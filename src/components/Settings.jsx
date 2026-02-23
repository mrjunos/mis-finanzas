import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';

// Helper component for rendering list sections
const ConfigSection = ({
    title, icon, listName, inputValue, setInputValue, placeholder,
    appConfig, saving, handleAddItem, handleRemoveItem, handleMoveItemUp
}) => (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-soft border border-white p-6 relative overflow-hidden group">
        {/* Subtle Gradient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 group-hover:bg-primary/10 transition-colors"></div>

        <div className="flex items-center justify-between mb-6">
            <div>
                <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">{icon}</span>
                    {title}
                </h3>
            </div>
        </div>

        {/* Input Row */}
        <div className="flex gap-2 mb-6">
            <input
                type="text"
                placeholder={placeholder}
                className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem(listName, inputValue, setInputValue)}
                disabled={saving}
            />
            <button
                onClick={() => handleAddItem(listName, inputValue, setInputValue)}
                disabled={saving || !inputValue.trim()}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center shrink-0"
            >
                <span className="material-symbols-outlined text-lg">add</span>
            </button>
        </div>

        {/* List */}
        <div className="space-y-2">
            {appConfig[listName] && appConfig[listName].length > 0 ? (
                appConfig[listName].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group/item hover:border-slate-300 transition-colors">
                        <span className="text-sm font-bold text-slate-700">
                            {item} {idx === 0 && listName === 'currencies' && <span className="ml-2 text-[10px] bg-primary/20 text-primary-dark px-2 py-0.5 rounded-md uppercase">Principal</span>}
                        </span>
                        <div className="flex items-center gap-1 opacity-50 group-hover/item:opacity-100 transition-opacity">
                            {idx > 0 && (
                                <button
                                    onClick={() => handleMoveItemUp(listName, idx)}
                                    disabled={saving}
                                    className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                                    title="Mover arriba"
                                >
                                    <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                </button>
                            )}
                            <button
                                onClick={() => handleRemoveItem(listName, idx)}
                                disabled={saving || appConfig[listName].length === 1}
                                className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="Eliminar"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </div>
                ))
            ) : (
                <p className="text-xs text-slate-400 italic text-center py-4">Sin elementos.</p>
            )}
        </div>
    </div>
);

export default function Settings() {
    const { appConfig, updateAppConfig } = useFinance();
    const [saving, setSaving] = useState(false);

    // Local state for inputs
    const [newCurrency, setNewCurrency] = useState('');
    const [newAccount, setNewAccount] = useState('');
    const [newCategory, setNewCategory] = useState('');

    const handleAddItem = async (listName, value, setter) => {
        if (!value.trim()) return;
        const trimmed = value.trim();
        if (appConfig[listName].includes(trimmed)) return; // Prevent duplicates

        setSaving(true);
        try {
            const updatedConfig = {
                ...appConfig,
                [listName]: [...appConfig[listName], trimmed]
            };
            await updateAppConfig(updatedConfig);
            setter(''); // Clear input
        } catch (error) {
            console.error("Error adding item:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveItem = async (listName, index) => {
        setSaving(true);
        try {
            const updatedList = [...appConfig[listName]];
            updatedList.splice(index, 1);

            const updatedConfig = {
                ...appConfig,
                [listName]: updatedList
            };
            await updateAppConfig(updatedConfig);
        } catch (error) {
            console.error("Error removing item:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleMoveItemUp = async (listName, index) => {
        if (index === 0) return;
        setSaving(true);
        try {
            const updatedList = [...appConfig[listName]];
            // Swap elements
            [updatedList[index - 1], updatedList[index]] = [updatedList[index], updatedList[index - 1]];

            const updatedConfig = {
                ...appConfig,
                [listName]: updatedList
            };
            await updateAppConfig(updatedConfig);
        } catch (error) {
            console.error("Error moving item:", error);
        } finally {
            setSaving(false);
        }
    };

    const sharedSectionProps = {
        appConfig, saving, handleAddItem, handleRemoveItem, handleMoveItemUp
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8 border-b border-slate-200 pb-6">
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Configuración</h1>
                    <p className="text-slate-500 mt-2 font-medium">Personaliza las opciones y catálogos de tu aplicación.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ConfigSection
                        {...sharedSectionProps}
                        title="Monedas"
                        icon="payments"
                        listName="currencies"
                        inputValue={newCurrency}
                        setInputValue={setNewCurrency}
                        placeholder="Ej. GBP"
                    />
                    <ConfigSection
                        {...sharedSectionProps}
                        title="Tarjetas y Cuentas"
                        icon="credit_card"
                        listName="accounts"
                        inputValue={newAccount}
                        setInputValue={setNewAccount}
                        placeholder="Ej. Santander Débito"
                    />
                    <ConfigSection
                        {...sharedSectionProps}
                        title="Categorías"
                        icon="category"
                        listName="categories"
                        inputValue={newCategory}
                        setInputValue={setNewCategory}
                        placeholder="Ej. Viajes"
                    />
                </div>
            </div>
        </div>
    );
}
