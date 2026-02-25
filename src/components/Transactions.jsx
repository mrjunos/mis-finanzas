import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { format, startOfMonth, isWithinInterval, endOfDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency, formatCompactNumber } from '../utils/format';
import TransactionModal from './TransactionModal';
import ConfirmModal from './ConfirmModal';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

// Color palette for currencies
const CURRENCY_COLORS = {
    'COP': '#10b981', // emerald-500
    'USD': '#3b82f6', // blue-500
    'EUR': '#f59e0b', // amber-500
    'DEFAULT': '#8b5cf6' // violet-500
};

export default function Transactions({ currentContext }) {
    const { getTotals, deleteTransaction } = useFinance();
    const { filteredTransactions } = useMemo(() => getTotals(currentContext), [getTotals, currentContext]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, txId: null });

    // Filters
    const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

    // New Filters
    const [categoryFilter, setCategoryFilter] = useState('');
    const [subcategoryFilter, setSubcategoryFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [minAmountFilter, setMinAmountFilter] = useState('');
    const [maxAmountFilter, setMaxAmountFilter] = useState('');

    // Pagination
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Extract unique options for selects
    const uniqueCategories = useMemo(() => {
        const cats = new Set(filteredTransactions.map(t => t.category || 'General'));
        return Array.from(cats).sort();
    }, [filteredTransactions]);

    const uniqueSubcategories = useMemo(() => {
        // Only show subcategories related to selected category if one is selected
        const relevantTxs = categoryFilter ? filteredTransactions.filter(t => (t.category || 'General') === categoryFilter) : filteredTransactions;
        const subCats = new Set(relevantTxs.filter(t => t.subcategory).map(t => t.subcategory));
        return Array.from(subCats).sort();
    }, [filteredTransactions, categoryFilter]);

    const uniqueAccounts = useMemo(() => {
        const accounts = new Set();
        filteredTransactions.forEach(t => {
            accounts.add(t.card || t.account || 'Efectivo');
            if (t.destinationCard) accounts.add(t.destinationCard);
        });
        return Array.from(accounts).sort();
    }, [filteredTransactions]);

    // Apply filters
    const processedTransactions = useMemo(() => {
        let filtered = filteredTransactions;

        // Date filter
        const start = startOfDay(new Date(startDate + 'T00:00:00'));
        const end = endOfDay(new Date(endDate + 'T23:59:59'));

        filtered = filtered.filter(t => {
            const txDate = t.date;
            return isWithinInterval(txDate, { start, end });
        });

        // Category filter
        if (categoryFilter) {
            filtered = filtered.filter(t => (t.category || 'General') === categoryFilter);
        }

        // Subcategory filter
        if (subcategoryFilter) {
            filtered = filtered.filter(t => t.subcategory === subcategoryFilter);
        }

        // Account filter
        if (accountFilter) {
            filtered = filtered.filter(t => {
                const card = t.card || t.account || 'Efectivo';
                if (t.type === 'transfer' || t.isTransfer) {
                    return card === accountFilter || t.destinationCard === accountFilter;
                }
                return card === accountFilter;
            });
        }

        // Amount filters
        if (minAmountFilter !== '') {
            filtered = filtered.filter(t => t.amount >= Number(minAmountFilter));
        }
        if (maxAmountFilter !== '') {
            filtered = filtered.filter(t => t.amount <= Number(maxAmountFilter));
        }

        // Ensure sorted by date desc
        filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

        return filtered;
    }, [filteredTransactions, startDate, endDate, categoryFilter, subcategoryFilter, accountFilter, minAmountFilter, maxAmountFilter]);

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, categoryFilter, subcategoryFilter, accountFilter, minAmountFilter, maxAmountFilter, pageSize]);

    // Pagination slice
    const paginatedTransactions = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return processedTransactions.slice(startIndex, startIndex + pageSize);
    }, [processedTransactions, currentPage, pageSize]);

    const totalPages = Math.ceil(processedTransactions.length / pageSize) || 1;

    // Chart Data Preparation: Cumulative Balance by currency over time in this range
    const chartData = useMemo(() => {
        // Transactions are descending right now. We need ascending for charts
        const ascTransactions = [...processedTransactions].reverse();

        // Find which currencies are active in this period
        const activeCurrencies = new Set();
        ascTransactions.forEach(t => activeCurrencies.add(t.currency || 'USD'));

        // Compile balances over time
        let runningBalances = {};
        activeCurrencies.forEach(c => runningBalances[c] = 0);

        const dataPoints = [];

        ascTransactions.forEach(t => {
            const amount = t.type === 'credit' ? Number(t.amount) : -Number(t.amount);
            const currency = t.currency || 'USD';

            runningBalances[currency] += amount;

            const dateStr = format(t.date, 'dd MMM', { locale: es });

            // Check if we need to merge with the previous data point (if same day)
            // For a perfectly exact chart we might want one point per day, but one point per tx is fine too
            dataPoints.push({
                date: dateStr,
                timestamp: t.date.getTime(),
                ...runningBalances
            });
        });

        // If no transactions, provide empty points to not break chart
        return { dataPoints, currencies: Array.from(activeCurrencies) };
    }, [processedTransactions]);


    const renderChart = () => {
        const { dataPoints, currencies } = chartData;

        if (currencies.length === 0) {
            return (
                <div className="h-64 flex items-center justify-center text-slate-400 bg-white/40 rounded-2xl border border-white/40 shadow-sm">
                    No hay datos para el rango seleccionado.
                </div>
            );
        }

        return (
            <div className="h-80 w-full bg-white/40 rounded-2xl border border-white/40 shadow-sm p-4 backdrop-blur-md">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataPoints} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />

                        {/* Render multiple Y axes, one for each currency */}
                        {currencies.map((currency, index) => (
                            <YAxis
                                key={`y-${currency}`}
                                yAxisId={currency}
                                orientation={index % 2 === 0 ? "left" : "right"}
                                stroke={CURRENCY_COLORS[currency] || CURRENCY_COLORS.DEFAULT}
                                fontSize={12}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => formatCompactNumber(val)}
                            />
                        ))}

                        <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            formatter={(value, name) => {
                                const curr = name.replace('Balance ', '');
                                try {
                                    return [formatCurrency(value, curr), name];
                                } catch {
                                    return [`$${value}`, name];
                                }
                            }}
                            labelStyle={{ color: '#475569', fontWeight: '500', marginBottom: '8px' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {currencies.map(currency => (
                            <Line
                                key={`l-${currency}`}
                                yAxisId={currency}
                                type="monotone"
                                dataKey={currency}
                                name={`Balance ${currency}`}
                                stroke={CURRENCY_COLORS[currency] || CURRENCY_COLORS.DEFAULT}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        );
    };

    return (
        <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto w-full relative">
            <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-8 pb-12">
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-br from-slate-900 via-primary to-secondary bg-clip-text text-transparent">
                            Historial de Transacciones
                        </h1>
                        <p className="text-slate-500 mt-2">
                            Analiza y filtra todos tus movimientos
                        </p>
                    </div>

                    {/* Advanced Filters */}
                    <div className="bg-white/60 p-4 rounded-2xl border border-white/50 backdrop-blur-md shadow-sm">
                        <div className="flex flex-wrap items-end gap-4">
                            {/* Date Group */}
                            <div className="flex flex-col gap-1 border-r border-slate-200 pr-4">
                                <label className="text-xs text-slate-500 font-bold uppercase tracking-wider">Fechas</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        title="Desde"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none cursor-pointer"
                                    />
                                    <span className="text-slate-400 font-medium">-</span>
                                    <input
                                        type="date"
                                        title="Hasta"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Attribs Group */}
                            <div className="flex flex-wrap items-end gap-3 flex-1">
                                <div className="flex flex-col min-w-[140px] flex-1 max-w-[200px]">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Categoría</label>
                                    <select
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                        value={categoryFilter}
                                        onChange={(e) => {
                                            setCategoryFilter(e.target.value);
                                            setSubcategoryFilter(''); // Reset subcat when cat changes
                                        }}
                                    >
                                        <option value="">Todas</option>
                                        {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>

                                <div className="flex flex-col min-w-[140px] flex-1 max-w-[200px]">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Subcategoría</label>
                                    <select
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                        value={subcategoryFilter}
                                        onChange={(e) => setSubcategoryFilter(e.target.value)}
                                    >
                                        <option value="">Todas</option>
                                        {uniqueSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div className="flex flex-col min-w-[140px] flex-1 max-w-[200px]">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Cuenta</label>
                                    <select
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                        value={accountFilter}
                                        onChange={(e) => setAccountFilter(e.target.value)}
                                    >
                                        <option value="">Todas</option>
                                        {uniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Amounts Group */}
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex flex-col w-24">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Monto Mín.</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={minAmountFilter}
                                        onChange={(e) => setMinAmountFilter(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none w-full"
                                    />
                                </div>
                                <div className="flex flex-col w-24">
                                    <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Monto Máx.</label>
                                    <input
                                        type="number"
                                        placeholder="∞"
                                        value={maxAmountFilter}
                                        onChange={(e) => setMaxAmountFilter(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none w-full"
                                    />
                                </div>
                            </div>

                            {/* Clear Filters Button */}
                            <div className="flex items-center pb-0.5">
                                <button
                                    onClick={() => {
                                        setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                                        setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                        setCategoryFilter('');
                                        setSubcategoryFilter('');
                                        setAccountFilter('');
                                        setMinAmountFilter('');
                                        setMaxAmountFilter('');
                                    }}
                                    className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1 h-[38px]"
                                    title="Limpiar todos los filtros"
                                >
                                    <span className="material-symbols-outlined text-sm">filter_list_off</span>
                                    <span className="hidden sm:inline">Limpiar</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-slate-800">Evolución de Balances</h2>
                    {renderChart()}
                </div>

                {/* List Section */}
                <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h2 className="text-lg font-bold text-slate-800">
                            Resultados ({processedTransactions.length})
                        </h2>

                        {/* Stepper / Page Size control */}
                        <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-xl">
                            {[10, 20, 50].map(size => (
                                <button
                                    key={size}
                                    onClick={() => { setPageSize(size); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-300 ${pageSize === size
                                        ? 'bg-white text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                        }`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Fecha</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Concepto</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Categoría</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Cuenta</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm opacity-0">Context</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm text-right">Monto</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((tx) => (
                                        <tr
                                            key={tx.id}
                                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                                            onClick={() => {
                                                setEditingTransaction(tx);
                                                setIsModalOpen(true);
                                            }}
                                        >
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {format(tx.date, "dd MMM yyyy", { locale: es })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-800">{tx.title || tx.description}</div>
                                                {tx.comments && <div className="text-[10px] text-slate-400 mt-1">{tx.comments}</div>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                        {tx.category || 'General'}
                                                    </span>
                                                    {tx.subcategory && (
                                                        <span className="text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                                            {tx.subcategory}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {(tx.type === 'transfer' || tx.isTransfer)
                                                    ? <>{tx.card || 'Efectivo'} <span className="text-indigo-400">→</span> {tx.destinationCard || '?'}</>
                                                    : (tx.card || tx.account || 'Efectivo')}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                {tx.context === 'business' ? (
                                                    <span className="material-symbols-outlined text-amber-500 text-sm" title="Negocio">storefront</span>
                                                ) : (
                                                    <span className="material-symbols-outlined text-blue-500 text-sm" title="Personal">person</span>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-semibold text-right ${(tx.type === 'transfer' || tx.isTransfer) ? 'text-indigo-600' : tx.type === 'credit' ? 'text-emerald-500' : 'text-slate-800'}`}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <span>
                                                        {(tx.type === 'transfer' || tx.isTransfer) ? '' : tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount || 0, tx.currency || 'USD')}
                                                    </span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${tx.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {tx.currency || 'USD'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmDelete({ isOpen: true, txId: tx.id });
                                                    }}
                                                    className="text-slate-400 md:text-slate-300 hover:text-red-500 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                                    title="Eliminar transacción"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                            No se encontraron transacciones en este rango de fechas.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
                            <span className="text-sm text-slate-500">
                                Mostrando página <span className="font-medium text-slate-700">{currentPage}</span> de <span className="font-medium text-slate-700">{totalPages}</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-primary disabled:opacity-50 disabled:hover:bg-transparent transition-all flex items-center justify-center w-8 h-8 font-bold"
                                >
                                    &lt;
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-white hover:text-primary disabled:opacity-50 disabled:hover:bg-transparent transition-all flex items-center justify-center w-8 h-8 font-bold"
                                >
                                    &gt;
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <TransactionModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
                editingTransaction={editingTransaction}
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
}

