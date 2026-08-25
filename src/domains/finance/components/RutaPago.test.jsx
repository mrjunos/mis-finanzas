import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RutaPago from './RutaPago';
import { RUTA_PAGO_SEED } from '../data/rutaPagoSeed';

const toggleRutaPagoItem = vi.fn();
const saveRutaPago = vi.fn();
const resetRutaPagoMarcas = vi.fn();
let planActual;

vi.mock('../context/FinanceContext', () => ({
    useFinance: () => ({
        rutaPago: planActual,
        toggleRutaPagoItem,
        saveRutaPago,
        resetRutaPagoMarcas,
    }),
}));

const plan = (done = {}) => ({ ...JSON.parse(JSON.stringify(RUTA_PAGO_SEED)), done });

describe('RutaPago', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        // Agosto 2026 es el mes en curso del plan sembrado: fijamos el reloj ahí
        // para que `encurso` no dependa de cuándo se corran los tests.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date(2026, 7, 25, 12, 0, 0));
        planActual = plan();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('muestra un estado de carga mientras el plan no llega', () => {
        planActual = null;
        render(<RutaPago onBack={vi.fn()} />);
        expect(screen.getByText('Cargando el plan…')).toBeInTheDocument();
    });

    it('pinta una tarjeta por deuda con su saldo restante', () => {
        render(<RutaPago onBack={vi.fn()} />);

        expect(screen.getByText('Visa Rappi')).toBeInTheDocument();
        expect(screen.getByText('Visa Bancolombia')).toBeInTheDocument();
        expect(screen.queryByText('SALDADA')).not.toBeInTheDocument();
        expect(screen.getByText(/0 de 6 deudas saldadas/)).toBeInTheDocument();
    });

    it('marca como SALDADA la deuda cuyo pago de liquidación está hecho', () => {
        planActual = plan({ 'ago-nequi': true });
        render(<RutaPago onBack={vi.fn()} />);

        expect(screen.getByText('SALDADA')).toBeInTheDocument();
        expect(screen.getByText(/1 de 6 deudas saldadas/)).toBeInTheDocument();
    });

    it('abre por defecto el mes en curso y lo etiqueta', () => {
        render(<RutaPago onBack={vi.fn()} />);

        expect(screen.getByText('En curso')).toBeInTheDocument();
        // Los ítems de agosto están visibles; los de diciembre, no
        expect(screen.getByText('Visa Rappi · liquidar')).toBeInTheDocument();
        expect(screen.queryByText('Excedente a ahorro o inversión')).not.toBeInTheDocument();
    });

    it('pliega el mes abierto al hacer clic en su cabecera', () => {
        render(<RutaPago onBack={vi.fn()} />);

        fireEvent.click(screen.getByRole('heading', { name: 'Agosto' }));
        expect(screen.queryByText('Visa Rappi · liquidar')).not.toBeInTheDocument();
    });

    it('despliega otro mes al hacer clic en él', () => {
        render(<RutaPago onBack={vi.fn()} />);

        fireEvent.click(screen.getByRole('heading', { name: 'Diciembre' }));
        expect(screen.getByText('Excedente a ahorro o inversión')).toBeInTheDocument();
        // …y el que estaba abierto se cierra
        expect(screen.queryByText('Visa Rappi · liquidar')).not.toBeInTheDocument();
    });

    it('marca un ítem pidiendo el estado siguiente', () => {
        render(<RutaPago onBack={vi.fn()} />);

        fireEvent.click(screen.getByText('Nequi · liquidar'));
        expect(toggleRutaPagoItem).toHaveBeenCalledWith('ago-nequi', true);
    });

    it('desmarca un ítem que ya estaba hecho', () => {
        planActual = plan({ 'ago-nequi': true });
        render(<RutaPago onBack={vi.fn()} />);

        fireEvent.click(screen.getByText('Nequi · liquidar'));
        expect(toggleRutaPagoItem).toHaveBeenCalledWith('ago-nequi', false);
    });

    it('muestra el disponible derivado de ingreso menos gastos', () => {
        render(<RutaPago onBack={vi.fn()} />);

        expect(screen.getByText('Disponible')).toBeInTheDocument();
        // 18.300.000 − 4.780.000 = 13.520.000
        expect(screen.getByText(/13\.520\.000/)).toBeInTheDocument();
    });

    it('pide confirmación antes de reiniciar las marcas', () => {
        render(<RutaPago onBack={vi.fn()} />);

        fireEvent.click(screen.getByText('Reiniciar marcas'));
        expect(resetRutaPagoMarcas).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Reiniciar'));
        expect(resetRutaPagoMarcas).toHaveBeenCalledTimes(1);
    });

    it('vuelve atrás con el botón de la cabecera', () => {
        const onBack = vi.fn();
        render(<RutaPago onBack={onBack} />);

        fireEvent.click(screen.getByTitle('Volver'));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('oculta la línea de efecto en vista compacta y lo recuerda', () => {
        const { unmount } = render(<RutaPago onBack={vi.fn()} />);

        expect(screen.getByText('Pago completo')).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Vista compacta'));
        expect(screen.queryByText('Pago completo')).not.toBeInTheDocument();

        unmount();
        render(<RutaPago onBack={vi.fn()} />);
        expect(screen.queryByText('Pago completo')).not.toBeInTheDocument();
    });

    it('celebra el plan terminado cuando no queda deuda', () => {
        const done = {};
        RUTA_PAGO_SEED.meses.forEach(m => m.items.forEach(it => { done[it.id] = true; }));
        planActual = plan(done);

        render(<RutaPago onBack={vi.fn()} />);
        expect(screen.getByText('Sin deudas')).toBeInTheDocument();
        expect(screen.getByText(/6 de 6 deudas saldadas/)).toBeInTheDocument();
    });
});
