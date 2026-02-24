import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';

export default function PresupuestoModal({ isOpen, onClose, currentContext, currentMonthStr, editingCategory, onSaveConfig }) {
    const { appConfig } = useFinance();
    const [formData, setFormData] = useState({
        nombre: appConfig?.categories?.[0] || 'general',
        limite: '',
    });

    useEffect(() => {
        if (editingCategory) {
            setFormData({
                nombre: editingCategory.nombre || '',
                limite: editingCategory.limite || '',
            });
        } else {
            setFormData({
                nombre: appConfig?.categories?.[0] || 'general',
                limite: '',
            });
        }
    }, [editingCategory, appConfig]);

    if (!isOpen) return null;

    const brandColor = currentContext === 'business' ? 'secondary' : 'primary';
    const hexClass = currentContext === 'business' ? 'bg-secondary' : 'bg-primary';

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const catData = {
                nombre: formData.nombre,
                limite: Number(formData.limite),
                color: hexClass, // default assignation
                gastado: editingCategory?.gastado || 0, // Keep current spending
            };

            await onSaveConfig(catData, editingCategory !== null);
            onClose();
        } catch (error) {
            console.error("Error managing category config:", error);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative my-8 border-t-4 border-${brandColor}`}>
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <span className={`material-symbols-outlined text-${brandColor}`}>pie_chart</span>
                    {editingCategory ? 'Editar Límite Mensual' : 'Nueva Categoría de Presupuesto'}
                </h2>
                <p className="text-xs text-slate-500 -mt-4 mb-6">
                    Ajustando presupuesto para: <span className="font-bold text-slate-700">{currentMonthStr}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre de la Categoría</label>
                        {editingCategory ? (
                            <input
                                disabled
                                type="text"
                                className="w-full px-4 py-2 bg-slate-100/70 text-slate-500 border border-slate-200 rounded-xl focus:outline-none cursor-not-allowed"
                                value={formData.nombre}
                            />
                        ) : (
                            <select
                                required
                                className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${brandColor}/50`}
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                            >
                                {appConfig?.categories && appConfig.categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Límite Mensual ($)</label>
                        <input
                            required
                            type="number"
                            className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${brandColor}/50`}
                            placeholder="0"
                            value={formData.limite}
                            onChange={(e) => setFormData({ ...formData, limite: e.target.value })}
                        />
                    </div>

                    <div className="pt-4">
                        <button type="submit" className={`w-full py-3 ${hexClass} ${currentContext === 'business' ? 'hover:bg-opacity-90 text-white' : 'hover:bg-primary-dark text-slate-900'} font-bold rounded-xl shadow-sm transition-colors`}>
                            Guardar Presupuesto
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
