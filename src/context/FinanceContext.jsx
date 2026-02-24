import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, getDoc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';

const FinanceContext = createContext();

export const useFinance = () => useContext(FinanceContext);

export const FinanceProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
    const [budgets, setBudgets] = useState({});
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);

    // Global Config State
    const [appConfig, setAppConfig] = useState({
        currencies: ['COP', 'USD', 'EUR'],
        accounts: ['Efectivo', 'Tarjeta de Crédito Principal', 'Cuenta Bancaria'],
        categories: ['Comida', 'Transporte', 'Servicios', 'Compras', 'Ingresos']
    });

    useEffect(() => {
        // Fetch Settings Configuration
        const fetchConfig = async () => {
            try {
                const configRef = doc(db, 'finance_settings', 'default');
                const configSnap = await getDoc(configRef);

                if (configSnap.exists()) {
                    setAppConfig(configSnap.data());
                } else {
                    // Initialize default if it doesn't exist
                    await setDoc(configRef, appConfig);
                }
            } catch (error) {
                console.error("Error fetching config: ", error);
                setLoading(false); // Make sure to stop loading if it fails
            }
        };

        fetchConfig();

        // Subscribe to transactions collection
        const unsubscribeTransactions = onSnapshot(collection(db, 'finance_transactions'), (snapshot) => {
            const txs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date?.toDate() || new Date() // Ensure date is a Date object
            }));
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
            await addDoc(collection(db, 'finance_transactions'), {
                ...data,
                date: Timestamp.now(),
            });
        } catch (error) {
            console.error("Error adding document: ", error);
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

    // Calculate balances based on context and transaction type
    const getTotals = (contextFilter) => {
        // filter transactions based on context ('personal', 'business' or 'unified')
        const filtered = transactions.filter(t =>
            contextFilter === 'unified' ? true : t.context === contextFilter
        );

        const netWorth = {};
        const personalBalance = {};
        const businessCashFlow = {};

        transactions.forEach(t => {
            const amount = t.type === 'credit' ? Number(t.amount) : -Number(t.amount);
            const currency = t.currency || 'USD'; // Fallback to USD for older transactions

            // Initialize currencies if they don't exist
            if (!netWorth[currency]) netWorth[currency] = 0;
            if (!personalBalance[currency]) personalBalance[currency] = 0;
            if (!businessCashFlow[currency]) businessCashFlow[currency] = 0;

            // For unified net worth, we add everything unless specified otherwise
            netWorth[currency] += amount;

            if (t.context === 'personal') {
                personalBalance[currency] += amount;
            } else if (t.context === 'business') {
                businessCashFlow[currency] += amount;
            }
        });

        return {
            netWorth,
            personalBalance,
            businessCashFlow,
            filteredTransactions: filtered
        };
    };

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
