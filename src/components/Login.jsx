import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const { loginWithGoogle, loginError } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (loginError) {
            setError(loginError);
            setLoading(false); // Make sure to stop loading indicator if rejected
        }
    }, [loginError]);

    const handleLogin = async () => {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
        } catch (err) {
            console.error(err);
            setError('Fallo al iniciar sesión. Inténtalo de nuevo.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="bg-slate-800/80 backdrop-blur-xl border border-white/10 p-10 rounded-3xl shadow-2xl w-full max-w-md relative z-10 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 mx-auto mb-6 transform hover:scale-105 transition-transform">
                    <span className="text-white font-extrabold text-3xl tracking-tighter">MF</span>
                </div>

                <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Mis Finanzas</h1>
                <p className="text-slate-400 mb-10 font-medium">Dashboard Personal Administrativo</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-3.5 px-6 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google logo"
                        className="w-5 h-5 group-hover:scale-110 transition-transform"
                    />
                    {loading ? 'Conectando...' : 'Ingresar con Google'}
                </button>

                <p className="text-xs text-slate-500 mt-8 mt-auto">
                    Acceso restringido. Solo cuentas autorizadas.
                </p>
            </div>
        </div>
    );
}
