import { test } from 'vitest';
import assert from 'node:assert/strict';
import { signedCashFlow, calculateBalances } from '../src/domains/finance/utils/financeHelpers.js';
import { readFileSync } from 'node:fs';

test('withdrawal is neutral; later cash purchase is counted once', () => {
  const txs = [
    { type: 'credit', amount: 200000, currency: 'COP', context: 'personal' },
    { type: 'transfer', amount: 100000, currency: 'COP', context: 'personal', card: 'Bancolombia Debit *2823', destinationCard: 'Efectivo' },
    { type: 'debit', amount: 20000, currency: 'COP', context: 'personal', card: 'Efectivo' }
  ];
  assert.deepEqual(txs.map(signedCashFlow), [200000,0,-20000]);
  assert.equal(txs.reduce((a,t)=>a+signedCashFlow(t),0),180000);
  assert.equal(calculateBalances(txs).netWorth.COP,180000);
});
test('legacy isTransfer flag is neutral', () => {
  assert.equal(signedCashFlow({ type:'debit',isTransfer:true,amount:100000 }),0);
});
test('regular debit and credit signs preserved', () => {
  assert.equal(signedCashFlow({type:'credit',amount:'9238'}),9238);
  assert.equal(signedCashFlow({type:'debit',amount:'9238'}),-9238);
});
test('chart source actually calls tested helper', () => {
  const source=readFileSync('src/domains/finance/components/Transactions.jsx','utf8');
  assert.match(source,/const amt = signedCashFlow\(t\);/);
  assert.doesNotMatch(source,/const amt = t.type === 'credit' \? Number\(t.amount\) : -Number\(t.amount\)/);
});
