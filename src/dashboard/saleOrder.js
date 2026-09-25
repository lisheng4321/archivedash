// Allocate whole-order costs in cents so the saved unit rows sum exactly.
export function allocateOrderAmount(value, count) {
  if (!count) return [];
  const cents = Math.round(Number(value || 0) * 100);
  const base = Math.floor(cents / count);
  return Array.from({ length: count }, (_, index) => (base + (index < cents - base * count ? 1 : 0)) / 100);
}

export function saleProductGroups(inventory) {
  const groups = new Map();
  for (const item of inventory) {
    const key = JSON.stringify([item.name, item.size || "OS", item.category, item.brand || "", Number(item.price) || 0, item.availability || "", item.releaseExpectedDate || item.preorderDate || ""]);
    if (!groups.has(key)) groups.set(key, { key, item, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}
