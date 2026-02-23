export default function Header({ currentContext, onContextChange, onMenuToggle }) {
    return (
        <header className="glass-panel sticky top-0 z-40 px-6 py-3 flex items-center justify-between shadow-sm border-b border-white/40">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                    <button
                        className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        onClick={onMenuToggle}
                    >
                        <span className="material-symbols-outlined text-xl">menu</span>
                    </button>
                    <div className="w-9 h-9 bg-gradient-to-tr from-primary to-secondary rounded-xl flex items-center justify-center text-white shadow-md">
                        <span className="material-symbols-outlined text-xl">donut_small</span>
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="text-base font-bold tracking-tight text-slate-800 leading-none">Mis Finanzas</h1>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Dashboard Personal</p>
                    </div>
                </div>
                <nav className="hidden md:flex bg-slate-100/50 p-1 rounded-xl items-center gap-1">
                    <label className="cursor-pointer">
                        <input
                            className="peer sr-only"
                            name="context"
                            type="radio"
                            value="personal"
                            checked={currentContext === 'personal'}
                            onChange={() => onContextChange('personal')}
                        />
                        <div className="px-5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 transition-all peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm hover:text-slate-700">Personal</div>
                    </label>
                    <label className="cursor-pointer">
                        <input
                            className="peer sr-only"
                            name="context"
                            type="radio"
                            value="unified"
                            checked={currentContext === 'unified'}
                            onChange={() => onContextChange('unified')}
                        />
                        <div className="px-5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 transition-all peer-checked:bg-primary peer-checked:text-slate-900 peer-checked:shadow-sm hover:text-slate-900">General</div>
                    </label>
                    <label className="cursor-pointer">
                        <input
                            className="peer sr-only"
                            name="context"
                            type="radio"
                            value="business"
                            checked={currentContext === 'business'}
                            onChange={() => onContextChange('business')}
                        />
                        <div className="px-5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 transition-all peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm hover:text-slate-700">Negocio</div>
                    </label>
                </nav>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center bg-white/50 border border-white/80 rounded-lg px-3 py-1.5 mr-2">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input className="bg-transparent border-none text-xs focus:outline-none w-32 placeholder:text-slate-400" placeholder="Buscar transacciones..." type="text" />
                </div>
                <button className="w-9 h-9 rounded-lg bg-white/80 flex items-center justify-center text-slate-600 hover:bg-white transition-all shadow-sm relative">
                    <span className="material-symbols-outlined text-xl">notifications</span>
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-secondary rounded-full border border-white"></span>
                </button>
                <div className="w-9 h-9 rounded-lg bg-slate-200 overflow-hidden border border-white shadow-sm">
                    <img alt="User profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDcVirnND2ap8hqalAGaij6ubIFjsZPuysXIoNKGa9DNz2FO3NGF0KGD5lxDDk8C0GgcmItYT9lXkspg0hpe_2MgcwAe1jURK5YRpuNAEd-o-e3JbwxkrNWx2LHUb41Kn377Dj9F65CnU5tpbzi15qja8oZIbHTyM0X3nZUl7I_U-yl1e5hNbm3cuCC_MlNUIAlJYy1AgknkM8Z9jFVU7xkvoUBhwym6uf9zX21eMH8-iYreewuUxYiGKiobUzV9J1r4fdI42iokvQ" />
                </div>
            </div>
        </header>
    );
}
