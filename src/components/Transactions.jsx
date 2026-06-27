import React, { useState, useMemo, useCallback, useDeferredValue, Suspense } from 'react';
import { useFinance } from '../context/FinanceContext';
import { format, startOfYear, isWithinInterval, endOfDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import ConfirmModal from './ConfirmModal';
import {
  Icon, Card, Pill, IconTile, Eyebrow, hueForCategory, hueColorVar
} from './ds/Primitives';

const LazyBalanceChart = React.lazy(() => import('./BalanceChart'));

// Small filter field wrapper
const FilterField = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 150, flex: 1, maxWidth: 220 }}>
    <Eyebrow style={{ marginBottom: 5 }}>{label}</Eyebrow>
    {children}
  </div>
);

const filterInputStyle = {
  background: 'var(--bg-default)',
  border: '1px solid var(--border-default)',
  borderRadius: 10, padding: '8px 10px',
  fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-sans)',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

export default function Transactions({ currentContext, onNavigate, onEditTransaction }) {
  const { getTotals, deleteTransaction } = useFinance();
  const { filteredTransactions } = useMemo(() => getTotals(currentContext), [getTotals, currentContext]);

  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, txId: null });

  // Filters
  const [startDate, setStartDate] = useState(() => format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate]     = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [categoryFilter, setCategoryFilter]     = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [accountFilter, setAccountFilter]         = useState('');
  const [minAmountFilter, setMinAmountFilter]     = useState('');
  const [maxAmountFilter, setMaxAmountFilter]     = useState('');
  const [typeFilter, setTypeFilter]               = useState('');
  const [searchText, setSearchText]               = useState('');
  const deferredSearch = useDeferredValue(searchText);
  const [noSubcategoryOnly, setNoSubcategoryOnly] = useState(false);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [pageSize, setPageSize]     = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCurrency, setSelectedCurrency] = useState(null);

  // ── Month overview (MovimientosB hero) ───────────────────────────────
  const today = useMemo(() => new Date(), []);
  const monthInfo = useMemo(() => {
    const y = today.getFullYear(), m = today.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayDay = today.getDate();
    const days = new Array(daysInMonth).fill(0);
    const pm = m === 0 ? 11 : m - 1;
    const pmy = m === 0 ? y - 1 : y;
    let monthTotal = 0, prevTotal = 0;
    filteredTransactions.forEach(t => {
      if (t.type !== 'debit' || t.isTransfer) return;
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      const amt = Number(t.amount) || 0;
      if (d.getFullYear() === y && d.getMonth() === m) {
        days[d.getDate() - 1] += amt;
        monthTotal += amt;
      } else if (d.getFullYear() === pmy && d.getMonth() === pm && d.getDate() <= todayDay) {
        prevTotal += amt;
      }
    });
    return { y, m, daysInMonth, todayDay, days, monthTotal, prevTotal };
  }, [filteredTransactions, today]);

  const dayStr = (d) => `${monthInfo.y}-${String(monthInfo.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const selectedDay = useMemo(() => {
    if (startDate !== endDate) return null;
    const d = new Date(startDate + 'T00:00:00');
    if (d.getFullYear() === monthInfo.y && d.getMonth() === monthInfo.m) return d.getDate();
    return null;
  }, [startDate, endDate, monthInfo]);

  const selectDay = (d) => {
    if (selectedDay === d) {
      setStartDate(dayStr(1));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
    } else {
      setStartDate(dayStr(d));
      setEndDate(dayStr(d));
    }
  };

  const uniqueCategories = useMemo(() => Array.from(new Set(filteredTransactions.map(t => t.category || 'General'))).sort(), [filteredTransactions]);
  const uniqueSubcategories = useMemo(() => {
    const rel = categoryFilter ? filteredTransactions.filter(t => (t.category || 'General') === categoryFilter) : filteredTransactions;
    return Array.from(new Set(rel.filter(t => t.subcategory).map(t => t.subcategory))).sort();
  }, [filteredTransactions, categoryFilter]);
  const uniqueAccounts = useMemo(() => {
    const s = new Set();
    filteredTransactions.forEach(t => {
      s.add(t.card || t.account || 'Efectivo');
      if (t.destinationCard) s.add(t.destinationCard);
    });
    return Array.from(s).sort();
  }, [filteredTransactions]);

  const processedTransactions = useMemo(() => {
    let list = filteredTransactions;
    const start = startOfDay(new Date(startDate + 'T00:00:00'));
    const end   = endOfDay(new Date(endDate   + 'T23:59:59'));
    list = list.filter(t => isWithinInterval(t.date, { start, end }));
    if (categoryFilter)    list = list.filter(t => (t.category || 'General') === categoryFilter);
    if (subcategoryFilter) list = list.filter(t => t.subcategory === subcategoryFilter);
    if (accountFilter) {
      list = list.filter(t => {
        const card = t.card || t.account || 'Efectivo';
        return t.type === 'transfer' || t.isTransfer ? card === accountFilter || t.destinationCard === accountFilter : card === accountFilter;
      });
    }
    if (minAmountFilter !== '') list = list.filter(t => t.amount >= Number(minAmountFilter));
    if (maxAmountFilter !== '') list = list.filter(t => t.amount <= Number(maxAmountFilter));
    if (typeFilter) {
      if (typeFilter === 'transfer') list = list.filter(t => t.type === 'transfer' || t.isTransfer);
      else list = list.filter(t => t.type === typeFilter && !t.isTransfer);
    }
    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      list = list.filter(t => (t.title || t.description || '').toLowerCase().includes(q) || (t.comments || '').toLowerCase().includes(q));
    }
    if (noSubcategoryOnly) list = list.filter(t => !t.subcategory);
    if (pendingOnly) list = list.filter(t => t.status === 'pending');
    // Orden por fecha+hora (sortAt); fallback a date para registros antiguos sin timestamp
    list.sort((a, b) => (b.sortAt || b.date).getTime() - (a.sortAt || a.date).getTime());
    return list;
  }, [filteredTransactions, startDate, endDate, categoryFilter, subcategoryFilter, accountFilter, minAmountFilter, maxAmountFilter, typeFilter, deferredSearch, noSubcategoryOnly, pendingOnly]);

  React.useEffect(() => { setCurrentPage(1); }, [startDate, endDate, categoryFilter, subcategoryFilter, accountFilter, minAmountFilter, maxAmountFilter, typeFilter, deferredSearch, noSubcategoryOnly, pendingOnly, pageSize]);

  const paginatedTransactions = useMemo(() => processedTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize), [processedTransactions, currentPage, pageSize]);
  const totalPages = Math.ceil(processedTransactions.length / pageSize) || 1;
  const pendingCount = useMemo(() => processedTransactions.filter(t => t.status === 'pending').length, [processedTransactions]);

  const chartData = useMemo(() => {
    const asc = [...processedTransactions].reverse();
    const activeCurrencies = new Set();
    asc.forEach(t => activeCurrencies.add(t.currency || 'USD'));
    let running = {};
    activeCurrencies.forEach(c => { running[c] = 0; });
    const dataPoints = asc.map(t => {
      const amt = t.type === 'credit' ? Number(t.amount) : -Number(t.amount);
      const cur = t.currency || 'USD';
      running[cur] += amt;
      return { date: format(t.date, 'dd MMM', { locale: es }), timestamp: t.date.getTime(), ...running };
    });
    return { dataPoints, currencies: Array.from(activeCurrencies) };
  }, [processedTransactions]);

  React.useEffect(() => {
    const { currencies } = chartData;
    if (currencies.length > 0 && (!selectedCurrency || !currencies.includes(selectedCurrency))) setSelectedCurrency(currencies[0]);
  }, [chartData, selectedCurrency]);

  const searchSummary = useMemo(() => {
    const activeCurrency = selectedCurrency || (chartData.currencies[0] || 'COP');
    const rel = processedTransactions.filter(t => (t.currency || 'USD') === activeCurrency);
    let totalIngresos = 0, totalEgresos = 0, totalTransferencias = 0;
    const categorias = {}, subcategorias = {}, cuentas = {};
    rel.forEach(t => {
      const amt = Number(t.amount || 0);
      if (t.type === 'transfer' || t.isTransfer) {
        totalTransferencias += amt;
      } else if (t.type === 'credit') {
        totalIngresos += amt;
        const acc = t.card || t.account || 'Efectivo';
        cuentas[acc] = (cuentas[acc] || 0) + amt;
      } else {
        totalEgresos += amt;
        const acc = t.card || t.account || 'Efectivo';
        cuentas[acc] = (cuentas[acc] || 0) - amt;
        const cat = t.category || 'General';
        categorias[cat] = (categorias[cat] || 0) + amt;
        if (t.subcategory) {
          const key = `${cat} - ${t.subcategory}`;
          subcategorias[key] = (subcategorias[key] || 0) + amt;
        }
      }
    });
    return {
      currency: activeCurrency,
      totalIngresos, totalEgresos, totalTransferencias,
      categories: Object.entries(categorias).sort(([, a], [, b]) => b - a).map(([name, amount]) => ({ name, amount })),
      subcategories: Object.entries(subcategorias).sort(([, a], [, b]) => b - a).map(([name, amount]) => ({ name, amount })),
      accounts: Object.entries(cuentas).sort(([, a], [, b]) => b - a).map(([name, amount]) => ({ name, amount })),
      hasData: rel.length > 0,
    };
  }, [processedTransactions, selectedCurrency, chartData]);

  const clearFilters = () => {
    setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setCategoryFilter(''); setSubcategoryFilter(''); setAccountFilter('');
    setMinAmountFilter(''); setMaxAmountFilter(''); setTypeFilter('');
    setSearchText(''); setNoSubcategoryOnly(false); setPendingOnly(false);
  };

  const txIcon = useCallback((tx) => {
    if (tx.type === 'transfer' || tx.isTransfer) return 'swap_horiz';
    if (tx.type === 'credit') return 'trending_up';
    const map = { food: 'restaurant', software: 'code', services: 'home_repair_service', salud: 'medical_services', transporte: 'directions_car' };
    return map[tx.category] || 'payments';
  }, []);

  // Hero derived values
  const monthDelta = monthInfo.prevTotal > 0
    ? ((monthInfo.monthTotal - monthInfo.prevTotal) / monthInfo.prevTotal) * 100 : 0;
  const avgDaily = monthInfo.todayDay > 0 ? monthInfo.monthTotal / monthInfo.todayDay : 0;
  const todaySpend = monthInfo.days[monthInfo.todayDay - 1] || 0;
  const maxDay = Math.max(...monthInfo.days, 1);
  const underAvg = todaySpend <= avgDaily;

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '16px 16px 32px' }} className="animate-fade-up">

      {/* Page header */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em' }}>Movimientos</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-3)' }}>Todo lo que entra y sale, en orden cronológico.</p>
      </div>

      {/* Month spend hero — daily bar strip */}
      <Card padding={16} style={{ marginBottom: 12, borderRadius: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <Eyebrow>Gastado este mes</Eyebrow>
            <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {monthInfo.monthTotal > 0 ? '−' : ''}{formatCurrency(monthInfo.monthTotal, 'COP')}
            </div>
          </div>
          {monthInfo.prevTotal > 0 && (
            <Pill variant={monthDelta > 0 ? 'warning' : 'success'} icon={monthDelta > 0 ? 'north_east' : 'south_east'}>
              {monthDelta > 0 ? '+' : ''}{monthDelta.toFixed(0)}% vs. mes pasado
            </Pill>
          )}
        </div>

        {/* Daily bars */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 76 }}>
          {monthInfo.days.map((v, i) => {
            const d = i + 1;
            const isSel = selectedDay === d;
            const isFuture = d > monthInfo.todayDay;
            const dow = new Date(monthInfo.y, monthInfo.m, d).getDay();
            const weekend = dow === 0 || dow === 6;
            const h = v === 0 ? 4 : Math.max(6, (v / maxDay) * 60);
            return (
              <button
                key={d}
                type="button"
                onClick={() => selectDay(d)}
                title={`${d}: ${formatCurrency(v, 'COP')}`}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none', cursor: isFuture ? 'default' : 'pointer', padding: 0, minWidth: 0,
                }}
                disabled={isFuture}
              >
                <div style={{
                  width: '100%', height: h, borderRadius: 3,
                  background: isSel ? 'var(--clay-500)'
                    : isFuture ? 'var(--parchment-100)'
                    : weekend ? 'var(--parchment-300)' : 'var(--parchment-200)',
                  transition: 'background var(--dur-fast) var(--ease-out)',
                }} />
                <span style={{
                  fontSize: 8, fontWeight: isSel ? 800 : 600,
                  color: isSel ? 'var(--clay-700)' : 'var(--fg-4)',
                }}>
                  {d}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--fg-3)' }}>
          {selectedDay
            ? <>Mostrando el <strong style={{ color: 'var(--fg-1)' }}>día {selectedDay}</strong> — toca de nuevo para ver el mes.</>
            : <>Toca un día para filtrar la tabla. Promedio diario <strong style={{ color: 'var(--fg-1)' }}>{formatCurrency(Math.round(avgDaily), 'COP')}</strong>.</>}
        </div>
      </Card>

      {/* Day pace insight */}
      {monthInfo.monthTotal > 0 && (
        <Card
          padding={14}
          style={{
            marginBottom: 20,
            background: underAvg ? 'var(--olive-50)' : 'var(--amber-50)',
            borderLeft: `4px solid ${underAvg ? 'var(--olive-500)' : 'var(--amber-300)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name={underAvg ? 'check_circle' : 'trending_up'} size={20} color={underAvg ? 'var(--olive-600)' : 'var(--amber-400)'} />
            <div style={{ fontSize: 12.5, color: 'var(--ink-600)', lineHeight: 1.45 }}>
              {underAvg
                ? <>Hoy vas <strong>{formatCurrency(Math.round(avgDaily - todaySpend), 'COP')}</strong> por debajo de tu promedio diario. Sigue así.</>
                : <>Hoy gastaste <strong>{formatCurrency(Math.round(todaySpend - avgDaily), 'COP')}</strong> por encima de tu promedio diario.</>}
            </div>
          </div>
        </Card>
      )}

      {/* Filter panel */}
      <Card padding={16} style={{ marginBottom: 20 }}>
        {/* Search row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-default)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '0 12px', marginBottom: 14 }}>
          <Icon name="search" size={18} color="var(--fg-3)" />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Buscar por título o comentario…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: '10px 0', fontSize: 14, color: 'var(--fg-1)', fontFamily: 'var(--font-sans)' }}
          />
          {searchText && (
            <button type="button" onClick={() => setSearchText('')} style={{ border: 'none', background: 'transparent', color: 'var(--fg-3)', cursor: 'pointer', padding: 4 }}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Filter rows */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <FilterField label="Fechas">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...filterInputStyle, flex: 1, minWidth: 0 }} />
              <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>—</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...filterInputStyle, flex: 1, minWidth: 0 }} />
            </div>
          </FilterField>

          <FilterField label="Tipo">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...filterInputStyle, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Todos</option>
              <option value="credit">Ingreso</option>
              <option value="debit">Egreso</option>
              <option value="transfer">Transferencia</option>
            </select>
          </FilterField>

          <FilterField label="Categoría">
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setSubcategoryFilter(''); }} style={{ ...filterInputStyle, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Todas</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FilterField>

          <FilterField label="Subcategoría">
            <select value={subcategoryFilter} onChange={e => setSubcategoryFilter(e.target.value)} style={{ ...filterInputStyle, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Todas</option>
              {uniqueSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FilterField>

          <FilterField label="Cuenta">
            <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} style={{ ...filterInputStyle, appearance: 'none', cursor: 'pointer' }}>
              <option value="">Todas</option>
              {uniqueAccounts.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </FilterField>

          <FilterField label="Monto mín.">
            <input type="number" placeholder="0" value={minAmountFilter} onChange={e => setMinAmountFilter(e.target.value)} style={filterInputStyle} />
          </FilterField>

          <FilterField label="Monto máx.">
            <input type="number" placeholder="∞" value={maxAmountFilter} onChange={e => setMaxAmountFilter(e.target.value)} style={filterInputStyle} />
          </FilterField>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => setNoSubcategoryOnly(v => !v)}
              style={{
                height: 38, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${noSubcategoryOnly ? 'var(--amber-400)' : 'var(--border-default)'}`,
                background: noSubcategoryOnly ? 'var(--amber-50)' : 'var(--bg-default)',
                color: noSubcategoryOnly ? 'var(--warning-700)' : 'var(--fg-3)',
                fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name={noSubcategoryOnly ? 'check_box' : 'check_box_outline_blank'} size={16} />
              Sin subcat.
            </button>
            <button
              type="button"
              onClick={() => setPendingOnly(v => !v)}
              style={{
                height: 38, padding: '0 12px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${pendingOnly ? 'var(--warning-500)' : 'var(--border-default)'}`,
                background: pendingOnly ? 'var(--warning-50)' : 'var(--bg-default)',
                color: pendingOnly ? 'var(--warning-700)' : 'var(--fg-3)',
                fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name={pendingOnly ? 'check_box' : 'check_box_outline_blank'} size={16} />
              Por revisar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              style={{
                height: 38, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid var(--border-default)', background: 'var(--bg-default)',
                color: 'var(--fg-2)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name="filter_list_off" size={16} />
              Limpiar
            </button>
          </div>
        </div>
      </Card>

      {/* Balance evolution chart — lazy loaded to keep initial bundle small */}
      {chartData.currencies.length > 0 && chartData.dataPoints.length > 1 && (
        <Card padding={16} style={{ marginBottom: 20 }}>
          <Eyebrow style={{ marginBottom: 12 }}>Evolución de saldo</Eyebrow>
          <Suspense fallback={<div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-4)', fontSize: 13 }}>Cargando gráfico…</div>}>
            <LazyBalanceChart
              dataPoints={chartData.dataPoints}
              currencies={chartData.currencies}
              selectedCurrency={selectedCurrency}
              onCurrencyChange={setSelectedCurrency}
            />
          </Suspense>
        </Card>
      )}

      {/* Transaction list */}
      <Card padding={0} style={{ marginBottom: 20, overflow: 'hidden' }}>
        {/* List header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>
              {processedTransactions.length} transacciones
            </span>
            {pendingCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning-700)' }}>
                · {pendingCount} por revisar
              </span>
            )}
          </div>
          {/* Page size switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-sunken)', padding: 3, borderRadius: 10, gap: 2 }}>
            {[10, 20, 50].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => { setPageSize(s); setCurrentPage(1); }}
                style={{
                  padding: '4px 10px', border: 'none', cursor: 'pointer', borderRadius: 7,
                  fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: pageSize === s ? 800 : 600,
                  background: pageSize === s ? 'var(--bg-raised)' : 'transparent',
                  color: pageSize === s ? 'var(--fg-1)' : 'var(--fg-3)',
                  boxShadow: pageSize === s ? 'var(--shadow-xs)' : 'none',
                }}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Table — kept wide, scrolls horizontally on mobile */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--fg-4)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tipo</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--fg-4)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Fecha</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--fg-4)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Concepto</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--fg-4)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Categoría</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: 'var(--fg-4)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cuenta</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--fg-4)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Monto</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length > 0 ? paginatedTransactions.map(tx => {
                const isTransfer = tx.type === 'transfer' || tx.isTransfer;
                const amountColor = isTransfer ? 'var(--plum-400)' : tx.type === 'credit' ? 'var(--success-700)' : 'var(--fg-1)';
                const sign = isTransfer ? '' : tx.type === 'credit' ? '+' : '−';
                const hue = hueForCategory(tx.category);
                return (
                  <tr
                    key={tx.id}
                    onClick={() => onEditTransaction && onEditTransaction(tx)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
                      transition: 'background var(--dur-fast) var(--ease-out)',
                      background: tx.status === 'pending' ? 'var(--warning-50)' : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = tx.status === 'pending' ? 'var(--warning-50)' : 'transparent'}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <IconTile icon={txIcon(tx)} hue={hue} size={32} />
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--fg-3)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {format(tx.date, 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: 'var(--fg-1)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.title || tx.description}
                        </span>
                        {tx.status === 'pending' && (
                          <Pill variant="warning" icon="rate_review">Por revisar</Pill>
                        )}
                      </div>
                      {tx.comments && <div style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{tx.comments}</div>}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Pill variant="neutral" style={{ fontSize: 11 }}>{tx.category || 'General'}</Pill>
                        {tx.subcategory && <span style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600 }}>{tx.subcategory}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--fg-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {isTransfer
                        ? <>{tx.card || 'Efectivo'} <span style={{ color: 'var(--plum-400)' }}>→</span> {tx.destinationCard || '?'}</>
                        : (tx.card || tx.account || 'Efectivo')}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: amountColor }}>
                        {sign}{formatCurrency(Math.abs(tx.amount || 0), tx.currency || 'COP')}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '0.08em', marginLeft: 5, textTransform: 'uppercase' }}>
                        {tx.currency || 'COP'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setConfirmDelete({ isOpen: true, txId: tx.id }); }}
                        style={{ border: 'none', background: 'transparent', color: 'var(--fg-4)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger-700)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-4)'}
                      >
                        <Icon name="delete" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="7" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <IconTile icon="receipt_long" hue="ink" size={48} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-2)' }}>No hay coincidencias.</span>
                      <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Prueba con otro filtro o limpia la búsqueda.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-canvas)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              Página <strong style={{ color: 'var(--fg-1)' }}>{currentPage}</strong> de <strong style={{ color: 'var(--fg-1)' }}>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ width: 32, height: 32, border: '1px solid var(--border-default)', borderRadius: 9, background: 'var(--bg-raised)', color: 'var(--fg-2)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chevron_left" size={18} />
              </button>
              <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ width: 32, height: 32, border: '1px solid var(--border-default)', borderRadius: 9, background: 'var(--bg-raised)', color: 'var(--fg-2)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="chevron_right" size={18} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Analysis summary */}
      {searchSummary.hasData && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>Resumen</h2>
            <Pill variant="neutral">{searchSummary.currency}</Pill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>

            {/* Flujo neto */}
            <Card padding={16}>
              <Eyebrow style={{ marginBottom: 12 }}>Flujo neto</Eyebrow>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--success-50)', borderRadius: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="arrow_upward" size={14} /> Ingresos
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success-700)', fontSize: 12 }}>+{formatCurrency(searchSummary.totalIngresos, searchSummary.currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--danger-50)', borderRadius: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="arrow_downward" size={14} /> Egresos
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger-700)', fontSize: 12 }}>-{formatCurrency(searchSummary.totalEgresos, searchSummary.currency)}</span>
                </div>
                {searchSummary.totalTransferencias > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--tint-plum)', borderRadius: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--plum-400)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name="swap_horiz" size={14} /> Transferencias
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--plum-400)', fontSize: 12 }}>{formatCurrency(searchSummary.totalTransferencias, searchSummary.currency)}</span>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 700 }}>Balance periodo</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13, color: searchSummary.totalIngresos - searchSummary.totalEgresos >= 0 ? 'var(--success-700)' : 'var(--danger-700)' }}>
                  {searchSummary.totalIngresos - searchSummary.totalEgresos >= 0 ? '+' : '-'}{formatCurrency(Math.abs(searchSummary.totalIngresos - searchSummary.totalEgresos), searchSummary.currency)}
                </span>
              </div>
            </Card>

            {/* Egresos por categoría */}
            {searchSummary.categories.length > 0 && (
              <Card padding={16} style={{ maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Eyebrow style={{ marginBottom: 12 }}>Egresos por categoría</Eyebrow>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchSummary.categories.map(cat => {
                    const hue = hueForCategory(cat.name);
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => onNavigate && onNavigate('categoria', { category: cat.name })}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          gap: 8, fontSize: 12, width: '100%', background: 'transparent',
                          border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 9999, background: hueColorVar(hue), flexShrink: 0 }} />
                          {cat.name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-1)', flexShrink: 0 }}>
                          {formatCurrency(cat.amount, searchSummary.currency)}
                        </span>
                        <Icon name="chevron_right" size={14} color="var(--fg-4)" />
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Top subcategorías */}
            {searchSummary.subcategories.length > 0 && (
              <Card padding={16} style={{ maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Eyebrow style={{ marginBottom: 12 }}>Top subcategorías</Eyebrow>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchSummary.subcategories.map(sub => {
                    const [cat, subcat] = sub.name.split(' - ');
                    return (
                      <div key={sub.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subcat || sub.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--fg-4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-1)', fontSize: 12, flexShrink: 0 }}>
                          {formatCurrency(sub.amount, searchSummary.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Flujo por cuenta */}
            {searchSummary.accounts.length > 0 && (
              <Card padding={16} style={{ maxHeight: 280, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Eyebrow style={{ marginBottom: 12 }}>Flujo por cuenta</Eyebrow>
                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {searchSummary.accounts.map(acc => (
                    <div key={acc.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{acc.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, marginLeft: 10, flexShrink: 0, color: acc.amount > 0 ? 'var(--success-700)' : acc.amount < 0 ? 'var(--danger-700)' : 'var(--fg-3)' }}>
                        {acc.amount > 0 ? '+' : ''}{formatCurrency(acc.amount, searchSummary.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete({ isOpen: false, txId: null })}
        onConfirm={() => { if (confirmDelete.txId) deleteTransaction(confirmDelete.txId); }}
        title="Eliminar transacción"
        message="¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDestructive
      />
    </div>
  );
}
