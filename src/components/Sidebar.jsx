import React from 'react';
import { useAuth } from '../context/AuthContext';

const SidebarItem = ({ icon, active, onClick, className = '', title = '' }) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group
    ${active ? 'bg-primary text-slate-900 shadow-lg shadow-primary/20 hover:scale-105' : 'hover:bg-white/60 text-slate-500 hover:text-primary'} ${className}`}
    >
        <span className="material-symbols-outlined transition-colors">
            {icon}
        </span>
    </button>
);

export default function Sidebar({ activeView, onNavigate, isOpen, setIsOpen }) {
    const { logout } = useAuth();

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <nav className={`
                w-20 flex-col py-6 px-4 z-50 border-r border-white/30 h-screen fixed left-0 top-0 items-center bg-slate-50 md:bg-transparent
                transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                flex
            `}>
                <div className="flex-1 flex flex-col gap-4 w-full items-center">
                    <SidebarItem
                        icon="dashboard"
                        title="Dashboard"
                        active={activeView === 'dashboard'}
                        onClick={() => { onNavigate && onNavigate('dashboard'); setIsOpen && setIsOpen(false); }}
                    />
                    <SidebarItem
                        icon="receipt_long"
                        title="Transacciones"
                        active={activeView === 'transactions'}
                        onClick={() => { onNavigate && onNavigate('transactions'); setIsOpen && setIsOpen(false); }}
                    />
                    <SidebarItem
                        icon="savings"
                        title="Presupuestos"
                        active={activeView === 'presupuestos'}
                        onClick={() => { onNavigate && onNavigate('presupuestos'); setIsOpen && setIsOpen(false); }}
                    />
                    <div className="w-8 h-px bg-slate-200 mx-auto my-2"></div>
                    <SidebarItem
                        icon="settings"
                        title="Ajustes"
                        active={activeView === 'settings'}
                        onClick={() => { onNavigate && onNavigate('settings'); setIsOpen && setIsOpen(false); }}
                    />
                </div>

                <div className="mt-auto items-center flex flex-col w-full">
                    <SidebarItem
                        icon="logout"
                        title="Cerrar Sesión"
                        onClick={logout}
                        className="hover:!text-red-500 hover:!bg-red-50"
                    />
                </div>
            </nav>
        </>
    );
}
