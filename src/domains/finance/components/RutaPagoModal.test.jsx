import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RutaPagoModal from './RutaPagoModal';

const planBase = () => ({
    nombre: 'Plan de saneamiento',
    periodo: 'Agosto – Diciembre',
    moneda: 'COP',
    deudas: [
        { id: 'nequi', nombre: 'Nequi', total: 2942000 },
        { id: 'rappi', nombre: 'Visa Rappi', total: 1605000 },
    ],
    meses: [{
        id: 'ago', nombre: 'Agosto', mes: '2026-08', lema: '', ingreso: 18300000, gastos: 4780000,
        items: [
            { id: 'ago-nequi', nombre: 'Nequi · liquidar', efecto: 'Pago completo', monto: 2942000, tipo: 'deuda', deuda: 'nequi', liquida: true },
            { id: 'ago-vida', nombre: 'Gastos de vida', efecto: '', monto: 4780000, tipo: 'vida', deuda: null, liquida: false },
        ],
    }],
    done: { 'ago-nequi': true },
});

const abrir = (onSave = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) => {
    render(<RutaPagoModal isOpen onClose={onClose} plan={planBase()} onSave={onSave} />);
    return { onSave, onClose };
};

const guardar = async () => {
    await act(async () => { fireEvent.click(screen.getByText('Guardar plan')); });
};

describe('RutaPagoModal', () => {
    beforeEach(() => vi.clearAllMocks());

    it('no renderiza nada cuando está cerrado', () => {
        const { container } = render(<RutaPagoModal isOpen={false} onClose={vi.fn()} plan={planBase()} onSave={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('arranca en la pestaña de deudas y las lista', () => {
        abrir();
        expect(screen.getByDisplayValue('Nequi')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Visa Rappi')).toBeInTheDocument();
        expect(screen.getByText('Deudas (2)')).toBeInTheDocument();
        expect(screen.getByText('Meses (1)')).toBeInTheDocument();
    });

    it('guarda los montos como números, no como texto', async () => {
        const { onSave } = abrir();

        fireEvent.change(screen.getByDisplayValue('2942000'), { target: { value: '3000000' } });
        await guardar();

        const payload = onSave.mock.calls[0][0];
        expect(payload.deudas.find(d => d.id === 'nequi').total).toBe(3000000);
        expect(payload.meses[0].ingreso).toBe(18300000);
    });

    it('cierra el modal después de guardar', async () => {
        const { onClose } = abrir();
        await guardar();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('no cierra el modal si el guardado falla', async () => {
        const onSave = vi.fn().mockRejectedValue(new Error('boom'));
        const onClose = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<RutaPagoModal isOpen onClose={onClose} plan={planBase()} onSave={onSave} />);

        await guardar();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('agrega una deuda nueva con id propio', async () => {
        const { onSave } = abrir();

        fireEvent.click(screen.getByText('Agregar deuda'));
        await guardar();

        const payload = onSave.mock.calls[0][0];
        expect(payload.deudas).toHaveLength(3);
        expect(payload.deudas[2].id).toBeTruthy();
        expect(payload.deudas[2].id).not.toBe(payload.deudas[0].id);
    });

    it('al borrar una deuda reasigna sus pagos en vez de dejar referencias colgando', async () => {
        const { onSave } = abrir();

        fireEvent.click(screen.getByRole('button', { name: 'Eliminar Nequi' }));
        await guardar();

        const payload = onSave.mock.calls[0][0];
        expect(payload.deudas.map(d => d.id)).toEqual(['rappi']);
        const item = payload.meses[0].items.find(i => i.id === 'ago-nequi');
        expect(item.deuda).toBeNull();
        expect(item.tipo).toBe('vida');
    });

    it('permite editar los ítems del mes seleccionado', async () => {
        const { onSave } = abrir();

        fireEvent.click(screen.getByText('Meses (1)'));
        fireEvent.change(screen.getByDisplayValue('Nequi · liquidar'), { target: { value: 'Nequi · pago final' } });
        await guardar();

        expect(onSave.mock.calls[0][0].meses[0].items[0].nombre).toBe('Nequi · pago final');
    });

    it('limpia deuda y liquida cuando el ítem deja de ser un pago a deuda', async () => {
        const { onSave } = abrir();

        fireEvent.click(screen.getByText('Meses (1)'));
        const selects = screen.getAllByRole('combobox');
        // El primer select de tipo corresponde al primer ítem
        fireEvent.change(selects[0], { target: { value: 'ahorro' } });
        await guardar();

        const item = onSave.mock.calls[0][0].meses[0].items[0];
        expect(item.tipo).toBe('ahorro');
        expect(item.deuda).toBeNull();
        expect(item.liquida).toBe(false);
    });

    it('conserva las marcas existentes en el borrador', async () => {
        const { onSave } = abrir();
        await guardar();
        expect(onSave.mock.calls[0][0].done).toEqual({ 'ago-nequi': true });
    });
});
