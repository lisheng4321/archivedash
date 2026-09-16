import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataStore } from '../src/dataStore.js';

// A small app_data server model: updates match revisions atomically, inserts
// enforce (user_id,key), and reads can fail independently of writes.
function fixture() {
  const rows = new Map();
  const writes = [];
  let readError = null;
  let writeError = null;
  let gate = null;
  let user = 'alice';
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    from: () => {
      let mode = 'read';
      let payload;
      const filters = {};
      const query = {
        select: () => query,
        eq: (key, value) => { filters[key] = value; return query; },
        insert: (value) => { mode = 'insert'; payload = value; return query; },
        upsert: (value) => { mode = 'upsert'; payload = value; return query; },
        update: (value) => { mode = 'update'; payload = value; return query; },
        maybeSingle: async () => {
          if (mode !== 'read' && gate) await gate;
          const id = `${payload?.user_id ?? filters.user_id}:${payload?.key ?? filters.key}`;
          const row = rows.get(id);
          if (mode === 'read') return { data: structuredClone(row ?? null), error: readError };
          writes.push({ mode, payload: structuredClone(payload), filters });
          if (writeError) return { data: null, error: writeError };
          if (mode === 'insert' && row) return { data: null, error: { code: '23505' } };
          if (mode === 'update' && (!row || row.updated_at !== filters.updated_at)) return { data: null };
          const next = { ...row, ...payload };
          rows.set(id, next);
          return { data: { updated_at: next.updated_at } };
        },
      };
      return query;
    },
  };
  return {
    rows, writes, storage, client, store: createDataStore(client),
    seed: (key, value) => rows.set(`alice:${key}`, { value, updated_at: '2026-09-08T00:00:00.000Z' }),
    failReads: (value) => { readError = value; },
    failWrites: (value) => { writeError = value; },
    setUser: (value) => { user = value; },
    holdWrites: () => { let release; gate = new Promise((resolve) => { release = resolve; }); return release; },
  };
}
const notes = [{ id: 'n1', content: 'Recovered notes', title: 'Keep me' }];

test('failed startup read rejects, cannot save empty fallback, and preserves notes', async () => {
  const f = fixture(); f.seed('arch-notes', notes);
  f.failReads({ message: 'Network unavailable' });
  await assert.rejects(f.store.load('arch-notes', null), /Network unavailable/);
  assert.equal((await f.store.save('arch-notes', [])).ok, false);
  assert.deepEqual(f.rows.get('alice:arch-notes').value, notes);
  assert.equal(f.writes.length, 0);
});

test('missing rows alone return fallback and are not written by loading', async () => {
  const f = fixture();
  assert.equal(await f.store.load('arch-notes', null), null);
  assert.equal(f.writes.length, 0);
  assert.equal((await f.store.save('arch-notes', notes)).ok, true);
  assert.deepEqual(f.rows.get('alice:arch-notes').value, notes);
});

test('authentication failures do not masquerade as empty records', async () => {
  const f = fixture(); f.setUser(null);
  await assert.rejects(f.store.load('arch-inv2', []), /signed-in/);
});

test('a failed dataset read cannot be saved after another dataset loads', async () => {
  const f = fixture();
  await f.store.load('arch-settings', {});
  f.failReads({ message: 'timeout' });
  await assert.rejects(f.store.load('arch-notes', null));
  assert.equal((await f.store.save('arch-notes', [])).ok, false);
  assert.equal(f.writes.length, 0);
});

test('rapid edits and a recovery serialize; newest snapshot wins', async () => {
  const f = fixture(); f.seed('arch-notes', notes);
  await f.store.load('arch-notes', null);
  const release = f.holdWrites();
  const first = f.store.save('arch-notes', [{ id: 'n1', content: 'old edit' }]);
  await new Promise((resolve) => setImmediate(resolve));
  const second = f.store.save('arch-notes', []);
  const last = f.store.save('arch-notes', notes);
  assert.equal(f.store.hasPendingSaves(), true);
  release();
  const results = await Promise.all([first, second, last]);
  assert.equal(results[0].superseded, true);
  assert.equal(results[1].superseded, true);
  assert.equal(results[2].ok, true);
  assert.deepEqual(f.rows.get('alice:arch-notes').value, notes);
  assert.equal(f.store.hasPendingSaves(), false);
  assert.equal(f.storage.size, 0);
});

test('failed writes retain a draft synchronously and recover through refresh', async () => {
  const f = fixture(); f.seed('arch-notes', []);
  await f.store.load('arch-notes', null);
  f.failWrites({ message: 'offline' });
  const result = f.store.save('arch-notes', notes);
  assert.equal(f.storage.size, 1);
  assert.equal((await result).ok, false);
  const refreshed = createDataStore(f.client);
  assert.deepEqual(await refreshed.load('arch-notes', null), notes);
  assert.equal(refreshed.hasNotesDraft(), true);
  f.failWrites(null);
  assert.equal((await refreshed.save('arch-notes', notes)).ok, true);
  assert.equal(f.storage.size, 0);
});

test('stale clients cannot erase newer notes or inventory', async () => {
  for (const key of ['arch-notes', 'arch-inv2']) {
    const f = fixture(); f.seed(key, notes);
    const second = createDataStore(f.client);
    await f.store.load(key, []); await second.load(key, []);
    const newer = [...notes, { id: 'n2', content: 'New record' }];
    assert.equal((await second.save(key, newer)).ok, true);
    const result = await f.store.save(key, []);
    assert.equal(result.ok, false);
    assert.match(result.error, /another tab or device/);
    assert.deepEqual(f.rows.get(`alice:${key}`).value, newer);
  }
});

test('two first-run clients cannot overwrite a newly created row', async () => {
  const f = fixture(); const second = createDataStore(f.client);
  await f.store.load('arch-notes', null); await second.load('arch-notes', null);
  await second.save('arch-notes', notes);
  assert.equal((await f.store.save('arch-notes', [])).ok, false);
  assert.deepEqual(f.rows.get('alice:arch-notes').value, notes);
});

test('draft after refresh retains its original revision and cannot overwrite newer cloud notes', async () => {
  const f = fixture(); f.seed('arch-notes', []);
  await f.store.load('arch-notes', null);
  f.failWrites({ message: 'offline' }); await f.store.save('arch-notes', notes);
  f.rows.set('alice:arch-notes', { value: [{ id: 'other' }], updated_at: '2026-09-08T01:00:00.000Z' });
  f.failWrites(null);
  const refreshed = createDataStore(f.client);
  assert.deepEqual(await refreshed.load('arch-notes', null), notes);
  assert.equal((await refreshed.save('arch-notes', notes)).ok, false);
  assert.deepEqual(f.rows.get('alice:arch-notes').value, [{ id: 'other' }]);
});

test('an already committed draft is recognized regardless of JSON object key order', async () => {
  const f = fixture(); f.seed('arch-notes', []);
  await f.store.load('arch-notes', null);
  f.failWrites({ message: 'lost response' }); await f.store.save('arch-notes', notes);
  f.seed('arch-notes', [{ title: 'Keep me', content: 'Recovered notes', id: 'n1' }]);
  const refreshed = createDataStore(f.client);
  await refreshed.load('arch-notes', null);
  assert.equal(refreshed.hasNotesDraft(), false);
  assert.equal(f.storage.size, 0);
});

test('queued edits never write into a different signed-in account', async () => {
  const f = fixture(); await f.store.load('arch-notes', null);
  f.setUser('bob');
  assert.equal((await f.store.save('arch-notes', notes)).ok, false);
  assert.equal(f.writes.length, 0);
  assert.equal(await f.store.load('arch-notes', null), null);
});

test('loading cloud notes keeps the local draft if the cloud read fails', async () => {
  const f = fixture(); f.seed('arch-notes', []);
  await f.store.load('arch-notes', null);
  f.failWrites({ message: 'offline' }); await f.store.save('arch-notes', notes);
  f.failReads({ message: 'offline' });
  await assert.rejects(f.store.loadCloudNotes());
  assert.equal(f.store.hasNotesDraft(), true);
  assert.equal(f.storage.size, 1);
  f.failReads(null);
  assert.deepEqual(await f.store.loadCloudNotes(), []);
  assert.equal(f.store.hasNotesDraft(), false);
  assert.equal(f.storage.size, 0);
});

test('selecting different notes in two tabs does not cause a record conflict', async () => {
  const f = fixture(); const second = createDataStore(f.client);
  await f.store.load('arch-notes-active', null); await second.load('arch-notes-active', null);
  await second.save('arch-notes-active', 'n2');
  assert.equal((await f.store.save('arch-notes-active', 'n1')).ok, true);
  assert.equal(f.store.hasPendingSaves(), false);
});
