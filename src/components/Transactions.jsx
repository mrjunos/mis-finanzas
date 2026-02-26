import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { format, startOfYear, isWithinInterval, endOfDay, startOfDay } from 'date-fns';
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
    const { getTotals, deleteTransaction, appConfig } = useFinance();
    const { filteredTransactions } = useMemo(() => getTotals(currentContext), [getTotals, currentContext]);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, txId: null });

    // Filters
    const [startDate, setStartDate] = useState(() => format(startOfYear(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

    // New Filters
    const [categoryFilter, setCategoryFilter] = useState('');
    const [subcategoryFilter, setSubcategoryFilter] = useState('');
    const [accountFilter, setAccountFilter] = useState('');
    const [minAmountFilter, setMinAmountFilter] = useState('');
    const [maxAmountFilter, setMaxAmountFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [searchText, setSearchText] = useState('');
    const [noSubcategoryOnly, setNoSubcategoryOnly] = useState(false);

    // Pagination
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCurrency, setSelectedCurrency] = useState(null);

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

        // Type filter
        if (typeFilter) {
            if (typeFilter === 'transfer') {
                filtered = filtered.filter(t => t.type === 'transfer' || t.isTransfer);
            } else {
                filtered = filtered.filter(t => t.type === typeFilter && !t.isTransfer);
            }
        }

        // Text search
        if (searchText.trim()) {
            const query = searchText.trim().toLowerCase();
            filtered = filtered.filter(t => {
                const title = (t.title || t.description || '').toLowerCase();
                const comments = (t.comments || '').toLowerCase();
                return title.includes(query) || comments.includes(query);
            });
        }

        // No subcategory filter
        if (noSubcategoryOnly) {
            filtered = filtered.filter(t => !t.subcategory);
        }

        // Ensure sorted by date desc
        filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

        return filtered;
    }, [filteredTransactions, startDate, endDate, categoryFilter, subcategoryFilter, accountFilter, minAmountFilter, maxAmountFilter, typeFilter, searchText, noSubcategoryOnly]);

    // Reset pagination when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [startDate, endDate, categoryFilter, subcategoryFilter, accountFilter, minAmountFilter, maxAmountFilter, typeFilter, searchText, noSubcategoryOnly, pageSize]);

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

    // Search Summary Calculation
    const searchSummary = useMemo(() => {
        const activeCurrency = selectedCurrency || (chartData.currencies.length > 0 ? chartData.currencies[0] : 'USD');

        let totalIngresos = 0;
        let totalEgresos = 0;
        let totalTransferencias = 0;

        const categorias = {};
        const subcategorias = {};
        const cuentas = {};

        // Only process transactions that match the active currency to keep totals consistent
        const relevantTxs = processedTransactions.filter(t => (t.currency || 'USD') === activeCurrency);

        relevantTxs.forEach(t => {
            const amount = Number(t.amount || 0);

            // Totals by type & Account Net Flows
            if (t.type === 'transfer' || t.isTransfer) {
                totalTransferencias += amount;
            } else if (t.type === 'credit') {
                totalIngresos += amount;
                const account = t.card || t.account || 'Efectivo';
                cuentas[account] = (cuentas[account] || 0) + amount;
            } else {
                totalEgresos += amount;
                const account = t.card || t.account || 'Efectivo';
                cuentas[account] = (cuentas[account] || 0) - amount;

                // Categories and Subcategories (only tracking expenses for these usually makes sense, but we can track all or just debits. Let's track debits for categorizations of expenses)
                const category = t.category || 'General';
                categorias[category] = (categorias[category] || 0) + amount;

                if (t.subcategory) {
                    const key = `${category} - ${t.subcategory}`;
                    subcategorias[key] = (subcategorias[key] || 0) + amount;
                }
            }
        });

        const sortedCategories = Object.entries(categorias)
            .sort(([, a], [, b]) => b - a)
            .map(([name, amount]) => ({ name, amount }));

        const sortedSubcategories = Object.entries(subcategorias)
            .sort(([, a], [, b]) => b - a)
            .map(([name, amount]) => ({ name, amount }));

        const sortedAccounts = Object.entries(cuentas)
            .sort(([, a], [, b]) => b - a) // Sort by highest net flow first
            .map(([name, amount]) => ({ name, amount }));

        return {
            currency: activeCurrency,
            totalIngresos,
            totalEgresos,
            totalTransferencias,
            categories: sortedCategories,
            subcategories: sortedSubcategories,
            accounts: sortedAccounts,
            hasData: relevantTxs.length > 0
        };
    }, [processedTransactions, selectedCurrency, chartData.currencies]);


    // Auto-select first currency when available currencies change
    React.useEffect(() => {
        const { currencies } = chartData;
        if (currencies.length > 0 && (!selectedCurrency || !currencies.includes(selectedCurrency))) {
            setSelectedCurrency(currencies[0]);
        }
    }, [chartData, selectedCurrency]);

    const renderChart = () => {
        const { dataPoints, currencies } = chartData;

        if (currencies.length === 0) {
            return (
                <div className="h-64 flex items-center justify-center text-slate-400 bg-white/40 rounded-2xl border border-white/40 shadow-sm">
                    No hay datos para el rango seleccionado.
                </div>
            );
        }

        const activeCurrency = selectedCurrency || currencies[0];
        const color = CURRENCY_COLORS[activeCurrency] || CURRENCY_COLORS.DEFAULT;

        return (
            <div className="w-full bg-white/40 rounded-2xl border border-white/40 shadow-sm p-4 backdrop-blur-md flex flex-col gap-3">
                {/* Currency toggle pills */}
                {currencies.length > 1 && (
                    <div className="flex items-center gap-2">
                        {currencies.map(currency => {
                            const isActive = currency === activeCurrency;
                            const pillColor = CURRENCY_COLORS[currency] || CURRENCY_COLORS.DEFAULT;
                            return (
                                <button
                                    key={currency}
                                    onClick={() => setSelectedCurrency(currency)}
                                    className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-200"
                                    style={{
                                        backgroundColor: isActive ? pillColor : 'transparent',
                                        color: isActive ? '#fff' : pillColor,
                                        border: `2px solid ${pillColor}`,
                                        opacity: isActive ? 1 : 0.6,
                                    }}
                                >
                                    {currency}
                                </button>
                            );
                        })}
                    </div>
                )}

                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dataPoints} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis
                                stroke={color}
                                fontSize={12}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => formatCompactNumber(val)}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                formatter={(value) => {
                                    try {
                                        return [formatCurrency(value, activeCurrency), `Balance ${activeCurrency}`];
                                    } catch {
                                        return [`$${value}`, `Balance ${activeCurrency}`];
                                    }
                                }}
                                labelStyle={{ color: '#475569', fontWeight: '500', marginBottom: '8px' }}
                            />
                            <Line
                                type="monotone"
                                dataKey={activeCurrency}
                                name={`Balance ${activeCurrency}`}
                                stroke={color}
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
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
                        <div className="flex flex-wrap items-end gap-3">
                            {/* Search */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Buscar</label>
                                <div className="relative">
                                    <span className="material-symbols-outlined text-slate-400 text-sm absolute left-2.5 top-1/2 -translate-y-1/2">search</span>
                                    <input
                                        type="text"
                                        placeholder="Título o comentario..."
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 pl-8 text-slate-700 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="flex flex-col">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Fechas</label>
                                <div className="flex items-center gap-1.5">
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

                            {/* Type */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Tipo</label>
                                <select
                                    className="custom-select bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    <option value="credit">Ingreso</option>
                                    <option value="debit">Egreso</option>
                                    <option value="transfer">Transferencia</option>
                                </select>
                            </div>

                            {/* Category */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Categoría</label>
                                <select
                                    className="custom-select bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                    value={categoryFilter}
                                    onChange={(e) => {
                                        setCategoryFilter(e.target.value);
                                        setSubcategoryFilter('');
                                    }}
                                >
                                    <option value="">Todas</option>
                                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            {/* Subcategory */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Subcategoría</label>
                                <select
                                    className="custom-select bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                    value={subcategoryFilter}
                                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                                >
                                    <option value="">Todas</option>
                                    {uniqueSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Account */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Cuenta</label>
                                <select
                                    className="custom-select bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none"
                                    value={accountFilter}
                                    onChange={(e) => setAccountFilter(e.target.value)}
                                >
                                    <option value="">Todas</option>
                                    {uniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            {/* Min Amount */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Monto Mín.</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={minAmountFilter}
                                    onChange={(e) => setMinAmountFilter(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none w-full"
                                />
                            </div>

                            {/* Max Amount */}
                            <div className="flex flex-col min-w-[180px] flex-1 max-w-[240px]">
                                <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Monto Máx.</label>
                                <input
                                    type="number"
                                    placeholder="∞"
                                    value={maxAmountFilter}
                                    onChange={(e) => setMaxAmountFilter(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-1 focus:ring-primary p-2 text-slate-700 outline-none w-full"
                                />
                            </div>

                            {/* No subcategory checkbox */}
                            <div className="flex items-end">
                                <button
                                    onClick={() => setNoSubcategoryOnly(v => !v)}
                                    className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 h-[38px] border ${noSubcategoryOnly
                                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                                        : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800'
                                        }`}
                                    title="Mostrar solo transacciones sin subcategoría"
                                >
                                    <span className="material-symbols-outlined text-sm">{noSubcategoryOnly ? 'check_box' : 'check_box_outline_blank'}</span>
                                    <span className="hidden sm:inline text-xs">Sin subcat.</span>
                                </button>
                            </div>

                            {/* Clear Filters Button */}
                            <div className="flex items-center pb-0.5">
                                <button
                                    onClick={() => {
                                        setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
                                        setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                        setCategoryFilter('');
                                        setSubcategoryFilter('');
                                        setAccountFilter('');
                                        setMinAmountFilter('');
                                        setMaxAmountFilter('');
                                        setTypeFilter('');
                                        setSearchText('');
                                        setNoSubcategoryOnly(false);
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
                                    <th className="pl-4 pr-1 py-4 w-8"></th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Fecha</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Concepto</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Categoría</th>
                                    <th className="px-6 py-4 font-medium text-slate-500 text-sm">Cuenta</th>
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
                                            <td className="pl-4 pr-1 py-4 w-14">
                                                <div className="flex items-center gap-1">
                                                    {tx.context === 'business' ? (
                                                        <span className="material-symbols-outlined text-amber-500 text-sm" title="Negocio">storefront</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-blue-500 text-sm" title="Personal">person</span>
                                                    )}
                                                    {(tx.type === 'transfer' || tx.isTransfer) ? (
                                                        <span className="material-symbols-outlined text-indigo-500 text-sm" title="Transferencia">swap_horiz</span>
                                                    ) : tx.type === 'credit' ? (
                                                        <span className="material-symbols-outlined text-emerald-500 text-sm" title="Ingreso">arrow_upward</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-rose-500 text-sm" title="Egreso">arrow_downward</span>
                                                    )}
                                                </div>
                                            </td>
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

                {/* Analysis/Summary Section */}
                {searchSummary.hasData && (
                    <div className="flex flex-col gap-4 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-xl font-bold text-slate-800">Resumen de Resultados</h2>
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg uppercase tracking-wider">
                                {searchSummary.currency}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {/* Totales por Tipo */}
                            <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm p-6 flex flex-col h-full">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">donut_large</span>
                                    Flujo Neto
                                </h3>
                                <div className="space-y-4 flex-1">
                                    <div className="flex justify-between items-center p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                                        <div className="flex items-center gap-2 text-emerald-600">
                                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                            <span className="font-medium text-sm">Ingresos</span>
                                        </div>
                                        <span className="font-bold text-emerald-600">
                                            +{formatCurrency(searchSummary.totalIngresos, searchSummary.currency)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                                        <div className="flex items-center gap-2 text-rose-600">
                                            <span className="material-symbols-outlined text-sm">arrow_downward</span>
                                            <span className="font-medium text-sm">Egresos</span>
                                        </div>
                                        <span className="font-bold text-rose-600">
                                            -{formatCurrency(searchSummary.totalEgresos, searchSummary.currency)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
                                        <div className="flex items-center gap-2 text-indigo-600">
                                            <span className="material-symbols-outlined text-sm">swap_horiz</span>
                                            <span className="font-medium text-sm">Transferencias</span>
                                        </div>
                                        <span className="font-bold text-indigo-600">
                                            {formatCurrency(searchSummary.totalTransferencias, searchSummary.currency)}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100/50 flex justify-between items-center">
                                    <span className="text-sm font-bold text-slate-500">Balance Periodo</span>
                                    <span className={`font-extrabold ${searchSummary.totalIngresos - searchSummary.totalEgresos >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {(searchSummary.totalIngresos - searchSummary.totalEgresos >= 0 ? '+' : '')}
                                        {formatCurrency(searchSummary.totalIngresos - searchSummary.totalEgresos, searchSummary.currency)}
                                    </span>
                                </div>
                            </div>

                            {/* Gastos por Categoría */}
                            <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm p-6 flex flex-col h-full max-h-[360px]">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-purple-400 text-lg">pie_chart</span>
                                    Egresos por Categoría
                                </h3>
                                <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
                                    {searchSummary.categories.length > 0 ? searchSummary.categories.map((cat) => {
                                        const catConfig = appConfig?.categories?.find(c => c.name === cat.name);
                                        const icon = catConfig?.icon || 'category';
                                        return (
                                            <div key={cat.name} className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="material-symbols-outlined text-purple-400 text-lg shrink-0">{icon}</span>
                                                    <span className="text-slate-600 font-medium truncate" title={cat.name}>{cat.name}</span>
                                                </div>
                                                <span className="font-bold text-slate-800 ml-2 shrink-0">
                                                    {formatCurrency(cat.amount, searchSummary.currency)}
                                                </span>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-sm text-slate-400 italic text-center py-4">No hay egresos registrados.</p>
                                    )}
                                </div>
                            </div>

                            {/* Gastos por Subcategoría */}
                            <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm p-6 flex flex-col h-full max-h-[360px]">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-amber-400 text-lg">list_alt</span>
                                    Top Subcategorías
                                </h3>
                                <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
                                    {searchSummary.subcategories.length > 0 ? searchSummary.subcategories.map((sub) => {
                                        const [cat, subcat] = sub.name.split(' - ');
                                        const catConfig = appConfig?.categories?.find(c => c.name === cat);
                                        const icon = catConfig?.icon || 'category';
                                        return (
                                            <div key={sub.name} className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <span className="material-symbols-outlined text-amber-500 text-lg shrink-0">{icon}</span>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className="text-slate-800 font-medium truncate" title={subcat}>{subcat}</span>
                                                        <span className="text-[10px] text-slate-400 truncate uppercase tracking-wider">{cat}</span>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-slate-800 ml-2 shrink-0">
                                                    {formatCurrency(sub.amount, searchSummary.currency)}
                                                </span>
                                            </div>
                                        );
                                    }) : (
                                        <p className="text-sm text-slate-400 italic text-center py-4">No hay subcategorías registradas.</p>
                                    )}
                                </div>
                            </div>

                            {/* Movimientos por Cuenta */}
                            <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm p-6 flex flex-col h-full max-h-[360px]">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
                                    <span className="material-symbols-outlined text-blue-400 text-lg">account_balance_wallet</span>
                                    Flujo Neto por Cuenta
                                </h3>
                                <div className="overflow-y-auto pr-2 space-y-3 flex-1 custom-scrollbar">
                                    {searchSummary.accounts.length > 0 ? searchSummary.accounts.map((acc) => (
                                        <div key={acc.name} className="flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0"></div>
                                                <span className="text-slate-600 font-medium truncate" title={acc.name}>{acc.name}</span>
                                            </div>
                                            <span className={`font-bold shrink-0 ml-2 ${acc.amount > 0 ? 'text-emerald-500' : acc.amount < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                                                {acc.amount > 0 ? '+' : ''}{formatCurrency(acc.amount, searchSummary.currency)}
                                            </span>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-slate-400 italic text-center py-4">No hay flujos registrados.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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

