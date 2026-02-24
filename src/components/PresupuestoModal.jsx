import React, { useState, useEffect, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';

export default function PresupuestoModal({ isOpen, onClose, currentContext, currentMonthStr, editingCategory, onSaveConfig }) {
    const { appConfig } = useFinance();

    // Normalize categories
    const categories = useMemo(() => {
        if (!appConfig?.categories) return [];
        return appConfig.categories.map(c => typeof c === 'string' ? { name: c, subcategories: [] } : c);
    }, [appConfig]);

    const [formData, setFormData] = useState({
        nombre: categories?.[0]?.name || 'general',
        subcategory: '',
        limite: '',
    });

    useEffect(() => {
        if (editingCategory) {
            // eslint-disable-next-line
            setFormData({
                nombre: editingCategory.nombre || '',
                subcategory: editingCategory.subcategory || '',
                limite: editingCategory.limite || '',
            });
        } else {
            // eslint-disable-next-line
            setFormData({
                nombre: categories?.[0]?.name || 'general',
                subcategory: '',
                limite: '',
            });
        }
    }, [editingCategory, categories]);

    const currentSubcategories = useMemo(() => {
        const cat = categories.find(c => c.name === formData.nombre);
        return cat ? cat.subcategories : [];
    }, [categories, formData.nombre]);

    if (!isOpen) return null;

    const brandColor = currentContext === 'business' ? 'secondary' : 'primary';
    const hexClass = currentContext === 'business' ? 'bg-secondary' : 'bg-primary';

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const catData = {
                nombre: formData.nombre,
                subcategory: formData.subcategory || null, // Ensure explicit null if empty
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
                            <div className="flex flex-col gap-1">
                                <input
                                    disabled
                                    type="text"
                                    className="w-full px-4 py-2 bg-slate-100/70 text-slate-500 border border-slate-200 rounded-xl focus:outline-none cursor-not-allowed"
                                    value={formData.nombre}
                                />
                                {formData.subcategory && (
                                    <input
                                        disabled
                                        type="text"
                                        className="w-full px-4 py-2 bg-slate-100/70 text-slate-500 border border-slate-200 rounded-xl focus:outline-none cursor-not-allowed text-xs"
                                        value={`Sub: ${formData.subcategory}`}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <select
                                    required
                                    className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${brandColor}/50`}
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value, subcategory: '' })}
                                >
                                    {categories.map(category => (
                                        <option key={category.name} value={category.name}>{category.name}</option>
                                    ))}
                                </select>

                                {currentSubcategories && currentSubcategories.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Subcategoría (Opcional)</label>
                                        <select
                                            className={`w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${brandColor}/50`}
                                            value={formData.subcategory}
                                            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                                        >
                                            <option value="">(Presupuesto General de la Categoría)</option>
                                            {currentSubcategories.map(sub => (
                                                <option key={sub} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
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
