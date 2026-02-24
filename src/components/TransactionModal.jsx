import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Timestamp } from 'firebase/firestore';

export default function TransactionModal({ isOpen, onClose, editingTransaction }) {
    const { addTransaction, updateTransaction, appConfig } = useFinance();
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        type: 'debit',
        context: 'personal',
        category: appConfig?.categories?.[0] || 'general',
        currency: appConfig?.currencies?.[0] || 'USD',
        card: appConfig?.accounts?.[0] || '',
        date: '',
        comments: ''
    });

    React.useEffect(() => {
        if (editingTransaction) {
            let formattedDate = '';
            if (editingTransaction.date) {
                const d = editingTransaction.date;
                const dateObj = d?.toDate ? d.toDate() : new Date(d);
                if (!isNaN(dateObj)) {
                    formattedDate = dateObj.toISOString().split('T')[0];
                }
            }

            setFormData({
                title: editingTransaction.title || '',
                amount: editingTransaction.amount || '',
                type: editingTransaction.type || 'debit',
                context: editingTransaction.context || 'personal',
                category: editingTransaction.category || appConfig?.categories?.[0] || 'general',
                currency: editingTransaction.currency || appConfig?.currencies?.[0] || 'USD',
                card: editingTransaction.card || appConfig?.accounts?.[0] || '',
                date: formattedDate,
                comments: editingTransaction.comments || ''
            });
        } else {
            setFormData({
                title: '', amount: '', type: 'debit', context: 'personal',
                category: appConfig?.categories?.[0] || 'general',
                currency: appConfig?.currencies?.[0] || 'USD',
                card: appConfig?.accounts?.[0] || '', date: '', comments: ''
            });
        }
    }, [editingTransaction, appConfig]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Parse date if selected, otherwise use now.
            const txDate = formData.date ? Timestamp.fromDate(new Date(formData.date)) : Timestamp.now();

            const txData = {
                title: formData.title,
                amount: Number(formData.amount),
                type: formData.type,
                context: formData.context,
                category: formData.category,
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
                    {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cantidad</label>
                            <div className="flex">
                                <select
                                    className="px-3 py-2 bg-slate-100 border border-slate-200 border-r-0 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold"
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

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                            <select
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="debit">Egreso</option>
                                <option value="credit">Ingreso</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarjeta / Cuenta</label>
                            <select
                                required
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.card}
                                onChange={(e) => setFormData({ ...formData, card: e.target.value })}
                            >
                                <option value="" disabled>Seleccionar cuenta...</option>
                                {appConfig?.accounts && appConfig.accounts.map(account => (
                                    <option key={account} value={account}>{account}</option>
                                ))}
                            </select>
                        </div>

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
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contexto</label>
                            <select
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.context}
                                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
                            >
                                <option value="personal">Personal</option>
                                <option value="business">Negocio</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoría</label>
                            <select
                                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            >
                                {appConfig?.categories && appConfig.categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        </div>

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

                    <div className="pt-4">
                        <button type="submit" className="w-full py-3 bg-primary hover:bg-primary-dark text-slate-900 font-bold rounded-xl shadow-sm transition-colors">
                            Guardar Transacción
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
