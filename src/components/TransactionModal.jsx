import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import ConfirmModal from './ConfirmModal';
import { Icon, Eyebrow, Segmented } from './ds/Primitives';

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-raised)', borderRadius: 12, padding: '11px 12px',
  fontFamily: 'var(--font-sans)', fontSize: 14,
  color: 'var(--fg-1)', outline: 'none',
};

const selectStyle = {
  ...inputStyle,
  appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
};

const FieldLabel = ({ children }) => (
  <Eyebrow style={{ marginBottom: 6, paddingLeft: 2 }}>{children}</Eyebrow>
);

export default function TransactionModal({ isOpen, onClose, editingTransaction, initialMode = 'transaction' }) {
  const { addTransaction, updateTransaction, addTransfer, appConfig, deleteTransaction } = useFinance();

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

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [mode, setMode] = useState(initialMode === 'transfer' ? 'transfer' : 'transaction');
  const [formData, setFormData] = useState({
    title: '', amount: '', type: 'debit', context: 'personal',
    category: allCategories?.[0]?.name || 'general', subcategory: '',
    currency: appConfig?.currencies?.[0] || 'USD',
    card: appConfig?.accounts?.[0] || '',
    date: '', comments: '', destinationContext: 'personal',
    destinationCard: appConfig?.accounts?.[0] || '',
  });

  const filteredCategories = useMemo(() => {
    if (mode === 'transfer') {
      return allCategories.filter(c => {
        const cCtx = c.context || 'personal';
        return cCtx === formData.context || cCtx === 'both';
      });
    }
    return allCategories.filter(c => {
      const cType = c.type || 'debit';
      const cCtx  = c.context || 'personal';
      return cType === formData.type && (cCtx === formData.context || cCtx === 'both');
    });
  }, [allCategories, formData.type, formData.context, mode]);

  React.useEffect(() => {
    if (isOpen && filteredCategories.length > 0) {
      const isValid = filteredCategories.some(c => c.name === formData.category);
      if (!isValid) setFormData(prev => ({ ...prev, category: filteredCategories[0].name, subcategory: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const day   = String(dateObj.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        }
      }
      setFormData({
        title: editingTransaction.title || '',
        amount: editingTransaction.amount || '',
        type: editingTransaction.type || 'debit',
        context: editingTransaction.context || 'personal',
        category: (typeof editingTransaction.category === 'object' ? editingTransaction.category?.name : editingTransaction.category) || allCategories?.[0]?.name || 'general',
        subcategory: editingTransaction.subcategory || '',
        currency: editingTransaction.currency || appConfig?.currencies?.[0] || 'USD',
        card: editingTransaction.card || appConfig?.accounts?.[0] || '',
        date: formattedDate,
        comments: editingTransaction.comments || '',
        destinationContext: editingTransaction.destinationContext || 'personal',
        destinationCard: editingTransaction.destinationCard || appConfig?.accounts?.[0] || '',
      });
    } else {
      setFormData({
        title: '',
        amount: '', type: 'debit', context: 'personal',
        category: allCategories?.[0]?.name || 'general', subcategory: '',
        currency: appConfig?.currencies?.[0] || 'USD',
        card: appConfig?.accounts?.[0] || '',
        date: '', comments: '', destinationContext: 'personal',
        destinationCard: appConfig?.accounts?.[0] || '',
      });
    }
  }, [editingTransaction, appConfig, allCategories, isOpen]);

  // Reset mode whenever the modal opens (transfer when editing a transfer)
  React.useEffect(() => {
    if (!isOpen) return;
    if (editingTransaction?.type === 'transfer' || editingTransaction?.isTransfer) setMode('transfer');
    else if (editingTransaction) setMode('transaction');
    else setMode(initialMode === 'transfer' ? 'transfer' : 'transaction');
  }, [isOpen, editingTransaction, initialMode]);

  const currentSubcategories = useMemo(() => {
    const cat = filteredCategories.find(c => c.name === formData.category);
    return cat ? cat.subcategories : [];
  }, [filteredCategories, formData.category]);

  if (!isOpen) return null;

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let txDate = formData.date;
      if (!txDate) {
        const today = new Date();
        txDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      }
      if (mode === 'transfer') {
        if (formData.card === formData.destinationCard && formData.context === formData.destinationContext) {
          alert("La cuenta de origen y destino no pueden ser la misma."); return;
        }
        if (editingTransaction) {
          await updateTransaction(editingTransaction.id, {
            title: formData.title || 'Transferencia', amount: Number(formData.amount),
            type: 'transfer', context: formData.context, destinationContext: formData.destinationContext,
            category: formData.category, subcategory: formData.subcategory,
            currency: formData.currency, card: formData.card, destinationCard: formData.destinationCard,
            comments: formData.comments, date: txDate,
          });
        } else {
          await addTransfer({
            title: formData.title || 'Transferencia', amount: formData.amount,
            currency: formData.currency, date: txDate, comments: formData.comments,
            category: formData.category, subcategory: formData.subcategory,
            sourceContext: formData.context, sourceAccount: formData.card,
            destinationContext: formData.destinationContext, destinationAccount: formData.destinationCard,
          });
        }
      } else {
        const txData = {
          title: formData.title, amount: Number(formData.amount), type: formData.type,
          context: formData.context, category: formData.category, subcategory: formData.subcategory,
          currency: formData.currency, card: formData.card, comments: formData.comments, date: txDate,
        };
        if (editingTransaction) await updateTransaction(editingTransaction.id, txData);
        else await addTransaction(txData);
      }
      onClose();
    } catch (error) {
      console.error("Error saving transaction", error);
    }
  };

  const isNew = !editingTransaction;
  const title = mode === 'transfer'
    ? (isNew ? 'Nueva transferencia' : 'Editar transferencia')
    : (isNew ? 'Nueva transacción' : 'Editar transacción');

  return (
    <>
      {/* Scrim */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg-overlay)' }}
        onClick={onClose}
      />

      {/* Modal panel — full-height sheet on mobile, centered dialog on desktop */}
      <div
        className="justify-end md:justify-center"
        style={{
          position: 'fixed', inset: 0, zIndex: 91,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className="rounded-t-[28px] md:rounded-[28px] md:my-6"
          style={{
            width: '100%', maxWidth: 520, maxHeight: '94dvh',
            background: 'var(--bg-canvas)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', pointerEvents: 'auto',
            animation: 'sheetIn 280ms var(--ease-out)',
            boxShadow: 'var(--shadow-xl)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '16px 16px 12px', flexShrink: 0,
            }}>
              <button type="button" onClick={onClose} style={{
                width: 38, height: 38, borderRadius: 12, border: 'none',
                background: 'var(--bg-sunken)', color: 'var(--fg-2)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="close" size={20} />
              </button>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-1)' }}>{title}</div>
              <button type="submit" style={{
                background: 'transparent', border: 'none', color: 'var(--clay-600)',
                fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                padding: '8px 4px',
              }}>
                Guardar
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: 'auto',
              padding: '0 16px 28px', display: 'flex', flexDirection: 'column', gap: 16,
            }}>

              {/* Type selector */}
              {isNew ? (
                <Segmented
                  value={mode === 'transfer' ? 'transfer' : formData.type}
                  onChange={v => {
                    if (v === 'transfer') {
                      setMode('transfer');
                      setFormData(prev => (prev.title ? prev : { ...prev, title: 'Transferencia' }));
                    } else {
                      setMode('transaction');
                      set('type', v);
                    }
                  }}
                  size="md"
                  options={[
                    { value: 'debit',     label: 'Gasto' },
                    { value: 'credit',    label: 'Ingreso' },
                    { value: 'transfer',  label: 'Transferencia' },
                  ]}
                />
              ) : mode === 'transaction' ? (
                <Segmented
                  value={formData.type}
                  onChange={v => set('type', v)}
                  size="md"
                  options={[
                    { value: 'debit',  label: 'Gasto' },
                    { value: 'credit', label: 'Ingreso' },
                  ]}
                />
              ) : null}

              {/* Amount card */}
              <div style={{
                background: 'var(--bg-raised)', borderRadius: 22, padding: 18,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <Eyebrow>Monto</Eyebrow>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 26, color: 'var(--fg-3)', fontWeight: 500 }}>$</span>
                  <input
                    required type="number" step="0.01" placeholder="0"
                    value={formData.amount}
                    onChange={e => set('amount', e.target.value)}
                    style={{
                      flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: 40, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.03em',
                      fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', padding: 0,
                    }}
                  />
                  <select
                    value={formData.currency}
                    onChange={e => set('currency', e.target.value)}
                    style={{
                      flexShrink: 0, padding: '5px 9px', borderRadius: 8, background: 'var(--bg-sunken)',
                      border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800,
                      color: 'var(--fg-2)', fontFamily: 'var(--font-mono)',
                      appearance: 'none', WebkitAppearance: 'none',
                    }}
                  >
                    {(appConfig?.currencies || ['COP', 'USD']).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Concepto */}
              <div>
                <FieldLabel>Descripción</FieldLabel>
                <div style={{
                  background: 'var(--bg-raised)', borderRadius: 14,
                  border: '1px solid var(--border-default)',
                  padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <Icon name="title" size={18} color="var(--fg-3)" />
                  <input
                    required type="text"
                    placeholder={mode === 'transfer' ? 'Ej. Transferencia mensual' : 'Ej. Almuerzo'}
                    value={formData.title}
                    onChange={e => set('title', e.target.value)}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--fg-1)', fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              {/* Category chips */}
              <div>
                <FieldLabel>Categoría</FieldLabel>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {filteredCategories.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>No hay categorías para este tipo/contexto.</span>
                  ) : filteredCategories.map(c => {
                    const active = c.name === formData.category;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => { set('category', c.name); set('subcategory', ''); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '7px 11px', borderRadius: 9999,
                          background: active ? 'var(--clay-500)' : 'var(--bg-raised)',
                          color: active ? '#fff' : 'var(--fg-1)',
                          border: active ? 'none' : '1px solid var(--border-default)',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                      >
                        <Icon name={c.icon || 'category'} size={14} />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subcategory */}
              {currentSubcategories.length > 0 && (
                <div>
                  <FieldLabel>Subcategoría</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select value={formData.subcategory} onChange={e => set('subcategory', e.target.value)} style={selectStyle}>
                      <option value="">(Sin subcategoría)</option>
                      {currentSubcategories.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Icon name="expand_more" size={16} color="var(--fg-3)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
              )}

              {/* Account + Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <FieldLabel>{mode === 'transfer' ? 'Cuenta origen' : 'Cuenta'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select required value={formData.card} onChange={e => set('card', e.target.value)} style={selectStyle}>
                      <option value="" disabled>Seleccionar…</option>
                      {(appConfig?.accounts || []).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <Icon name="expand_more" size={16} color="var(--fg-3)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Fecha</FieldLabel>
                  <input type="date" value={formData.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
                </div>
              </div>

              {/* Context + (transfer) destination */}
              <div style={{ display: 'grid', gridTemplateColumns: mode === 'transfer' ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div>
                  <FieldLabel>{mode === 'transfer' ? 'Contexto origen' : 'Contexto'}</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select value={formData.context} onChange={e => set('context', e.target.value)} style={selectStyle}>
                      <option value="personal">Personal</option>
                      <option value="business">Negocio</option>
                    </select>
                    <Icon name="expand_more" size={16} color="var(--fg-3)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
                {mode === 'transfer' && (
                  <div>
                    <FieldLabel>Contexto destino</FieldLabel>
                    <div style={{ position: 'relative' }}>
                      <select value={formData.destinationContext} onChange={e => set('destinationContext', e.target.value)} style={selectStyle}>
                        <option value="personal">Personal</option>
                        <option value="business">Negocio</option>
                      </select>
                      <Icon name="expand_more" size={16} color="var(--fg-3)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Transfer destination account */}
              {mode === 'transfer' && (
                <div>
                  <FieldLabel>Cuenta destino</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <select required value={formData.destinationCard} onChange={e => set('destinationCard', e.target.value)} style={selectStyle}>
                      <option value="" disabled>Seleccionar…</option>
                      {(appConfig?.accounts || []).map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <Icon name="expand_more" size={16} color="var(--fg-3)" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
              )}

              {/* Comentarios */}
              <div>
                <FieldLabel>Nota · opcional</FieldLabel>
                <textarea
                  placeholder="Contexto, recordatorios…"
                  rows={2}
                  value={formData.comments}
                  onChange={e => set('comments', e.target.value)}
                  style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
                />
              </div>

              {/* Submit + delete */}
              <button
                type="submit"
                style={{
                  marginTop: 4, padding: '14px 16px', border: 'none', cursor: 'pointer',
                  background: 'var(--clay-500)', color: '#fff', borderRadius: 14,
                  fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 14,
                  boxShadow: 'var(--shadow-clay)',
                }}
              >
                {isNew ? `Registrar ${mode === 'transfer' ? 'transferencia' : 'transacción'}` : 'Guardar cambios'}
              </button>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  style={{
                    padding: '12px 16px', border: 'none', cursor: 'pointer',
                    background: 'var(--danger-50)', color: 'var(--danger-700)', borderRadius: 14,
                    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
                  }}
                >
                  Eliminar transacción
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          deleteTransaction(editingTransaction.id);
          setConfirmDeleteOpen(false);
          onClose();
        }}
        title="Eliminar transacción"
        message="¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        isDestructive
      />
    </>
  );
}
