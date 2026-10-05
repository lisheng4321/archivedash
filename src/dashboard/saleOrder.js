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

// Validate the entire queue before preparing any writes. Every buyer's order
// gets its own ID, while all stock removal is committed in one recovery batch.
export function prepareManualSaleOrders(orders, inventory, createId, latestDate) {
  if (!orders.length) throw new Error("Add at least one sale.");
  const stock = new Map(inventory.map((item) => [item.id, item]));
  const soldIds = new Set();
  const entries = [];
  for (const order of orders) {
    const { items, shared, rows } = order;
    if (!items.length || !shared.saleDate || shared.saleDate > latestDate) throw new Error("Check the items and date for each sale.");
    const orderId = createId();
    for (const selected of items) {
      const item = stock.get(selected.id);
      if (!item) throw new Error(`${selected.name || "An item"} is no longer in inventory. Remove that queued sale and select stock again.`);
      if (soldIds.has(item.id)) throw new Error("The same inventory unit cannot be sold to more than one buyer.");
      const row = rows.find((entry) => entry.id === item.id);
      if (!row || [row.salePrice, row.shippingPrice, row.platformFees].some((value) => String(value ?? "").trim() === "" || !Number.isFinite(Number(value)) || Number(value) < 0)) {
        throw new Error("Check the prices, shipping and fees for each sale.");
      }
      soldIds.add(item.id);
      entries.push({ item, shared, row, orderId });
    }
  }
  return { entries, soldIds };
}
