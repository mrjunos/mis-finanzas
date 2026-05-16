import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Settings from './components/Settings';
import Login from './components/Login';
import { FinanceProvider } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Transactions from './components/Transactions';
import Presupuestos from './components/Presupuestos';
import Insights from './components/Insights';
import CategoriaDetalle from './components/CategoriaDetalle';
import TransaccionDetalle from './components/TransaccionDetalle';
import Nutricion from './components/Nutricion';
import TransactionModal from './components/TransactionModal';
import { Icon } from './components/ds/Primitives';

// Pushed views reached from within a screen (not bottom-nav destinations)
const DETAIL_VIEWS = ['categoria', 'transaccion', 'nutricion'];

// Bottom tab bar — mobile only
function TabBar({ active, onChange, onFab }) {
  const items = [
    { id: 'insights',     icon: 'insights',     label: 'Radiografía' },
    { id: 'transactions', icon: 'receipt_long', label: 'Movimientos' },
    { id: '__fab__',      icon: 'add',          label: null },
    { id: 'presupuestos', icon: 'savings',      label: 'Presupuestos' },
    { id: 'settings',     icon: 'person',       label: 'Yo' },
  ];

  return (
    <nav style={{
      position: 'fixed', left: 12, right: 12, bottom: 12,
      height: 'var(--tabbar-h)',
      background: 'rgba(255, 255, 255, 0.88)',
      backdropFilter: 'blur(24px) saturate(140%)',
      WebkitBackdropFilter: 'blur(24px) saturate(140%)',
      border: '1px solid rgba(255, 255, 255, 0.9)',
      borderRadius: 22,
      display: 'flex', alignItems: 'center', padding: '0 6px',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 50,
    }}>
      {items.map(item => {
        if (item.id === '__fab__') {
          return (
            <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={onFab}
                style={{
                  width: 52, height: 52, borderRadius: '50%', border: 'none',
                  background: 'var(--clay-500)', color: '#fff', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: -22, boxShadow: 'var(--shadow-clay)',
                  transition: 'transform var(--dur-fast) var(--ease-out)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Icon name="add" size={24} />
              </button>
            </div>
          );
        }
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              flex: 1, border: 'none', background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '8px 0',
              color: isActive ? 'var(--clay-600)' : 'var(--fg-3)',
              transition: 'color var(--dur-fast) var(--ease-out)',
            }}
          >
            <Icon name={item.icon} size={22} fill={isActive} />
            <span style={{ fontSize: 9, fontWeight: isActive ? 800 : 600, letterSpacing: '0.04em' }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function AppContent() {
  const { currentUser } = useAuth();
  const [context, setContext] = useState('unified');
  const [currentView, setCurrentView] = useState('insights');
  const [viewParams, setViewParams] = useState(null);
  const [backView, setBackView] = useState('insights');
  const [isFABModalOpen, setIsFABModalOpen] = useState(false);
  const [fabModalMode, setFabModalMode] = useState('transaction');
  const [editingTx, setEditingTx] = useState(null);

  if (!currentUser) {
    return <Login />;
  }

  const isDetailView = DETAIL_VIEWS.includes(currentView);

  const navigate = (view, params = null) => {
    // Remember the origin screen when stepping into a detail view
    if (DETAIL_VIEWS.includes(view) && !DETAIL_VIEWS.includes(currentView)) {
      setBackView(currentView);
    }
    setCurrentView(view);
    setViewParams(params);
  };
  const goBack = () => navigate(backView);

  const openAddTransaction = () => {
    setEditingTx(null);
    setFabModalMode('transaction');
    setIsFABModalOpen(true);
  };
  const openEditTransaction = (tx) => {
    setEditingTx(tx);
    setFabModalMode('transaction');
    setIsFABModalOpen(true);
  };

  return (
    <FinanceProvider>
      <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>

        {/* Desktop sidebar rail — hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar activeView={currentView} onNavigate={navigate} />
        </div>

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Sticky glass header — hidden on full-bleed detail views */}
          {!isDetailView && <Header currentContext={context} onContextChange={setContext} />}

          {/* Scrollable view content — generous bottom pad clears the mobile tab bar + FAB */}
          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
            className="pb-28 md:pb-8"
          >
            {currentView === 'insights'      && <Insights currentContext={context} onNavigate={navigate} onAddTransaction={openAddTransaction} />}
            {currentView === 'transactions'  && <Transactions currentContext={context} onNavigate={navigate} />}
            {currentView === 'presupuestos'  && <Presupuestos currentContext={context} onNavigate={navigate} />}
            {currentView === 'settings'      && <Settings onNavigate={navigate} />}
            {currentView === 'categoria'     && <CategoriaDetalle currentContext={context} categoryName={viewParams?.category} onBack={goBack} onNavigate={navigate} />}
            {currentView === 'transaccion'   && <TransaccionDetalle txId={viewParams?.txId} onBack={goBack} onEdit={openEditTransaction} />}
            {currentView === 'nutricion'     && <Nutricion onBack={goBack} />}
          </main>
        </div>

        {/* Desktop FAB stack — bottom right, hidden on mobile */}
        <div className="hidden md:flex" style={{
          position: 'fixed', right: 28, bottom: 28,
          flexDirection: 'column', gap: 10, zIndex: 50,
        }}>
          <button
            type="button"
            onClick={() => { setFabModalMode('transfer'); setIsFABModalOpen(true); }}
            style={{
              height: 44, padding: '0 16px 0 12px', gap: 7, borderRadius: 9999,
              border: 'none', cursor: 'pointer',
              background: 'var(--ink-700)', color: '#fff',
              boxShadow: '0 8px 24px -6px rgba(31,27,20,0.30)',
              display: 'inline-flex', alignItems: 'center',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
              transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <Icon name="swap_horiz" size={18} />
            Transferir
          </button>
          <button
            type="button"
            onClick={openAddTransaction}
            style={{
              height: 52, padding: '0 20px 0 16px', gap: 8, borderRadius: 9999,
              border: 'none', cursor: 'pointer',
              background: 'var(--clay-500)', color: '#fff',
              boxShadow: 'var(--shadow-clay)',
              display: 'inline-flex', alignItems: 'center',
              fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13,
              transition: 'transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.background = 'var(--clay-600)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--clay-500)'; }}
          >
            <Icon name="add" size={22} />
            Agregar transacción
          </button>
        </div>

        {/* Mobile bottom tab bar — hidden on desktop */}
        <div className="md:hidden">
          <TabBar
            active={currentView}
            onChange={navigate}
            onFab={openAddTransaction}
          />
        </div>

        <TransactionModal
          isOpen={isFABModalOpen}
          onClose={() => { setIsFABModalOpen(false); setEditingTx(null); }}
          editingTransaction={editingTx}
          initialMode={fabModalMode}
        />
      </div>
    </FinanceProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
