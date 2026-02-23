import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Login from './components/Login';
import { FinanceProvider } from './context/FinanceContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { currentUser } = useAuth();
  const [context, setContext] = useState('unified'); // 'personal', 'unified', 'business'
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'settings'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
              {currentView === 'dashboard' ? (
                <Dashboard currentContext={context} />
              ) : (
                <Settings />
              )}
            </main>
          </div>
        </div>
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
