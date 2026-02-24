import React, { useState, useEffect, useMemo } from 'react';
import Widget from './Widget';
import PresupuestoModal from './PresupuestoModal';
import MetaModal from './MetaModal';
import { useFinance } from '../context/FinanceContext';
import { format, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Presupuestos({ currentContext }) {
    const { budgets, fetchBudgetConfig, saveBudgetConfig, goals, appConfig, transactions } = useFinance();
    const [currentDate, setCurrentDate] = useState(new Date());

    const [isPresupuestoModalOpen, setIsPresupuestoModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

    const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
    const [editingMeta, setEditingMeta] = useState(null);

    const monthStr = format(currentDate, 'yyyy-MM');
    const monthDisplay = format(currentDate, 'MMMM yyyy', { locale: es });

    // Use the safe context
    const contextoKey = currentContext === 'business' ? 'business' : 'personal';
    const budgetId = `${monthStr}_${contextoKey}`;

    // Fetch or clone config when the month or context changes
    useEffect(() => {
        fetchBudgetConfig(monthStr, contextoKey);
    }, [monthStr, contextoKey]);

    const [localCategories, setLocalCategories] = useState([]);

    // Filter transactions for the current month and context
    const monthTransactions = useMemo(() => {
        const [year, month] = monthStr.split('-').map(Number);
        return transactions.filter(t => {
            const d = t.date instanceof Date ? t.date : new Date(t.date);
            return d.getFullYear() === year && (d.getMonth() + 1) === month;
        });
    }, [transactions, monthStr]);

    // Compute per-category spending from real transactions (only debits)
    const categorySpending = useMemo(() => {
        const contextFiltered = monthTransactions.filter(t => {
            if (contextoKey === 'personal') return t.context === 'personal';
            if (contextoKey === 'business') return t.context === 'business';
            return true;
        });
        const spending = {};
        contextFiltered.forEach(t => {
            if (t.type === 'debit' && t.category) {
                const catName = t.category;
                spending[catName] = (spending[catName] || 0) + Number(t.amount);
            }
        });
        return spending;
    }, [monthTransactions, contextoKey]);

    // Enrich localCategories with real spending
    const enrichedCategories = useMemo(() => {
        return localCategories.map(cat => ({
            ...cat,
            gastado: categorySpending[cat.nombre] || 0,
        }));
    }, [localCategories, categorySpending]);

    const gastadoReal = useMemo(() => {
        return enrichedCategories.reduce((acc, cat) => acc + cat.gastado, 0);
    }, [enrichedCategories]);

    useEffect(() => {
        if (budgets[budgetId] && budgets[budgetId].categories) {
            setLocalCategories(budgets[budgetId].categories);
        } else {
            setLocalCategories([]);
        }
    }, [budgets, budgetId]);

    const presupuestadoTotal = useMemo(() => {
        return enrichedCategories.reduce((acc, cat) => acc + Number(cat.limite), 0);
    }, [enrichedCategories]);

    // Compute goal progress from account credits (all-time)
    const goalSavings = useMemo(() => {
        const savings = {};
        goals.forEach(goal => {
            if (goal.cuenta) {
                const total = transactions
                    .filter(t => t.type === 'credit' && t.account === goal.cuenta)
                    .reduce((acc, t) => acc + Number(t.amount), 0);
                savings[goal.id] = total;
            }
        });
        return savings;
    }, [transactions, goals]);

    // Derived Goals Filtering with computed savings
    const localGoals = useMemo(() => {
        const filtered = goals.filter(g => currentContext === 'unified' ? true : g.contexto === currentContext);
        return filtered.map(g => ({
            ...g,
            ahorrado: goalSavings[g.id] || 0,
        }));
    }, [goals, currentContext, goalSavings]);

    const handleSaveBudgetConfig = async (categoryData, isEditing) => {
        let updatedCategories = [...localCategories];

        if (isEditing) {
            updatedCategories = updatedCategories.map(cat => cat.nombre === categoryData.nombre ? categoryData : cat);
        } else {
            // Prevent duplicate append
            const exists = updatedCategories.find(cat => cat.nombre === categoryData.nombre);
            if (exists) {
                alert("Esta categoría ya tiene un presupuesto para este mes.");
                return;
            }
            updatedCategories.push(categoryData);
        }

        await saveBudgetConfig(monthStr, contextoKey, updatedCategories);
    };

    const formatearDinero = (monto) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
        }).format(monto);
    };

    const calcularPorcentaje = (gastado, limite) => {
        const porcentaje = (gastado / limite) * 100;
        return porcentaje > 100 ? 100 : porcentaje;
    };

    const renderResumenGeneral = () => {
        const personalBudget = budgets[`${monthStr}_personal`]?.categories || [];
        const businessBudget = budgets[`${monthStr}_business`]?.categories || [];

        // Compute real spending for personal context
        const pSpending = monthTransactions.filter(t => t.context === 'personal' && t.type === 'debit');
        const pGastado = pSpending.reduce((a, t) => a + Number(t.amount), 0);
        const pTotal = personalBudget.reduce((a, c) => a + c.limite, 0);
        const saludPersonal = pTotal > 0 ? (pGastado / pTotal) * 100 : 0;

        // Compute real spending for business context
        const bSpending = monthTransactions.filter(t => t.context === 'business' && t.type === 'debit');
        const bGastado = bSpending.reduce((a, t) => a + Number(t.amount), 0);
        const bTotal = businessBudget.reduce((a, c) => a + c.limite, 0);
        const saludNegocio = bTotal > 0 ? (bGastado / bTotal) * 100 : 0;

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                {/* Tarjeta de Salud Personal */}
                <Widget className="relative overflow-hidden p-6 border-l-4 border-l-primary hover:shadow-soft transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Salud Presupuesto Personal</p>
                            <h2 className="text-3xl font-extrabold text-slate-800">{saludPersonal.toFixed(1)}%</h2>
                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Consumido este mes</p>
                        </div>
                        <div className="w-10 h-10 bg-primary/10 rounded-xl text-primary-dark flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${saludPersonal > 90 ? 'bg-red-400' : 'bg-primary'}`}
                            style={{ width: `${saludPersonal}%` }}
                        ></div>
                    </div>
                </Widget>

                {/* Tarjeta de Salud Negocio */}
                <Widget className="relative overflow-hidden p-6 border-l-4 border-l-secondary hover:shadow-soft transition-all">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Salud Presupuesto Negocio</p>
                            <h2 className="text-3xl font-extrabold text-slate-800">{saludNegocio.toFixed(1)}%</h2>
                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">Consumido este mes</p>
                        </div>
                        <div className="w-10 h-10 bg-secondary/10 rounded-xl text-secondary flex items-center justify-center">
                            <span className="material-symbols-outlined text-xl">business_center</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-4 overflow-hidden">
                        <div
                            className={`h-full rounded-full ${saludNegocio > 90 ? 'bg-red-400' : 'bg-secondary'}`}
                            style={{ width: `${saludNegocio}%` }}
                        ></div>
                    </div>
                </Widget>

                <Widget className="col-span-1 md:col-span-2 text-center p-8 bg-slate-50/50 flex flex-col items-center justify-center border border-dashed border-slate-200">
                    <span className="material-symbols-outlined text-slate-300 text-4xl mb-3">warning</span>
                    <p className="text-slate-600 font-bold text-sm">El contexto General no mezcla presupuestos detallados.</p>
                    <p className="text-slate-400 text-xs mt-1 font-medium max-w-md">Selecciona 'Personal' o 'Negocio' en el menú superior para gestionar las categorías individuales y límites de cada uno.</p>
                </Widget>
            </div>
        );
    };

    const renderContextoEspecifico = () => {
        const disponible = presupuestadoTotal - gastadoReal;
        const porcentajeGlobal = presupuestadoTotal > 0 ? (gastadoReal / presupuestadoTotal) * 100 : 0;

        // Vars for color depending on context
        const brandColor = currentContext === 'business' ? 'secondary' : 'primary';
        const brandColorHex = currentContext === 'business' ? '#818cf8' : '#13ecda';
        const bgBrand = currentContext === 'business' ? 'bg-secondary' : 'bg-primary';

        return (
            <div className="mt-2 space-y-6">
                {/* Métricas Top */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Widget className="p-6 hover:shadow-soft transition-all">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Presupuestado</p>
                        <h2 className="text-2xl font-extrabold text-slate-800">{formatearDinero(presupuestadoTotal)}</h2>
                    </Widget>
                    <Widget className="p-6 hover:shadow-soft transition-all">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gastado</p>
                        <h2 className="text-2xl font-extrabold text-slate-800">{formatearDinero(gastadoReal)}</h2>
                        <div className="w-full bg-slate-100 rounded-full h-1 mt-3 overflow-hidden">
                            <div className={`${bgBrand} h-full rounded-full`} style={{ width: `${porcentajeGlobal}%` }}></div>
                        </div>
                    </Widget>
                    <Widget className="p-6 hover:shadow-soft transition-all">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Disponible</p>
                        <h2 className={`text-2xl font-extrabold ${disponible < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                            {formatearDinero(disponible)}
                        </h2>
                    </Widget>
                </div>

                {/* Lista de Categorías */}
                <Widget className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <span className={`material-symbols-outlined text-${brandColor}`}>pie_chart</span>
                            Categorías
                        </h3>
                        <button
                            onClick={() => {
                                setEditingCategory(null);
                                setIsPresupuestoModalOpen(true);
                            }}
                            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-${currentContext === 'business' ? 'secondary' : 'primary-dark'} hover:bg-${brandColor}/10 px-3 py-1.5 rounded-lg transition-colors`}
                        >
                            <span className="material-symbols-outlined text-[14px]">add</span> Agregar
                        </button>
                    </div>

                    <div className="space-y-5">
                        {localCategories.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">No hay presupuesto configurado para este mes aún.</p>
                        ) : (
                            localCategories.map((cat, index) => {
                                const enrichedCat = enrichedCategories[index] || cat;
                                const porcentaje = calcularPorcentaje(enrichedCat.gastado || 0, enrichedCat.limite);
                                const excedido = (enrichedCat.gastado || 0) > enrichedCat.limite;

                                return (
                                    <div
                                        key={index}
                                        className="group cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-xl transition-colors"
                                        onClick={() => {
                                            setEditingCategory(cat);
                                            setIsPresupuestoModalOpen(true);
                                        }}
                                    >
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-700 text-sm">{enrichedCat.nombre}</h4>
                                                <p className="text-[10px] font-medium uppercase text-slate-400 mt-0.5 tracking-wide">{formatearDinero(enrichedCat.gastado || 0)} de {formatearDinero(enrichedCat.limite)}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${excedido ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                                                    {porcentaje.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${excedido ? 'bg-red-400' : bgBrand}`}
                                                style={{ width: `${porcentaje}%` }}
                                            ></div>
                                        </div>
                                        {excedido && (
                                            <p className="text-[10px] font-bold text-red-500 mt-1.5 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">error</span> Te pasaste por {formatearDinero((enrichedCat.gastado || 0) - enrichedCat.limite)}
                                            </p>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Widget>

                {/* Lista de Metas de Ahorro */}
                <Widget className="p-6 mt-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-500">track_changes</span>
                            Metas de Ahorro
                        </h3>
                        <button
                            onClick={() => {
                                setEditingMeta(null);
                                setIsMetaModalOpen(true);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-600 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">add</span> Nueva Meta
                        </button>
                    </div>

                    <div className="space-y-5">
                        {localGoals.length === 0 ? (
                            <p className="text-xs text-slate-500 py-4 text-center">No hay metas configuradas.</p>
                        ) : (
                            localGoals.map((meta) => {
                                const progreso = calcularPorcentaje(meta.ahorrado, meta.objetivo);

                                return (
                                    <div
                                        key={meta.id}
                                        className="group cursor-pointer hover:bg-slate-50 p-2 -mx-2 rounded-xl transition-colors"
                                        onClick={() => {
                                            setEditingMeta(meta);
                                            setIsMetaModalOpen(true);
                                        }}
                                    >
                                        <div className="flex justify-between items-end mb-2">
                                            <div>
                                                <h4 className="font-bold text-slate-700 text-sm">{meta.nombre}</h4>
                                                <p className="text-[10px] font-medium uppercase text-slate-400 mt-0.5 tracking-wide">{formatearDinero(meta.ahorrado)} de {formatearDinero(meta.objetivo)}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600">
                                                    {progreso.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-500 bg-purple-400"
                                                style={{ width: `${progreso}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </Widget>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-[1000px] mx-auto">

                {/* Encabezado del Mes */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400 text-xl">calendar_month</span>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Presupuesto Mensual</h2>
                    </div>
                    <div className="flex items-center gap-3 bg-white/60 px-3 py-1.5 rounded-xl shadow-sm border border-white">
                        <button
                            className="text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center w-6 h-6 rounded-md hover:bg-white"
                            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                        >
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                        </button>
                        <span className="text-[11px] font-extrabold text-slate-700 w-24 text-center uppercase tracking-widest">{monthDisplay}</span>
                        <button
                            className="text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center w-6 h-6 rounded-md hover:bg-white"
                            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                        >
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* Contenido Dinámico */}
                {currentContext === 'unified' ? renderResumenGeneral() : renderContextoEspecifico()}

            </div>

            <PresupuestoModal
                isOpen={isPresupuestoModalOpen}
                onClose={() => { setIsPresupuestoModalOpen(false); setEditingCategory(null); }}
                currentContext={contextoKey}
                currentMonthStr={monthDisplay}
                editingCategory={editingCategory}
                onSaveConfig={handleSaveBudgetConfig}
            />

            <MetaModal
                isOpen={isMetaModalOpen}
                onClose={() => { setIsMetaModalOpen(false); setEditingMeta(null); }}
                currentContext={currentContext}
                editingMeta={editingMeta}
            />
        </div>
    );
}
