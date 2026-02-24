/**
 * Formats a number as a currency string.
 * Uses es-CO locale.
 *
 * @param {number} value - The numeric value to format.
 * @param {string} currency - The currency code (e.g., 'COP', 'USD', 'EUR'). Defaults to 'COP'.
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (value, currency = 'COP') => {
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency === 'COP' ? 0 : 2,
            maximumFractionDigits: currency === 'COP' ? 0 : 2,
        }).format(value);
    } catch (error) {
        console.warn(`Invalid currency code: "${currency}". Falling back to USD. Error:`, error);
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }
};

/**
 * Formats a number with thousand separators, without currency symbol.
 * Uses es-CO locale. Useful when the currency label is displayed separately.
 *
 * @param {number} value - The numeric value to format.
 * @param {string} currency - The currency code to determine decimal digits. Defaults to 'COP'.
 * @returns {string} The formatted number string (e.g., '16.824.635' for COP, '1,00' for USD).
 */
export const formatNumber = (value, currency = 'COP') => {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: currency === 'COP' ? 0 : 2,
        maximumFractionDigits: currency === 'COP' ? 0 : 2,
    }).format(value);
};

/**
 * Formats a number in compact notation (e.g. 1K, 1M).
 * Uses es-CO locale.
 *
 * @param {number} value - The numeric value to format.
 * @returns {string} The formatted compact string.
 */
export const formatCompactNumber = (value) => {
    return new Intl.NumberFormat('es-CO', {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1
    }).format(value);
};
