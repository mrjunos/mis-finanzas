import React, { useState, useMemo } from 'react';
import { Icon, Field, Segmented, Pill } from '../../../shared/ds/Primitives';

const INPUT_STYLE = {
    width: '100%', padding: '10px 14px',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--r-lg)',
    fontFamily: 'var(--font-sans)', fontSize: 14,
    color: 'var(--fg-1)', outline: 'none',
    boxSizing: 'border-box',
};

const MONEY_STYLE = { ...INPUT_STYLE, fontFamily: 'var(--font-mono)', fontWeight: 600 };
const SMALL_STYLE = { ...INPUT_STYLE, padding: '8px 11px', fontSize: 13, borderRadius: 'var(--r-md)' };

const TIPOS = [
    { value: 'deuda', label: 'Pago a deuda' },
    { value: 'vida', label: 'Gastos de vida' },
    { value: 'ahorro', label: 'Ahorro' },
];

const nuevoId = () => (
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `id-${Math.random().toString(36).slice(2, 10)}`
);

// Botón de texto discreto, reutilizado para "agregar" y "eliminar".
const LinkBtn = ({ icon, children, onClick, label, tone = 'var(--clay-600)' }) => (
    <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label || undefined}
        style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: tone, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
        }}
    >
        <Icon name={icon} size={15} />
        {children}
    </button>
);

const Bloque = ({ children }) => (
    <div style={{
        border: '1px solid var(--border-default)', borderRadius: 'var(--r-lg)',
        padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
        {children}
    </div>
);

export default function RutaPagoModal({ isOpen, onClose, plan, onSave }) {
    const [tab, setTab] = useState('deudas');
    const [guardando, setGuardando] = useState(false);
    const [borrador, setBorrador] = useState(() => ({
        nombre: plan?.nombre || 'Plan de saneamiento',
        periodo: plan?.periodo || '',
        moneda: plan?.moneda || 'COP',
        deudas: JSON.parse(JSON.stringify(plan?.deudas || [])),
        meses: JSON.parse(JSON.stringify(plan?.meses || [])),
        done: { ...(plan?.done || {}) },
    }));
    const [mesSel, setMesSel] = useState(() => plan?.meses?.[0]?.id || null);

    const mesActivo = useMemo(
        () => borrador.meses.find((m) => m.id === mesSel) || null,
        [borrador.meses, mesSel]
    );

    if (!isOpen) return null;

    const patch = (campos) => setBorrador((b) => ({ ...b, ...campos }));

    // --- Deudas ---
    const patchDeuda = (id, campos) => patch({
        deudas: borrador.deudas.map((d) => (d.id === id ? { ...d, ...campos } : d)),
    });

    const addDeuda = () => patch({
        deudas: [...borrador.deudas, { id: nuevoId(), nombre: '', total: 0 }],
    });

    // Al borrar una deuda, los ítems que le abonaban quedan sin destino: pasan a
    // gastos de vida para no dejar referencias colgando.
    const delDeuda = (id) => patch({
        deudas: borrador.deudas.filter((d) => d.id !== id),
        meses: borrador.meses.map((m) => ({
            ...m,
            items: m.items.map((it) => (it.deuda === id ? { ...it, deuda: null, tipo: 'vida' } : it)),
        })),
    });

    // --- Meses ---
    const patchMes = (id, campos) => patch({
        meses: borrador.meses.map((m) => (m.id === id ? { ...m, ...campos } : m)),
    });

    const addMes = () => {
        const id = nuevoId();
        patch({ meses: [...borrador.meses, { id, nombre: '', mes: '', lema: '', ingreso: 0, gastos: 0, items: [] }] });
        setMesSel(id);
    };

    const delMes = (id) => {
        const restantes = borrador.meses.filter((m) => m.id !== id);
        patch({ meses: restantes });
        setMesSel(restantes[0]?.id || null);
    };

    // --- Ítems ---
    const patchItem = (mesId, itemId, campos) => patch({
        meses: borrador.meses.map((m) => (m.id !== mesId ? m : {
            ...m,
            items: m.items.map((it) => (it.id === itemId ? { ...it, ...campos } : it)),
        })),
    });

    const addItem = (mesId) => patch({
        meses: borrador.meses.map((m) => (m.id !== mesId ? m : {
            ...m,
            items: [...m.items, { id: nuevoId(), nombre: '', efecto: '', monto: 0, tipo: 'vida', deuda: null, liquida: false }],
        })),
    });

    const delItem = (mesId, itemId) => patch({
        meses: borrador.meses.map((m) => (m.id !== mesId ? m : {
            ...m,
            items: m.items.filter((it) => it.id !== itemId),
        })),
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await onSave({
                ...borrador,
                deudas: borrador.deudas.map((d) => ({ ...d, total: Number(d.total) || 0 })),
                meses: borrador.meses.map((m) => ({
                    ...m,
                    ingreso: Number(m.ingreso) || 0,
                    gastos: Number(m.gastos) || 0,
                    items: m.items.map((it) => ({
                        ...it,
                        monto: Number(it.monto) || 0,
                        deuda: it.tipo === 'deuda' ? (it.deuda || null) : null,
                        liquida: it.tipo === 'deuda' ? !!it.liquida : false,
                    })),
                })),
            });
            onClose();
        } catch (error) {
            console.error("Error saving ruta de pago:", error);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)' }}
                onClick={onClose}
            />
            <div style={{
                position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 91,
                background: 'var(--bg-raised)',
                borderTopLeftRadius: 28, borderTopRightRadius: 28,
                boxShadow: 'var(--shadow-xl)',
                animation: 'sheetIn var(--dur-slow) var(--ease-out)',
                maxHeight: '90dvh',
                display: 'flex', flexDirection: 'column',
            }}>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)' }} />
                </div>

                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
                            Editar ruta de pago
                        </h2>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>
                            Deudas, meses y pagos del plan
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: 'var(--bg-sunken)', color: 'var(--fg-3)',
                        }}
                    >
                        <Icon name="close" size={18} />
                    </button>
                </div>

                <form
                    onSubmit={handleSubmit}
                    style={{ padding: '16px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}
                >
                    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                        <Field label="Nombre del plan">
                            <input value={borrador.nombre} onChange={e => patch({ nombre: e.target.value })} style={INPUT_STYLE} />
                        </Field>
                        <Field label="Periodo" optional>
                            <input value={borrador.periodo} placeholder="Agosto – Diciembre" onChange={e => patch({ periodo: e.target.value })} style={INPUT_STYLE} />
                        </Field>
                    </div>

                    <Segmented
                        size="sm"
                        value={tab}
                        onChange={setTab}
                        options={[
                            { value: 'deudas', label: `Deudas (${borrador.deudas.length})` },
                            { value: 'meses', label: `Meses (${borrador.meses.length})` },
                        ]}
                    />

                    {/* ── Deudas ── */}
                    {tab === 'deudas' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {borrador.deudas.length === 0 && (
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)' }}>Todavía no hay deudas en el plan.</p>
                            )}
                            {borrador.deudas.map((d) => (
                                <Bloque key={d.id}>
                                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1.6fr 1fr auto', alignItems: 'center' }}>
                                        <input
                                            value={d.nombre}
                                            placeholder="Nombre de la deuda"
                                            onChange={e => patchDeuda(d.id, { nombre: e.target.value })}
                                            style={SMALL_STYLE}
                                        />
                                        <input
                                            type="number"
                                            value={d.total}
                                            placeholder="0"
                                            onChange={e => patchDeuda(d.id, { total: e.target.value })}
                                            style={{ ...SMALL_STYLE, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                                        />
                                        <LinkBtn icon="delete" tone="var(--danger-700)" label={`Eliminar ${d.nombre || 'deuda'}`} onClick={() => delDeuda(d.id)} />
                                    </div>
                                </Bloque>
                            ))}
                            <LinkBtn icon="add" onClick={addDeuda}>Agregar deuda</LinkBtn>
                        </div>
                    )}

                    {/* ── Meses ── */}
                    {tab === 'meses' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {borrador.meses.map((m) => (
                                    <Pill
                                        key={m.id}
                                        variant={m.id === mesSel ? 'clay' : 'outline'}
                                        onClick={() => setMesSel(m.id)}
                                    >
                                        {m.nombre || 'Sin nombre'}
                                    </Pill>
                                ))}
                                <LinkBtn icon="add" onClick={addMes}>Agregar mes</LinkBtn>
                            </div>

                            {!mesActivo && (
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-3)' }}>Elige un mes para editarlo.</p>
                            )}

                            {mesActivo && (
                                <>
                                    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
                                        <Field label="Mes">
                                            <input
                                                value={mesActivo.nombre}
                                                placeholder="Agosto"
                                                onChange={e => patchMes(mesActivo.id, { nombre: e.target.value })}
                                                style={SMALL_STYLE}
                                            />
                                        </Field>
                                        <Field label="Periodo (YYYY-MM)">
                                            <input
                                                type="month"
                                                value={mesActivo.mes || ''}
                                                onChange={e => patchMes(mesActivo.id, { mes: e.target.value })}
                                                style={{ ...SMALL_STYLE, fontFamily: 'var(--font-mono)' }}
                                            />
                                        </Field>
                                        <Field label="Ingreso">
                                            <input
                                                type="number"
                                                value={mesActivo.ingreso}
                                                onChange={e => patchMes(mesActivo.id, { ingreso: e.target.value })}
                                                style={{ ...SMALL_STYLE, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                                            />
                                        </Field>
                                        <Field label="Gastos de vida">
                                            <input
                                                type="number"
                                                value={mesActivo.gastos}
                                                onChange={e => patchMes(mesActivo.id, { gastos: e.target.value })}
                                                style={{ ...SMALL_STYLE, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                                            />
                                        </Field>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {mesActivo.items.map((it) => (
                                            <Bloque key={it.id}>
                                                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                                                    <input
                                                        value={it.nombre}
                                                        placeholder="Nombre del pago"
                                                        onChange={e => patchItem(mesActivo.id, it.id, { nombre: e.target.value })}
                                                        style={SMALL_STYLE}
                                                    />
                                                    <LinkBtn icon="delete" tone="var(--danger-700)" label={`Eliminar ${it.nombre || 'pago'}`} onClick={() => delItem(mesActivo.id, it.id)} />
                                                </div>
                                                <input
                                                    value={it.efecto || ''}
                                                    placeholder="Efecto (opcional)"
                                                    onChange={e => patchItem(mesActivo.id, it.id, { efecto: e.target.value })}
                                                    style={{ ...SMALL_STYLE, fontSize: 12 }}
                                                />
                                                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                                                    <input
                                                        type="number"
                                                        value={it.monto}
                                                        placeholder="Monto"
                                                        onChange={e => patchItem(mesActivo.id, it.id, { monto: e.target.value })}
                                                        style={{ ...SMALL_STYLE, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                                                    />
                                                    <select
                                                        value={it.tipo || 'vida'}
                                                        onChange={e => patchItem(mesActivo.id, it.id, { tipo: e.target.value })}
                                                        style={SMALL_STYLE}
                                                    >
                                                        {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                                    </select>
                                                </div>

                                                {it.tipo === 'deuda' && (
                                                    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                                                        <select
                                                            value={it.deuda || ''}
                                                            onChange={e => patchItem(mesActivo.id, it.id, { deuda: e.target.value || null })}
                                                            style={SMALL_STYLE}
                                                        >
                                                            <option value="">¿A qué deuda abona?</option>
                                                            {borrador.deudas.map(d => (
                                                                <option key={d.id} value={d.id}>{d.nombre || 'Sin nombre'}</option>
                                                            ))}
                                                        </select>
                                                        <label style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                                            fontSize: 12, color: 'var(--fg-2)', fontWeight: 600, cursor: 'pointer',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!it.liquida}
                                                                onChange={e => patchItem(mesActivo.id, it.id, { liquida: e.target.checked })}
                                                                style={{ accentColor: 'var(--clay-500)' }}
                                                            />
                                                            Liquida
                                                        </label>
                                                    </div>
                                                )}
                                            </Bloque>
                                        ))}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <LinkBtn icon="add" onClick={() => addItem(mesActivo.id)}>Agregar pago</LinkBtn>
                                            <LinkBtn icon="delete" tone="var(--danger-700)" onClick={() => delMes(mesActivo.id)}>Eliminar mes</LinkBtn>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={guardando}
                        style={{
                            width: '100%', padding: '14px 20px',
                            borderRadius: 'var(--r-xl)', border: 'none',
                            background: 'var(--clay-500)', color: '#fff',
                            fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15,
                            cursor: guardando ? 'wait' : 'pointer', marginTop: 4,
                            opacity: guardando ? 0.7 : 1,
                            boxShadow: 'var(--shadow-clay)',
                            transition: 'opacity var(--dur-fast) var(--ease-out)',
                        }}
                    >
                        {guardando ? 'Guardando…' : 'Guardar plan'}
                    </button>
                </form>
            </div>
        </>
    );
}
