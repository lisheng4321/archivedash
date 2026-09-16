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
    const token = `${id}:${key}`;
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
  function save(key, value) {
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
  return {
    load, save,
    hasPendingSaves: () => [...pending.keys()].some((token) => token.startsWith(`${owner}:`) && !token.endsWith(':arch-notes-active')),
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
