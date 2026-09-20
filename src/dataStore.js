// Failed reads must never become empty datasets. Writes compare the revision
// this client read, so stale tabs/devices cannot silently overwrite newer data.
export function createDataStore(client) {
  const revisions = new Map();
  const queues = new Map();
  const pending = new Map();
  const equivalent = (a, b) => {
    const canonical = (value) => Array.isArray(value) ? value.map(canonical)
      : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
    return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  };
  let owner = null;
  let saleOwner = null;
  let saleDraft = null;
  let saleFlight = null;
  const saleKeys = ['arch-sales2', 'arch-inv2'];
  const saleDraftKey = (id) => `archivedash:sale-draft:v1:${id}`;
  const storeSaleDraft = () => {
    if (saleDraft) sessionStorage.setItem(saleDraftKey(saleOwner), JSON.stringify(saleDraft));
    else sessionStorage.removeItem(saleDraftKey(saleOwner));
  };
  const draftKey = (id) => `archivedash:notes-draft:v1:${id}`;
  const readDraft = (id) => {
    try { return JSON.parse(sessionStorage.getItem(draftKey(id))); } catch { return null; }
  };
  const writeDraft = (id, draft) => {
    try {
      if (draft) sessionStorage.setItem(draftKey(id), JSON.stringify(draft));
      else sessionStorage.removeItem(draftKey(id));
    } catch { /* Save warnings/unload guard still apply when storage is unavailable. */ }
  };
  async function userId() {
    if (!client) throw new Error('Supabase is not configured');
    const { data: { user }, error } = await client.auth.getUser();
    if (error) throw error;
    if (!user) throw new Error('No signed-in user');
    return user.id;
  }
  async function load(key, fallback) {
    const id = await userId();
    const { data, error } = await client.from('app_data').select('value,updated_at')
      .eq('user_id', id).eq('key', key).maybeSingle();
    if (error) throw new Error(`Could not load ${key}: ${error.message}`);
    owner = id;
    if (saleOwner !== id) {
      saleOwner = id;
      let raw = null;
      try { raw = sessionStorage.getItem(saleDraftKey(id)); } catch { /* New sales require writable recovery storage. */ }
      saleDraft = raw ? JSON.parse(raw) : null;
      if (saleDraft && saleKeys.some((key) => !Array.isArray(saleDraft[key]?.value) || !Object.hasOwn(saleDraft[key], 'revision'))) {
        throw new Error('The pending sale could not be read. Keep this tab open and export your data before recovering it.');
      }
    }
    const token = `${id}:${key}`;
    if (saleDraft && saleKeys.includes(key)) {
      const entry = saleDraft[key];
      const committed = data && equivalent(data.value, entry.value);
      entry.done = Boolean(committed);
      revisions.set(token, committed ? data.updated_at : entry.revision);
      if (committed) pending.delete(token);
      else pending.set(token, entry.value);
      const value = entry.value;
      if (saleKeys.every((k) => saleDraft[k].done)) {
        saleDraft = null;
        storeSaleDraft();
      }
      return value;
    }
    const draft = key === 'arch-notes' ? readDraft(id) : null;
    if (draft && Array.isArray(draft.value) && Object.hasOwn(draft, 'revision')) {
      if (data && equivalent(data.value, draft.value)) {
        writeDraft(id, null);
        pending.delete(token);
      } else {
        revisions.set(token, draft.revision);
        pending.set(token, draft.value);
        return draft.value;
      }
    }
    revisions.set(token, data ? data.updated_at : null);
    return data ? data.value : fallback;
  }
  function save(key, value, saleWrite = false) {
    if (saleDraft && saleKeys.includes(key) && !saleWrite) {
      return Promise.resolve({ ok: false, error: 'Finish recovering the pending sale before changing sales or inventory.' });
    }
    // Capture the account before yielding, including for queued edits.
    const id = owner;
    const token = `${id}:${key}`;
    const snapshot = structuredClone(value);
    pending.set(token, snapshot);
    if (id && key === 'arch-notes') writeDraft(id, { value: snapshot, revision: revisions.get(token) });
    const run = async () => {
      try {
        if (pending.get(token) !== snapshot) return { ok: true, superseded: true };
        if (!id || !revisions.has(token)) throw new Error('Data must load successfully before it can be saved.');
        if (await userId() !== id) throw new Error('Account changed. Sign back in to save these edits.');
        const revision = revisions.get(token);
        const updatedAt = new Date(Math.max(Date.now(), (Date.parse(revision) || 0) + 1)).toISOString();
        const row = { user_id: id, key, value: snapshot, updated_at: updatedAt };
        // Active-note selection is a navigation preference, not record data.
        // Different tabs selecting different notes must not create a data conflict.
        const query = key === 'arch-notes-active'
          ? client.from('app_data').upsert(row, { onConflict: 'user_id,key' })
          : revision === null
            ? client.from('app_data').insert(row)
            : client.from('app_data').update({ value: snapshot, updated_at: updatedAt })
              .eq('user_id', id).eq('key', key).eq('updated_at', revision);
        const { data, error } = await query.select('updated_at').maybeSingle();
        if (error?.code === '23505' || (!error && !data)) {
          throw new Error('This data changed in another tab or device. Export your current data before reloading to reconcile the changes.');
        }
        if (error) throw error;
        revisions.set(token, data.updated_at);
        const superseded = pending.get(token) !== snapshot;
        if (!superseded) {
          pending.delete(token);
          if (key === 'arch-notes') writeDraft(id, null);
        } else if (key === 'arch-notes') {
          writeDraft(id, { value: pending.get(token), revision: data.updated_at });
        }
        return { ok: true, superseded };
      } catch (error) {
        return { ok: false, superseded: pending.get(token) !== snapshot, error: error?.message || String(error) };
      }
    };
    const result = (queues.get(token) || Promise.resolve()).then(run);
    queues.set(token, result);
    void result.finally(() => { if (queues.get(token) === result) queues.delete(token); });
    return result;
  }
  function saveInventorySale(values) {
    if (saleFlight) return saleFlight;
    try {
      if (!saleDraft) {
        if (!owner || saleKeys.some((key) => !revisions.has(`${owner}:${key}`))) throw new Error('Inventory and sales must finish loading first.');
        if (saleKeys.some((key) => pending.has(`${owner}:${key}`))) throw new Error('Save your existing inventory and sales changes before recording a sale.');
        saleOwner = owner;
        saleDraft = Object.fromEntries(saleKeys.map((key) => [key, { value: structuredClone(values[key]), revision: revisions.get(`${owner}:${key}`), done: false }]));
        try { storeSaleDraft(); } catch {
          saleDraft = null;
          throw new Error('Could not keep a recovery copy of this sale. Free browser storage and try again. No sale was saved.');
        }
      }
    } catch (error) { return Promise.resolve({ ok: false, error: error.message }); }
    const operation = saleDraft;
    const operationOwner = saleOwner;
    saleFlight = (async () => {
      // A stable, account-scoped journal keeps the two existing datasets together
      // through retries and refreshes. Revision conflicts still stop the operation.
      for (const key of saleKeys) {
        if (owner !== operationOwner) return { ok: false, error: 'Account changed. Sign back in to finish saving this sale.' };
        const entry = operation[key];
        if (entry.done) continue;
        // A response can be lost after the server committed the write. Check the
        // exact target before retrying, without adopting a conflicting revision.
        if (await userId() !== operationOwner) return { ok: false, error: 'Account changed. Sign back in to finish saving this sale.' };
        const { data: existing, error: readError } = await client.from('app_data').select('value,updated_at')
          .eq('user_id', operationOwner).eq('key', key).maybeSingle();
        if (owner !== operationOwner) return { ok: false, error: 'Account changed. Sign back in to finish saving this sale.' };
        if (readError) return { ok: false, error: readError.message || 'Could not check the pending sale. Try again.' };
        if (existing && equivalent(existing.value, entry.value)) {
          revisions.set(`${operationOwner}:${key}`, existing.updated_at);
          pending.delete(`${operationOwner}:${key}`);
          entry.done = true;
          entry.revision = existing.updated_at;
          try { storeSaleDraft(); } catch { /* the original journal remains recoverable */ }
          continue;
        }
        const result = await save(key, entry.value, true);
        if (!result.ok) return result;
        if (owner !== operationOwner) return { ok: false, error: 'Account changed. Sign back in to finish saving this sale.' };
        entry.done = true;
        entry.revision = revisions.get(`${saleOwner}:${key}`);
        // The initial journal is sufficient for reload recovery if this update fails.
        try { storeSaleDraft(); } catch { /* load compares each target with cloud data */ }
      }
      saleDraft = null;
      try { storeSaleDraft(); } catch { /* a reload recognizes the completed targets */ }
      return { ok: true };
    })().catch((error) => ({ ok: false, error: error?.message || 'Could not finish saving this sale.' })).finally(() => { saleFlight = null; });
    return saleFlight;
  }
  return {
    load, save,
    saveInventorySale,
    hasPendingSale: () => Boolean(saleDraft),
    hasPendingSaves: () => Boolean(saleDraft) || [...pending.keys()].some((token) => token.startsWith(`${owner}:`) && !token.endsWith(':arch-notes-active')),
    hasNotesDraft: () => owner && pending.has(`${owner}:arch-notes`),
    loadCloudNotes: async () => {
      const id = await userId();
      const token = `${id}:arch-notes`;
      const previous = pending.get(token);
      if (queues.has(token)) throw new Error('Wait for the current note save to finish, then try again.');
      const { data, error } = await client.from('app_data').select('value,updated_at')
        .eq('user_id', id).eq('key', 'arch-notes').maybeSingle();
      if (error) throw error;
      if (data && !Array.isArray(data.value)) throw new Error('Invalid saved notes data.');
      if (owner !== id || queues.has(token) || pending.get(token) !== previous) throw new Error('Notes changed while loading. Please try again.');
      revisions.set(token, data ? data.updated_at : null);
      writeDraft(id, null);
      pending.delete(token);
      return data ? data.value : [];
    },
  };
}
