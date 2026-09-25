export function groupInventoryQueue(items) {
  const groups = new Map();
  for (const item of items) {
    // Purchaser details remain on each unit; they don't split the visual summary.
    const key = JSON.stringify([item.name, item.category, item.brand || "", item.size || "OS", Number(item.price), item.purchaseSource || "", item.availability || "", item.releaseExpectedDate || item.preorderDate || ""]);
    if (!groups.has(key)) groups.set(key, { key, item, ids: [], total: 0 });
    const group = groups.get(key);
    group.ids.push(item.id);
    group.total += Number(item.price) || 0;
  }
  return [...groups.values()];
}
