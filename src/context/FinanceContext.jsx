import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, setDoc, getDoc, Timestamp, deleteDoc, updateDoc } from 'firebase/firestore';

const FinanceContext = createContext();

export const useFinance = () => useContext(FinanceContext);

export const FinanceProvider = ({ children }) => {
    const [transactions, setTransactions] = useState([]);
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
        const unsubscribe = onSnapshot(collection(db, 'finance_transactions'), (snapshot) => {
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

        // Cleanup subscription on unmount
        return () => unsubscribe();
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

    const value = {
        transactions,
        loading,
        addTransaction,
        deleteTransaction,
        updateTransaction,
        getTotals,
        appConfig,
        updateAppConfig
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
        </FinanceContext.Provider>
    );
};
