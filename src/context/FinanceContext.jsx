import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, getDoc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { normalizeCategory, parseTransactionDate, calculateBalances } from '../utils/financeHelpers';

const FinanceContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useFinance = () => useContext(FinanceContext);

const DEFAULT_CONFIG = {
    currencies: ['COP', 'USD', 'EUR'],
    accounts: ['Efectivo', 'Tarjeta de Crédito Principal', 'Cuenta Bancaria'],
    categories: [
        { name: 'Comida', subcategories: [], icon: 'restaurant', type: 'debit', context: 'personal' },
        { name: 'Transporte', subcategories: [], icon: 'directions_car', type: 'debit', context: 'personal' },
        { name: 'Servicios', subcategories: [], icon: 'bolt', type: 'debit', context: 'personal' },
        { name: 'Ingresos', subcategories: [], icon: 'payments', type: 'credit', context: 'personal' }
    ]
};

export const FinanceProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
    const [budgets, setBudgets] = useState({});
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);

    // Global Config State
    const [appConfig, setAppConfig] = useState(DEFAULT_CONFIG);

    useEffect(() => {
        // Fetch Settings Configuration
        const fetchConfig = async () => {
            try {
                const configRef = doc(db, 'finance_settings', 'default');
                const configSnap = await getDoc(configRef);

                if (configSnap.exists()) {
                    const data = configSnap.data();
                    let needsMigration = false;
                    let migratedCategories = data.categories || [];

                    // Migration: Check if categories need migration
                    if (migratedCategories.length > 0) {
                        migratedCategories = migratedCategories.map(cat => {
                            if (typeof cat === 'string') {
                                needsMigration = true;
                                const isIncome = cat.toLowerCase().includes('ingreso');
                                return {
                                    name: cat,
                                    subcategories: [],
                                    icon: 'category',
                                    type: isIncome ? 'credit' : 'debit',
                                    context: 'personal'
                                };
                            } else if (typeof cat === 'object') {
                                // Check if any fields are missing
                                let updatedCat = { ...cat };
                                if (!updatedCat.icon || !updatedCat.type || !updatedCat.context) {
                                    needsMigration = true;
                                    const isIncome = (updatedCat.name || '').toLowerCase().includes('ingreso');
                                    updatedCat.icon = updatedCat.icon || 'category';
                                    updatedCat.type = updatedCat.type || (isIncome ? 'credit' : 'debit');
                                    updatedCat.context = updatedCat.context || 'personal';
                                }
                                return updatedCat;
                            }
                            return cat;
                        });
                    }

                    if (needsMigration) {
                        const migratedConfig = { ...data, categories: migratedCategories };
                        setAppConfig(migratedConfig);
                        // Update Firestore immediately to migrate persistence
                        await updateDoc(configRef, { categories: migratedCategories });
                    } else {
                        setAppConfig(data);
                    }
                } else {
                    // Initialize default if it doesn't exist
                    await setDoc(configRef, DEFAULT_CONFIG);
                }
            } catch (error) {
                console.error("Error fetching config: ", error);
                // Do not set loading false here, wait for transactions
            }
        };

        fetchConfig();

        // Subscribe to transactions collection
        const unsubscribeTransactions = onSnapshot(collection(db, 'finance_transactions'), (snapshot) => {
            const txs = snapshot.docs.map(doc => {
                const data = doc.data();
                const date = parseTransactionDate(data.date);
                const category = normalizeCategory(data.category);

                return {
                    id: doc.id,
                    ...data,
                    category,
                    date,
                };
            });

            // Sort by date descending
            txs.sort((a, b) => b.date.getTime() - a.date.getTime());
            setTransactions(txs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching transactions:", error);
            setLoading(false); // Make sure it stops loading even on error
        });

        // Subscribe to goals collection
        const unsubscribeGoals = onSnapshot(collection(db, 'finance_goals'), (snapshot) => {
            const goalsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setGoals(goalsData);
        }, (error) => {
            console.error("Error fetching goals:", error);
        });

        // Cleanup subscriptions on unmount
        return () => {
            unsubscribeTransactions();
            unsubscribeGoals();
        }
    }, []);

    const updateAppConfig = async (newConfig) => {
        try {
            const configRef = doc(db, 'finance_settings', 'default');
            await setDoc(configRef, newConfig);
            setAppConfig(newConfig);
        } catch (error) {
            console.error("Error updating config: ", error);
            throw error;
        }
    };

    const addTransaction = async (data) => {
        try {
            // Default to today string if not provided
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const defaultDateStr = `${year}-${month}-${day}`;

            await addDoc(collection(db, 'finance_transactions'), {
                date: defaultDateStr,
                ...data,
            });
        } catch (error) {
            console.error("Error adding document: ", error);
            throw error;
        }
    };

    const addTransfer = async (transferData) => {
        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const defaultDateStr = `${year}-${month}-${day}`;

            await addDoc(collection(db, 'finance_transactions'), {
                title: transferData.title || 'Transferencia',
                amount: Number(transferData.amount),
                type: 'transfer',
                context: transferData.sourceContext,
                destinationContext: transferData.destinationContext,
                category: 'Financiero y Deudas',
                subcategory: '',
                currency: transferData.currency,
                card: transferData.sourceAccount,
                destinationCard: transferData.destinationAccount,
                comments: transferData.comments || '',
                date: transferData.date || defaultDateStr,
            });
        } catch (error) {
            console.error("Error adding transfer: ", error);
            throw error;
        }
    };

    const deleteTransaction = async (id) => {
        try {
            await deleteDoc(doc(db, 'finance_transactions', id));
        } catch (error) {
            console.error("Error deleting document: ", error);
            throw error;
        }
    };

    const updateTransaction = async (id, data) => {
        try {
            await updateDoc(doc(db, 'finance_transactions', id), {
                ...data,
                // Do not overwrite date if it's already a Timestamp, unless updating the date specifically.
                // Assuming data.date will be provided as a Timestamp if modified.
            });
        } catch (error) {
            console.error("Error updating document: ", error);
            throw error;
        }
    };

    // Memoize global balance calculations to avoid re-computing on every render/call
    const balances = useMemo(() => calculateBalances(transactions), [transactions]);

    // Calculate balances based on context and transaction type
    const getTotals = useCallback((contextFilter) => {
        // filter transactions based on context ('personal', 'business' or 'unified')
        const filtered = transactions.filter(t =>
            contextFilter === 'unified' ? true : t.context === contextFilter
        );

        return {
            ...balances,
            filteredTransactions: filtered
        };
    }, [transactions, balances]);

    // --- Metas / Goals Methods ---
    const addGoal = async (data) => {
        try {
            await addDoc(collection(db, 'finance_goals'), data);
        } catch (error) {
            console.error("Error adding goal: ", error);
            throw error;
        }
    };

    const updateGoal = async (id, data) => {
        try {
            await updateDoc(doc(db, 'finance_goals', id), data);
        } catch (error) {
            console.error("Error updating goal: ", error);
            throw error;
        }
    };

    const deleteGoal = async (id) => {
        try {
            await deleteDoc(doc(db, 'finance_goals', id));
        } catch (error) {
            console.error("Error deleting goal: ", error);
            throw error;
        }
    };

    // --- Presupuestos / Budgets Methods (Automatic Cloning) ---
    // Fetch budget for a specific month and context. If not found, attempts to clone the previous month.
    const fetchBudgetConfig = async (monthStr, context) => {
        try {
            const budgetId = `${monthStr}_${context}`;
            const budgetRef = doc(db, 'finance_budgets', budgetId);
            const budgetSnap = await getDoc(budgetRef);

            if (budgetSnap.exists()) {
                const data = budgetSnap.data();
                setBudgets(prev => ({ ...prev, [budgetId]: data }));
                return data;
            } else {
                // Not found. Attempt cloning.
                // Expected monthStr format: YYYY-MM
                const [year, month] = monthStr.split('-');
                let prevDate = new Date(year, parseInt(month) - 1 - 1, 1); // -1 for 0 index, -1 for previous month
                if (isNaN(prevDate)) return null;

                const prevYYYY = prevDate.getFullYear();
                const prevMM = String(prevDate.getMonth() + 1).padStart(2, '0');
                const prevMonthStr = `${prevYYYY}-${prevMM}`;
                const prevBudgetId = `${prevMonthStr}_${context}`;

                const prevBudgetRef = doc(db, 'finance_budgets', prevBudgetId);
                const prevBudgetSnap = await getDoc(prevBudgetRef);

                if (prevBudgetSnap.exists()) {
                    const clonedData = prevBudgetSnap.data();

                    // Save the cloned data directly as the new month's config
                    await setDoc(budgetRef, clonedData);
                    setBudgets(prev => ({ ...prev, [budgetId]: clonedData }));
                    return clonedData;
                }

                // If previous doesn't exist either, return empty setup
                return null;
            }
        } catch (error) {
            console.error("Error in fetchBudgetConfig: ", error);
            return null;
        }
    };

    const saveBudgetConfig = async (monthStr, context, newCategories) => {
        try {
            const budgetId = `${monthStr}_${context}`;
            const budgetRef = doc(db, 'finance_budgets', budgetId);
            const dataToSave = {
                month: monthStr,
                context: context,
                categories: newCategories,
                updatedAt: Timestamp.now()
            };

            await setDoc(budgetRef, dataToSave);
            setBudgets(prev => ({ ...prev, [budgetId]: dataToSave }));
        } catch (error) {
            console.error("Error saving budget config: ", error);
            throw error;
        }
    };


    const value = {
        transactions,
        budgets,
        goals,
        loading,
        addTransaction,
        addTransfer,
        deleteTransaction,
        updateTransaction,
        getTotals,
        appConfig,
        updateAppConfig,
        addGoal,
        updateGoal,
        deleteGoal,
        fetchBudgetConfig,
        saveBudgetConfig
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
};
