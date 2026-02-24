import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';

// Helper component for rendering list sections (Currencies, Accounts)
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

// Specialized component for Categories with nesting
const CategoryConfigSection = ({ appConfig, saving, updateAppConfig }) => {
    const [newCategory, setNewCategory] = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});
    const [newSubcategories, setNewSubcategories] = useState({}); // Map of catIndex -> inputValue

    // Safely access categories, defaulting to empty array if undefined
    // And ensure we handle the case where migration hasn't run yet (strings vs objects)
    // Although FinanceContext migration should handle it, we want to be safe.
    const categories = Array.isArray(appConfig.categories) ? appConfig.categories : [];

    // Helper to get category name safely
    const getCatName = (cat) => typeof cat === 'string' ? cat : cat.name;
    const getSubcats = (cat) => typeof cat === 'string' ? [] : (cat.subcategories || []);

    const toggleExpand = (index) => {
        setExpandedCategories(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return;
        const trimmed = newCategory.trim();

        // Prevent duplicates
        if (categories.some(c => getCatName(c) === trimmed)) return;

        const updatedCategories = [
            ...categories,
            { name: trimmed, subcategories: [] }
        ];

        await updateAppConfig({ ...appConfig, categories: updatedCategories });
        setNewCategory('');
    };

    const handleDeleteCategory = async (index) => {
        if (!window.confirm("¿Eliminar categoría y todas sus subcategorías?")) return;
        const updatedCategories = [...categories];
        updatedCategories.splice(index, 1);
        await updateAppConfig({ ...appConfig, categories: updatedCategories });
    };

    const handleMoveCategoryUp = async (index) => {
        if (index === 0) return;
        const updatedCategories = [...categories];
        [updatedCategories[index - 1], updatedCategories[index]] = [updatedCategories[index], updatedCategories[index - 1]];
        await updateAppConfig({ ...appConfig, categories: updatedCategories });
    };

    const handleAddSubcategory = async (catIndex) => {
        const val = newSubcategories[catIndex];
        if (!val || !val.trim()) return;
        const trimmed = val.trim();

        const updatedCategories = [...categories];
        // Ensure we are working with an object structure even if it was a string
        let category = updatedCategories[catIndex];
        if (typeof category === 'string') {
            category = { name: category, subcategories: [] };
        } else {
            category = { ...category };
        }

        const currentSubs = category.subcategories || [];
        if (currentSubs.includes(trimmed)) return;

        category.subcategories = [...currentSubs, trimmed];
        updatedCategories[catIndex] = category;

        await updateAppConfig({ ...appConfig, categories: updatedCategories });
        setNewSubcategories(prev => ({ ...prev, [catIndex]: '' }));
    };

    const handleDeleteSubcategory = async (catIndex, subIndex) => {
        const updatedCategories = [...categories];
        let category = { ...updatedCategories[catIndex] };
        // Safety check if it was string, but deleting subcat implies it was already object or we can't be here
        if (typeof category === 'string') return;

        const updatedSubs = [...category.subcategories];
        updatedSubs.splice(subIndex, 1);
        category.subcategories = updatedSubs;
        updatedCategories[catIndex] = category;

        await updateAppConfig({ ...appConfig, categories: updatedCategories });
    };

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-soft border border-white p-6 relative overflow-hidden group">
            {/* Subtle Gradient background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 group-hover:bg-primary/10 transition-colors"></div>

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">category</span>
                        Categorías
                    </h3>
                </div>
            </div>

            {/* Main Input Row */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    placeholder="Nueva Categoría..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    disabled={saving}
                />
                <button
                    onClick={handleAddCategory}
                    disabled={saving || !newCategory.trim()}
                    className="w-10 h-10 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center shrink-0"
                >
                    <span className="material-symbols-outlined text-lg">add</span>
                </button>
            </div>

            {/* List */}
            <div className="space-y-2">
                {categories.length > 0 ? (
                    categories.map((cat, idx) => {
                        const name = getCatName(cat);
                        const subcats = getSubcats(cat);
                        const isExpanded = expandedCategories[idx];

                        return (
                            <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden transition-all">
                                {/* Header Row */}
                                <div className="flex items-center justify-between p-3 hover:bg-slate-100 transition-colors">
                                    <div
                                        className="flex items-center gap-2 flex-1 cursor-pointer"
                                        onClick={() => toggleExpand(idx)}
                                    >
                                        <button className={`w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                                        </button>
                                        <span className="text-sm font-bold text-slate-700">{name}</span>
                                        <span className="text-[10px] text-slate-400 font-medium bg-slate-200/50 px-2 py-0.5 rounded-md">
                                            {subcats.length} sub
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                        {idx > 0 && (
                                            <button
                                                onClick={() => handleMoveCategoryUp(idx)}
                                                disabled={saving}
                                                className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                                                title="Mover arriba"
                                            >
                                                <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteCategory(idx)}
                                            disabled={saving}
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors"
                                            title="Eliminar"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Subcategories Area */}
                                {isExpanded && (
                                    <div className="bg-slate-100/50 p-3 border-t border-slate-100 pl-10">
                                        {/* Add Subcategory Input */}
                                        <div className="flex gap-2 mb-3">
                                            <input
                                                type="text"
                                                placeholder={`Subcategoría de ${name}...`}
                                                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs font-medium"
                                                value={newSubcategories[idx] || ''}
                                                onChange={(e) => setNewSubcategories(prev => ({ ...prev, [idx]: e.target.value }))}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(idx)}
                                                disabled={saving}
                                            />
                                            <button
                                                onClick={() => handleAddSubcategory(idx)}
                                                disabled={saving || !(newSubcategories[idx] || '').trim()}
                                                className="w-8 h-8 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-300 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-sm">add</span>
                                            </button>
                                        </div>

                                        {/* Subcategories List */}
                                        <div className="space-y-1">
                                            {subcats.length > 0 ? (
                                                subcats.map((sub, sIdx) => (
                                                    <div key={sIdx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/50 group/sub">
                                                        <span className="text-xs font-bold text-slate-600">{sub}</span>
                                                        <button
                                                            onClick={() => handleDeleteSubcategory(idx, sIdx)}
                                                            className="w-6 h-6 rounded hover:bg-red-50 text-red-400 flex items-center justify-center opacity-0 group-hover/sub:opacity-100 transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-[10px] text-slate-400 italic">No hay subcategorías.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4">Sin elementos.</p>
                )}
            </div>
        </div>
    );
};

export default function Settings() {
    const { appConfig, updateAppConfig } = useFinance();
    const [saving, setSaving] = useState(false);

    // Local state for inputs
    const [newCurrency, setNewCurrency] = useState('');
    const [newAccount, setNewAccount] = useState('');

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

                    {/* New Specialized Category Section */}
                    <CategoryConfigSection
                        appConfig={appConfig}
                        saving={saving}
                        updateAppConfig={updateAppConfig}
                    />
                </div>
            </div>
        </div>
    );
}
