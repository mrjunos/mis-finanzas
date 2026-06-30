import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Shared infrastructure
import Header from './shared/components/Header';
import Sidebar from './shared/components/Sidebar';
import HomeScreen from './shared/components/HomeScreen';
import Login from './shared/components/Login';
import { usePushNotifications } from './shared/hooks/usePushNotifications';
import { Icon } from './shared/ds/Primitives';

// Auth (cross-cutting)
import { AuthProvider, useAuth } from './context/AuthContext';

// Domain providers
import { FinanceProvider, useFinance } from './domains/finance/context/FinanceContext';
import { HealthProvider } from './domains/health/context/HealthContext';
import { TasksProvider } from './domains/tasks/context/TasksContext';
import { HabitsProvider } from './domains/habits/context/HabitsContext';

// Finance screens
import Insights from './domains/finance/components/Insights';
import Transactions from './domains/finance/components/Transactions';
import Presupuestos from './domains/finance/components/Presupuestos';
import CategoriaDetalle from './domains/finance/components/CategoriaDetalle';
import TransaccionDetalle from './domains/finance/components/TransaccionDetalle';
import TransactionModal from './domains/finance/components/TransactionModal';

// Other domain screens
import HealthHome from './domains/health/components/HealthHome';
import TasksHome from './domains/tasks/components/TasksHome';
import HabitsHome from './domains/habits/components/HabitsHome';

// Settings stays in legacy location (evolves in place)
import Settings from './components/Settings';

// Views that push from within a domain (not tab-bar destinations)
const DETAIL_VIEWS = ['categoria', 'transaccion'];

const DOMAIN_DEFAULTS = {
  home:    'home',
  finance: 'insights',
  health:  'health',
  tasks:   'tasks',
  habits:  'habits',
};

// Sub-navigation tabs per domain (only domains with multiple views need this)
const DOMAIN_TABS = {
  finance: [
    { view: 'insights',     icon: 'insights',      label: 'Radiografía' },
    { view: 'transactions', icon: 'receipt_long',   label: 'Movimientos' },
    { view: 'presupuestos', icon: 'savings',        label: 'Presupuestos' },
  ],
};

// FAB appearance per domain
const FAB_CONFIG = {
  home:    { icon: 'add',                    color: 'var(--ink-800)' },
  finance: { icon: 'add',                    color: 'var(--clay-500)' },
  health:  { icon: 'restaurant',             color: 'var(--olive-600, #5E6738)' },
  tasks:   { icon: 'add_task',               color: 'var(--ink-700)' },
  habits:  { icon: 'local_fire_department',  color: 'var(--clay-500)' },
};

// Horizontal tab strip shown below the header when a domain has sub-views
function DomainTabStrip({ domain, currentView, onNavigate }) {
  const tabs = DOMAIN_TABS[domain];
  if (!tabs) return null;
  return (
    <div style={{
      display: 'flex', gap: 0, flexShrink: 0,
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--bg-base)',
      overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const isActive = currentView === tab.view;
        return (
          <button
            key={tab.view}
            type="button"
            onClick={() => onNavigate(tab.view)}
            style={{
              flex: '0 0 auto', border: 'none', background: 'transparent',
              padding: '10px 18px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: isActive ? 800 : 600,
              color: isActive ? 'var(--clay-600)' : 'var(--fg-3)',
              borderBottom: isActive ? '2px solid var(--clay-500)' : '2px solid transparent',
              transition: 'color var(--dur-fast) var(--ease-out)',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={tab.icon} size={15} fill={isActive} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Resolves a deep-link transaction ID using the in-memory cache first,
// avoiding a Firestore round-trip when the app is already open and subscribed.
function DeepLinkResolver({ currentUser, pendingEditId, setPendingEditId, openEditTransaction }) {
  const { transactions, loading } = useFinance();

  useEffect(() => {
    if (!currentUser || !pendingEditId) return;

    const cleanUrl = () => {
      if (typeof window === 'undefined') return;
      const u = new URL(window.location.href);
      u.searchParams.delete('editTx');
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    };

    const cached = transactions.find(t => t.id === pendingEditId);
    if (cached) {
      openEditTransaction(cached);
      setPendingEditId(null);
      cleanUrl();
      return;
    }

    if (loading) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'finance_transactions', pendingEditId));
        if (!cancelled && snap.exists()) {
          openEditTransaction({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error('No se pudo abrir la transacción del deep-link:', e);
      } finally {
        cleanUrl();
        if (!cancelled) setPendingEditId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser, pendingEditId, transactions, loading, openEditTransaction, setPendingEditId]);

  return null;
}

// Mobile tab bar — 4 items + FAB
const TabBar = React.memo(function TabBar({ activeDomain, onHome, onFinance, onSettings, onFab, fabIcon, fabColor }) {
  const items = [
    { id: 'home',    icon: 'home',    label: 'Inicio',   onClick: onHome },
    { id: 'finance', icon: 'account_balance_wallet', label: 'Finanzas', onClick: onFinance },
    { id: '__fab__', icon: 'add',     label: null },
    { id: 'settings',icon: 'person',  label: 'Yo',       onClick: onSettings },
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
                  background: fabColor || 'var(--clay-500)', color: '#fff', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: -22, boxShadow: 'var(--shadow-clay)',
                  transition: 'transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.07)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Icon name={fabIcon || 'add'} size={24} />
              </button>
            </div>
          );
        }
        const isActive = activeDomain === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
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
});

function AppContent() {
  const { currentUser } = useAuth();
  const [domain, setDomain] = useState('home');
  const [currentView, setCurrentView] = useState('home');
  const [viewParams, setViewParams] = useState(null);
  const [backView, setBackView] = useState('insights');
  const [isFABModalOpen, setIsFABModalOpen] = useState(false);
  const [fabModalMode, setFabModalMode] = useState('transaction');
  const [editingTx, setEditingTx] = useState(null);

  // Per-domain FAB triggers (increment to open the domain's creation modal)
  const [healthFab, setHealthFab] = useState(0);
  const [tasksFab, setTasksFab]   = useState(0);
  const [habitsFab, setHabitsFab] = useState(0);

  // Deep-link: ?editTx=<id> from push notification
  const [pendingEditId, setPendingEditId] = useState(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('editTx');
  });

  // In-app foreground notice stack
  const [foregroundNotices, setForegroundNotices] = useState([]);
  const noticeIdRef = useRef(0);
  const dismissNotice = useCallback((id) => {
    setForegroundNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const openEditTransaction = useCallback((tx) => {
    setEditingTx(tx);
    setFabModalMode('transaction');
    setIsFABModalOpen(true);
  }, []);

  const openAddTransaction = useCallback(() => {
    setEditingTx(null);
    setFabModalMode('transaction');
    setIsFABModalOpen(true);
  }, []);

  const handleFab = useCallback((dom) => {
    if (dom === 'finance') { setEditingTx(null); setFabModalMode('transaction'); setIsFABModalOpen(true); }
    else if (dom === 'health')  setHealthFab(n => n + 1);
    else if (dom === 'tasks')   setTasksFab(n => n + 1);
    else if (dom === 'habits')  setHabitsFab(n => n + 1);
  }, []);

  const push = usePushNotifications(useCallback((payload) => {
    const d = payload?.data || {};
    setForegroundNotices((prev) => {
      const filtered = d.txId ? prev.filter((n) => n.txId !== d.txId) : prev;
      const next = [...filtered, { id: ++noticeIdRef.current, txId: d.txId, title: d.title, body: d.body }];
      return next.slice(-4);
    });
  }, []));

  // PWA postMessage from service worker (notification tap, app already open)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = (e) => {
      if (e.data?.type === 'OPEN_EDIT_TX' && e.data.url) {
        const id = new URL(e.data.url, window.location.origin).searchParams.get('editTx');
        if (id) setPendingEditId(id);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (!currentUser) {
    return <Login />;
  }

  const switchDomain = (newDomain) => {
    setDomain(newDomain);
    setCurrentView(DOMAIN_DEFAULTS[newDomain] ?? newDomain);
    setViewParams(null);
  };

  const navigate = (view, params = null) => {
    if (DETAIL_VIEWS.includes(view) && !DETAIL_VIEWS.includes(currentView)) {
      setBackView(currentView);
    }
    setCurrentView(view);
    setViewParams(params);
  };

  const goBack = () => navigate(backView);

  const isDetailView = DETAIL_VIEWS.includes(currentView);
  const isSettingsView = currentView === 'settings';
  // Domain for the header: settings is neutral, detail views stay in domain
  const headerDomain = isSettingsView ? 'home' : domain;

  return (
    <FinanceProvider>
      <HealthProvider>
        <TasksProvider>
          <HabitsProvider>
            <DeepLinkResolver
              currentUser={currentUser}
              pendingEditId={pendingEditId}
              setPendingEditId={setPendingEditId}
              openEditTransaction={openEditTransaction}
            />
            <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>

              {/* Desktop sidebar rail */}
              <div className="hidden md:block">
                <Sidebar
                  activeView={currentView}
                  activeDomain={domain}
                  onNavigate={navigate}
                  onSwitchDomain={switchDomain}
                />
              </div>

              {/* Main content area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Sticky header — hidden on detail views */}
                {!isDetailView && (
                  <Header
                    domain={headerDomain}
                    onHome={() => switchDomain('home')}
                  />
                )}

                {/* Domain sub-navigation tabs (Finance: Radiografía/Movimientos/Presupuestos, etc.) */}
                {!isDetailView && !isSettingsView && (
                  <DomainTabStrip domain={domain} currentView={currentView} onNavigate={navigate} />
                )}

                {/* Scrollable content */}
                <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} className="pb-28 md:pb-8">
                  {/* Home */}
                  {domain === 'home' && currentView === 'home' && (
                    <HomeScreen onSwitchDomain={switchDomain} />
                  )}

                  {/* Finance */}
                  {domain === 'finance' && currentView === 'insights'     && <Insights onNavigate={navigate} onAddTransaction={openAddTransaction} onEditTransaction={openEditTransaction} />}
                  {domain === 'finance' && currentView === 'transactions'  && <Transactions onNavigate={navigate} onEditTransaction={openEditTransaction} />}
                  {domain === 'finance' && currentView === 'presupuestos'  && <Presupuestos onNavigate={navigate} />}
                  {domain === 'finance' && currentView === 'categoria'     && <CategoriaDetalle categoryName={viewParams?.category} onBack={goBack} onNavigate={navigate} />}
                  {domain === 'finance' && currentView === 'transaccion'   && <TransaccionDetalle txId={viewParams?.txId} onBack={goBack} onEdit={openEditTransaction} />}

                  {/* Other domains */}
                  {domain === 'health'  && <HealthHome fabTrigger={healthFab} />}
                  {domain === 'tasks'   && <TasksHome  fabTrigger={tasksFab} />}
                  {domain === 'habits'  && <HabitsHome fabTrigger={habitsFab} />}

                  {/* Settings — accessible from any domain */}
                  {isSettingsView && <Settings onNavigate={navigate} push={push} />}
                </main>
              </div>

              {/* Desktop FAB — context-aware per domain */}
              {!isSettingsView && (
                <div className="hidden md:flex" style={{
                  position: 'fixed', right: 28, bottom: 28,
                  flexDirection: 'column', gap: 10, zIndex: 50,
                }}>
                  {domain === 'finance' && (
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
                        transition: 'transform var(--dur-fast) var(--ease-out)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Icon name="swap_horiz" size={18} />
                      Transferir
                    </button>
                  )}
                  {domain !== 'home' && (() => {
                    const fab = FAB_CONFIG[domain] || FAB_CONFIG.finance;
                    const LABELS = { finance: 'Agregar transacción', health: 'Registrar comida', tasks: 'Nueva lista', habits: 'Nuevo hábito' };
                    return (
                      <button
                        type="button"
                        onClick={() => handleFab(domain)}
                        style={{
                          height: 52, padding: '0 20px 0 16px', gap: 8, borderRadius: 9999,
                          border: 'none', cursor: 'pointer',
                          background: fab.color, color: '#fff',
                          boxShadow: 'var(--shadow-clay)',
                          display: 'inline-flex', alignItems: 'center',
                          fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 13,
                          transition: 'transform var(--dur-fast) var(--ease-out)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <Icon name={fab.icon} size={22} />
                        {LABELS[domain]}
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* Mobile tab bar */}
              <div className="md:hidden">
                <TabBar
                  activeDomain={isSettingsView ? 'settings' : domain}
                  onHome={() => switchDomain('home')}
                  onFinance={() => switchDomain('finance')}
                  onSettings={() => navigate('settings')}
                  onFab={() => handleFab(domain)}
                  fabIcon={(FAB_CONFIG[domain] || FAB_CONFIG.finance).icon}
                  fabColor={(FAB_CONFIG[domain] || FAB_CONFIG.finance).color}
                />
              </div>

              {/* Foreground push notices */}
              {foregroundNotices.length > 0 && (
                <div style={{
                  position: 'fixed', left: 12, right: 12, top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
                  margin: '0 auto', maxWidth: 460, zIndex: 60,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {foregroundNotices.map((notice) => (
                    <div key={notice.id} style={{
                      background: 'var(--bg-raised)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 16, boxShadow: 'var(--shadow-lg)',
                      padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'var(--clay-500)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon name="rate_review" size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-1)' }}>
                          {notice.title || 'Pendiente de revisión'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notice.body || 'Nuevo movimiento por revisar'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (notice.txId) setPendingEditId(notice.txId);
                          dismissNotice(notice.id);
                        }}
                        style={{
                          flexShrink: 0, height: 34, padding: '0 14px', borderRadius: 9999,
                          border: 'none', cursor: 'pointer', background: 'var(--ink-800)', color: '#fff',
                          fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12,
                        }}
                      >
                        Revisar
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissNotice(notice.id)}
                        aria-label="Cerrar"
                        style={{
                          flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                          border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--fg-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <TransactionModal
                isOpen={isFABModalOpen}
                onClose={() => { setIsFABModalOpen(false); setEditingTx(null); }}
                editingTransaction={editingTx}
                initialMode={fabModalMode}
              />
            </div>
          </HabitsProvider>
        </TasksProvider>
      </HealthProvider>
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
