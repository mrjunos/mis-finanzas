import React, { useState } from 'react';
import Widget from './Widget';
import TransactionModal from './TransactionModal';
import { useFinance } from '../context/FinanceContext';
import { format } from 'date-fns';

const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
    }).format(value);
};

export default function Dashboard({ currentContext, onNavigate }) {
    const { getTotals, deleteTransaction, loading } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);

    const { netWorth, personalBalance, businessCashFlow, filteredTransactions } = getTotals(currentContext);

    // Helper to get the total sum for a single currency
    const getCurrencyTotal = (balances) => {
        let total = 0;
        for (const cur in balances) {
            total += balances[cur];
        }
        return total;
    };

    // Helper to render the multi-currency widget content
    const renderCurrencyWidgetContent = (title, balances, PrimaryIcon, iconClass, lineContent) => {
        const activeCurrencies = Object.keys(balances).filter(cur => balances[cur] !== 0);
        // Determine primary currency: COP if present, else USD, or the highest value
        let primaryCurrency = 'COP';
        if (activeCurrencies.length > 0) {
            if (activeCurrencies.includes('COP')) {
                primaryCurrency = 'COP';
            } else if (activeCurrencies.includes('USD')) {
                primaryCurrency = 'USD';
            } else {
                // Find the currency with the highest absolute value
                primaryCurrency = activeCurrencies.reduce((maxCur, currentCur) => {
                    return Math.abs(balances[currentCur]) > Math.abs(balances[maxCur] || 0) ? currentCur : maxCur;
                }, activeCurrencies[0]);
            }
        }

        const primaryValue = balances[primaryCurrency] || 0;
        const primarySign = primaryValue < 0 ? '-' : '';

        const secondaryCurrencies = activeCurrencies.filter(cur => cur !== primaryCurrency);

        return (
            <Widget className={`flex flex-col justify-between border-l-4 group hover:shadow-soft transition-all ${iconClass}`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                        <h2 className="text-3xl font-extrabold text-slate-800">
                            {primarySign}{formatCurrency(Math.abs(primaryValue))} <span className="text-lg font-bold text-slate-400">{primaryCurrency}</span>
                        </h2>
                        {secondaryCurrencies.length > 0 && (
                            <div className="mt-1 flex gap-2 text-[10px] font-bold text-slate-500">
                                {secondaryCurrencies.map(cur => {
                                    const amount = balances[cur];
                                    const sign = amount < 0 ? '-' : '+';
                                    return (
                                        <span key={cur}>{sign} {formatCurrency(Math.abs(amount))} {cur}</span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {PrimaryIcon}
                </div>
                {lineContent}
            </Widget>
        );
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center p-6"><p className="text-slate-500 font-bold">Cargando...</p></div>;
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-[1600px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                    {renderCurrencyWidgetContent(
                        "Patrimonio Neto",
                        netWorth,
                        (<div className="flex items-center gap-1 px-2 py-1 bg-green-100/50 rounded-lg">
                            <span className="material-symbols-outlined text-green-600 text-sm">trending_up</span>
                            <span className="text-xs font-bold text-green-700">Live</span>
                        </div>),
                        "border-l-primary",
                        (<div className="flex items-center gap-3">
                            <button className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary-dark py-2 rounded-lg text-xs font-bold transition-colors">Detalles</button>
                            <button className="w-10 h-9 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-lg">share</span>
                            </button>
                        </div>)
                    )}

                    {renderCurrencyWidgetContent(
                        "Balance Personal",
                        personalBalance,
                        (<div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                            <span className="material-symbols-outlined text-lg">person</span>
                        </div>),
                        "border-l-secondary",
                        (<div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
                            <div className="bg-secondary h-full rounded-full" style={{ width: '100%' }}></div>
                        </div>)
                    )}

                    {renderCurrencyWidgetContent(
                        "Caja Negocio",
                        businessCashFlow,
                        (<div className="w-8 h-8 rounded-lg bg-teal-100/50 flex items-center justify-center text-teal-600">
                            <span className="material-symbols-outlined text-lg">business_center</span>
                        </div>),
                        "border-l-teal-400",
                        (<div className="mt-2 h-8 w-full">
                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                                <path d="M0 15 Q 25 5, 50 15 T 100 5" fill="none" stroke="#13ecda" strokeLinecap="round" strokeWidth="2"></path>
                            </svg>
                        </div>)
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                            className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white hover:border-primary/30 transition-all border border-transparent"
                        >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary-dark flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">add</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Agregar</span>
                        </button>
                        <button
                            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
                            className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white hover:border-secondary/30 transition-all border border-transparent"
                        >
                            <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">swap_horiz</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Transferir</span>
                        </button>
                    </div>
                </div>

                <div className="mt-6 md:col-span-2 xl:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Widget className="overflow-hidden flex flex-col p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-lg">history</span>
                                <h3 className="font-bold text-slate-700 text-sm">Actividad Reciente</h3>
                            </div>
                            <button
                                onClick={() => onNavigate && onNavigate('transactions')}
                                className="text-[10px] font-bold text-primary-dark hover:underline uppercase tracking-wider"
                            >
                                Ver Todo
                            </button>
                        </div>
                        <div className="space-y-1">
                            {filteredTransactions.length === 0 ? (
                                <p className="text-xs text-slate-500 py-4 text-center">No hay transacciones registradas.</p>
                            ) : (
                                filteredTransactions.slice(0, 6).map(tx => {
                                    const categoryLabels = {
                                        'general': 'General',
                                        'food': 'Comida y Salidas',
                                        'software': 'Software',
                                        'services': 'Servicios'
                                    };

                                    const currencyCode = tx.currency || 'USD';
                                    const symbol = currencyCode === 'EUR' ? '€' : '$';
                                    const formattedAmount = `${currencyCode} ${symbol}${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                                    // Make date formatting robust (Firestore Timestamp vs JS Date string)
                                    let txDate;
                                    try {
                                        txDate = tx.date && tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
                                    } catch (e) {
                                        txDate = new Date();
                                    }

                                    return (
                                        <div
                                            key={tx.id}
                                            className="flex items-center gap-3 p-2 hover:bg-white/50 rounded-xl transition-colors cursor-pointer group"
                                            onClick={() => {
                                                setEditingTransaction(tx);
                                                setIsModalOpen(true);
                                            }}
                                        >
                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tx.context === 'business' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                                <span className="material-symbols-outlined text-lg">
                                                    {tx.context === 'business' ? 'domain' : 'person'}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-800 truncate">{tx.title}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-medium capitalize truncate">
                                                    {tx.context === 'business' ? 'Negocio' : 'Personal'}
                                                    {tx.card && ` • ${tx.card}`}
                                                    • {categoryLabels[tx.category] || tx.category}
                                                    • {format(txDate, 'MMM dd, yyyy')}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end justify-center gap-1">
                                                <p className={`text-xs font-extrabold ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-800'}`}>
                                                    {tx.type === 'credit' ? '+' : '-'}{formattedAmount}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {tx.comments && <span className="material-symbols-outlined text-[12px] text-slate-400" title={tx.comments}>chat</span>}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('¿Estás seguro de eliminar esta transacción?')) {
                                                                deleteTransaction(tx.id);
                                                            }
                                                        }}
                                                        className="text-red-300 hover:text-red-500 transition-colors"
                                                        title="Eliminar transacción"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Widget>

                    <Widget>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-slate-700 text-sm">Métricas</h3>
                            <span className="text-[10px] font-bold bg-white/60 px-2 py-1 rounded-md text-slate-500 uppercase tracking-widest">Q1 2024</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-white/40 p-4 rounded-xl border border-white/60">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Por Cobrar</p>
                                <p className="text-xl font-extrabold text-slate-700">$4,250</p>
                                <div className="mt-2 text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">schedule</span> 3 Atrasadas
                                </div>
                            </div>
                            <div className="bg-white/40 p-4 rounded-xl border border-white/60">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Egresos Totales</p>
                                <p className="text-xl font-extrabold text-slate-700">{formatCurrency(filteredTransactions.filter(t => t.type === 'debit').reduce((acc, t) => acc + Number(t.amount), 0))}</p>
                                <div className="mt-2 text-[10px] text-green-600 font-bold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">check_circle</span> Al día
                                </div>
                            </div>
                        </div>
                        <div className="relative h-20 w-full overflow-hidden rounded-xl bg-primary/5 border border-primary/10">
                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 50">
                                <path d="M0 40 C 20 40, 30 20, 50 25 C 70 30, 80 10, 100 15 L 100 50 L 0 50 Z" fill="rgba(19, 236, 218, 0.1)"></path>
                                <path d="M0 40 C 20 40, 30 20, 50 25 C 70 30, 80 10, 100 15" fill="none" stroke="#13ecda" strokeWidth="1.5"></path>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-primary-dark uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded shadow-sm">Tendencia: Normal</span>
                            </div>
                        </div>
                    </Widget>
                </div>
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                editingTransaction={editingTransaction}
            />
        </div>
    );
}
