import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../../../shared/utils/format';
import ConfirmModal from '../../../shared/components/ConfirmModal';
import { Icon, Card, Pill, IconTile } from '../../../shared/ds/Primitives';

// "Bancolombia Master *7761" → "Master *7761" (drop the issuer prefix on mobile)
const shortAccount = (label) => {
  if (!label) return 'Efectivo';
  const parts = label.trim().split(/\s+/);
  return parts.length > 2 ? parts.slice(-2).join(' ') : label;
};

// Left tile distinguishes personal vs. business at a glance
const contextTile = (ctx) => (ctx === 'business'
  ? { icon: 'business_center', hue: 'amber' }
  : { icon: 'person', hue: 'olive' });

/**
 * Compact, mobile-first transaction list for the dashboard.
 * Mirrors the big Movimientos table's data, trimmed to the essentials.
 */
export default function CompactTransactions({ onEditTransaction }) {
  const { getTotals, deleteTransaction, appConfig, currentContext } = useFinance();
  const { filteredTransactions } = useMemo(() => getTotals(currentContext), [getTotals, currentContext]);

  const [pageSize, setPageSize] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, txId: null });

  const catIconMap = useMemo(() => {
    const m = {};
    (appConfig?.categories || []).forEach(c => { m[c.name] = c.icon; });
    return m;
  }, [appConfig]);

  const sorted = useMemo(() => (
    [...filteredTransactions].sort((a, b) => (b.sortAt || b.date).getTime() - (a.sortAt || a.date).getTime())
  ), [filteredTransactions]);

  const rows = useMemo(() => sorted.slice(0, pageSize), [sorted, pageSize]);
  const pendingCount = useMemo(() => sorted.filter(t => t.status === 'pending').length, [sorted]);

  const categoryIcon = (tx) => {
    if (tx.type === 'transfer' || tx.isTransfer) return 'swap_horiz';
    if (tx.type === 'credit') return 'payments';
    return catIconMap[tx.category] || 'category';
  };

  if (sorted.length === 0) return null;

  return (
    <Card padding={14} style={{ borderRadius: 22 }}>
      {/* Header — count + pending, with page-size switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
            {sorted.length} transacciones
          </div>
          {pendingCount > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning-700)', marginTop: 2 }}>
              −{pendingCount} por revisar
            </div>
          )}
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-sunken)', padding: 3, borderRadius: 10, gap: 2 }}>
          {[10, 20, 50].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setPageSize(s)}
              style={{
                padding: '4px 11px', border: 'none', cursor: 'pointer', borderRadius: 7,
                fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: pageSize === s ? 800 : 600,
                background: pageSize === s ? 'var(--bg-raised)' : 'transparent',
                color: pageSize === s ? 'var(--fg-1)' : 'var(--fg-3)',
                boxShadow: pageSize === s ? 'var(--shadow-xs)' : 'none',
              }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(tx => {
          const isTransfer = tx.type === 'transfer' || tx.isTransfer;
          const amountColor = isTransfer ? 'var(--plum-400)' : tx.type === 'credit' ? 'var(--success-700)' : 'var(--fg-1)';
          const sign = isTransfer ? '' : tx.type === 'credit' ? '+' : '−';
          const pending = tx.status === 'pending';
          const tile = contextTile(tx.context);
          return (
            <div
              key={tx.id}
              onClick={() => onEditTransaction && onEditTransaction(tx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 16, cursor: 'pointer',
                background: pending ? 'var(--warning-50)' : 'var(--bg-default)',
                border: `1px solid ${pending ? 'var(--warning-500)' : 'var(--border-subtle)'}`,
                transition: 'background var(--dur-fast) var(--ease-out)',
              }}
            >
              {/* Personal / business indicator */}
              <IconTile icon={tile.icon} hue={tile.hue} size={44} />

              {/* Concept block */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                    {format(tx.date, 'dd MMM', { locale: es })}
                  </span>
                  <Icon name={categoryIcon(tx)} size={15} color="var(--fg-3)" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.title || tx.description}
                  </span>
                  {pending && <Pill variant="warning" icon="rate_review">Por revisar</Pill>}
                </div>
              </div>

              {/* Account + amount */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                  {isTransfer
                    ? <>{shortAccount(tx.card || 'Efectivo')} <span style={{ color: 'var(--plum-400)' }}>→</span> {shortAccount(tx.destinationCard || '?')}</>
                    : shortAccount(tx.card || tx.account || 'Efectivo')}
                </div>
                <div style={{ marginTop: 4, whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 16, color: amountColor }}>
                    {sign}{formatCurrency(Math.abs(tx.amount || 0), tx.currency || 'COP')}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--fg-4)', fontWeight: 700, letterSpacing: '0.08em', marginLeft: 4, textTransform: 'uppercase' }}>
                    {tx.currency || 'COP'}
                  </span>
                </div>
              </div>

              {/* Delete */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setConfirmDelete({ isOpen: true, txId: tx.id }); }}
                style={{ border: 'none', background: 'transparent', color: 'var(--fg-4)', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0, alignSelf: 'center' }}
              >
                <Icon name="delete" size={16} />
              </button>
            </div>
          );
        })}
      </div>

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
    </Card>
  );
}
