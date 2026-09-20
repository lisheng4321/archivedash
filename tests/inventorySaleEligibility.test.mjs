import test from 'node:test';
import assert from 'node:assert/strict';
import { isInventorySellable, inventorySaleError } from '../src/dashboard/inventory.js';

test('preorders require receipt regardless of expected date', () => {
  for (const releaseExpectedDate of ['', '2000-01-01', '2099-01-01']) {
    assert.equal(isInventorySellable({ availability: 'preorder', releaseExpectedDate }), false);
  }
  assert.equal(isInventorySellable({ preorderDate: '2000-01-01' }), false);
  assert.equal(isInventorySellable({ preorderOrigin: true }), false);
});

test('received and ordinary legacy stock remain sellable', () => {
  assert.equal(isInventorySellable({ availability: 'available', preorderOrigin: true, preorderDate: '2099-01-01' }), true);
  assert.equal(isInventorySellable({ name: 'Legacy stock' }), true);
});

test('sale validation checks current inventory and rejects an entire mixed selection', () => {
  const inventory = [{ id: 'ready', availability: 'available' }, { id: 'waiting', availability: 'preorder' }];
  assert.equal(inventorySaleError(inventory, [inventory[0]]), '');
  assert.match(inventorySaleError(inventory, inventory), /cannot be sold/);
  assert.match(inventorySaleError(inventory, [{ id: 'waiting', availability: 'available' }]), /cannot be sold/);
  assert.match(inventorySaleError(inventory, [{ id: 'missing' }]), /no longer available/);
  assert.match(inventorySaleError(inventory, []), /no longer available/);
});
