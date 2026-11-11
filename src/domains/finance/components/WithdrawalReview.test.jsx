import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import TransactionModal from './TransactionModal';
const mocks = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn(), transfer: vi.fn() }));
const config = { accounts: ['Bank *2823', 'Efectivo'], currencies: ['COP'], categories: [] };
vi.mock('../context/FinanceContext', () => ({ useFinance: () => ({
  appConfig: config,
  updateTransaction: mocks.update, addTransaction: mocks.add, addTransfer: mocks.transfer,
}) }));
const tx = { id: 'existing-withdrawal', title: 'Cash withdrawal', amount: 100000,
  type: 'debit', card: '', currency: 'COP', context: 'personal', date: '2026-11-10',
  cardResolution: { status: 'needs_review', observedLast4: ['5996'] } };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
test('converts same record to transfer, not a new expense or second transfer', async () => {
  const { container } = render(<TransactionModal isOpen onClose={() => {}} editingTransaction={tx} />);
  fireEvent.click(screen.getByRole('button', { name: 'Transferencia', exact: true }));
  const accounts=screen.getAllByRole('combobox').filter(el => [...el.options].some(o => o.value==='Efectivo'));
  fireEvent.change(accounts[0], { target: { value: 'Bank *2823' } });
  fireEvent.change(accounts[1], { target: { value: 'Efectivo' } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('existing-withdrawal', expect.objectContaining({
    type: 'transfer', amount: 100000, card: 'Bank *2823', destinationCard: 'Efectivo',
    context: 'personal', destinationContext: 'personal', status: 'reviewed',
  })));
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.transfer).not.toHaveBeenCalled();
});
test('cancel leaves withdrawal unchanged', () => {
  const onClose=vi.fn();
  render(<TransactionModal isOpen onClose={onClose} editingTransaction={tx} />);
  fireEvent.click(screen.getByRole('button',{name:'close'}));
  expect(onClose).toHaveBeenCalledOnce();
  expect(mocks.update).not.toHaveBeenCalled();
});
