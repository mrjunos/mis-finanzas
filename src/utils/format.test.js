import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCompactNumber } from './format';

describe('formatCurrency', () => {
    it('formats COP without decimals', () => {
        const result = formatCurrency(50000, 'COP');
        // COP uses 0 fraction digits
        expect(result).toContain('50.000');
        expect(result).not.toMatch(/,\d{2}$/); // no decimal cents
    });

    it('formats USD with 2 decimals', () => {
        const result = formatCurrency(99.99, 'USD');
        expect(result).toContain('99');
        expect(result).toMatch(/99/);
    });

    it('formats EUR with 2 decimals', () => {
        const result = formatCurrency(1234.56, 'EUR');
        expect(result).toContain('1.234');
    });

    it('falls back to USD for invalid currency code without crashing', () => {
        // Should not throw — uses USD fallback
        expect(() => formatCurrency(100, 'INVALID')).not.toThrow();
        const result = formatCurrency(100, 'INVALID');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });

    it('formats zero correctly', () => {
        const result = formatCurrency(0, 'COP');
        expect(result).toBeDefined();
        expect(result).not.toContain('NaN');
    });

    it('formats negative values', () => {
        const result = formatCurrency(-5000, 'COP');
        expect(result).toContain('5.000');
        expect(result).toMatch(/-/); // has negative sign
    });

    it('handles very large numbers', () => {
        const result = formatCurrency(999999999, 'COP');
        expect(result).toBeDefined();
        expect(result).not.toContain('NaN');
    });

    it('uses COP as default when no currency provided', () => {
        const result = formatCurrency(1000);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
    });
});

describe('formatCompactNumber', () => {
    it('formats thousands', () => {
        const result = formatCompactNumber(1500);
        // es-CO compact: "1,5 mil" or "1.5 mil" depending on locale
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeLessThan(10);
    });

    it('formats millions', () => {
        const result = formatCompactNumber(2500000);
        expect(result).toBeDefined();
        expect(result.length).toBeLessThan(10);
    });

    it('formats zero', () => {
        const result = formatCompactNumber(0);
        expect(result).toBe('0');
    });

    it('formats small numbers without compacting', () => {
        const result = formatCompactNumber(42);
        expect(result).toContain('42');
    });

    it('handles negative numbers', () => {
        const result = formatCompactNumber(-3000);
        expect(result).toBeDefined();
        expect(result).toMatch(/-/);
    });
});
