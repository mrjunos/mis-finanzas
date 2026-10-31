import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TransactionModal from './TransactionModal';
const mocks = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn() }));
const config = { accounts: ['Rappi Visa *3323', 'Rappi Visa *3716'], currencies: ['COP'], categories: [] };
vi.mock('../context/FinanceContext', () => ({ useFinance: () => ({
  appConfig: config, updateTransaction: mocks.update, addTransaction: mocks.add,
}) }));
const tx = { id: 'synthetic', title: 'RAPPI', amount: 30250, type: 'debit', card: '', status: 'pending',
  cardResolution: { status: 'needs_review', reason: 'unknown_suffix', observedLast4: ['3716'] } };
const accountSelect = () => screen.getAllByRole('combobox').find(el => [...el.options].some(o => o.value === 'Rappi Visa *3716'));
describe('unresolved imported account review', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.spyOn(window, 'alert').mockImplementation(() => {}); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('does not default first account or allow blank save', () => {
    const { container } = render(<TransactionModal isOpen onClose={() => {}} editingTransaction={tx} />);
    expect(accountSelect()).toHaveValue('');
    fireEvent.submit(container.querySelector('form'));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalled();
  });
  it('requires explicit selection then preserves evidence and marks resolution', async () => {
    const onClose = vi.fn();
    const { container } = render(<TransactionModal isOpen onClose={onClose} editingTransaction={tx} />);
    fireEvent.change(accountSelect(), { target: { value: 'Rappi Visa *3716' } });
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('synthetic', expect.objectContaining({
      card: 'Rappi Visa *3716', status: 'reviewed',
      cardResolution: { status: 'resolved', reason: 'manual_selection', observedLast4: ['3716'] },
    })));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('preserves known existing account and resets blank on another unresolved edit', () => {
    const { rerender } = render(<TransactionModal isOpen onClose={() => {}} editingTransaction={{...tx, card:'Rappi Visa *3716'}} />);
    expect(accountSelect()).toHaveValue('Rappi Visa *3716');
    rerender(<TransactionModal isOpen onClose={() => {}} editingTransaction={{...tx,id:'another'}} />);
    expect(accountSelect()).toHaveValue('');
  });
});
