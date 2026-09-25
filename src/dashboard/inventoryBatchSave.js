// Reuse unit IDs on retries, including when an optimistic update is already visible.
export function createInventoryBatchSave(items) {
  const batch = items.map((item) => ({ ...item }));
  const ids = new Set(batch.map((item) => item.id));
  let inFlight;
  return {
    save(inventory, persist) {
      if (inFlight) return inFlight;
      inFlight = Promise.resolve().then(() => persist([...batch, ...inventory.filter((item) => !ids.has(item.id))]))
        .finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}
