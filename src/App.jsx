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
import TransactionModal from './components/TransactionModal';

function AppContent() {
  const { currentUser } = useAuth();
  const [context, setContext] = useState('unified'); // 'personal', 'unified', 'business'
  const [currentView, setCurrentView] = useState('insights'); // 'insights', 'settings', 'transactions'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFABModalOpen, setIsFABModalOpen] = useState(false);
  const [fabModalMode, setFabModalMode] = useState('transaction');

  if (!currentUser) {
    return <Login />;
  }

  return (
    <FinanceProvider>
      <div className="text-slate-900 overflow-x-hidden selection:bg-primary/30 min-h-screen relative">
        <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none z-[-1]"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none z-[-1]"></div>

        <div className="flex h-screen relative z-0">
          <Sidebar activeView={currentView} onNavigate={setCurrentView} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

          <div className="flex-1 flex flex-col md:ml-20 transition-all duration-300 w-full">
            <Header currentContext={context} onContextChange={setContext} onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

            <main className="flex-1 flex overflow-hidden">
              {currentView === 'insights' ? (
                <Insights currentContext={context} onNavigate={setCurrentView} />
              ) : currentView === 'settings' ? (
                <Settings />
              ) : currentView === 'transactions' ? (
                <Transactions currentContext={context} />
              ) : currentView === 'presupuestos' ? (
                <Presupuestos currentContext={context} />
              ) : null}
            </main>
          </div>
        </div>

        {/* Global Floating Action Buttons */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
          <button
            onClick={() => { setFabModalMode('transfer'); setIsFABModalOpen(true); }}
            className="w-14 h-14 bg-secondary text-white rounded-full shadow-[0_4px_20px_rgba(255,140,115,0.4)] hover:shadow-[0_6px_25px_rgba(255,140,115,0.6)] hover:scale-105 transition-all flex items-center justify-center relative group isolate"
            title="Transferir"
          >
            <span className="material-symbols-outlined text-2xl">swap_horiz</span>
            <span className="absolute right-full mr-4 bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">Transferir</span>
          </button>

          <button
            onClick={() => { setFabModalMode('transaction'); setIsFABModalOpen(true); }}
            className="w-14 h-14 bg-primary-dark text-white rounded-full shadow-[0_4px_20px_rgba(14,188,176,0.4)] hover:shadow-[0_6px_25px_rgba(14,188,176,0.6)] hover:scale-105 transition-all flex items-center justify-center relative group isolate"
            title="Agregar Transacción"
          >
            <span className="material-symbols-outlined text-2xl text-white font-bold">add</span>
            <span className="absolute right-full mr-4 bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">Agregar Transacción</span>
          </button>
        </div>

        <TransactionModal
          isOpen={isFABModalOpen}
          onClose={() => setIsFABModalOpen(false)}
          editingTransaction={null}
          initialMode={fabModalMode}
        />

      </div>
    </FinanceProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
