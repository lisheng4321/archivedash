import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createDataStore } from '../src/dataStore.js';

let db;
const account = '11111111-1111-4111-8111-111111111111';
const otherAccount = '22222222-2222-4222-8222-222222222222';
const initialStock = [{ id: 'ready', price: 20, availability: 'available' }, { id: 'waiting', price: 40, availability: 'in_transit' }];
const initialRevision = '2026-09-01T00:00:00Z';
const target = { 'arch-inv2': [initialStock[1]], 'arch-sales2': [{ id: 'sale', inventoryUnitId: 'ready', orderId: 'order', costPrice: 20, salePrice: 35, shippingPrice: 0, platformFees: 0, saleDate: '2026-01-01' }] };
before(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.app_data(user_id uuid not null, key text not null, value jsonb, updated_at timestamptz default now(), primary key(user_id,key));
    alter table public.app_data enable row level security;
    grant select, insert, update, delete on public.app_data to authenticated;
    create policy own_data on public.app_data to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261007000000_atomic_inventory_sale.sql', import.meta.url), 'utf8'));
});
after(async () => { await db?.close(); });

async function fixture() {
  await db.exec('reset role; truncate public.app_data;');
  for (const [key, value] of [['arch-inv2', initialStock], ['arch-sales2', []]]) {
    await db.query('insert into public.app_data(user_id,key,value,updated_at) values ($1,$2,$3::jsonb,$4::timestamptz)', [account, key, JSON.stringify(value), initialRevision]);
  }
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [account]);
  await db.exec('set role authenticated;');
  const storage = new Map();
  globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  let loseResponse = false;
  let networkFailure = false;
  let calls = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: account } } }) },
    from: () => {
      const filters = {};
      const query = { select: () => query, eq: (key, value) => { filters[key] = value; return query; }, maybeSingle: async () => {
        const result = await db.query('select value, updated_at::text from public.app_data where user_id=$1 and key=$2', [filters.user_id, filters.key]);
        return { data: result.rows[0] ?? null };
      } };
      return query;
    },
    rpc: async (_name, params) => {
      calls++;
      if (networkFailure) return { error: { message: 'Offline' } };
      try {
        const result = await db.query('select public.commit_inventory_sale($1::uuid,$2::jsonb,$3::jsonb,$4::timestamptz,$5::timestamptz) as result', [params.p_operation_id, JSON.stringify(params.p_inventory), JSON.stringify(params.p_sales), params.p_inventory_revision, params.p_sales_revision]);
        if (loseResponse) { loseResponse = false; return { error: { message: 'Response lost' } }; }
        return { data: result.rows[0].result };
      } catch (error) { return { error: { code: error.code, message: error.message } }; }
    },
  };
  return { client, storage, lose: () => { loseResponse = true; }, offline: (value) => { networkFailure = value; }, calls: () => calls };
}
async function loaded(client) {
  const store = createDataStore(client);
  await Promise.all(['arch-inv2', 'arch-sales2'].map((key) => store.load(key, [])));
  return store;
}
async function records() {
  return Object.fromEntries((await db.query("select key,value from public.app_data where key in ('arch-inv2','arch-sales2')")).rows.map((row) => [row.key, row.value]));
}

test('authenticated sale transaction commits sale and stock removal together', async () => {
  const f = await fixture(); const store = await loaded(f.client);
  assert.equal((await store.saveInventorySale(target)).ok, true);
  assert.deepEqual(await records(), target); assert.equal(store.hasPendingSale(), false);
});
test('a stale second client cannot sell the same unit or append a partial sale', async () => {
  const f = await fixture(); const first = await loaded(f.client); const second = await loaded(f.client);
  assert.equal((await first.saveInventorySale(target)).ok, true);
  const result = await second.saveInventorySale({ ...target, 'arch-sales2': [{ ...target['arch-sales2'][0], id: 'duplicate' }] });
  assert.equal(result.ok, false); assert.equal(result.conflict, true);
  assert.match(result.error, /another tab/); assert.deepEqual(await records(), target);
  assert.equal(second.hasPendingSale(), false);
});
test('unavailable units reject the entire transaction without writing either dataset', async () => {
  const f = await fixture(); const store = await loaded(f.client);
  const result = await store.saveInventorySale({ 'arch-inv2': [], 'arch-sales2': [...target['arch-sales2'], { ...target['arch-sales2'][0], id: 'bad', inventoryUnitId: 'waiting', costPrice: 40 }] });
  assert.equal(result.ok, false); assert.match(result.error, /unavailable/);
  assert.deepEqual(await records(), { 'arch-inv2': initialStock, 'arch-sales2': [] });
});
test('lost-response retry recognizes the operation after later stock changes', async () => {
  const f = await fixture(); const store = await loaded(f.client); f.lose();
  assert.equal((await store.saveInventorySale(target)).ok, false); assert(store.hasPendingSale());
  const received = [{ ...initialStock[1], availability: 'available', receivedDate: '2026-10-07' }];
  await db.query("update public.app_data set value=$1::jsonb, updated_at=clock_timestamp() + interval '1 second' where key='arch-inv2'", [JSON.stringify(received)]);
  const refreshed = await loaded(f.client);
  const result = await refreshed.saveInventorySale();
  assert.equal(result.ok, true); assert.deepEqual(result.inventory, received);
  assert.equal(result.sales.length, 1); assert(!refreshed.hasPendingSale());
  assert.equal(f.storage.size, 0);
});
test('offline and rapid repeat submissions keep one operation and recover once', async () => {
  const f = await fixture(); const store = await loaded(f.client); f.offline(true);
  const first = store.saveInventorySale(target); const repeat = store.saveInventorySale(target);
  assert.equal(first, repeat); assert.equal((await first).ok, false); assert.equal(f.calls(), 1);
  const refused = await store.save('arch-inv2', []); assert.equal(refused.ok, false);
  f.offline(false); assert.equal((await store.saveInventorySale()).ok, true);
  assert.deepEqual(await records(), target);
});
test('operation receipts reject a different payload reusing the same ID', async () => {
  const f = await fixture(); const store = await loaded(f.client); f.lose();
  await store.saveInventorySale(target);
  const draft = JSON.parse([...f.storage.values()][0]);
  const result = await f.client.rpc('commit_inventory_sale', { p_operation_id: draft.operationId, p_inventory: [], p_sales: [], p_inventory_revision: initialRevision, p_sales_revision: initialRevision });
  assert.match(result.error.message, /different sale/); assert.deepEqual(await records(), target);
});
test('row-level security isolates another account and anonymous callers cannot execute', async () => {
  const f = await fixture(); const store = await loaded(f.client); await store.saveInventorySale(target);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherAccount]);
  assert.deepEqual(await records(), {});
  await db.exec('reset role; set role anon;');
  await assert.rejects(db.query('select public.commit_inventory_sale($1::uuid,$2::jsonb,$3::jsonb,null,null)', [crypto.randomUUID(), '[]', '[]']), /permission denied/);
});
