import React, { useState, useEffect, useMemo } from 'react';
import PresupuestoModal from './PresupuestoModal';
import MetaModal from './MetaModal';
import { useFinance } from '../context/FinanceContext';
import { format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../utils/format';
import {
  Icon, Card, Pill, IconTile, ProgressBar, Eyebrow,
} from './ds/Primitives';

export default function Presupuestos({ currentContext }) {
  const { budgets, fetchBudgetConfig, saveBudgetConfig, goals, transactions } = useFinance();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPresupuestoModalOpen, setIsPresupuestoModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState(null);

  const monthStr     = format(currentDate, 'yyyy-MM');
  const monthDisplay = format(currentDate, 'MMMM yyyy', { locale: es });
  const contextoKey  = currentContext === 'business' ? 'business' : 'personal';
  const budgetId     = `${monthStr}_${contextoKey}`;

  useEffect(() => {
    fetchBudgetConfig(monthStr, contextoKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr, contextoKey]);

  const [localCategories, setLocalCategories] = useState([]);

  const monthTransactions = useMemo(() => {
    const [year, month] = monthStr.split('-').map(Number);
    return transactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });
  }, [transactions, monthStr]);

  const spendingMap = useMemo(() => {
    const map = {};
    const contextFiltered = monthTransactions.filter(t => {
      if (contextoKey === 'personal') return t.context === 'personal';
      if (contextoKey === 'business') return t.context === 'business';
      return true;
    });
    contextFiltered.forEach(t => {
      if (t.type === 'debit' && t.category) {
        const amount = Number(t.amount);
        map[`${t.category}-ALL`] = (map[`${t.category}-ALL`] || 0) + amount;
        if (t.subcategory) map[`${t.category}-${t.subcategory}`] = (map[`${t.category}-${t.subcategory}`] || 0) + amount;
      }
    });
    return map;
  }, [monthTransactions, contextoKey]);

  const getBudgetId = (cat) => `${cat.nombre}-${cat.subcategory || 'ALL'}`;

  const enrichedCategories = useMemo(() =>
    localCategories.map(cat => ({ ...cat, gastado: spendingMap[getBudgetId(cat)] || 0 })),
    [localCategories, spendingMap]);

  const gastadoReal = useMemo(() => enrichedCategories.reduce((a, c) => a + c.gastado, 0), [enrichedCategories]);

  useEffect(() => {
    if (budgets[budgetId]?.categories) setLocalCategories(budgets[budgetId].categories);
    else setLocalCategories([]);
  }, [budgets, budgetId]);

  const presupuestadoTotal = useMemo(() => enrichedCategories.reduce((a, c) => a + Number(c.limite), 0), [enrichedCategories]);

  const goalSavings = useMemo(() => {
    const s = {};
    goals.forEach(g => {
      if (g.cuenta) s[g.id] = transactions.filter(t => t.type === 'credit' && t.account === g.cuenta).reduce((a, t) => a + Number(t.amount), 0);
    });
    return s;
  }, [transactions, goals]);

  const localGoals = useMemo(() =>
    goals
      .filter(g => currentContext === 'unified' ? true : g.contexto === currentContext)
      .map(g => ({ ...g, ahorrado: goalSavings[g.id] || 0 })),
    [goals, currentContext, goalSavings]);

  const handleSaveBudgetConfig = async (categoryData, isEditing) => {
    let updated = [...localCategories];
    const newId = getBudgetId(categoryData);
    if (isEditing && editingCategory) {
      const origId = getBudgetId(editingCategory);
      updated = updated.map(c => getBudgetId(c) === origId ? categoryData : c);
    } else {
      if (updated.find(c => getBudgetId(c) === newId)) { alert("Este presupuesto ya existe."); return; }
      updated.push(categoryData);
    }
    await saveBudgetConfig(monthStr, contextoKey, updated);
  };

  const pct = (spent, limit) => Math.min(100, (spent / limit) * 100);

  // Unified view
  const renderResumenGeneral = () => {
    const pBudget  = budgets[`${monthStr}_personal`]?.categories || [];
    const bBudget  = budgets[`${monthStr}_business`]?.categories || [];
    const pGastado = monthTransactions.filter(t => t.context === 'personal' && t.type === 'debit').reduce((a, t) => a + Number(t.amount), 0);
    const pTotal   = pBudget.reduce((a, c) => a + c.limite, 0);
    const bGastado = monthTransactions.filter(t => t.context === 'business' && t.type === 'debit').reduce((a, t) => a + Number(t.amount), 0);
    const bTotal   = bBudget.reduce((a, c) => a + c.limite, 0);
    const saludP   = pTotal > 0 ? (pGastado / pTotal) * 100 : 0;
    const saludB   = bTotal > 0 ? (bGastado / bTotal) * 100 : 0;

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {/* Personal budget health */}
        <Card moduleHue="var(--clay-500)" padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Eyebrow>Salud personal</Eyebrow>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8 }}>
                {saludP.toFixed(1)}<span style={{ fontSize: 20, color: 'var(--fg-3)' }}>%</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Consumido este mes</p>
            </div>
            <IconTile icon="account_balance_wallet" hue="clay" size={40} />
          </div>
          <ProgressBar value={pGastado} max={pTotal || 1} color="var(--clay-500)" />
        </Card>

        {/* Business budget health */}
        <Card moduleHue="var(--plum-400)" padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <Eyebrow>Salud negocio</Eyebrow>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8 }}>
                {saludB.toFixed(1)}<span style={{ fontSize: 20, color: 'var(--fg-3)' }}>%</span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--fg-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Consumido este mes</p>
            </div>
            <IconTile icon="business_center" hue="plum" size={40} />
          </div>
          <ProgressBar value={bGastado} max={bTotal || 1} color="var(--plum-400)" />
        </Card>

        {/* Advisory */}
        <Card variant="outlined" padding={20} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IconTile icon="info" hue="ink" size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>El contexto General no mezcla presupuestos.</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 3 }}>
              Selecciona Personal o Negocio para gestionar categorías y límites.
            </div>
          </div>
        </Card>
      </div>
    );
  };

  // Personal / Business specific view
  const renderContextoEspecifico = () => {
    const disponible     = presupuestadoTotal - gastadoReal;
    const moduleHue      = currentContext === 'business' ? 'var(--plum-400)' : 'var(--clay-500)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Top KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Card padding={16}>
            <Eyebrow>Presupuestado</Eyebrow>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
              {formatCurrency(presupuestadoTotal, 'COP')}
            </div>
          </Card>
          <Card padding={16}>
            <Eyebrow>Gastado</Eyebrow>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
              {formatCurrency(gastadoReal, 'COP')}
            </div>
            <div style={{ marginTop: 8 }}>
              <ProgressBar value={gastadoReal} max={presupuestadoTotal || 1} color={moduleHue} />
            </div>
          </Card>
          <Card padding={16}>
            <Eyebrow>Disponible</Eyebrow>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: disponible < 0 ? 'var(--danger-700)' : 'var(--fg-1)', fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}>
              {formatCurrency(disponible, 'COP')}
            </div>
          </Card>
        </div>

        {/* Category list */}
        <Card padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>Categorías</h3>
            <button
              type="button"
              onClick={() => { setEditingCategory(null); setIsPresupuestoModalOpen(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 32, padding: '0 12px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                background: 'var(--clay-50)', color: 'var(--clay-600)',
                fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11,
              }}
            >
              <Icon name="add" size={15} /> Agregar
            </button>
          </div>

          {localCategories.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--fg-3)' }}>
              <IconTile icon="savings" hue="ink" size={48} />
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-2)' }}>No hay presupuesto configurado para este mes.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {enrichedCategories.map((cat, i) => {
                const excedido  = cat.gastado > cat.limite;
                const warn      = !excedido && cat.gastado / cat.limite >= 0.9;
                const displayName = cat.subcategory ? `${cat.nombre} › ${cat.subcategory}` : cat.nombre;
                return (
                  <div
                    key={i}
                    onClick={() => { setEditingCategory(localCategories[i]); setIsPresupuestoModalOpen(true); }}
                    style={{
                      padding: '12px 10px', borderRadius: 12, cursor: 'pointer',
                      transition: 'background var(--dur-fast) var(--ease-out)',
                      borderBottom: i < enrichedCategories.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {displayName}
                          {cat.subcategory && <span style={{ fontSize: 9, background: 'var(--ink-100)', color: 'var(--fg-3)', padding: '1px 5px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sub</span>}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(cat.gastado, 'COP')} de {formatCurrency(cat.limite, 'COP')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {excedido ? <Pill variant="danger" icon="report">Excedido</Pill> :
                         warn     ? <Pill variant="warning" icon="schedule">Casi al tope</Pill> :
                                    <Pill variant="success" icon="check_circle">A tiempo</Pill>}
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 12, color: excedido ? 'var(--danger-700)' : warn ? 'var(--warning-700)' : 'var(--fg-1)' }}>
                          {pct(cat.gastado, cat.limite).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <ProgressBar value={cat.gastado} max={cat.limite} color={moduleHue} />
                    {excedido && (
                      <p style={{ margin: '5px 0 0', fontSize: 10, fontWeight: 700, color: 'var(--danger-700)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="error" size={12} /> Te pasaste por {formatCurrency(cat.gastado - cat.limite, 'COP')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Savings goals */}
        <Card padding={20}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>Metas de ahorro</h3>
            <button
              type="button"
              onClick={() => { setEditingMeta(null); setIsMetaModalOpen(true); }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 32, padding: '0 12px', borderRadius: 9999, border: 'none', cursor: 'pointer',
                background: 'var(--olive-50)', color: 'var(--olive-600)',
                fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 11,
              }}
            >
              <Icon name="add" size={15} /> Nueva meta
            </button>
          </div>

          {localGoals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--fg-3)' }}>
              <IconTile icon="savings" hue="olive" size={48} />
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-2)' }}>No hay metas configuradas.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {localGoals.map((meta, i) => {
                const progreso = pct(meta.ahorrado, meta.objetivo);
                return (
                  <div
                    key={meta.id}
                    onClick={() => { setEditingMeta(meta); setIsMetaModalOpen(true); }}
                    style={{
                      padding: '12px 10px', borderRadius: 12, cursor: 'pointer',
                      transition: 'background var(--dur-fast) var(--ease-out)',
                      borderBottom: i < localGoals.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--ink-50)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-1)' }}>{meta.nombre}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(meta.ahorrado, 'COP')} de {formatCurrency(meta.objetivo, 'COP')}
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 13, color: 'var(--olive-600)' }}>
                        {progreso.toFixed(0)}%
                      </span>
                    </div>
                    <ProgressBar value={meta.ahorrado} max={meta.objetivo} color="var(--olive-500)" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 'var(--content-max)', margin: '0 auto', padding: '0 20px', paddingBottom: 32 }} className="animate-fade-up">

      {/* Page header with month nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '16px 0 16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--fg-1)', letterSpacing: '-0.02em' }}>Presupuestos</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-3)' }}>Límites mensuales por categoría.</p>
        </div>

        {/* Month navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
          borderRadius: 12, padding: '6px 10px',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <button type="button" onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }}>
            <Icon name="chevron_left" size={18} />
          </button>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-1)', width: 96, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {monthDisplay}
          </span>
          <button type="button" onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--fg-3)', display: 'flex', padding: 2 }}>
            <Icon name="chevron_right" size={18} />
          </button>
        </div>
      </div>

      {currentContext === 'unified' ? renderResumenGeneral() : renderContextoEspecifico()}

      <PresupuestoModal
        isOpen={isPresupuestoModalOpen}
        onClose={() => { setIsPresupuestoModalOpen(false); setEditingCategory(null); }}
        currentContext={contextoKey}
        currentMonthStr={monthDisplay}
        editingCategory={editingCategory}
        onSaveConfig={handleSaveBudgetConfig}
      />
      <MetaModal
        isOpen={isMetaModalOpen}
        onClose={() => { setIsMetaModalOpen(false); setEditingMeta(null); }}
        currentContext={currentContext}
        editingMeta={editingMeta}
      />
    </div>
  );
}
