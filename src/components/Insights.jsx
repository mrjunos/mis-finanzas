import React, { useState, useMemo } from 'react';
import TransactionModal from './TransactionModal';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency, formatNumber } from '../utils/format';
import { format } from 'date-fns';
import ConfirmModal from './ConfirmModal';

const EXCHANGE_RATE = 4100; // Hardcoded COP/USD rate for estimation

const Insights = ({ currentContext, onNavigate }) => {
    const { transactions, getTotals, deleteTransaction, loading } = useFinance();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [modalMode, setModalMode] = useState('transaction');
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, txId: null });

    // Helper to detect transfers (new model + legacy)
    const isTransferTx = (t) => t.type === 'transfer' || t.isTransfer === true;

    // Filter transactions by context
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (currentContext === 'unified') return true;
            // Transfers belong to both contexts — show if either matches
            if (isTransferTx(t)) {
                return t.context === currentContext || t.destinationContext === currentContext;
            }
            return t.context === currentContext;
        });
    }, [transactions, currentContext]);

    // Calculate Date Ranges
    const today = useMemo(() => new Date(), []);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // --- KPIs ---

    // 1. Savings Rate (Current Month)
    const savingsRate = useMemo(() => {
        const currentMonthTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !isTransferTx(t);
        });

        const income = currentMonthTxs
            .filter(t => t.type === 'credit')
            .reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

        const expenses = currentMonthTxs
            .filter(t => t.type === 'debit')
            .reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

        if (income === 0) return 0;
        return ((income - expenses) / income) * 100;
    }, [filteredTransactions, currentMonth, currentYear]);

    // Savings Rate Previous Month for Comparison
    const prevSavingsRate = useMemo(() => {
        const prevMonthTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear && !isTransferTx(t);
        });

        const income = prevMonthTxs
            .filter(t => t.type === 'credit')
            .reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

        const expenses = prevMonthTxs
            .filter(t => t.type === 'debit')
            .reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

        if (income === 0) return 0;
        return ((income - expenses) / income) * 100;
    }, [filteredTransactions, lastMonth, lastMonthYear]);

    const savingsRateTrend = savingsRate - prevSavingsRate;

    // 2. Burn Rate (Average Monthly Expenses - Last 3 Months)
    const burnRate = useMemo(() => {
        // Get last 3 months
        let totalExpenses = 0;
        let monthsCounted = 0;

        for (let i = 0; i < 3; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const m = d.getMonth();
            const y = d.getFullYear();

            const monthTxs = filteredTransactions.filter(t =>
                t.date.getMonth() === m && t.date.getFullYear() === y && t.type === 'debit' && !isTransferTx(t)
            );

            if (monthTxs.length > 0) {
                const monthlyExp = monthTxs.reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);
                totalExpenses += monthlyExp;
                monthsCounted++;
            }
        }

        return monthsCounted > 0 ? totalExpenses / monthsCounted : 0;
    }, [filteredTransactions, today]);


    // 3. Currency Exposure
    const currencyExposure = useMemo(() => {
        const totals = getTotals(currentContext);
        // totals.netWorth is { COP: X, USD: Y }
        const cop = totals.netWorth.COP || 0;
        const usd = totals.netWorth.USD || 0;
        const totalInCop = cop + (usd * EXCHANGE_RATE);

        if (totalInCop === 0) return { cop: 0, usd: 0 };

        return {
            cop: (cop / totalInCop) * 100,
            usd: ((usd * EXCHANGE_RATE) / totalInCop) * 100
        };
    }, [getTotals, currentContext]);


    // --- Charts Data ---

    // 4. Cashflow History (Last 6 Months)
    const cashflowData = useMemo(() => {
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthName = d.toLocaleString('es-CO', { month: 'short' });
            const m = d.getMonth();
            const y = d.getFullYear();

            const txs = filteredTransactions.filter(t => t.date.getMonth() === m && t.date.getFullYear() === y && !isTransferTx(t));

            const income = txs
                .filter(t => t.type === 'credit')
                .reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

            const expenses = txs
                .filter(t => t.type === 'debit')
                .reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

            data.push({ month: monthName, income, expenses });
        }
        return data;
    }, [filteredTransactions, today]);

    // 5. Category Breakdown (Last 3 Months)
    const categoryBreakdown = useMemo(() => {
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const recentTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d >= threeMonthsAgo && t.type === 'debit' && !isTransferTx(t);
        });

        const categories = {};
        let total = 0;

        recentTxs.forEach(t => {
            const amount = t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount;
            const cat = t.category || 'Sin Categoría';
            categories[cat] = (categories[cat] || 0) + amount;
            total += amount;
        });

        const sorted = Object.entries(categories)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3) // Top 3
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: total > 0 ? (amount / total) * 100 : 0
            }));

        // Add "Others"
        const top3Total = sorted.reduce((acc, curr) => acc + curr.amount, 0);
        if (total > top3Total) {
            sorted.push({
                name: 'Otros',
                amount: total - top3Total,
                percentage: ((total - top3Total) / total) * 100
            });
        }

        return sorted;
    }, [filteredTransactions, today]);

    // 5.5 Card/Account Breakdown (Last 3 Months)
    const cardBreakdown = useMemo(() => {
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const recentTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d >= threeMonthsAgo && t.type === 'debit' && !isTransferTx(t);
        });

        const accounts = {};
        let total = 0;

        recentTxs.forEach(t => {
            const amount = t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount;
            const accountName = t.card || 'Efectivo/Otro';
            accounts[accountName] = (accounts[accountName] || 0) + amount;
            total += amount;
        });

        const sorted = Object.entries(accounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3) // Top 3
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: total > 0 ? (amount / total) * 100 : 0
            }));

        // Add "Others"
        const top3Total = sorted.reduce((acc, curr) => acc + curr.amount, 0);
        if (total > top3Total) {
            sorted.push({
                name: 'Otros',
                amount: total - top3Total,
                percentage: ((total - top3Total) / total) * 100
            });
        }

        return sorted;
    }, [filteredTransactions, today]);


    // 6. Top Fugas (Highest Expenses by Title - Last 3 Months)
    const topFugas = useMemo(() => {
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const prevThreeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

        const recentTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d >= threeMonthsAgo && t.type === 'debit' && !isTransferTx(t);
        });

        const groups = {};
        recentTxs.forEach(t => {
            const amount = t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount;
            const title = t.title || 'Sin Nombre';
            groups[title] = (groups[title] || 0) + amount;
        });

        // Get Top 4
        const sorted = Object.entries(groups)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([name, amount]) => {
                // Calculate trend vs previous 3 months for same title
                const prevPeriodTxs = filteredTransactions.filter(t => {
                    const d = t.date;
                    return d >= prevThreeMonthsAgo && d < threeMonthsAgo && t.type === 'debit' && t.title === name;
                });
                const prevAmount = prevPeriodTxs.reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

                let trend = 0;
                if (prevAmount > 0) {
                    trend = ((amount - prevAmount) / prevAmount) * 100;
                } else if (amount > 0) {
                    trend = 100; // New expense
                }

                return {
                    name,
                    amount,
                    trend
                };
            });

        return sorted;
    }, [filteredTransactions, today]);

    const { netWorth, personalBalance, businessCashFlow } = getTotals(currentContext);

    let activeBalanceTitle = "Patrimonio Neto";
    let activeBalanceData = netWorth;
    let activeBalanceIcon = (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100/50 rounded-lg">
            <span className="material-symbols-outlined text-green-600 text-sm">trending_up</span>
            <span className="text-xs font-bold text-green-700">Live</span>
        </div>
    );
    let activeBalanceClass = "border-l-primary";
    let waveColor = "#13ecda";

    if (currentContext === 'personal') {
        activeBalanceTitle = "Balance Personal";
        activeBalanceData = personalBalance;
        activeBalanceIcon = (
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-lg">person</span>
            </div>
        );
        activeBalanceClass = "border-l-secondary";
        waveColor = "#ff8c73";
    } else if (currentContext === 'business') {
        activeBalanceTitle = "Caja Negocio";
        activeBalanceData = businessCashFlow;
        activeBalanceIcon = (
            <div className="w-8 h-8 rounded-lg bg-teal-100/50 flex items-center justify-center text-teal-600">
                <span className="material-symbols-outlined text-lg">business_center</span>
            </div>
        );
        activeBalanceClass = "border-l-teal-400";
        waveColor = "#13ecda";
    }

    let activeBalanceLineContent = (
        <div className="flex flex-col mt-2">
            <div className="h-8 w-full mb-1">
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 20">
                    <path d="M0 15 Q 25 5, 50 15 T 100 5" fill="none" stroke={waveColor} strokeLinecap="round" strokeWidth="2"></path>
                </svg>
            </div>
        </div>
    );

    const renderCurrencyWidgetContent = (title, balances, PrimaryIcon, iconClass, lineContent) => {
        const activeCurrencies = Object.keys(balances).filter(cur => balances[cur] !== 0);
        let primaryCurrency = 'COP';
        if (activeCurrencies.length > 0) {
            if (activeCurrencies.includes('COP')) {
                primaryCurrency = 'COP';
            } else if (activeCurrencies.includes('USD')) {
                primaryCurrency = 'USD';
            } else {
                primaryCurrency = activeCurrencies.reduce((maxCur, currentCur) => {
                    return Math.abs(balances[currentCur]) > Math.abs(balances[maxCur] || 0) ? currentCur : maxCur;
                }, activeCurrencies[0]);
            }
        }

        const primaryValue = balances[primaryCurrency] || 0;
        const primarySign = primaryValue < 0 ? '-' : '';
        const secondaryCurrencies = activeCurrencies.filter(cur => cur !== primaryCurrency);

        return (
            <div className={`bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col justify-between border-l-4 group hover:shadow-md transition-all ${iconClass}`}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                        <h2 className="text-3xl font-extrabold text-slate-800">
                            {primarySign}$ {formatNumber(Math.abs(primaryValue), primaryCurrency)} <span className="text-lg font-bold text-slate-400">{primaryCurrency}</span>
                        </h2>
                        {secondaryCurrencies.length > 0 && (
                            <div className="mt-1 flex gap-2 text-[10px] font-bold text-slate-500">
                                {secondaryCurrencies.map(cur => {
                                    const amount = balances[cur];
                                    const sign = amount < 0 ? '-' : '+';
                                    return (
                                        <span key={cur}>{sign} $ {formatNumber(Math.abs(amount), cur)} {cur}</span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {PrimaryIcon}
                </div>
                {lineContent}
            </div>
        );
    };

    if (loading) {
        return <div className="flex-1 flex items-center justify-center p-6"><p className="text-slate-500 font-bold">Cargando...</p></div>;
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans w-full overflow-y-auto">
            <div className="max-w-[1600px] mx-auto w-full space-y-6 pb-20">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Radiografía Financiera</h1>
                        <p className="text-sm text-gray-500">Deja de adivinar a dónde se va la plata.</p>
                    </div>
                </div>

                {/* Top Metrics Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                    {/* Main Balance */}
                    {renderCurrencyWidgetContent(
                        activeBalanceTitle,
                        activeBalanceData,
                        activeBalanceIcon,
                        activeBalanceClass,
                        activeBalanceLineContent
                    )}

                    {/* Savings Rate */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tasa de Ahorro</p>
                                <div className="p-2 bg-teal-50 rounded-xl text-teal-500">
                                    <span className="material-symbols-outlined text-lg">trending_up</span>
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-800">{savingsRate.toFixed(1)}%</h2>
                        </div>
                        <p className={`text-xs flex items-center mt-4 font-bold ${savingsRateTrend >= 0 ? 'text-teal-500' : 'text-red-500'}`}>
                            <span className="material-symbols-outlined text-[14px] mr-1">
                                {savingsRateTrend >= 0 ? 'north_east' : 'south_east'}
                            </span>
                            {savingsRateTrend >= 0 ? '+' : ''}{savingsRateTrend.toFixed(1)}% vs mes pasado
                        </p>
                    </div>

                    {/* Burn Rate */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Burn Rate</p>
                                <div className="p-2 bg-red-50 rounded-xl text-red-500">
                                    <span className="material-symbols-outlined text-lg">local_fire_department</span>
                                </div>
                            </div>
                            <h2 className="text-3xl font-bold text-gray-800">{formatCurrency(burnRate, 'COP')} <span className="text-sm text-gray-400 font-normal">COP/m</span></h2>
                        </div>
                        <p className="text-xs text-gray-400 mt-4 font-bold uppercase tracking-wider">Promedio 3 meses</p>
                    </div>

                    {/* Currency Exposure */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Moneda</p>
                                <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
                                    <span className="material-symbols-outlined text-lg">attach_money</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 mt-4">
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1"><span className="font-bold text-gray-700">COP</span><span className="font-bold text-gray-500">{currencyExposure.cop.toFixed(0)}%</span></div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full"><div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${currencyExposure.cop}%` }}></div></div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1"><span className="font-bold text-gray-700">USD</span><span className="font-bold text-gray-500">{currencyExposure.usd.toFixed(0)}%</span></div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full"><div className="h-full bg-teal-400 rounded-full transition-all duration-500" style={{ width: `${currencyExposure.usd}%` }}></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Charts Area Option 2: 2 cols for Charts/Activity, then 3 cols for side widgets */}
                <div className="space-y-6">
                    {/* Top Row: Cashflow and Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Activity */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">history</span> Actividad Reciente
                                </h3>
                                <button
                                    onClick={() => onNavigate && onNavigate('transactions')}
                                    className="text-[10px] font-bold text-primary-dark hover:underline uppercase tracking-wider"
                                >
                                    Ver Todo
                                </button>
                            </div>
                            <div className="space-y-1 overflow-y-auto flex-1 h-64 pr-2">
                                {filteredTransactions.length === 0 ? (
                                    <p className="text-xs text-slate-500 py-4 text-center">No hay transacciones registradas.</p>
                                ) : (
                                    filteredTransactions.slice(0, 8).map(tx => {
                                        const categoryLabels = {
                                            'general': 'General',
                                            'food': 'Comida y Salidas',
                                            'software': 'Software',
                                            'services': 'Servicios'
                                        };

                                        const currencyCode = tx.currency || 'USD';
                                        const formattedAmount = formatCurrency(Number(tx.amount), currencyCode);

                                        let txDate;
                                        try {
                                            txDate = tx.date && tx.date.toDate ? tx.date.toDate() : new Date(tx.date);
                                        } catch {
                                            txDate = new Date();
                                        }

                                        return (
                                            <div
                                                key={tx.id}
                                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                                                onClick={() => {
                                                    setEditingTransaction(tx);
                                                    setModalMode('transaction');
                                                    setIsModalOpen(true);
                                                }}
                                            >
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isTransferTx(tx) ? 'bg-indigo-50 text-indigo-500' : tx.context === 'business' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                                                    <span className="material-symbols-outlined text-lg">
                                                        {isTransferTx(tx) ? 'swap_horiz' : tx.context === 'business' ? 'domain' : 'person'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{tx.title}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-medium capitalize truncate">
                                                        {isTransferTx(tx)
                                                            ? `${tx.card || '?'} → ${tx.destinationCard || '?'}`
                                                            : <>{tx.context === 'business' ? 'Negocio' : 'Personal'}{tx.card && ` • ${tx.card}`}</>}
                                                        • {categoryLabels[tx.category] || tx.category}
                                                        • {format(txDate, 'MMM dd, yyyy')}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col items-end justify-center gap-1">
                                                    <p className={`text-xs font-extrabold ${isTransferTx(tx) ? 'text-indigo-600' : tx.type === 'credit' ? 'text-green-600' : 'text-slate-800'}`}>
                                                        {isTransferTx(tx) ? '' : tx.type === 'credit' ? '+' : '-'}{formattedAmount}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {tx.comments && <span className="material-symbols-outlined text-[12px] text-slate-400" title={tx.comments}>chat</span>}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setConfirmDelete({ isOpen: true, txId: tx.id });
                                                            }}
                                                            className="text-slate-300 hover:text-red-500 transition-colors"
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
                        </div>

                        {/* Cashflow Chart */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col h-full">
                            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined text-teal-500">bolt</span> Histórico de Flujo de Caja
                            </h3>

                            <div className="h-64 flex flex-1 items-end gap-2 md:gap-6 pt-4 px-2">
                                {cashflowData.map((mes, i) => {
                                    const maxVal = Math.max(...cashflowData.map(d => Math.max(d.income, d.expenses))) || 1;
                                    const incomeHeight = (mes.income / maxVal) * 100;
                                    const expenseHeight = (mes.expenses / maxVal) * 100;

                                    return (
                                        <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                                            <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] p-2 rounded-lg whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-400"></div> IN: {formatCurrency(mes.income, 'COP')}</div>
                                                <div className="flex items-center gap-1 mt-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> OUT: {formatCurrency(mes.expenses, 'COP')}</div>
                                            </div>

                                            <div className="w-full flex justify-center gap-1 items-end h-full">
                                                <div className="w-3 md:w-6 bg-teal-400 rounded-t-md hover:bg-teal-500 transition-all duration-300 relative group-hover:shadow-[0_0_15px_rgba(45,212,191,0.5)]" style={{ height: `${incomeHeight}%` }}></div>
                                                <div className="w-3 md:w-6 bg-red-400 rounded-t-md hover:bg-red-500 transition-all duration-300 relative group-hover:shadow-[0_0_15px_rgba(248,113,113,0.5)]" style={{ height: `${expenseHeight}%` }}></div>
                                            </div>
                                            <span className="text-xs text-gray-400 mt-3 font-semibold uppercase">{mes.month}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-center gap-6 mt-6 border-t border-gray-50 pt-4">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-teal-400"></div><span className="text-sm text-gray-600 font-medium">Ingresos</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400"></div><span className="text-sm text-gray-600 font-medium">Egresos</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Category, Card Breakdown, Top Fugas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Category Breakdown */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col">
                            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-500">pie_chart</span> Gastos por Categoría
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">Top categorías en los últimos 3 meses.</p>

                            <div className="flex-1 flex flex-col mt-2">
                                <div className="w-full h-4 bg-gray-100 rounded-full flex overflow-hidden mb-4">
                                    {categoryBreakdown.map((cat, i) => (
                                        <div
                                            key={cat.name}
                                            className={`h-full ${i === 0 ? 'bg-slate-800' : i === 1 ? 'bg-teal-400' : i === 2 ? 'bg-red-400' : 'bg-gray-300'}`}
                                            style={{ width: `${cat.percentage}%` }}
                                            title={`${cat.name}: ${cat.percentage.toFixed(1)}%`}
                                        ></div>
                                    ))}
                                </div>

                                <ul className="space-y-3">
                                    {categoryBreakdown.map((cat, i) => (
                                        <li key={cat.name} className="flex justify-between text-sm items-center">
                                            <span className="flex items-center gap-2 text-gray-600 font-medium">
                                                <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-slate-800' : i === 1 ? 'bg-teal-400' : i === 2 ? 'bg-red-400' : 'bg-gray-300'}`}></div>
                                                {cat.name}
                                            </span>
                                            <span className="font-bold text-gray-800">{cat.percentage.toFixed(0)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Card/Account Breakdown */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col">
                            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-500">credit_card</span> Gastos por Tarjeta/Cuenta
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">Tarjetas más usadas en los últimos 3 meses.</p>

                            <div className="flex-1 flex flex-col mt-2">
                                <div className="w-full h-4 bg-gray-100 rounded-full flex overflow-hidden mb-4">
                                    {cardBreakdown.map((acc, i) => (
                                        <div
                                            key={acc.name}
                                            className={`h-full ${i === 0 ? 'bg-secondary' : i === 1 ? 'bg-primary-dark' : i === 2 ? 'bg-blue-400' : 'bg-gray-300'}`}
                                            style={{ width: `${acc.percentage}%` }}
                                            title={`${acc.name}: ${acc.percentage.toFixed(1)}%`}
                                        ></div>
                                    ))}
                                </div>

                                <ul className="space-y-3">
                                    {cardBreakdown.map((acc, i) => (
                                        <li key={acc.name} className="flex justify-between text-sm items-center">
                                            <span className="flex items-center gap-2 text-gray-600 font-medium overflow-hidden whitespace-nowrap overflow-ellipsis flex-1">
                                                <div className={`w-2 h-2 rounded-full shrink-0 ${i === 0 ? 'bg-secondary' : i === 1 ? 'bg-primary-dark' : i === 2 ? 'bg-blue-400' : 'bg-gray-300'}`}></div>
                                                <span className="truncate" title={acc.name}>{acc.name}</span>
                                            </span>
                                            <span className="font-bold text-gray-800 shrink-0 ml-2">{acc.percentage.toFixed(0)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Top Fugas */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex flex-col">
                            <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-500">warning</span> Mayores Fugas
                            </h3>
                            <p className="text-sm text-gray-500 mb-4">Mayores gastos individuales en los últimos 3 meses.</p>

                            <div className="space-y-4 flex-1 overflow-y-auto">
                                {topFugas.map((fuga, i) => (
                                    <div key={i} className="flex justify-between items-center group border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                                        <div className="min-w-0 pr-2">
                                            <h4 className="font-semibold text-gray-800 text-sm group-hover:text-teal-600 transition-colors truncate" title={fuga.name}>{fuga.name}</h4>
                                            <span className={`text-xs font-bold ${fuga.trend > 0 ? 'text-red-500' : 'text-teal-500'} flex items-center mt-0.5`}>
                                                <span className="material-symbols-outlined text-[10px] mr-0.5">
                                                    {fuga.trend > 0 ? 'north_east' : 'south_east'}
                                                </span>
                                                {fuga.trend > 0 ? '+' : ''}{fuga.trend.toFixed(0)}%
                                            </span>
                                        </div>
                                        <span className="font-bold text-gray-700 shrink-0">{formatCurrency(fuga.amount, 'COP')}</span>
                                    </div>
                                ))}
                                {topFugas.length === 0 && (
                                    <p className="text-sm text-gray-400 italic text-center py-4">No hay gastos registrados este mes.</p>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                editingTransaction={editingTransaction}
                initialMode={modalMode}
            />

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, txId: null })}
                onConfirm={() => {
                    if (confirmDelete.txId) {
                        deleteTransaction(confirmDelete.txId);
                    }
                }}
                title="Eliminar Transacción"
                message="¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
                isDestructive={true}
            />
        </div>
    );
};

export default Insights;
