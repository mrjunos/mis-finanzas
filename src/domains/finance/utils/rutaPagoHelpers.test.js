import { describe, it, expect } from 'vitest';
import {
    mesActual,
    pagadoDeDeuda,
    idsDeItems,
    podarMarcas,
    computeRutaPago,
} from './rutaPagoHelpers';
import { RUTA_PAGO_SEED } from '../data/rutaPagoSeed';

const planBase = () => JSON.parse(JSON.stringify(RUTA_PAGO_SEED));

const conMarcas = (...ids) => {
    const plan = planBase();
    ids.forEach(id => { plan.done[id] = true; });
    return plan;
};

describe('mesActual', () => {
    it('formatea como YYYY-MM con cero a la izquierda', () => {
        expect(mesActual(new Date(2026, 7, 25))).toBe('2026-08');
        expect(mesActual(new Date(2026, 11, 1))).toBe('2026-12');
    });
});

describe('pagadoDeDeuda', () => {
    it('devuelve 0 cuando no hay nada marcado', () => {
        expect(pagadoDeDeuda(planBase(), 'mcusd')).toBe(0);
    });

    it('suma solo los ítems marcados de esa deuda', () => {
        // ago-mcusd (832.000) marcado, sep-mcusd (5.840.000) no
        const plan = conMarcas('ago-mcusd', 'ago-nequi');
        expect(pagadoDeDeuda(plan, 'mcusd')).toBe(832000);
        expect(pagadoDeDeuda(plan, 'nequi')).toBe(2942000);
    });

    it('acumula a través de varios meses', () => {
        const plan = conMarcas('ago-mcusd', 'sep-mcusd', 'oct-mcusd');
        expect(pagadoDeDeuda(plan, 'mcusd')).toBe(832000 + 5840000 + 2608000);
    });

    it('ignora ítems de vida y ahorro (no tienen deuda asociada)', () => {
        const plan = conMarcas('ago-vida', 'ago-caja');
        expect(pagadoDeDeuda(plan, 'rappi')).toBe(0);
    });

    it('tolera un plan vacío o sin done', () => {
        expect(pagadoDeDeuda({}, 'rappi')).toBe(0);
        expect(pagadoDeDeuda(null, 'rappi')).toBe(0);
    });
});

describe('idsDeItems / podarMarcas', () => {
    it('recoge los IDs de todos los meses', () => {
        const ids = idsDeItems(planBase());
        expect(ids.size).toBe(19);
        expect(ids.has('ago-vida')).toBe(true);
        expect(ids.has('dic-ahorro')).toBe(true);
    });

    it('descarta las marcas de ítems que ya no existen', () => {
        const plan = conMarcas('ago-nequi', 'item-borrado');
        expect(podarMarcas(plan)).toEqual({ 'ago-nequi': true });
    });

    it('conserva intactas las marcas válidas', () => {
        const plan = conMarcas('ago-nequi', 'sep-dahia');
        expect(podarMarcas(plan)).toEqual({ 'ago-nequi': true, 'sep-dahia': true });
    });
});

describe('computeRutaPago', () => {
    it('parte del total completo cuando no hay nada marcado', () => {
        const r = computeRutaPago(planBase(), '2026-08');
        expect(r.total).toBe(36747000);
        expect(r.restante).toBe(36747000);
        expect(r.pagado).toBe(0);
        expect(r.pct).toBe(0);
        expect(r.saldadas).toBe(0);
    });

    it('marca una deuda como saldada al completar su liquidación', () => {
        const r = computeRutaPago(conMarcas('ago-nequi'), '2026-08');
        const nequi = r.deudas.find(d => d.id === 'nequi');
        expect(nequi.saldada).toBe(true);
        expect(nequi.restante).toBe(0);
        expect(nequi.pct).toBe(100);
        expect(r.saldadas).toBe(1);
        expect(r.restante).toBe(36747000 - 2942000);
    });

    it('refleja un abono parcial sin dar la deuda por saldada', () => {
        const r = computeRutaPago(conMarcas('ago-dahia'), '2026-08');
        const dahia = r.deudas.find(d => d.id === 'dahia');
        expect(dahia.saldada).toBe(false);
        expect(dahia.pagado).toBe(2000000);
        expect(dahia.restante).toBe(3600000);
    });

    it('nunca deja el restante en negativo si lo pagado excede el total', () => {
        const plan = planBase();
        plan.deudas.find(d => d.id === 'nequi').total = 1000000;
        plan.done['ago-nequi'] = true; // 2.942.000 sobre una deuda de 1.000.000
        const nequi = computeRutaPago(plan, '2026-08').deudas.find(d => d.id === 'nequi');
        expect(nequi.pagado).toBe(1000000);
        expect(nequi.restante).toBe(0);
    });

    it('deriva `libre` como ingreso menos gastos', () => {
        const { meses } = computeRutaPago(planBase(), '2026-08');
        expect(meses.map(m => m.libre)).toEqual([13520000, 9440000, 9220000, 9440000, 9220000]);
    });

    it('marca `encurso` solo en el mes calendario actual', () => {
        const oct = computeRutaPago(planBase(), '2026-10').meses;
        expect(oct.filter(m => m.encurso).map(m => m.id)).toEqual(['oct']);
    });

    it('no marca ningún mes en curso fuera del rango del plan', () => {
        const r = computeRutaPago(planBase(), '2027-03');
        expect(r.meses.some(m => m.encurso)).toBe(false);
    });

    it('calcula avance y pendiente por mes', () => {
        const r = computeRutaPago(conMarcas('dic-vida'), '2026-08');
        const dic = r.meses.find(m => m.id === 'dic');
        expect(dic.hechos).toBe(1);
        expect(dic.total).toBe(2);
        expect(dic.pct).toBe(50);
        expect(dic.pendiente).toBe(9220000);
        expect(dic.completo).toBe(false);
    });

    it('da un mes por completo cuando todos sus ítems están marcados', () => {
        const dic = computeRutaPago(conMarcas('dic-vida', 'dic-ahorro'), '2026-08')
            .meses.find(m => m.id === 'dic');
        expect(dic.completo).toBe(true);
        expect(dic.pendiente).toBe(0);
        expect(dic.pct).toBe(100);
    });

    it('deja el plan en cero al recorrer todos los ítems de deuda', () => {
        const plan = planBase();
        plan.meses.forEach(m => m.items.forEach(it => { plan.done[it.id] = true; }));
        const r = computeRutaPago(plan, '2026-12');
        expect(r.restante).toBe(0);
        expect(r.pct).toBe(100);
        expect(r.saldadas).toBe(6);
    });

    it('propaga el tipo, la deuda y el flag de liquidación a cada ítem', () => {
        const ago = computeRutaPago(planBase(), '2026-08').meses[0];
        const rappi = ago.items.find(i => i.id === 'ago-rappi');
        expect(rappi).toMatchObject({ tipo: 'deuda', deuda: 'rappi', liquida: true, marcado: false });
        const vida = ago.items.find(i => i.id === 'ago-vida');
        expect(vida).toMatchObject({ tipo: 'vida', deuda: null, liquida: false });
    });

    it('sobrevive a un plan vacío', () => {
        const r = computeRutaPago({}, '2026-08');
        expect(r).toMatchObject({ total: 0, pagado: 0, restante: 0, pct: 0, saldadas: 0 });
        expect(r.deudas).toEqual([]);
        expect(r.meses).toEqual([]);
    });
});
