import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBackup, requireSaved } from '../src/dashboard/backupValidation.js';

test('reject malformed imported datasets before the first write', () => {
  const base = { inventory: [], sales: [], expenses: [] };
  for (const key of ['inventory', 'sales', 'expenses', 'subs', 'notes', 'templates']) {
    for (const value of [{}, 'bad', null, [null], [[]]]) {
      assert.throws(() => validateBackup({ ...base, [key]: value }), new RegExp(key));
    }
  }
});

test('accept legacy backups without notes or subscriptions', () => {
  assert.doesNotThrow(() => validateBackup({ inventory: [], sales: [], expenses: [], notepad: 'legacy text' }));
});

test('invalid settings cannot replace dashboard arrays', () => {
  for (const settings of [null, [], { categories: {} }, { customers: [null] }]) {
    assert.throws(() => validateBackup({ inventory: [], sales: [], expenses: [], settings }), /settings/);
  }
});

test('restoration stops at the first failed save instead of reporting success', async () => {
  const writes = [];
  const restore = async () => {
    writes.push('inventory');
    await requireSaved(Promise.resolve({ ok: false, error: 'Connection lost' }));
    writes.push('notes');
  };
  await assert.rejects(restore(), /Connection lost/);
  assert.deepEqual(writes, ['inventory']);
  await assert.rejects(requireSaved(Promise.resolve({ ok: true, superseded: true })), /superseded/);
  assert.deepEqual(await requireSaved(Promise.resolve({ ok: true })), { ok: true });
});
