import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Timestamp } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';

export default function TransactionModal({ isOpen, onClose, editingTransaction, initialMode = 'transaction' }) {
    const { addTransaction, updateTransaction, addTransfer, appConfig, deleteTransaction } = useFinance();

    // Helper to normalize categories access
    const allCategories = useMemo(() => {
        if (!appConfig?.categories) return [];
        return appConfig.categories.map(c => {
            if (typeof c === 'string') {
                const isIncome = c.toLowerCase().includes('ingreso');
                return { name: c, subcategories: [], type: isIncome ? 'credit' : 'debit', context: 'personal' };
            }
            return c;
        });
    }, [appConfig]);

    const mode = (editingTransaction?.type === 'transfer' || editingTransaction?.isTransfer) ? 'transfer' : (editingTransaction ? 'transaction' : initialMode);

    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        type: 'debit',
        context: 'personal',
        category: allCategories?.[0]?.name || 'general',
        subcategory: '',
        currency: appConfig?.currencies?.[0] || 'USD',
        card: appConfig?.accounts?.[0] || '',
        date: '',
        comments: '',
        destinationContext: 'personal',
        destinationCard: appConfig?.accounts?.[0] || ''
    });

    const filteredCategories = useMemo(() => {
        if (mode === 'transfer') {
            // For transfers, show all categories matching source context (any type)
            return allCategories.filter(c => {
                const cContext = c.context || 'personal';
                return cContext === formData.context || cContext === 'both';
            });
        }
        return allCategories.filter(c => {
            const cType = c.type || 'debit';
            const cContext = c.context || 'personal';
            return cType === formData.type && (cContext === formData.context || cContext === 'both');
        });
    }, [allCategories, formData.type, formData.context, mode]);

    React.useEffect(() => {
        if (isOpen && filteredCategories.length > 0) {
            const isValid = filteredCategories.some(c => c.name === formData.category);
            if (!isValid) {
                setFormData(prev => ({ ...prev, category: filteredCategories[0].name, subcategory: '' }));
            }
        }
    }, [formData.type, formData.context, filteredCategories, mode, isOpen]);

    React.useEffect(() => {
        if (editingTransaction) {
            let formattedDate = '';
            if (editingTransaction.date) {
                const d = editingTransaction.date;
                const dateObj = d?.toDate ? d.toDate() : new Date(d);
                if (!isNaN(dateObj)) {
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    formattedDate = `${year}-${month}-${day}`;
                }
            }

            setFormData({
                title: editingTransaction.title || '',
                amount: editingTransaction.amount || '',
                type: editingTransaction.type || 'debit',
                context: editingTransaction.context || 'personal',
                category: (typeof editingTransaction.category === 'object'
                    ? editingTransaction.category?.name
                    : editingTransaction.category) || allCategories?.[0]?.name || 'general',
                subcategory: editingTransaction.subcategory || '',
                currency: editingTransaction.currency || appConfig?.currencies?.[0] || 'USD',
                card: editingTransaction.card || appConfig?.accounts?.[0] || '',
                date: formattedDate,
                comments: editingTransaction.comments || '',
                destinationContext: editingTransaction.destinationContext || 'personal',
                destinationCard: editingTransaction.destinationCard || appConfig?.accounts?.[0] || ''
            });
        } else {
            setFormData({
                title: mode === 'transfer' ? 'Transferencia' : '',
                amount: '',
                type: 'debit',
                context: 'personal',
                category: allCategories?.[0]?.name || 'general',
                subcategory: '',
                currency: appConfig?.currencies?.[0] || 'USD',
                card: appConfig?.accounts?.[0] || '',
                date: '',
                comments: '',
                destinationContext: 'personal',
                destinationCard: appConfig?.accounts?.[0] || ''
            });
        }
    }, [editingTransaction, appConfig, allCategories, mode, isOpen]);

    // Get subcategories for currently selected category
    const currentSubcategories = useMemo(() => {
        const cat = filteredCategories.find(c => c.name === formData.category);
        return cat ? cat.subcategories : [];
    }, [filteredCategories, formData.category]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Parse date if selected, otherwise use today's string
            let txDate = formData.date;
            if (!txDate) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                txDate = `${year}-${month}-${day}`;
            }

            if (mode === 'transfer') {
                if (formData.card === formData.destinationCard && formData.context === formData.destinationContext) {
                    alert("La cuenta de origen y destino no pueden ser la misma.");
                    return;
                }

                if (editingTransaction) {
                    // Update existing transfer
                    await updateTransaction(editingTransaction.id, {
                        title: formData.title || 'Transferencia',
                        amount: Number(formData.amount),
                        type: 'transfer',
                        context: formData.context,
                        destinationContext: formData.destinationContext,
                        category: formData.category,
                        subcategory: formData.subcategory,
                        currency: formData.currency,
                        card: formData.card,
                        destinationCard: formData.destinationCard,
                        comments: formData.comments,
                        date: txDate,
                    });
                } else {
                    const transferData = {
                        title: formData.title || 'Transferencia',
                        amount: formData.amount,
                        currency: formData.currency,
                        date: txDate,
                        comments: formData.comments,
                        category: formData.category,
                        subcategory: formData.subcategory,
                        sourceContext: formData.context,
                        sourceAccount: formData.card,
                        destinationContext: formData.destinationContext,
                        destinationAccount: formData.destinationCard
                    };
                    await addTransfer(transferData);
                }
            } else {
                const txData = {
                    title: formData.title,
                    amount: Number(formData.amount),
                    type: formData.type,
                    context: formData.context,
                    category: formData.category,
                    subcategory: formData.subcategory, // Save subcategory
                    currency: formData.currency,
                    card: formData.card,
                    comments: formData.comments,
                    date: txDate
                };

                if (editingTransaction) {
                    await updateTransaction(editingTransaction.id, txData);
                } else {
                    await addTransaction(txData);
                }
            }

            onClose();
        } catch (error) {
            console.error("Error saving transaction", error);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl relative my-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>

                <h2 className="text-xl font-bold text-slate-800 mb-6">
                    {mode === 'transfer' ? (editingTransaction ? 'Editar Transferencia' : 'Nueva Transferencia') : (editingTransaction ? 'Editar Transacción' : 'Nueva Transacción')}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {mode === 'transaction' && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="ej. Panadería"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                        )}

                        {mode === 'transfer' && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="ej. Transferencia mensual"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                            <div className="flex">
                                <select
                                    className="custom-select px-3 py-2 bg-slate-100 border border-slate-200 border-r-0 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold"
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    {appConfig?.currencies && appConfig.currencies.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    placeholder="0.00"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                />
                            </div>
                        </div>

                        {mode === 'transaction' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                                <select
                                    className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="debit">Egreso</option>
                                    <option value="credit">Ingreso</option>
                                </select>
                            </div>
                        )}

                        {/* Source Account (Used for both, but labelled "Desde" in transfer) */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {mode === 'transfer' ? 'Desde (Cuenta Origen)' : 'Tarjeta / Cuenta'}
                            </label>
                            <select
                                required
                                className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.card}
                                onChange={(e) => setFormData({ ...formData, card: e.target.value })}
                            >
                                <option value="" disabled>Seleccionar cuenta...</option>
                                {appConfig?.accounts && appConfig.accounts.map(account => (
                                    <option key={account} value={account}>{account}</option>
                                ))}
                            </select>
                        </div>

                        {/* Destination Account - Only Transfer */}
                        {mode === 'transfer' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                    Hacia (Cuenta Destino)
                                </label>
                                <select
                                    required
                                    className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={formData.destinationCard}
                                    onChange={(e) => setFormData({ ...formData, destinationCard: e.target.value })}
                                >
                                    <option value="" disabled>Seleccionar cuenta...</option>
                                    {appConfig?.accounts && appConfig.accounts.map(account => (
                                        <option key={account} value={account}>{account}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                            <input
                                type="date"
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                {mode === 'transfer' ? 'Contexto Origen' : 'Contexto'}
                            </label>
                            <select
                                className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.context}
                                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                            >
                                <option value="personal">Personal</option>
                                <option value="business">Negocio</option>
                            </select>
                        </div>

                        {/* Destination Context - Only Transfer */}
                        {mode === 'transfer' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contexto Destino</label>
                                <select
                                    className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    value={formData.destinationContext}
                                    onChange={(e) => setFormData({ ...formData, destinationContext: e.target.value })}
                                >
                                    <option value="personal">Personal</option>
                                    <option value="business">Negocio</option>
                                </select>
                            </div>
                        )}

                        {/* Category & Subcategory for transfers */}
                        {mode === 'transfer' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                                    <select
                                        className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={formData.category}
                                        onChange={(e) => {
                                            setFormData({
                                                ...formData,
                                                category: e.target.value,
                                                subcategory: ''
                                            });
                                        }}
                                    >
                                        {filteredCategories.map(cat => (
                                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {currentSubcategories.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subcategoría</label>
                                        <select
                                            className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            value={formData.subcategory}
                                            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                                        >
                                            <option value="">(Sin subcategoría)</option>
                                            {currentSubcategories.map(sub => (
                                                <option key={sub} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        {mode === 'transaction' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                                    <select
                                        className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={formData.category}
                                        onChange={(e) => {
                                            setFormData({
                                                ...formData,
                                                category: e.target.value,
                                                subcategory: '' // Reset subcategory when category changes
                                            });
                                        }}
                                    >
                                        {filteredCategories.map(cat => (
                                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Subcategory Select - Only if category has subcategories */}
                                {currentSubcategories.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subcategoría</label>
                                        <select
                                            className="custom-select w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                            value={formData.subcategory}
                                            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                                        >
                                            <option value="">(Sin subcategoría)</option>
                                            {currentSubcategories.map(sub => (
                                                <option key={sub} value={sub}>{sub}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Comentarios</label>
                            <textarea
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                                placeholder="Añade una nota opcional..."
                                rows="2"
                                value={formData.comments}
                                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                            ></textarea>
                        </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                        <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-dark text-slate-900 font-bold rounded-xl shadow-sm transition-colors">
                            Guardar {mode === 'transfer' ? 'Transferencia' : 'Transacción'}
                        </button>
                        {editingTransaction && (
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteOpen(true)}
                                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors"
                            >
                                Eliminar Transacción
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <ConfirmModal
                isOpen={confirmDeleteOpen}
                onClose={() => setConfirmDeleteOpen(false)}
                onConfirm={() => {
                    deleteTransaction(editingTransaction.id);
                    setConfirmDeleteOpen(false);
                    onClose();
                }}
                title="Eliminar Transacción"
                message="¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
}
