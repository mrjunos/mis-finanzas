import React, { useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';

const EXCHANGE_RATE = 4100; // Hardcoded COP/USD rate for estimation

const Insights = ({ currentContext }) => {
    const { transactions, getTotals } = useFinance();

    const formatCompact = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: 1
        }).format(amount);
    };

    // Filter transactions by context
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (currentContext === 'unified') return true;
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
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
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
            return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
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
                t.date.getMonth() === m && t.date.getFullYear() === y && t.type === 'debit'
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

            const txs = filteredTransactions.filter(t => t.date.getMonth() === m && t.date.getFullYear() === y);

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

    // 5. Category Breakdown (Current Month) - "Guilt Index" replacement
    const categoryBreakdown = useMemo(() => {
         const currentMonthTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.type === 'debit';
        });

        const categories = {};
        let total = 0;

        currentMonthTxs.forEach(t => {
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
    }, [filteredTransactions, currentMonth, currentYear]);


    // 6. Top Fugas (Highest Expenses by Title - Current Month)
    const topFugas = useMemo(() => {
        const currentMonthTxs = filteredTransactions.filter(t => {
            const d = t.date;
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.type === 'debit';
        });

        const groups = {};
        currentMonthTxs.forEach(t => {
             const amount = t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount;
             const title = t.title || 'Sin Nombre';
             groups[title] = (groups[title] || 0) + amount;
        });

        // Get Top 4
        const sorted = Object.entries(groups)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([name, amount]) => {
                // Calculate trend vs previous month for same title
                const prevMonthTxs = filteredTransactions.filter(t => {
                    const d = t.date;
                    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear && t.type === 'debit' && t.title === name;
                });
                const prevAmount = prevMonthTxs.reduce((acc, t) => acc + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);

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
    }, [filteredTransactions, currentMonth, currentYear, lastMonth, lastMonthYear]);


    return (
        <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 font-sans w-full overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6 pb-20">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Radiografía Financiera</h1>
                        <p className="text-sm text-gray-500">Deja de adivinar a dónde se va la plata.</p>
                    </div>
                </div>

                {/* Top KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Savings Rate */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 transition-transform hover:scale-[1.02] duration-300">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tasa de Ahorro</p>
                            <div className="p-2 bg-teal-50 rounded-xl text-teal-500">
                                <span className="material-symbols-outlined text-lg">trending_up</span>
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-800">{savingsRate.toFixed(1)}%</h2>
                        <p className={`text-sm flex items-center mt-2 font-medium ${savingsRateTrend >= 0 ? 'text-teal-500' : 'text-red-500'}`}>
                            <span className="material-symbols-outlined text-sm mr-1">
                                {savingsRateTrend >= 0 ? 'north_east' : 'south_east'}
                            </span>
                            {savingsRateTrend >= 0 ? '+' : ''}{savingsRateTrend.toFixed(1)}% vs mes pasado
                        </p>
                    </div>

                    {/* Burn Rate */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 transition-transform hover:scale-[1.02] duration-300">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Burn Rate Mensual</p>
                            <div className="p-2 bg-red-50 rounded-xl text-red-500">
                                <span className="material-symbols-outlined text-lg">local_fire_department</span>
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-gray-800">{formatCompact(burnRate)} <span className="text-sm text-gray-400 font-normal">/ mes</span></h2>
                        <p className="text-sm text-gray-500 mt-2 font-medium">Promedio últimos 3 meses.</p>
                    </div>

                    {/* Currency Exposure */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 transition-transform hover:scale-[1.02] duration-300">
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Exposición de Moneda</p>
                            <div className="p-2 bg-blue-50 rounded-xl text-blue-500">
                                <span className="material-symbols-outlined text-lg">attach_money</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1"><span className="font-bold text-gray-700">COP</span><span>{currencyExposure.cop.toFixed(0)}%</span></div>
                                <div className="h-2 w-full bg-gray-100 rounded-full"><div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${currencyExposure.cop}%` }}></div></div>
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1"><span className="font-bold text-gray-700">USD</span><span>{currencyExposure.usd.toFixed(0)}%</span></div>
                                <div className="h-2 w-full bg-gray-100 rounded-full"><div className="h-full bg-teal-400 rounded-full transition-all duration-500" style={{ width: `${currencyExposure.usd}%` }}></div></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Charts Area */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Cashflow Chart */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 lg:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-500">bolt</span> Histórico de Flujo de Caja
                        </h3>

                        <div className="h-64 flex items-end gap-2 md:gap-6 pt-4 px-2">
                            {cashflowData.map((mes, i) => {
                                // Dynamic scaling based on max value in the set
                                const maxVal = Math.max(...cashflowData.map(d => Math.max(d.income, d.expenses))) || 1;
                                const incomeHeight = (mes.income / maxVal) * 100;
                                const expenseHeight = (mes.expenses / maxVal) * 100;

                                return (
                                    <div key={i} className="flex-1 flex flex-col justify-end items-center group relative h-full">
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] p-2 rounded-lg whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-teal-400"></div> IN: {formatCompact(mes.income)}</div>
                                            <div className="flex items-center gap-1 mt-1"><div className="w-2 h-2 rounded-full bg-red-400"></div> OUT: {formatCompact(mes.expenses)}</div>
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

                    {/* Side Widgets */}
                    <div className="space-y-6 lg:col-span-1">

                        {/* Category Breakdown */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Gastos por Categoría</h3>
                            <p className="text-sm text-gray-500 mb-4">Top 3 categorías este mes.</p>

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

                        {/* Top Fugas */}
                        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-500">warning</span> Mayores Fugas
                            </h3>
                            <div className="space-y-4">
                                {topFugas.map((fuga, i) => (
                                    <div key={i} className="flex justify-between items-center group border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                                        <div>
                                            <h4 className="font-semibold text-gray-800 text-sm group-hover:text-teal-600 transition-colors">{fuga.name}</h4>
                                            <span className={`text-xs font-bold ${fuga.trend > 0 ? 'text-red-500' : 'text-teal-500'} flex items-center mt-0.5`}>
                                                <span className="material-symbols-outlined text-[10px] mr-0.5">
                                                    {fuga.trend > 0 ? 'north_east' : 'south_east'}
                                                </span>
                                                {fuga.trend > 0 ? '+' : ''}{fuga.trend.toFixed(0)}%
                                            </span>
                                        </div>
                                        <span className="font-bold text-gray-700">{formatCompact(fuga.amount)}</span>
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
        </div>
    );
};

export default Insights;
