/**
 * Normalizes a category field that may be stored as a string or an object.
 * Handles the known Firestore inconsistency where category can be
 * {name: 'Comida', subcategories: []} instead of just 'Comida'.
 *
 * @param {string|object|null|undefined} category - The raw category value.
 * @returns {string} The normalized category name.
 */
export const normalizeCategory = (category) => {
    if (category && typeof category === 'object') {
        return category.name || 'general';
    }
    return category || 'general';
};

/**
 * Parses a transaction date field that can be:
 * 1. A Firestore Timestamp (has .toDate())
 * 2. A date string (parseable by new Date())
 * 3. null/undefined (falls back to current date)
 *
 * @param {object|string|null|undefined} dateField - The raw date value.
 * @returns {Date} A valid Date object.
 */
export const parseTransactionDate = (dateField) => {
    if (dateField && typeof dateField.toDate === 'function') {
        return dateField.toDate();
    }
    if (dateField) {
        // If the date is just a string 'YYYY-MM-DD', parse it safely at noon to avoid timezone shifts
        if (typeof dateField === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateField)) {
            const [year, month, day] = dateField.split('-');
            return new Date(year, month - 1, day, 12, 0, 0);
        }

        const parsed = new Date(dateField);
        // Guard against Invalid Date
        if (!isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date();
};

/**
 * Calculates multi-currency balances from a list of transactions.
 *
 * @param {Array<{type: string, amount: number, currency?: string, context?: string}>} transactions
 * @returns {{ netWorth: Object, personalBalance: Object, businessCashFlow: Object }}
 */
export const calculateBalances = (transactions) => {
    const netWorth = {};
    const personalBalance = {};
    const businessCashFlow = {};

    transactions.forEach((t) => {
        // Skip transfers — they move money between accounts, not in/out
        if (t.type === 'transfer' || t.isTransfer === true) return;

        const amount = t.type === 'credit' ? Number(t.amount) : -Number(t.amount);
        const currency = t.currency || 'USD';

        if (!netWorth[currency]) netWorth[currency] = 0;
        if (!personalBalance[currency]) personalBalance[currency] = 0;
        if (!businessCashFlow[currency]) businessCashFlow[currency] = 0;

        netWorth[currency] += amount;

        if (t.context === 'personal') {
            personalBalance[currency] += amount;
        } else if (t.context === 'business') {
            businessCashFlow[currency] += amount;
        }
    });

    return { netWorth, personalBalance, businessCashFlow };
};
