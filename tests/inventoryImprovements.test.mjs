import test from 'node:test';
import assert from 'node:assert/strict';
import { receivingItems, inventoryWorkReason, calendarAge } from '../src/dashboard/receiving.js';
import { inventoryAgeStart, inventoryStatusFor, isInventorySellable } from '../src/dashboard/inventory.js';
import { prepareManualSaleOrders, saleProductGroups } from '../src/dashboard/saleOrder.js';
import { saleBackupIdentity, validateBackup } from '../src/dashboard/backupValidation.js';

const purchase = [
  { id: 'a', name: 'Box', purchaseLineId: 'box', price: 20, purchaseSource: 'Custom shop' },
  { id: 'b', name: 'Box', purchaseLineId: 'box', price: 20, purchaseSource: 'Custom shop' },
  { id: 'c', name: 'Tin', purchaseLineId: 'tin', price: 40, purchaseSource: 'Custom shop' },
];
const stock = Array.from({ length: 5 }, (_, i) => ({ id: `unit-${i}`, price: 23, name: 'Lot', availability: 'in_transit', purchaseSource: 'Custom shop', purchaseLotId: 'lot', transitDate: '2026-09-23' }));
const ids = stock.map((item) => item.id);
test('receiving two of five preserves quantity, IDs and exact cost basis', () => {
  const next = receivingItems(stock, ids, 2, '2026-10-07', 0, '2026-10-07');
  assert.equal(next.filter(isInventorySellable).length, 2);
  assert.equal(next.filter((item) => item.availability === 'in_transit').length, 3);
  assert.deepEqual(next.map((item) => item.id), ids);
  assert.equal(next.reduce((sum, item) => sum + item.price, 0), 115);
  assert.equal(stock.filter((item) => item.availability === 'in_transit').length, 5);
  assert.throws(() => receivingItems(next, ids, 2, '2026-10-07', 0, '2026-10-07'), /changed/);
  assert.throws(() => receivingItems(stock, ids, 6, '2026-10-07', 0, '2026-10-07'), /exceeds/);
});
test('damaged arrivals are physically received but blocked from sale', () => {
  const next = receivingItems(stock, ids, 2, '2026-10-07', 1, '2026-10-07');
  assert.equal(next[0].receivedDate, '2026-10-07'); assert.equal(next[0].stockIssue, 'damaged');
  assert.equal(isInventorySellable(next[0]), false); assert.equal(isInventorySellable(next[1]), true);
  assert.throws(() => receivingItems(stock, ids, 1, '2026-10-08', 0, '2026-10-07'), /future/);
});
test('overdue estimates flag follow-up while preserving explicit Preorder', () => {
  const item = { availability: 'preorder', releaseExpectedDate: '2026-10-01' };
  assert.match(inventoryWorkReason(item, 'expected_passed', '2026-10-07'), /6 days overdue/);
  assert.equal(inventoryStatusFor(item, '2026-10-07'), 'preorder'); assert.equal(isInventorySellable(item), false);
  assert.equal(inventoryWorkReason({ ...item, releaseExpectedDate: '2026-10-09' }, 'expected_passed', '2026-10-07'), '');
});
test('transit follow-up uses 14 days and explains missing or invalid dates', () => {
  assert.match(inventoryWorkReason(stock[0], 'transit_followup', '2026-10-07'), /14 days/);
  assert.equal(inventoryWorkReason(stock[0], 'transit_followup', '2026-10-06'), '');
  assert.match(inventoryWorkReason({ availability: 'in_transit' }, 'transit_followup', '2026-10-07'), /missing/);
  assert.equal(inventoryWorkReason({ ...stock[0], releaseExpectedDate: '2026-10-10' }, 'transit_followup', '2026-10-07'), '');
  assert.equal(calendarAge('2026-02-30', '2026-10-07'), null);
  assert.equal(calendarAge('2024-02-29', '2024-03-01'), 1);
});
test('ageing prefers confirmed receipt and labels legacy estimates', () => {
  const item = { availability: 'available', preorderOrigin: true, releaseExpectedDate: '2026-01-01', receivedDate: '2026-10-01' };
  assert.equal(inventoryAgeStart(item), '2026-10-01');
  assert.equal(inventoryWorkReason(item, 'aged_available', '2026-10-07'), '');
  assert.match(inventoryWorkReason({ availability: 'available', purchaseDate: '2026-01-01' }, 'aged_available', '2026-10-07'), /estimated from legacy purchase/);
});
test('manual-sale preparation rechecks the current status, including changed and damaged stock', () => {
  const order = { items: [{ id: 'one', availability: 'available' }], shared: { saleDate: '2026-10-07' }, rows: [{ id: 'one', salePrice: 30, shippingPrice: 0, platformFees: 0 }] };
  for (const current of [{ id: 'one', availability: 'preorder' }, { id: 'one', availability: 'in_transit' }, { id: 'one', availability: 'available', stockIssue: 'damaged' }]) {
    assert.throws(() => prepareManualSaleOrders([order], [current], () => 'order', '2026-10-07'), /cannot be sold|condition/);
  }
});

test('JSON backup and merge identity retain same-priced units and separate actual orders', () => {
  const one = { id: 'one', orderId: 'order-one', inventoryUnitId: 'unit-one', name: 'Box', saleDate: '2026-10-07', salePrice: 50, profit: 20, receivedDate: '2026-10-01', fulfilmentDate: '2026-10-07', purchaseReference: 'ref', purchaseLotId: 'lot' };
  const two = { ...one, id: 'two', orderId: 'order-two', inventoryUnitId: 'unit-two' };
  const backup = JSON.parse(JSON.stringify({ inventory: purchase, sales: [one, two], expenses: [] }));
  assert.doesNotThrow(() => validateBackup(backup));
  assert.deepEqual(backup.sales, [one, two]);
  assert.notEqual(saleBackupIdentity(one), saleBackupIdentity(two));
  assert.equal(saleBackupIdentity(one), saleBackupIdentity({ ...one, profit: 21 }));
  const withoutIds = [one, two].map(({ id, ...sale }) => sale);
  assert.notEqual(saleBackupIdentity(withoutIds[0]), saleBackupIdentity(withoutIds[1]));
});
