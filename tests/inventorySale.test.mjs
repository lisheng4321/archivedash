import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataStore } from '../src/dataStore.js';

function fixture() {
  const rows = new Map([['arch-inv2', {value:[{id:'item',price:30}],updated_at:'2026-09-01T00:00:00Z'}], ['arch-sales2',{value:[],updated_at:'2026-09-01T00:00:00Z'}]]);
  const storage = new Map();
  globalThis.sessionStorage = {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  let failKey='', user='alice', gate=null;
  const client={auth:{getUser:async()=>({data:{user:{id:user}}})},from:()=>{
    let payload, filters={}, write=false;
    const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},update:v=>{payload=v;write=true;return q;},maybeSingle:async()=>{
      const key=filters.key, row=rows.get(key);
      if(!write)return {data:structuredClone(row??null)};
      if(gate)await gate;
      if(key===failKey)return {error:{message:'Offline'}};
      if(row.updated_at!==filters.updated_at)return {data:null};
      rows.set(key,{...row,...payload});return {data:{updated_at:payload.updated_at}};
    }};return q;
  }};
  return {rows,storage,client,store:createDataStore(client),fail:k=>{failKey=k;},user:u=>{user=u;},hold:()=>{let release;gate=new Promise(r=>release=r);return ()=>{gate=null;release();};}};
}
const target={'arch-sales2':[{id:'sale',name:'Tee',salePrice:80}], 'arch-inv2':[]};
async function load(store){return Promise.all(['arch-sales2','arch-inv2'].map(k=>store.load(k,[])));}

test('retry after failed sale write reuses the original sale and removes stock',async()=>{
 const f=fixture();await load(f.store);f.fail('arch-sales2');assert.equal((await f.store.saveInventorySale(target)).ok,false);
 assert(f.store.hasPendingSaves());assert(f.store.hasPendingSale());
 f.fail('');assert.equal((await f.store.saveInventorySale({'arch-sales2':[{id:'duplicate'}],'arch-inv2':[]})).ok,true);
 assert.deepEqual(f.rows.get('arch-sales2').value,target['arch-sales2']);assert.deepEqual(f.rows.get('arch-inv2').value,[]);assert(!f.store.hasPendingSaves());
});
test('inventory failure resumes without creating another sale, including across refresh',async()=>{
 const f=fixture();await load(f.store);f.fail('arch-inv2');assert.equal((await f.store.saveInventorySale(target)).ok,false);
 const saleRevision=f.rows.get('arch-sales2').updated_at;
 const refreshed=createDataStore(f.client);assert.deepEqual(await load(refreshed),[target['arch-sales2'],[]]);
 f.fail('');assert.equal((await refreshed.saveInventorySale()).ok,true);assert.equal(f.rows.get('arch-sales2').updated_at,saleRevision);assert.deepEqual(f.rows.get('arch-inv2').value,[]);
});
test('refresh after the first failed write restores and completes both stages',async()=>{
 const f=fixture();await load(f.store);f.fail('arch-sales2');await f.store.saveInventorySale(target);
 const refreshed=createDataStore(f.client);await load(refreshed);f.fail('');assert((await refreshed.saveInventorySale()).ok);assert.deepEqual(f.rows.get('arch-sales2').value,target['arch-sales2']);assert.deepEqual(f.rows.get('arch-inv2').value,[]);
});
test('rapid repeat submissions share one operation and pending sales block conflicting edits',async()=>{
 const f=fixture();await load(f.store);const release=f.hold();const one=f.store.saveInventorySale(target);const two=f.store.saveInventorySale(target);assert.equal(one,two);
 assert.equal((await f.store.save('arch-inv2',[{id:'unrelated'}])).ok,false);release();assert((await one).ok);assert.equal(f.rows.get('arch-sales2').value.length,1);
});
test('recovery retains its original revision and cannot overwrite another device',async()=>{
 const f=fixture();await load(f.store);f.fail('arch-sales2');await f.store.saveInventorySale(target);
 f.rows.set('arch-sales2',{value:[{id:'other-device'}],updated_at:'2026-09-19T00:00:00Z'});
 const refreshed=createDataStore(f.client);await load(refreshed);f.fail('');assert.equal((await refreshed.saveInventorySale()).ok,false);assert.equal(f.rows.get('arch-sales2').value[0].id,'other-device');
});
test('unavailable recovery storage prevents all sale writes',async()=>{
 const f=fixture();await load(f.store);sessionStorage.setItem=()=>{throw Error('Full');};
 assert.equal((await f.store.saveInventorySale(target)).ok,false);assert.equal(f.rows.get('arch-sales2').value.length,0);assert.equal(f.rows.get('arch-inv2').value.length,1);
});

test('lost response is recognized on retry without a reload',async()=>{
 const f=fixture();await load(f.store);f.fail('arch-sales2');await f.store.saveInventorySale(target);
 // Model a write that committed remotely but whose response never arrived.
 f.rows.set('arch-sales2',{value:structuredClone(target['arch-sales2']),updated_at:'2026-09-18T00:00:00Z'});
 f.fail('');assert((await f.store.saveInventorySale()).ok);assert.equal(f.rows.get('arch-sales2').value.length,1);assert.deepEqual(f.rows.get('arch-inv2').value,[]);
});

test('account changes cannot redirect a recovery into another account',async()=>{
 const f=fixture();await load(f.store);f.fail('arch-sales2');await f.store.saveInventorySale(target);
 f.user('bob');f.fail('');assert.equal((await f.store.saveInventorySale()).ok,false);assert.equal(f.rows.get('arch-sales2').value.length,0);
 f.user('alice');assert((await f.store.saveInventorySale()).ok);
});
