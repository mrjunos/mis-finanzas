import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Icon, Field } from './ds/Primitives';

const INPUT_STYLE = {
    width: '100%', padding: '10px 14px',
    background: 'var(--bg-sunken)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--r-lg)',
    fontFamily: 'var(--font-sans)', fontSize: 14,
    color: 'var(--fg-1)', outline: 'none',
    boxSizing: 'border-box',
};

export default function MetaModal({ isOpen, onClose, currentContext, editingMeta }) {
    const { addGoal, updateGoal, appConfig } = useFinance();
    const [formData, setFormData] = useState({
        nombre: '',
        objetivo: '',
        cuenta: '',
        contexto: currentContext || 'personal',
    });

    useEffect(() => {
        if (editingMeta) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                nombre: editingMeta.nombre || '',
                objetivo: editingMeta.objetivo || '',
                cuenta: editingMeta.cuenta || '',
                contexto: editingMeta.contexto || currentContext || 'personal',
            });
        } else {
            setFormData({
                nombre: '',
                objetivo: '',
                cuenta: appConfig?.accounts?.[0] || '',
                contexto: currentContext === 'unified' ? 'personal' : (currentContext || 'personal'),
            });
        }
    }, [editingMeta, currentContext, appConfig]);

    if (!isOpen) return null;

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSave = {
                nombre: formData.nombre,
                objetivo: Number(formData.objetivo),
                cuenta: formData.cuenta,
                contexto: formData.contexto,
            };
            if (editingMeta) {
                await updateGoal(editingMeta.id, dataToSave);
            } else {
                await addGoal(dataToSave);
            }
            onClose();
        } catch (error) {
            console.error("Error saving goal:", error);
        }
    };

    return (
        <>
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 90,
                    background: 'var(--bg-overlay)',
                    backdropFilter: 'blur(4px)',
                }}
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
                {/* Drag handle */}
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-default)' }} />
                </div>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'var(--plum-50)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Icon name="track_changes" size={20} color="var(--plum-600)" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
                            {editingMeta ? 'Editar Meta' : 'Nueva Meta'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 36, height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: 'var(--bg-sunken)', color: 'var(--fg-3)',
                        }}
                    >
                        <Icon name="close" size={18} />
                    </button>
                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}
                >
                    <Field label="Nombre de la meta">
                        <input
                            required
                            type="text"
                            placeholder="ej. Viaje a Japón"
                            value={formData.nombre}
                            onChange={e => set('nombre', e.target.value)}
                            style={INPUT_STYLE}
                        />
                    </Field>

                    <Field label="Objetivo final">
                        <div style={{ position: 'relative' }}>
                            <span style={{
                                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                                fontSize: 15, fontWeight: 700, color: 'var(--fg-3)',
                                fontFamily: 'var(--font-mono)',
                            }}>$</span>
                            <input
                                required
                                type="number"
                                placeholder="0"
                                value={formData.objetivo}
                                onChange={e => set('objetivo', e.target.value)}
                                style={{ ...INPUT_STYLE, paddingLeft: 30, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                            />
                        </div>
                    </Field>

                    <Field label="Cuenta vinculada">
                        <select
                            required
                            value={formData.cuenta}
                            onChange={e => set('cuenta', e.target.value)}
                            style={INPUT_STYLE}
                        >
                            <option value="">Selecciona una cuenta...</option>
                            {appConfig?.accounts?.map(acc => (
                                <option key={acc} value={acc}>{acc}</option>
                            ))}
                        </select>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-4)', lineHeight: 1.4 }}>
                            Los créditos a esta cuenta se sumarán al progreso de la meta.
                        </p>
                    </Field>

                    <Field label="Contexto">
                        <select
                            value={formData.contexto}
                            onChange={e => set('contexto', e.target.value)}
                            style={INPUT_STYLE}
                        >
                            <option value="personal">Personal</option>
                            <option value="business">Negocio</option>
                        </select>
                    </Field>

                    <button
                        type="submit"
                        style={{
                            width: '100%', padding: '14px 20px',
                            borderRadius: 'var(--r-xl)', border: 'none',
                            background: 'var(--plum-400)', color: '#fff',
                            fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 15,
                            cursor: 'pointer', marginTop: 4,
                            boxShadow: '0 4px 16px -4px rgba(155, 92, 246, 0.45)',
                            transition: 'opacity var(--dur-fast) var(--ease-out)',
                        }}
                    >
                        Guardar Meta
                    </button>
                </form>
            </div>
        </>
    );
}
