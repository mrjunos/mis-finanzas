import React, { useMemo, useState, lazy, Suspense } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../../../shared/utils/format';
import { computeRutaPago, mesActual } from '../utils/rutaPagoHelpers';
import { Icon, Card, Pill, Eyebrow, IconBtn } from '../../../shared/ds/Primitives';
import ConfirmModal from '../../../shared/components/ConfirmModal';

const RutaPagoModal = lazy(() => import('./RutaPagoModal'));

const DENSIDAD_KEY = 'ruta-pago-densidad';

// Los montos que no abonan a una deuda (vida, ahorro) se pintan en olive, el
// matiz que la app ya usa para ingreso/ahorro, para no competir con el clay.
const COLOR_FONDO = 'var(--olive-500)';

const mono = (size, weight = 500) => ({
    fontFamily: 'var(--font-mono)',
    fontSize: size,
    fontWeight: weight,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
});

export default function RutaPago({ onBack }) {
    const { rutaPago, toggleRutaPagoItem, saveRutaPago, resetRutaPagoMarcas } = useFinance();

    // `undefined` = el usuario todavía no ha plegado nada; se resuelve al mes
    // en curso en el primer render con plan.
    const [abierto, setAbierto] = useState(undefined);
    const [editando, setEditando] = useState(false);
    const [confirmandoReset, setConfirmandoReset] = useState(false);
    const [detalles, setDetalles] = useState(() => {
        try { return localStorage.getItem(DENSIDAD_KEY) !== 'compacto'; } catch { return true; }
    });

    const hoyMes = mesActual();
    const vista = useMemo(
        () => (rutaPago ? computeRutaPago(rutaPago, hoyMes) : null),
        [rutaPago, hoyMes]
    );

    const moneda = rutaPago?.moneda || 'COP';
    const fmt = (n) => formatCurrency(n, moneda);

    const toggleDensidad = () => {
        setDetalles((prev) => {
            const next = !prev;
            try { localStorage.setItem(DENSIDAD_KEY, next ? 'completo' : 'compacto'); } catch { /* no-op */ }
            return next;
        });
    };

    const header = (titulo, sub) => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '14px 16px 10px', position: 'sticky', top: 0, zIndex: 10,
            background: 'rgba(251,247,238,0.9)', backdropFilter: 'blur(16px)',
        }}>
            <IconBtn icon="arrow_back" tone="sunken" onClick={onBack} title="Volver" />
            {/* En pantallas angostas las acciones bajan a una segunda línea en
                vez de comerse el título. */}
            <div style={{ minWidth: 0, flex: '1 1 180px' }}>
                <Eyebrow style={{ marginBottom: 2 }}>Ruta de pago</Eyebrow>
                <div style={{
                    fontSize: 18, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {titulo}
                </div>
            </div>
            {sub}
        </div>
    );

    if (!vista) {
        return (
            <div className="animate-fade-up" style={{ minHeight: '100%' }}>
                {header('Plan de saneamiento', null)}
                <div style={{ padding: '24px 16px', color: 'var(--fg-3)', fontSize: 13 }}>
                    Cargando el plan…
                </div>
            </div>
        );
    }

    const { total, pagado, restante, pct, saldadas, deudas, meses } = vista;
    const libre = restante === 0 && total > 0;

    const mesEnCurso = meses.find((m) => m.encurso)?.id ?? null;
    const abiertoEfectivo = abierto === undefined ? mesEnCurso : abierto;
    const toggleMes = (id) => setAbierto(abiertoEfectivo === id ? null : id);

    return (
        <div className="animate-fade-up" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

            {header(rutaPago.nombre || 'Plan de saneamiento', (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                    <Pill variant={libre ? 'success' : 'clay'} style={{ ...mono(12, 600), padding: '5px 10px' }}>
                        {libre ? 'Sin deudas' : fmt(restante)}
                        <span style={{ ...mono(10), opacity: 0.7, marginLeft: 4 }}>{Math.round(pct)}%</span>
                    </Pill>
                    <IconBtn
                        icon={detalles ? 'unfold_less' : 'unfold_more'}
                        tone="ghost"
                        size={34}
                        onClick={toggleDensidad}
                        title={detalles ? 'Vista compacta' : 'Mostrar detalle'}
                    />
                    <IconBtn icon="edit" tone="sunken" size={34} onClick={() => setEditando(true)} title="Editar plan" />
                </div>
            ))}

            <div style={{
                maxWidth: 1000, width: '100%', margin: '0 auto',
                padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14,
            }}>

                {/* Resumen del plan */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
                        {rutaPago.periodo ? `${rutaPago.periodo} · ` : ''}
                        {saldadas} de {deudas.length} {deudas.length === 1 ? 'deuda saldada' : 'deudas saldadas'}
                    </span>
                    <span style={{ ...mono(11), color: 'var(--fg-3)' }}>
                        {fmt(pagado)} de {fmt(total)}
                    </span>
                </div>

                {/* Deudas */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 6 }}>
                    {deudas.map((d) => (
                        <Card key={d.id} variant="outlined" padding="8px 10px" style={{ borderRadius: 'var(--r-sm)' }}>
                            <span style={{
                                display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                color: 'var(--fg-1)', opacity: d.saldada ? 0.6 : 1,
                            }}>
                                {d.nombre}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginTop: 3 }}>
                                <span style={{ ...mono(13), color: d.saldada ? 'var(--success-500)' : 'var(--fg-1)' }}>
                                    {d.saldada ? 'SALDADA' : fmt(d.restante)}
                                </span>
                                <span style={{ ...mono(9.5), color: d.saldada ? 'var(--success-500)' : 'var(--fg-3)' }}>
                                    {Math.round(d.pct)}%
                                </span>
                            </div>
                        </Card>
                    ))}
                </section>

                {/* Meses */}
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8, alignItems: 'start' }}>
                    {meses.map((m) => {
                        const anillo = m.completo ? 'var(--success-500)' : 'var(--clay-500)';
                        const borde = m.completo
                            ? 'var(--success-500)'
                            : m.encurso ? 'var(--clay-500)' : 'var(--border-default)';
                        const desplegado = abiertoEfectivo === m.id;

                        return (
                            <Card
                                key={m.id}
                                variant="floating"
                                padding={0}
                                style={{ border: `1px solid ${borde}`, borderRadius: 'var(--r-md)', overflow: 'hidden' }}
                            >
                                {/* Cabecera plegable */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleMes(m.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMes(m.id); } }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', cursor: 'pointer',
                                        transition: 'background var(--dur-fast) var(--ease-out)',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        flex: '0 0 auto', width: 30, height: 30, borderRadius: 9999,
                                        display: 'grid', placeItems: 'center',
                                        background: `conic-gradient(${anillo} ${(m.pct * 3.6).toFixed(1)}deg, var(--bg-sunken) 0)`,
                                    }}>
                                        <span style={{
                                            width: 23, height: 23, borderRadius: 9999, background: 'var(--bg-raised)',
                                            display: 'grid', placeItems: 'center', ...mono(8, 700), color: anillo,
                                        }}>
                                            {Math.round(m.pct)}%
                                        </span>
                                    </div>

                                    <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                                        <h2 style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--fg-1)' }}>
                                            {m.nombre}
                                        </h2>
                                        {m.encurso && (
                                            <Pill variant="clay" style={{ fontSize: 8, letterSpacing: '0.14em', textTransform: 'uppercase', padding: '2px 5px' }}>
                                                En curso
                                            </Pill>
                                        )}
                                    </div>

                                    <span style={{ flex: '0 0 auto', ...mono(11), color: 'var(--fg-3)', textAlign: 'right' }}>
                                        <b style={{ color: anillo, fontWeight: 600 }}>{m.hechos}</b>/{m.total}
                                        <span style={{ display: 'block', ...mono(9.5), color: 'var(--fg-3)' }}>
                                            {m.completo ? 'completo' : `falta ${fmt(m.pendiente)}`}
                                        </span>
                                    </span>

                                    <Icon
                                        name="expand_more"
                                        size={16}
                                        color="var(--fg-3)"
                                        style={{
                                            flex: '0 0 auto',
                                            transition: 'transform var(--dur-normal) var(--ease-out)',
                                            transform: desplegado ? 'rotate(180deg)' : 'rotate(0deg)',
                                        }}
                                    />
                                </div>

                                {/* Cuerpo */}
                                {desplegado && (
                                    <div style={{ animation: 'fadeUp var(--dur-normal) var(--ease-out)' }}>
                                        <div style={{
                                            display: 'flex', gap: 10, padding: '7px 11px',
                                            background: 'var(--bg-sunken)',
                                            borderTop: '1px solid var(--border-subtle)',
                                            borderBottom: '1px solid var(--border-subtle)',
                                            ...mono(9.5), color: 'var(--fg-3)',
                                        }}>
                                            {[['Ingreso', m.ingreso], ['Gastos', m.gastos], ['Disponible', m.libre]].map(([label, valor]) => (
                                                <span key={label} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    {label}
                                                    <b style={{ display: 'block', color: 'var(--fg-1)', ...mono(11), marginTop: 1 }}>
                                                        {fmt(valor)}
                                                    </b>
                                                </span>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            {m.items.map((it) => {
                                                const esFondo = it.tipo === 'vida' || it.tipo === 'ahorro';
                                                return (
                                                    <div
                                                        key={it.id}
                                                        role="checkbox"
                                                        aria-checked={it.marcado}
                                                        tabIndex={0}
                                                        onClick={() => toggleRutaPagoItem(it.id, !it.marcado)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRutaPagoItem(it.id, !it.marcado); } }}
                                                        style={{
                                                            display: 'flex', alignItems: 'flex-start', gap: 9, padding: '8px 11px',
                                                            cursor: 'pointer', borderTop: '1px solid var(--border-subtle)',
                                                            transition: 'background var(--dur-fast) var(--ease-out)',
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-sunken)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <span style={{
                                                            flex: '0 0 auto', width: 17, height: 17, marginTop: 1,
                                                            borderRadius: 5, display: 'grid', placeItems: 'center',
                                                            fontSize: 10, fontWeight: 700,
                                                            transition: 'all var(--dur-normal) var(--ease-out)',
                                                            border: `1.5px solid ${it.marcado ? 'var(--success-500)' : 'var(--border-strong)'}`,
                                                            background: it.marcado ? 'var(--success-500)' : 'transparent',
                                                            color: it.marcado ? 'var(--bg-raised)' : 'var(--fg-3)',
                                                        }}>
                                                            {it.marcado ? '✓' : ''}
                                                        </span>

                                                        <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                                                            <span style={{
                                                                display: 'block', fontSize: 12, fontWeight: 500, letterSpacing: '-0.01em',
                                                                lineHeight: 1.3, color: 'var(--fg-1)',
                                                                opacity: it.marcado ? 0.55 : 1,
                                                                textDecoration: it.marcado ? 'line-through' : 'none',
                                                                textDecorationColor: 'var(--fg-3)',
                                                            }}>
                                                                {it.nombre}
                                                            </span>
                                                            {detalles && it.efecto && (
                                                                <span style={{
                                                                    display: 'block', fontSize: 10.5, color: 'var(--fg-3)',
                                                                    marginTop: 1, lineHeight: 1.3, opacity: it.marcado ? 0.55 : 1,
                                                                }}>
                                                                    {it.efecto}
                                                                </span>
                                                            )}
                                                        </span>

                                                        <span style={{
                                                            flex: '0 0 auto', ...mono(11.5), textAlign: 'right',
                                                            color: it.marcado ? 'var(--success-500)' : (esFondo ? COLOR_FONDO : 'var(--fg-1)'),
                                                        }}>
                                                            {fmt(it.monto)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </section>

                {/* Pie */}
                <footer style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 14, flexWrap: 'wrap', paddingTop: 4,
                }}>
                    <p style={{ ...mono(10.5), color: 'var(--fg-3)', margin: 0 }}>
                        Las marcas se sincronizan en todos tus dispositivos.
                    </p>
                    <button
                        type="button"
                        onClick={() => setConfirmandoReset(true)}
                        style={{
                            background: 'none', color: 'var(--fg-3)',
                            border: '1px solid var(--border-default)', borderRadius: 9999,
                            padding: '8px 14px', cursor: 'pointer',
                            ...mono(10.5), letterSpacing: '0.12em', textTransform: 'uppercase',
                            transition: 'color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fg-1)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fg-3)'; e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                        Reiniciar marcas
                    </button>
                </footer>
            </div>

            <ConfirmModal
                isOpen={confirmandoReset}
                onClose={() => setConfirmandoReset(false)}
                onConfirm={() => { resetRutaPagoMarcas(); setConfirmandoReset(false); }}
                title="¿Reiniciar todas las marcas?"
                message="Se desmarcarán los pagos de todos los meses. El plan y los montos no cambian."
                confirmText="Reiniciar"
                isDestructive
            />

            {editando && (
                <Suspense fallback={null}>
                    <RutaPagoModal
                        isOpen={editando}
                        onClose={() => setEditando(false)}
                        plan={rutaPago}
                        onSave={saveRutaPago}
                    />
                </Suspense>
            )}
        </div>
    );
}
