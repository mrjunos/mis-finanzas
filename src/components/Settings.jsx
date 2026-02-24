import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';

// Helper component for rendering list sections (Currencies, Accounts)
const ConfigSection = ({
    title, icon, listName, inputValue, setInputValue, placeholder,
    appConfig, saving, handleAddItem, handleRemoveItem, handleMoveItemUp, handleEditItem
}) => {
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState('');

    const startEdit = (index, value) => {
        setEditingIndex(index);
        setEditValue(value);
    };

    const submitEdit = async (index) => {
        if (!editValue.trim() || editValue === appConfig[listName][index]) {
            setEditingIndex(null);
            return;
        }
        await handleEditItem(listName, index, editValue);
        setEditingIndex(null);
    };

    return (
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
                            {editingIndex === idx ? (
                                <div className="flex items-center gap-2 flex-1 mr-2">
                                    <input
                                        type="text"
                                        className="flex-1 px-3 py-1 bg-white border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold text-slate-700"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && submitEdit(idx)}
                                        autoFocus
                                        disabled={saving}
                                    />
                                    <button
                                        onClick={() => submitEdit(idx)}
                                        disabled={saving || !editValue.trim()}
                                        className="w-8 h-8 rounded-lg hover:bg-green-50 text-green-600 flex items-center justify-center transition-colors disabled:opacity-50"
                                        title="Guardar"
                                    >
                                        <span className="material-symbols-outlined text-sm">check</span>
                                    </button>
                                    <button
                                        onClick={() => setEditingIndex(null)}
                                        disabled={saving}
                                        className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                                        title="Cancelar"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="text-sm font-bold text-slate-700">
                                        {item} {idx === 0 && listName === 'currencies' && <span className="ml-2 text-[10px] bg-primary/20 text-primary-dark px-2 py-0.5 rounded-md uppercase">Principal</span>}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-50 group-hover/item:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(idx, item)}
                                            disabled={saving}
                                            className="w-8 h-8 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
                                            title="Editar"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                        </button>
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
                                            disabled={saving}
                                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors disabled:opacity-50"
                                            title="Eliminar"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4">Sin elementos.</p>
                )}
            </div>
        </div>
    );
};

// Specialized component for Categories with nesting
const CategoryConfigSection = ({ appConfig, saving, updateAppConfig }) => {
    const [newCategory, setNewCategory] = useState('');
    const [expandedCategories, setExpandedCategories] = useState({});
    const [newSubcategories, setNewSubcategories] = useState({}); // Map of catIndex -> inputValue

    // New attributes state for adding
    const [newCategoryIcon, setNewCategoryIcon] = useState('category');
    const [newCategoryType, setNewCategoryType] = useState('debit');
    const [newCategoryContext, setNewCategoryContext] = useState('personal');

    // Editing State
    const [editingCatIndex, setEditingCatIndex] = useState(null);
    const [editCatForm, setEditCatForm] = useState({
        name: '',
        icon: 'category',
        type: 'debit',
        context: 'personal'
    });

    // Subcategory Editing State
    const [editingSub, setEditingSub] = useState(null); // { catIndex: number, subIndex: number } | null
    const [editSubValue, setEditSubValue] = useState('');

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
            {
                name: trimmed,
                subcategories: [],
                icon: newCategoryIcon,
                type: newCategoryType,
                context: newCategoryContext
            }
        ];

        await updateAppConfig({ ...appConfig, categories: updatedCategories });
        setNewCategory('');
        setNewCategoryIcon('category');
    };

    const startEditCategory = (index, cat) => {
        setEditingCatIndex(index);
        setEditCatForm({
            name: getCatName(cat),
            icon: cat.icon || 'category',
            type: cat.type || 'debit',
            context: cat.context || 'personal'
        });
    };

    const submitEditCategory = async (index) => {
        const trimmed = editCatForm.name.trim();
        if (!trimmed) {
            setEditingCatIndex(null);
            return;
        }

        // Check for duplicates (ignoring if we're just changing case or not modifying)
        const isDuplicate = categories.some((c, i) => i !== index && getCatName(c).toLowerCase() === trimmed.toLowerCase());
        if (isDuplicate) {
            alert("Ya existe una categoría con este nombre.");
            return;
        }

        const updatedCategories = [...categories];
        let category = updatedCategories[index];
        if (typeof category === 'string') {
            category = { name: trimmed, subcategories: [] };
        } else {
            category = { ...category };
            category.name = trimmed;
        }

        category.icon = editCatForm.icon;
        category.type = editCatForm.type;
        category.context = editCatForm.context;

        updatedCategories[index] = category;

        await updateAppConfig({ ...appConfig, categories: updatedCategories });
        setEditingCatIndex(null);
    };

    const handleDeleteCategory = async (index) => {
        if (categories.length === 1) {
            alert("No puedes eliminar la última categoría. Debes tener al menos una.");
            return;
        }
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

    const startEditSubcategory = (catIndex, subIndex, currentValue) => {
        setEditingSub({ catIndex, subIndex });
        setEditSubValue(currentValue);
    };

    const submitEditSubcategory = async (catIndex, subIndex) => {
        const trimmed = editSubValue.trim();
        if (!trimmed) {
            setEditingSub(null);
            return;
        }

        const category = categories[catIndex];
        const subcats = getSubcats(category);

        // Check for duplicates within this category
        const isDuplicate = subcats.some((s, i) => i !== subIndex && s.toLowerCase() === trimmed.toLowerCase());
        if (isDuplicate) {
            alert("Ya existe una subcategoría con este nombre.");
            return;
        }

        const updatedCategories = [...categories];
        const updatedSubcats = [...subcats];
        updatedSubcats[subIndex] = trimmed;

        let updatedCategory = category;
        if (typeof updatedCategory === 'string') {
            updatedCategory = { name: updatedCategory, subcategories: updatedSubcats };
        } else {
            updatedCategory = { ...updatedCategory };
            updatedCategory.subcategories = updatedSubcats;
        }

        updatedCategories[catIndex] = updatedCategory;
        await updateAppConfig({ ...appConfig, categories: updatedCategories });
        setEditingSub(null);
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
            <div className="flex flex-col gap-3 mb-6">
                <div className="flex gap-2">
                    <div className="relative h-[42px]">
                        <select
                            className="h-full w-[60px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-700 material-symbols-outlined cursor-pointer appearance-none text-center"
                            style={{ fontSize: '24px', textAlignLast: 'center' }}
                            value={newCategoryIcon}
                            onChange={(e) => setNewCategoryIcon(e.target.value)}
                            disabled={saving}
                        >
                            <option value="category">category</option>
                            <option value="restaurant">restaurant</option>
                            <option value="directions_car">directions_car</option>
                            <option value="shopping_bag">shopping_bag</option>
                            <option value="payments">payments</option>
                            <option value="home">home</option>
                            <option value="bolt">bolt</option>
                            <option value="local_gas_station">local_gas_station</option>
                            <option value="flight">flight</option>
                            <option value="pets">pets</option>
                            <option value="fitness_center">fitness_center</option>
                            <option value="school">school</option>
                            <option value="health_and_safety">health_and_safety</option>
                            <option value="redeem">redeem</option>
                            <option value="savings">savings</option>
                            <option value="credit_card">credit_card</option>
                            <option value="account_balance">account_balance</option>
                            <option value="work">work</option>
                            <option value="storefront">storefront</option>
                            <option value="movie">movie</option>
                        </select>
                    </div>

                    <input
                        type="text"
                        placeholder="Nueva Categoría..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                        disabled={saving}
                    />
                </div>

                <div className="flex gap-2">
                    <select
                        className="custom-select flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium text-slate-600"
                        value={newCategoryType}
                        onChange={(e) => setNewCategoryType(e.target.value)}
                        disabled={saving}
                    >
                        <option value="debit">Egreso</option>
                        <option value="credit">Ingreso</option>
                    </select>

                    <select
                        className="custom-select flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-medium text-slate-600"
                        value={newCategoryContext}
                        onChange={(e) => setNewCategoryContext(e.target.value)}
                        disabled={saving}
                    >
                        <option value="personal">Personal</option>
                        <option value="business">Negocio</option>
                        <option value="both">Ambos</option>
                    </select>

                    <button
                        onClick={handleAddCategory}
                        disabled={saving || !newCategory.trim()}
                        className="w-10 h-10 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center shrink-0"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                    </button>
                </div>
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
                                {editingCatIndex === idx ? (
                                    <div className="p-3 bg-white border-b border-primary/20 flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <div className="relative h-[34px]">
                                                <select
                                                    className="h-full w-[60px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-700 material-symbols-outlined cursor-pointer appearance-none text-center"
                                                    style={{ fontSize: '20px', textAlignLast: 'center' }}
                                                    value={editCatForm.icon}
                                                    onChange={(e) => setEditCatForm({ ...editCatForm, icon: e.target.value })}
                                                    disabled={saving}
                                                >
                                                    <option value="category">category</option>
                                                    <option value="restaurant">restaurant</option>
                                                    <option value="directions_car">directions_car</option>
                                                    <option value="shopping_bag">shopping_bag</option>
                                                    <option value="payments">payments</option>
                                                    <option value="home">home</option>
                                                    <option value="bolt">bolt</option>
                                                    <option value="local_gas_station">local_gas_station</option>
                                                    <option value="flight">flight</option>
                                                    <option value="pets">pets</option>
                                                    <option value="fitness_center">fitness_center</option>
                                                    <option value="school">school</option>
                                                    <option value="health_and_safety">health_and_safety</option>
                                                    <option value="redeem">redeem</option>
                                                    <option value="savings">savings</option>
                                                    <option value="credit_card">credit_card</option>
                                                    <option value="account_balance">account_balance</option>
                                                    <option value="work">work</option>
                                                    <option value="storefront">storefront</option>
                                                    <option value="movie">movie</option>
                                                </select>
                                            </div>

                                            <input
                                                type="text"
                                                className="flex-1 px-3 py-1 bg-white border border-primary/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold text-slate-700"
                                                value={editCatForm.name}
                                                onChange={(e) => setEditCatForm({ ...editCatForm, name: e.target.value })}
                                                onKeyDown={(e) => e.key === 'Enter' && submitEditCategory(idx)}
                                                autoFocus
                                                disabled={saving}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <select
                                                className="custom-select flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs font-medium text-slate-600"
                                                value={editCatForm.type}
                                                onChange={(e) => setEditCatForm({ ...editCatForm, type: e.target.value })}
                                                disabled={saving}
                                            >
                                                <option value="debit">Egreso</option>
                                                <option value="credit">Ingreso</option>
                                            </select>

                                            <select
                                                className="custom-select flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-xs font-medium text-slate-600"
                                                value={editCatForm.context}
                                                onChange={(e) => setEditCatForm({ ...editCatForm, context: e.target.value })}
                                                disabled={saving}
                                            >
                                                <option value="personal">Personal</option>
                                                <option value="business">Negocio</option>
                                                <option value="both">Ambos</option>
                                            </select>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => submitEditCategory(idx)}
                                                    disabled={saving || !editCatForm.name.trim()}
                                                    className="w-8 h-8 rounded-lg hover:bg-green-50 text-green-600 flex items-center justify-center transition-colors disabled:opacity-50"
                                                    title="Guardar"
                                                >
                                                    <span className="material-symbols-outlined text-sm">check</span>
                                                </button>
                                                <button
                                                    onClick={() => setEditingCatIndex(null)}
                                                    disabled={saving}
                                                    className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                                                    title="Cancelar"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Header Row */}
                                        <div className="flex items-center justify-between p-3 hover:bg-slate-100 transition-colors">
                                            <div
                                                className="flex items-center gap-2 flex-1 cursor-pointer"
                                                onClick={() => toggleExpand(idx)}
                                            >
                                                <div className="flex items-center">
                                                    <button className={`w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-200 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                                        <span className="material-symbols-outlined text-lg">chevron_right</span>
                                                    </button>
                                                    <span className="text-xs font-bold text-slate-400 ml-0.5">{subcats.length}</span>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white shrink-0 shadow-sm border border-slate-600">
                                                    <span className="material-symbols-outlined text-sm">{cat.icon || 'category'}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-700">{name}</span>
                                                    </div>
                                                    <div className="flex gap-1 mt-0.5">
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${cat.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {cat.type === 'credit' ? 'Ingreso' : 'Egreso'}
                                                        </span>
                                                        {cat.context === 'both' ? (
                                                            <>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase bg-blue-100 text-blue-700">Personal</span>
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase bg-purple-100 text-purple-700">Negocio</span>
                                                            </>
                                                        ) : (
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${cat.context === 'business' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {cat.context === 'business' ? 'Negocio' : 'Personal'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startEditCategory(idx, cat)}
                                                    disabled={saving}
                                                    className="w-8 h-8 rounded-lg hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors disabled:opacity-50"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-sm">edit</span>
                                                </button>
                                                {idx > 0 && (
                                                    <button
                                                        onClick={() => handleMoveCategoryUp(idx)}
                                                        disabled={saving}
                                                        className="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors disabled:opacity-50"
                                                        title="Mover arriba"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteCategory(idx)}
                                                    disabled={saving}
                                                    className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 flex items-center justify-center transition-colors disabled:opacity-50"
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
                                                        subcats.map((sub, sIdx) => {
                                                            const isEditingThisSub = editingSub?.catIndex === idx && editingSub?.subIndex === sIdx;
                                                            return isEditingThisSub ? (
                                                                <div key={sIdx} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-primary/30">
                                                                    <input
                                                                        type="text"
                                                                        className="flex-1 px-2 py-1 bg-slate-50 border border-transparent rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 text-xs font-bold text-slate-700"
                                                                        value={editSubValue}
                                                                        onChange={(e) => setEditSubValue(e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && submitEditSubcategory(idx, sIdx)}
                                                                        autoFocus
                                                                        disabled={saving}
                                                                    />
                                                                    <button
                                                                        onClick={() => submitEditSubcategory(idx, sIdx)}
                                                                        disabled={saving || !editSubValue.trim()}
                                                                        className="w-6 h-6 rounded hover:bg-green-50 text-green-600 flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                                                                        title="Guardar"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">check</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setEditingSub(null)}
                                                                        disabled={saving}
                                                                        className="w-6 h-6 rounded hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                                                                        title="Cancelar"
                                                                    >
                                                                        <span className="material-symbols-outlined text-sm">close</span>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div key={sIdx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200/50 group/sub">
                                                                    <span className="text-xs font-bold text-slate-600">{sub}</span>
                                                                    <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => startEditSubcategory(idx, sIdx, sub)}
                                                                            disabled={saving}
                                                                            className="w-6 h-6 rounded hover:bg-blue-50 text-blue-500 flex items-center justify-center transition-colors"
                                                                            title="Editar subcategoría"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[14px]">edit</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteSubcategory(idx, sIdx)}
                                                                            disabled={saving}
                                                                            className="w-6 h-6 rounded hover:bg-red-50 text-red-400 flex items-center justify-center transition-colors"
                                                                            title="Eliminar subcategoría"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <p className="text-[10px] text-slate-400 italic">No hay subcategorías.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
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
        if (appConfig[listName].length === 1) {
            alert("No puedes eliminar el último elemento de esta lista. Debes tener al menos uno.");
            return;
        }

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

    const handleEditItem = async (listName, index, newValue) => {
        const trimmed = newValue.trim();
        if (!trimmed) return;

        // Check for duplicates (ignoring if we're just changing case or not modifying)
        const isDuplicate = appConfig[listName].some((item, i) => i !== index && item.toLowerCase() === trimmed.toLowerCase());
        if (isDuplicate) {
            alert("Ya existe un elemento con este nombre.");
            return;
        }

        setSaving(true);
        try {
            const updatedList = [...appConfig[listName]];
            updatedList[index] = trimmed;

            const updatedConfig = {
                ...appConfig,
                [listName]: updatedList
            };
            await updateAppConfig(updatedConfig);
        } catch (error) {
            console.error("Error editing item:", error);
        } finally {
            setSaving(false);
        }
    };

    const sharedSectionProps = {
        appConfig, saving, handleAddItem, handleRemoveItem, handleMoveItemUp, handleEditItem
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-[1600px] mx-auto w-full">
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
