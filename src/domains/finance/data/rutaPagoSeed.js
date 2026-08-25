/**
 * Semilla del plan de saneamiento de deudas ("Ruta de pago").
 *
 * Se escribe una sola vez en `finance_debt_plans/default` cuando el documento
 * no existe todavía — mismo patrón que `DEFAULT_CONFIG` con
 * `finance_settings/default` en el FinanceContext.
 *
 * Dos campos del plan NO se guardan porque se derivan (ver `rutaPagoHelpers.js`):
 *   - `libre`   = ingreso - gastos
 *   - `encurso` = el mes calendario actual
 */
export const RUTA_PAGO_SEED = {
    nombre: 'Plan de saneamiento',
    periodo: 'Agosto – Diciembre',
    moneda: 'COP',

    deudas: [
        { id: 'rappi',   nombre: 'Visa Rappi',       total: 1605000 },
        { id: 'mccop',   nombre: 'Mastercard COP',   total: 4320000 },
        { id: 'nequi',   nombre: 'Nequi',            total: 2942000 },
        { id: 'dahia',   nombre: 'Dahia (personal)', total: 5600000 },
        { id: 'mcusd',   nombre: 'Mastercard USD',   total: 9280000 },
        { id: 'visacop', nombre: 'Visa Bancolombia', total: 13000000 },
    ],

    meses: [
        {
            id: 'ago', nombre: 'Agosto', mes: '2026-08',
            lema: 'Limpieza de tres cabezas',
            ingreso: 18300000, gastos: 4780000,
            items: [
                { id: 'ago-vida',    tipo: 'vida',   nombre: 'Separar gastos de vida el día de cobro',   efecto: 'Incluye terapia humanista este mes',        monto: 4780000 },
                { id: 'ago-visacop', tipo: 'deuda',  deuda: 'visacop', nombre: 'Visa Bancolombia COP · cuota mínima', efecto: 'Saldo baja a $11.620.000',      monto: 1380000 },
                { id: 'ago-mcusd',   tipo: 'deuda',  deuda: 'mcusd',   nombre: 'Mastercard USD · cuota mínima',       efecto: 'US$260 · saldo baja a $8.448.000', monto: 832000 },
                { id: 'ago-rappi',   tipo: 'deuda',  deuda: 'rappi',   liquida: true, nombre: 'Visa Rappi · liquidar',                    efecto: '$1.000.000 mínimo + $605.000 remanente', monto: 1605000 },
                { id: 'ago-mccop',   tipo: 'deuda',  deuda: 'mccop',   liquida: true, nombre: 'Mastercard Bancolombia COP · liquidar',    efecto: '$3.550.000 mínimo + $770.000 remanente', monto: 4320000 },
                { id: 'ago-nequi',   tipo: 'deuda',  deuda: 'nequi',   liquida: true, nombre: 'Nequi · liquidar',                         efecto: 'Pago completo',                          monto: 2942000 },
                { id: 'ago-dahia',   tipo: 'deuda',  deuda: 'dahia',   nombre: 'Dahia · primer abono',                efecto: 'Quedan restando $3.600.000',   monto: 2000000 },
                { id: 'ago-caja',    tipo: 'ahorro', nombre: 'Dejar colchón en caja',                    efecto: 'No tocar',                     monto: 441000 },
            ],
        },
        {
            id: 'sep', nombre: 'Septiembre', mes: '2026-09',
            lema: 'Cerrar la deuda personal y golpear el dólar',
            ingreso: 14000000, gastos: 4560000,
            items: [
                { id: 'sep-vida',  tipo: 'vida',  nombre: 'Separar gastos de vida',            efecto: 'Mes sin terapia humanista', monto: 4560000 },
                { id: 'sep-dahia', tipo: 'deuda', deuda: 'dahia', liquida: true, nombre: 'Dahia · liquidar',  efecto: 'Saldo final', monto: 3600000 },
                { id: 'sep-mcusd', tipo: 'deuda', deuda: 'mcusd', nombre: 'Mastercard USD · abono grande',    efecto: '~US$1.825 · quedan ~US$815 ($2.608.000)', monto: 5840000 },
            ],
        },
        {
            id: 'oct', nombre: 'Octubre', mes: '2026-10',
            lema: 'Cerrar el dólar, atacar la Visa',
            ingreso: 14000000, gastos: 4780000,
            items: [
                { id: 'oct-vida',    tipo: 'vida',  nombre: 'Separar gastos de vida',          efecto: 'Incluye terapia humanista este mes', monto: 4780000 },
                { id: 'oct-mcusd',   tipo: 'deuda', deuda: 'mcusd',   liquida: true, nombre: 'Mastercard USD · liquidar', efecto: '~US$815 · verificar TRM del día', monto: 2608000 },
                { id: 'oct-visacop', tipo: 'deuda', deuda: 'visacop', nombre: 'Visa Bancolombia COP · abono grande',      efecto: 'Saldo baja a $5.008.000', monto: 6612000 },
            ],
        },
        {
            id: 'nov', nombre: 'Noviembre', mes: '2026-11',
            lema: 'Cero deudas',
            ingreso: 14000000, gastos: 4560000,
            items: [
                { id: 'nov-vida',    tipo: 'vida',   nombre: 'Separar gastos de vida',          efecto: 'Mes sin terapia humanista', monto: 4560000 },
                { id: 'nov-visacop', tipo: 'deuda',  deuda: 'visacop', liquida: true, nombre: 'Visa Bancolombia COP · liquidar', efecto: 'Última cabeza', monto: 5008000 },
                { id: 'nov-ahorro',  tipo: 'ahorro', nombre: 'Excedente al fondo de ahorro',    efecto: 'Primer aporte grande', monto: 4432000 },
            ],
        },
        {
            id: 'dic', nombre: 'Diciembre', mes: '2026-12',
            lema: 'Todo el excedente es tuyo',
            ingreso: 14000000, gastos: 4780000,
            items: [
                { id: 'dic-vida',   tipo: 'vida',   nombre: 'Separar gastos de vida',        efecto: 'Incluye terapia humanista este mes', monto: 4780000 },
                { id: 'dic-ahorro', tipo: 'ahorro', nombre: 'Excedente a ahorro o inversión', efecto: 'Sin contar prima ni bonos', monto: 9220000 },
            ],
        },
    ],

    done: {},
};

export default RUTA_PAGO_SEED;
