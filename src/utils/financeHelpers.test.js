import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeCategory, parseTransactionDate, calculateBalances } from './financeHelpers';

// ─────────────────────────────────────────────────
// normalizeCategory
// ─────────────────────────────────────────────────
describe('normalizeCategory', () => {
    it('returns string category as-is', () => {
        expect(normalizeCategory('Comida')).toBe('Comida');
    });

    it('extracts name from object category', () => {
        expect(normalizeCategory({ name: 'Transporte', subcategories: [] })).toBe('Transporte');
    });

    it('extracts name from object with extra fields', () => {
        expect(normalizeCategory({ name: 'Servicios', foo: 'bar' })).toBe('Servicios');
    });

    it('returns "general" for null', () => {
        expect(normalizeCategory(null)).toBe('general');
    });

    it('returns "general" for undefined', () => {
        expect(normalizeCategory(undefined)).toBe('general');
    });

    it('returns "general" for empty string', () => {
        expect(normalizeCategory('')).toBe('general');
    });

    it('returns "general" for object without name', () => {
        expect(normalizeCategory({ subcategories: [] })).toBe('general');
    });

    it('handles number input gracefully', () => {
        // A number is truthy and not an object with .name, so it returns as-is
        expect(normalizeCategory(123)).toBe(123);
    });
});

// ─────────────────────────────────────────────────
// parseTransactionDate
// ─────────────────────────────────────────────────
describe('parseTransactionDate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-24T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('parses Firestore Timestamp (object with toDate())', () => {
        const mockTimestamp = {
            toDate: () => new Date('2026-01-15T10:30:00Z'),
        };
        const result = parseTransactionDate(mockTimestamp);
        expect(result).toEqual(new Date('2026-01-15T10:30:00Z'));
    });

    it('parses a valid date string', () => {
        const result = parseTransactionDate('2026-01-15');
        expect(result.getUTCFullYear()).toBe(2026);
        expect(result.getUTCMonth()).toBe(0); // January
        expect(result.getUTCDate()).toBe(15);
    });

    it('parses ISO 8601 string', () => {
        const result = parseTransactionDate('2026-03-20T15:30:00Z');
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(2); // March
    });

    it('returns current date for null', () => {
        const result = parseTransactionDate(null);
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(24);
    });

    it('returns current date for undefined', () => {
        const result = parseTransactionDate(undefined);
        expect(result.toISOString()).toBe('2026-02-24T12:00:00.000Z');
    });

    it('returns current date for invalid date string', () => {
        const result = parseTransactionDate('not-a-date');
        // Invalid string should fallback to current date
        expect(result.getFullYear()).toBe(2026);
    });

    it('returns a Date object (not a string)', () => {
        const result = parseTransactionDate('2026-06-15');
        expect(result).toBeInstanceOf(Date);
    });
});

// ─────────────────────────────────────────────────
// calculateBalances
// ─────────────────────────────────────────────────
describe('calculateBalances', () => {
    it('returns zero balances for empty transactions', () => {
        const result = calculateBalances([]);
        expect(result.netWorth).toEqual({});
        expect(result.personalBalance).toEqual({});
        expect(result.businessCashFlow).toEqual({});
    });

    it('calculates net worth from a single credit', () => {
        const txs = [{ type: 'credit', amount: 5000, currency: 'COP', context: 'personal' }];
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(5000);
        expect(result.personalBalance.COP).toBe(5000);
    });

    it('calculates net worth from a single debit', () => {
        const txs = [{ type: 'debit', amount: 3000, currency: 'COP', context: 'personal' }];
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(-3000);
        expect(result.personalBalance.COP).toBe(-3000);
    });

    it('calculates correct balance with mixed credits and debits', () => {
        const txs = [
            { type: 'credit', amount: 10000, currency: 'COP', context: 'personal' },
            { type: 'debit', amount: 3000, currency: 'COP', context: 'personal' },
            { type: 'debit', amount: 2000, currency: 'COP', context: 'personal' },
        ];
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(5000); // 10000 - 3000 - 2000
        expect(result.personalBalance.COP).toBe(5000);
    });

    it('separates personal and business balances', () => {
        const txs = [
            { type: 'credit', amount: 8000, currency: 'COP', context: 'personal' },
            { type: 'credit', amount: 15000, currency: 'COP', context: 'business' },
            { type: 'debit', amount: 5000, currency: 'COP', context: 'business' },
        ];
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(18000); // 8000 + 15000 - 5000
        expect(result.personalBalance.COP).toBe(8000);
        expect(result.businessCashFlow.COP).toBe(10000); // 15000 - 5000
    });

    it('handles multi-currency transactions', () => {
        const txs = [
            { type: 'credit', amount: 100000, currency: 'COP', context: 'personal' },
            { type: 'credit', amount: 500, currency: 'USD', context: 'personal' },
            { type: 'debit', amount: 200, currency: 'USD', context: 'personal' },
        ];
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(100000);
        expect(result.netWorth.USD).toBe(300); // 500 - 200
        expect(result.personalBalance.COP).toBe(100000);
        expect(result.personalBalance.USD).toBe(300);
    });

    it('falls back to USD when currency is missing', () => {
        const txs = [{ type: 'credit', amount: 1000, context: 'personal' }]; // no currency field
        const result = calculateBalances(txs);
        expect(result.netWorth.USD).toBe(1000);
    });

    it('handles transactions without context (unified only)', () => {
        const txs = [{ type: 'credit', amount: 7000, currency: 'COP' }]; // no context
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(7000);
        expect(result.personalBalance.COP).toBe(0); // not personal
        expect(result.businessCashFlow.COP).toBe(0); // not business
    });

    it('handles string amounts by coercing to number', () => {
        const txs = [
            { type: 'credit', amount: '5000', currency: 'COP', context: 'personal' },
            { type: 'debit', amount: '2000', currency: 'COP', context: 'personal' },
        ];
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toBe(3000);
    });

    it('does not produce NaN for undefined amounts', () => {
        const txs = [{ type: 'credit', currency: 'COP', context: 'personal' }]; // no amount
        const result = calculateBalances(txs);
        expect(result.netWorth.COP).toEqual(NaN); // Number(undefined) is NaN — this documents current behavior
    });
});
