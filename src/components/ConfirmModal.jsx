import React from 'react';

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = false
}) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>

                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDestructive ? 'bg-red-100 text-red-500' : 'bg-primary/20 text-primary-dark'}`}>
                        <span className="material-symbols-outlined text-2xl">
                            {isDestructive ? 'delete' : 'info'}
                        </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 mb-6">{message}</p>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-white transition-colors ${isDestructive
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-primary hover:bg-primary-dark text-slate-900'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
