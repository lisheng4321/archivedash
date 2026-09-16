import { compareInventorySize, explicitAvailabilityFor, isPreorderOrigin, releaseExpectedDateFor } from "./inventory.js";
import { calendarDaysUntil, preorderBadge } from "./shared/dates.js";

const isInventoryInTransit = (item = {}) => (
  explicitAvailabilityFor(item) === "preorder" && !releaseExpectedDateFor(item)
);

const compareTransitFirst = (a, b) => Number(isInventoryInTransit(b)) - Number(isInventoryInTransit(a));

const inventoryPreorderBadge = (item = {}) => {
  const items = Array.isArray(item._items) ? item._items : [item];
  if (items.some(isInventoryInTransit)) return { bg: "#1e3a5f", fg: "#93c5fd", text: "In transit" };
  if (!isPreorderOrigin(item)) return null;
  return preorderBadge(calendarDaysUntil(releaseExpectedDateFor(item)));
};

const sortInventory = (items, sort, view) => {
  const name = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
  return [...items].sort((a, b) => {
    // Keep the transit queue visible even when the user changes sort direction.
    const transit = view === "preorders" || sort.startsWith("preorder_") ? compareTransitFirst(a, b) : 0;
    if (transit) return transit;
    let order = 0;
    switch (sort) {
      case "name_asc": order = name(a, b); break;
      case "name_desc": order = name(b, a); break;
      case "price_desc": order = b.price - a.price; break;
      case "price_asc": order = a.price - b.price; break;
      case "date_desc": order = (b.purchaseDate || "").localeCompare(a.purchaseDate || ""); break;
      case "date_asc": order = (a.purchaseDate || "").localeCompare(b.purchaseDate || ""); break;
      case "preorder_asc": order = (releaseExpectedDateFor(a) || "9999-12-31").localeCompare(releaseExpectedDateFor(b) || "9999-12-31"); break;
      case "preorder_desc": order = (releaseExpectedDateFor(b) || "").localeCompare(releaseExpectedDateFor(a) || ""); break;
    }
    return order || name(a, b) || compareInventorySize(a, b);
  });
};

const groupInventory = (items, collapse, view) => {
  if (!collapse) return items.map((item) => ({ ...item, _group: false }));
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.name)) groups.set(item.name, []);
    groups.get(item.name).push(item);
  });
  return [...groups.values()].map((group) => {
    const sortedItems = [...group].sort((a, b) => (
      (view === "preorders" ? compareTransitFirst(a, b) : 0) || compareInventorySize(a, b)
    ));
    if (sortedItems.length === 1) return { ...sortedItems[0], _group: false };
    const releaseDates = sortedItems.map(releaseExpectedDateFor).filter(Boolean).sort();
    return {
      ...sortedItems[0],
      releaseExpectedDate: releaseDates[0] || "",
      preorderDate: releaseDates[0] || "",
      _group: true,
      _items: sortedItems,
      _count: sortedItems.length,
      _totalValue: sortedItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0),
    };
  });
};

export { groupInventory, inventoryPreorderBadge, isInventoryInTransit, sortInventory };
