/**
 * Matemática pura del plan de saneamiento ("Ruta de pago").
 *
 * Vive aparte de la vista para poder testearla sin React ni Firestore, igual
 * que `financeHelpers.js`.
 */

/** Devuelve 'YYYY-MM' para una fecha dada (por defecto, hoy). */
export const mesActual = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

/** Suma de los ítems ya marcados que abonan a una deuda concreta. */
export const pagadoDeDeuda = (plan, deudaId) => {
    const done = plan?.done || {};
    let total = 0;
    (plan?.meses || []).forEach((mes) => {
        (mes.items || []).forEach((item) => {
            if (item.deuda === deudaId && done[item.id]) total += Number(item.monto) || 0;
        });
    });
    return total;
};

/** Conjunto de todos los IDs de ítem que existen hoy en el plan. */
export const idsDeItems = (plan) => {
    const ids = new Set();
    (plan?.meses || []).forEach((mes) => {
        (mes.items || []).forEach((item) => ids.add(item.id));
    });
    return ids;
};

/**
 * Elimina de `done` las marcas de ítems que ya no existen en el plan, para que
 * borrar un ítem o una deuda no deje basura acumulándose en el documento.
 */
export const podarMarcas = (plan) => {
    const ids = idsDeItems(plan);
    const done = {};
    Object.keys(plan?.done || {}).forEach((id) => {
        if (ids.has(id)) done[id] = true;
    });
    return done;
};

/**
 * Deriva todo lo que la vista necesita pintar a partir del plan crudo.
 *
 * @param {object} plan   Documento de `finance_debt_plans/default`.
 * @param {string} hoyMes Mes actual en formato 'YYYY-MM' (inyectable para tests).
 */
export const computeRutaPago = (plan, hoyMes = mesActual()) => {
    const done = plan?.done || {};
    const deudasRaw = plan?.deudas || [];
    const mesesRaw = plan?.meses || [];

    let total = 0;
    let restante = 0;
    let saldadas = 0;

    const deudas = deudasRaw.map((d) => {
        const bruto = Number(d.total) || 0;
        const pagadoDeuda = Math.min(bruto, pagadoDeDeuda(plan, d.id));
        const queda = bruto - pagadoDeuda;
        const saldada = queda === 0 && bruto > 0;

        total += bruto;
        restante += queda;
        if (saldada) saldadas += 1;

        return {
            id: d.id,
            nombre: d.nombre,
            total: bruto,
            pagado: pagadoDeuda,
            restante: queda,
            pct: bruto > 0 ? (pagadoDeuda / bruto) * 100 : 0,
            saldada,
        };
    });

    const meses = mesesRaw.map((m) => {
        const items = m.items || [];
        let hechos = 0;
        let pendiente = 0;

        const itemsOut = items.map((it) => {
            const marcado = !!done[it.id];
            if (marcado) hechos += 1;
            else pendiente += Number(it.monto) || 0;
            return {
                id: it.id,
                nombre: it.nombre,
                efecto: it.efecto || '',
                monto: Number(it.monto) || 0,
                tipo: it.tipo || 'deuda',
                deuda: it.deuda || null,
                liquida: !!it.liquida,
                marcado,
            };
        });

        const ingreso = Number(m.ingreso) || 0;
        const gastos = Number(m.gastos) || 0;

        return {
            id: m.id,
            nombre: m.nombre,
            mes: m.mes || '',
            lema: m.lema || '',
            ingreso,
            gastos,
            libre: ingreso - gastos,
            encurso: !!m.mes && m.mes === hoyMes,
            hechos,
            total: items.length,
            pct: items.length > 0 ? (hechos / items.length) * 100 : 0,
            pendiente,
            completo: items.length > 0 && hechos === items.length,
            items: itemsOut,
        };
    });

    const pagado = total - restante;

    return {
        total,
        pagado,
        restante,
        pct: total > 0 ? (pagado / total) * 100 : 0,
        saldadas,
        deudas,
        meses,
    };
};
