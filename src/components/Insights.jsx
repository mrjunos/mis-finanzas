import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/format';
import TransactionModal from './TransactionModal';
import ConfirmModal from './ConfirmModal';
import {
  Icon, Card, Pill, DeltaPill, IconTile, SparkLine, ProgressBar,
  Eyebrow, Money, hueForCategory, hueColorVar,
} from './ds/Primitives';

const EXCHANGE_RATE = 4100;

// Section heading used throughout
const SectionHead = ({ title, action }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 0 8px',
  }}>
    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
      {title}
    </h3>
    {action}
  </div>
);

// Single transaction row
const TxRow = ({ tx, onClick, onDelete }) => {
  const isTransfer = tx.type === 'transfer' || tx.isTransfer;
  const amountColor = isTransfer ? 'var(--plum-400)' : tx.type === 'credit' ? 'var(--success-700)' : 'var(--fg-1)';
  const sign = isTransfer ? '' : tx.type === 'credit' ? '+' : '−';

  const cat = tx.category || 'general';
  const hue = hueForCategory(cat);

  const iconName = (() => {
    if (isTransfer) return 'swap_horiz';
    if (tx.type === 'credit') return 'trending_up';
    const map = { food: 'restaurant', software: 'code', services: 'home_repair_service', salud: 'medical_services', transporte: 'directions_car' };
    return map[cat] || 'payments';
  })();

  let dateStr = '';
  try {
    const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date);
    dateStr = d.toLocaleDateString('es-CO', { month: 'short', day: 'numeric' });
  } catch { /* ignore */ }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '9px 10px',
        borderRadius: 12, cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease-out)',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <IconTile icon={iconName} hue={hue} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tx.title}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
          {tx.context === 'business' ? 'Negocio' : 'Personal'}
          {tx.card && ` · ${tx.card}`}
          {dateStr && ` · ${dateStr}`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: amountColor, whiteSpace: 'nowrap' }}>
          {sign}{formatCurrency(Math.abs(tx.amount), tx.currency || 'COP')}
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(tx.id); }}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-4)', padding: 2, borderRadius: 6 }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger-700)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-4)'}
          >
            <Icon name="delete" size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default function Insights({ currentContext, onNavigate }) {
  const { transactions, getTotals, deleteTransaction, loading } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [modalMode, setModalMode] = useState('transaction');
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, txId: null });

  const isTransferTx = (t) => t.type === 'transfer' || t.isTransfer === true;

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (currentContext === 'unified') return true;
      if (isTransferTx(t)) return t.context === currentContext || t.destinationContext === currentContext;
      return t.context === currentContext;
    });
  }, [transactions, currentContext]);

  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const savingsRate = useMemo(() => {
    const txs = filteredTransactions.filter(t => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !isTransferTx(t);
    });
    const income   = txs.filter(t => t.type === 'credit').reduce((a, t) => a + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);
    const expenses = txs.filter(t => t.type === 'debit').reduce((a, t)  => a + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);
    return income === 0 ? 0 : ((income - expenses) / income) * 100;
  }, [filteredTransactions, currentMonth, currentYear]);

  const prevSavingsRate = useMemo(() => {
    const txs = filteredTransactions.filter(t => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear && !isTransferTx(t);
    });
    const income   = txs.filter(t => t.type === 'credit').reduce((a, t) => a + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);
    const expenses = txs.filter(t => t.type === 'debit').reduce((a, t)  => a + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);
    return income === 0 ? 0 : ((income - expenses) / income) * 100;
  }, [filteredTransactions, lastMonth, lastMonthYear]);

  const savingsRateTrend = savingsRate - prevSavingsRate;

  const categoryBreakdown = useMemo(() => {
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const txs = filteredTransactions.filter(t => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return d >= threeMonthsAgo && t.type === 'debit' && !isTransferTx(t);
    });
    const cats = {};
    let total = 0;
    txs.forEach(t => {
      const amt = t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount;
      const cat = t.category || 'general';
      cats[cat] = (cats[cat] || 0) + amt;
      total += amt;
    });
    return Object.entries(cats)
      .sort(([, a], [, b]) => b - a)
      .map(([name, amount]) => ({ name, amount, pct: total > 0 ? (amount / total) * 100 : 0 }));
  }, [filteredTransactions, today]);

  const topFugas = useMemo(() => {
    const threeMonthsAgo    = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    const prevThreeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const txs = filteredTransactions.filter(t => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      return d >= threeMonthsAgo && t.type === 'debit' && !isTransferTx(t);
    });
    const groups = {};
    txs.forEach(t => {
      const amt = t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount;
      const title = t.title || 'Sin Nombre';
      groups[title] = (groups[title] || 0) + amt;
    });
    return Object.entries(groups)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, amount]) => {
        const prev = filteredTransactions
          .filter(t => {
            const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
            return d >= prevThreeMonthsAgo && d < threeMonthsAgo && t.type === 'debit' && t.title === name;
          })
          .reduce((a, t) => a + (t.currency === 'USD' ? t.amount * EXCHANGE_RATE : t.amount), 0);
        const trend = prev > 0 ? ((amount - prev) / prev) * 100 : amount > 0 ? 100 : 0;
        return { name, amount, trend };
      });
  }, [filteredTransactions, today]);

  const { netWorth, personalBalance, businessCashFlow } = getTotals(currentContext);

  const balanceConfig = {
    personal: { title: 'Balance personal',  data: personalBalance,   hue: 'var(--clay-500)',  iconHue: 'clay',  icon: 'person' },
    business: { title: 'Caja del negocio',  data: businessCashFlow,  hue: 'var(--plum-400)',  iconHue: 'plum',  icon: 'business_center' },
    unified:  { title: 'Patrimonio neto',   data: netWorth,          hue: 'var(--ink-700)',   iconHue: 'ink',   icon: 'donut_small' },
  }[currentContext];

  const primaryCurrency = Object.keys(balanceConfig.data).find(k => balanceConfig.data[k] !== 0) || 'COP';
  const primaryValue    = balanceConfig.data[primaryCurrency] || 0;
  const secondaryCurrencies = Object.keys(balanceConfig.data).filter(k => k !== primaryCurrency && balanceConfig.data[k] !== 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--fg-3)' }}>
        <Icon name="autorenew" size={24} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} />
        Cargando…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '0 20px', paddingBottom: 24 }} className="animate-fade-up">

      {/* Page header */}
      <div style={{ padding: '16px 0 8px' }}>
        <Eyebrow style={{ marginBottom: 6 }}>
          {today.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </Eyebrow>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          Radiografía financiera
        </h1>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.4 }}>
          Deja de adivinar a dónde se va la plata.
        </p>
      </div>

      {/* Top grid: balance + savings rate */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}
        className="grid-cols-1 sm:grid-cols-[1.5fr_1fr]"
      >
        {/* Main balance card */}
        <Card moduleHue={balanceConfig.hue} style={{ gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Eyebrow>{balanceConfig.title}</Eyebrow>
              <div style={{ marginTop: 8 }}>
                <Money amount={primaryValue} currency={primaryCurrency} size="xl" />
              </div>
              {secondaryCurrencies.length > 0 && (
                <div style={{ marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {secondaryCurrencies.map(cur => {
                    const val = balanceConfig.data[cur];
                    return (
                      <span key={cur} style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                        {val >= 0 ? '+' : '−'} {formatCurrency(Math.abs(val), cur)} {cur}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <IconTile icon={balanceConfig.icon} hue={balanceConfig.iconHue} size={36} />
          </div>
          <SparkLine color={balanceConfig.hue} points={[28, 18, 24, 12, 18, 8, 14, 5]} />
        </Card>

        {/* Savings rate card */}
        <Card padding={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <Eyebrow>Tasa de ahorro</Eyebrow>
            <IconTile icon="trending_up" hue="success" size={28} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {savingsRate.toFixed(1)}<span style={{ fontSize: 16, color: 'var(--fg-3)' }}>%</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <DeltaPill value={savingsRateTrend} />
            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-3)' }}>vs mes pasado</span>
          </div>
        </Card>
      </div>

      {/* Actividad reciente */}
      <SectionHead
        title="Actividad reciente"
        action={
          <button
            type="button"
            onClick={() => onNavigate && onNavigate('transactions')}
            style={{ background: 'none', border: 'none', color: 'var(--clay-600)', fontWeight: 700, fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            Ver todo →
          </button>
        }
      />

      <Card padding={6} style={{ marginBottom: 12 }}>
        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 20px', color: 'var(--fg-3)' }}>
            <IconTile icon="receipt_long" hue="ink" size={48} />
            <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: 'var(--fg-2)' }}>No hay transacciones registradas.</div>
          </div>
        ) : (
          filteredTransactions.slice(0, 6).map(tx => (
            <TxRow
              key={tx.id}
              tx={tx}
              onClick={() => { setEditingTransaction(tx); setModalMode('transaction'); setIsModalOpen(true); }}
              onDelete={(id) => setConfirmDelete({ isOpen: true, txId: id })}
            />
          ))
        )}
      </Card>

      {/* Gastos por categoría */}
      {categoryBreakdown.length > 0 && (
        <>
          <SectionHead title="Gastos por categoría" />
          <Card padding={16} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--fg-3)' }}>Últimos 3 meses</p>
            {/* Stacked bar */}
            <div style={{ display: 'flex', height: 10, borderRadius: 9999, overflow: 'hidden', marginBottom: 14 }}>
              {categoryBreakdown.map(b => (
                <div
                  key={b.name}
                  style={{ width: `${b.pct}%`, background: hueColorVar(hueForCategory(b.name)) }}
                  title={`${b.name}: ${b.pct.toFixed(0)}%`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categoryBreakdown.slice(0, 6).map(b => (
                <div key={b.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--fg-2)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 9999, background: hueColorVar(hueForCategory(b.name)), flexShrink: 0 }} />
                    {b.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-1)' }}>
                    {b.pct.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Mayores fugas */}
      {topFugas.length > 0 && (
        <>
          <SectionHead title="Mayores fugas" />
          <Card padding={16} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--fg-3)' }}>Top gastos individuales, últimos 3 meses.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {topFugas.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: i < topFugas.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </div>
                    <Pill
                      variant={f.trend > 0 ? 'danger' : 'success'}
                      icon={f.trend > 0 ? 'north_east' : 'south_east'}
                      style={{ marginTop: 4 }}
                    >
                      {f.trend > 0 ? '+' : ''}{f.trend.toFixed(0)}%
                    </Pill>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-1)', fontSize: 13 }}>
                    {formatCurrency(f.amount, 'COP')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
        editingTransaction={editingTransaction}
        initialMode={modalMode}
      />

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
