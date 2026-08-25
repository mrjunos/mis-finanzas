import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { FinanceProvider, useFinance } from './FinanceContext';

// ─────────────────────────────────────────────────
// Mock Firebase
// ─────────────────────────────────────────────────
const mockOnSnapshot = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDoc = vi.fn();
const DELETE_FIELD = Symbol('deleteField');

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(),
    onSnapshot: (...args) => mockOnSnapshot(...args),
    addDoc: (...args) => mockAddDoc(...args),
    // Devuelve un marcador con la ruta para poder distinguir una suscripción a
    // documento (ruta de pago) de una a colección en el mock de onSnapshot.
    doc: vi.fn((_db, ...segments) => ({ __kind: 'doc', path: segments.join('/') })),
    setDoc: (...args) => mockSetDoc(...args),
    getDoc: (...args) => mockGetDoc(...args),
    Timestamp: { now: vi.fn(() => ({ seconds: 1234567890 })) },
    deleteDoc: (...args) => mockDeleteDoc(...args),
    updateDoc: (...args) => mockUpdateDoc(...args),
    deleteField: () => DELETE_FIELD,
}));

vi.mock('../firebase', () => ({
    db: {},
}));

// ─────────────────────────────────────────────────
// Helper: renders a consumer component that exposes context values
// ─────────────────────────────────────────────────
function TestConsumer({ onRender }) {
    const ctx = useFinance();
    onRender(ctx);
    return <div data-testid="consumer">loaded</div>;
}

describe('FinanceProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: getDoc returns no config (triggers default initialization)
        mockGetDoc.mockResolvedValue({ exists: () => false, data: () => null });

        // setDoc siempre debe devolver una promesa: el provider la espera al
        // sembrar la config por defecto y el plan de ruta de pago.
        mockSetDoc.mockResolvedValue(undefined);

        // Default: onSnapshot fires immediately. Las suscripciones a colección
        // reciben `{docs: []}`; la del documento de ruta de pago recibe un
        // snapshot de documento inexistente (dispara la siembra).
        mockOnSnapshot.mockImplementation((ref, successCb) => {
            if (ref?.__kind === 'doc') successCb({ exists: () => false, data: () => null });
            else successCb({ docs: [] });
            return vi.fn(); // unsubscribe
        });
    });

    it('renders children without crashing', () => {
        render(
            <FinanceProvider>
                <div data-testid="child">Hello</div>
            </FinanceProvider>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('provides default empty state', async () => {
        let contextValue;

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        expect(contextValue.transactions).toEqual([]);
        expect(contextValue.goals).toEqual([]);
        expect(contextValue.loading).toBe(false);
    });

    it('provides appConfig with default values when Firestore has no config', async () => {
        let contextValue;

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        expect(contextValue.appConfig).toBeDefined();
        expect(contextValue.appConfig.currencies).toContain('COP');
        expect(contextValue.appConfig.accounts.length).toBeGreaterThan(0);
    });

    it('exposes addTransaction that calls addDoc', async () => {
        let contextValue;
        mockAddDoc.mockResolvedValue({ id: 'new-tx-id' });

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        await act(async () => {
            await contextValue.addTransaction({
                title: 'Test',
                amount: 5000,
                type: 'debit',
                currency: 'COP',
            });
        });

        expect(mockAddDoc).toHaveBeenCalledTimes(1);
        const callArgs = mockAddDoc.mock.calls[0][1];
        expect(callArgs.title).toBe('Test');
        expect(callArgs.amount).toBe(5000);
        expect(callArgs.date).toBeDefined(); // Now a YYYY-MM-DD string
    });

    it('exposes deleteTransaction that calls deleteDoc', async () => {
        let contextValue;
        mockDeleteDoc.mockResolvedValue(undefined);

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        await act(async () => {
            await contextValue.deleteTransaction('test-id-123');
        });

        expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });

    it('exposes updateTransaction that calls updateDoc', async () => {
        let contextValue;
        mockUpdateDoc.mockResolvedValue(undefined);

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        await act(async () => {
            await contextValue.updateTransaction('tx-id', { amount: 9999 });
        });

        expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    });

    it('addTransaction throws and propagates errors', async () => {
        let contextValue;
        mockAddDoc.mockRejectedValue(new Error('Firestore error'));

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        await expect(
            contextValue.addTransaction({ title: 'Fail', amount: 100 })
        ).rejects.toThrow('Firestore error');
    });

    it('processes transactions from snapshot with normalized data', async () => {
        let contextValue;

        mockOnSnapshot.mockImplementation((collectionRef, successCb) => {
            // First call = transactions, second call = goals
            if (mockOnSnapshot.mock.calls.length <= 1) {
                successCb({
                    docs: [
                        {
                            id: 'tx1',
                            data: () => ({
                                title: 'Almuerzo',
                                amount: 15000,
                                type: 'debit',
                                currency: 'COP',
                                context: 'personal',
                                category: { name: 'Comida', subcategories: [] }, // Object category
                                date: { toDate: () => new Date('2026-01-10T12:00:00Z') },
                            }),
                        },
                        {
                            id: 'tx2',
                            data: () => ({
                                title: 'Salario',
                                amount: 3000000,
                                type: 'credit',
                                currency: 'COP',
                                context: 'personal',
                                category: 'Ingresos', // String category
                                date: '2026-01-15',
                            }),
                        },
                    ],
                });
            } else {
                successCb({ docs: [] });
            }
            return vi.fn();
        });

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        expect(contextValue.transactions).toHaveLength(2);
        // Category should be normalized to strings
        expect(contextValue.transactions[0].category).toBe('Ingresos');
        expect(contextValue.transactions[1].category).toBe('Comida');
        // Dates should be Date objects
        expect(contextValue.transactions[0].date).toBeInstanceOf(Date);
        expect(contextValue.transactions[1].date).toBeInstanceOf(Date);
    });

    it('exposes goal CRUD methods', async () => {
        let contextValue;
        mockAddDoc.mockResolvedValue({ id: 'goal-1' });
        mockUpdateDoc.mockResolvedValue(undefined);
        mockDeleteDoc.mockResolvedValue(undefined);

        await act(async () => {
            render(
                <FinanceProvider>
                    <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                </FinanceProvider>
            );
        });

        // addGoal
        await act(async () => {
            await contextValue.addGoal({ name: 'Vacaciones', target: 5000000 });
        });
        expect(mockAddDoc).toHaveBeenCalled();

        // updateGoal
        await act(async () => {
            await contextValue.updateGoal('goal-1', { name: 'Vacaciones Updated' });
        });
        expect(mockUpdateDoc).toHaveBeenCalled();

        // deleteGoal
        await act(async () => {
            await contextValue.deleteGoal('goal-1');
        });
        expect(mockDeleteDoc).toHaveBeenCalled();
    });

    // ─────────────────────────────────────────────────
    // Ruta de pago (plan de saneamiento)
    // ─────────────────────────────────────────────────
    describe('ruta de pago', () => {
        const RUTA_PATH = 'finance_debt_plans/default';

        const renderProvider = async () => {
            let contextValue;
            await act(async () => {
                render(
                    <FinanceProvider>
                        <TestConsumer onRender={(ctx) => { contextValue = ctx; }} />
                    </FinanceProvider>
                );
            });
            return () => contextValue;
        };

        it('siembra el plan por defecto cuando el documento no existe', async () => {
            mockSetDoc.mockResolvedValue(undefined);
            await renderProvider();

            const seedCall = mockSetDoc.mock.calls.find(([ref]) => ref?.path === RUTA_PATH);
            expect(seedCall).toBeDefined();
            expect(seedCall[1].deudas).toHaveLength(6);
            expect(seedCall[1].meses).toHaveLength(5);
            expect(seedCall[1].done).toEqual({});
        });

        it('no siembra cuando el documento ya existe y expone el plan', async () => {
            const planExistente = { nombre: 'Mi plan', deudas: [], meses: [], done: { 'x': true } };
            mockOnSnapshot.mockImplementation((ref, successCb) => {
                if (ref?.__kind === 'doc') successCb({ exists: () => true, data: () => planExistente });
                else successCb({ docs: [] });
                return vi.fn();
            });

            const getCtx = await renderProvider();

            expect(getCtx().rutaPago).toEqual(planExistente);
            expect(mockSetDoc.mock.calls.some(([ref]) => ref?.path === RUTA_PATH)).toBe(false);
        });

        it('marca un ítem escribiendo la ruta anidada en `done`', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);
            const getCtx = await renderProvider();

            await act(async () => {
                await getCtx().toggleRutaPagoItem('ago-nequi', true);
            });

            const [ref, payload] = mockUpdateDoc.mock.calls.at(-1);
            expect(ref.path).toBe(RUTA_PATH);
            expect(payload).toEqual({ 'done.ago-nequi': true });
        });

        it('desmarca un ítem con deleteField en vez de guardar false', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);
            const getCtx = await renderProvider();

            await act(async () => {
                await getCtx().toggleRutaPagoItem('ago-nequi', false);
            });

            const [, payload] = mockUpdateDoc.mock.calls.at(-1);
            expect(payload['done.ago-nequi']).toBe(DELETE_FIELD);
        });

        it('poda las marcas huérfanas al guardar el plan', async () => {
            mockSetDoc.mockResolvedValue(undefined);
            const getCtx = await renderProvider();

            await act(async () => {
                await getCtx().saveRutaPago({
                    nombre: 'Plan', periodo: 'Ene – Feb', moneda: 'COP',
                    deudas: [{ id: 'a', nombre: 'A', total: 100 }],
                    meses: [{ id: 'm1', nombre: 'Enero', mes: '2026-01', ingreso: 10, gastos: 5, items: [{ id: 'i1', monto: 100 }] }],
                    done: { i1: true, 'ya-no-existe': true },
                });
            });

            const [ref, payload] = mockSetDoc.mock.calls.at(-1);
            expect(ref.path).toBe(RUTA_PATH);
            expect(payload.done).toEqual({ i1: true });
            expect(payload.updatedAt).toBeDefined();
        });

        it('reinicia todas las marcas', async () => {
            mockUpdateDoc.mockResolvedValue(undefined);
            const getCtx = await renderProvider();

            await act(async () => {
                await getCtx().resetRutaPagoMarcas();
            });

            const [ref, payload] = mockUpdateDoc.mock.calls.at(-1);
            expect(ref.path).toBe(RUTA_PATH);
            expect(payload).toEqual({ done: {} });
        });

        it('propaga los errores de escritura', async () => {
            mockUpdateDoc.mockRejectedValue(new Error('Firestore error'));
            const getCtx = await renderProvider();

            await expect(getCtx().toggleRutaPagoItem('ago-nequi', true)).rejects.toThrow('Firestore error');
        });
    });
});
