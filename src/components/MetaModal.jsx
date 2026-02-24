import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFormData({
                nombre: '',
                objetivo: '',
                cuenta: appConfig?.accounts?.[0] || '',
                contexto: currentContext === 'unified' ? 'personal' : (currentContext || 'personal'),
            });
        }
    }, [editingMeta, currentContext, appConfig]);

    if (!isOpen) return null;

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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative my-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-500">track_changes</span>
                    {editingMeta ? 'Editar Meta' : 'Nueva Meta'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de la Meta</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            placeholder="ej. Viaje a Japón"
                            value={formData.nombre}
                            onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Objetivo Final ($)</label>
                        <input
                            required
                            type="number"
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            placeholder="0"
                            value={formData.objetivo}
                            onChange={(e) => setFormData({ ...formData, objetivo: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cuenta vinculada</label>
                        <select
                            required
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            value={formData.cuenta}
                            onChange={(e) => setFormData({ ...formData, cuenta: e.target.value })}
                        >
                            <option value="">Selecciona una cuenta...</option>
                            {appConfig?.accounts?.map(acc => (
                                <option key={acc} value={acc}>{acc}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">Los créditos a esta cuenta se sumarán al progreso de la meta.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contexto</label>
                        <select
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            value={formData.contexto}
                            onChange={(e) => setFormData({ ...formData, contexto: e.target.value })}
                        >
                            <option value="personal">Personal</option>
                            <option value="business">Negocio</option>
                        </select>
                    </div>

                    <div className="pt-4">
                        <button type="submit" className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl shadow-sm transition-colors">
                            Guardar Meta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
