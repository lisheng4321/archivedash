import { inventoryStatusFor, inventoryAgeStart, releaseExpectedDateFor, isPreorderOrigin } from "./inventory.js";

export const INVENTORY_WORK_VIEWS = [{ id: "expected_passed", label: "Expected date passed" }, { id: "transit_followup", label: "Transit follow-up" }, { id: "aged_available", label: "Available 90+ days" }];
export function calendarAge(date, todayKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return null;
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== date) return null;
  return Math.floor((Date.parse(`${todayKey}T00:00:00Z`) - parsed) / 86400000);
}
export function inventoryWorkReason(item, view, todayKey) {
  const status = inventoryStatusFor(item, todayKey);
  const expected = releaseExpectedDateFor(item);
  const expectedAge = calendarAge(expected, todayKey);
  if (view === "expected_passed" && status !== "available" && expectedAge > 0) return `Expected ${expected} · ${expectedAge} days overdue${status === "preorder" ? " · shipment unconfirmed" : ""}`;
  if (view === "transit_followup" && status === "in_transit") {
    if (expectedAge > 0) return `Expected ${expected} · arrival overdue`;
    if (expected && expectedAge !== null) return "";
    const transitAge = calendarAge(item.transitDate, todayKey);
    if (transitAge === null) return "Transit date missing · confirm dispatch date";
    if (transitAge >= 14) return `${transitAge} days in transit · no expected date`;
  }
  if (view === "aged_available" && status === "available") {
    const age = calendarAge(inventoryAgeStart(item), todayKey);
    if (age >= 90) return `${age} days · ${item.receivedDate ? "received" : "estimated from " + (item.purchaseLineId ? "" : "legacy ") + (isPreorderOrigin(item) ? "release" : "purchase")} ${inventoryAgeStart(item)}`;
  }
  return "";
}
export function receivingItems(inventory, ids, quantity, receivedDate, damagedQuantity = 0, todayKey) {
  if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(damagedQuantity) || damagedQuantity < 0 || damagedQuantity > quantity) throw new Error("Enter valid whole received and damaged quantities.");
  const age = calendarAge(receivedDate, todayKey);
  if (age === null || age < 0) throw new Error("Choose a valid receipt date that is not in the future.");
  const requested = new Set(ids);
  const units = inventory.filter((item) => requested.has(item.id));
  if (units.length !== requested.size || units.some((item) => inventoryStatusFor(item, todayKey) !== "in_transit") || quantity > units.length) throw new Error("This stock changed or the received quantity exceeds the remaining transit units. Refresh the selection.");
  const chosen = new Map(units.slice(0, quantity).map((item, index) => [item.id, index < damagedQuantity]));
  return inventory.map((item) => chosen.has(item.id) ? { ...item, availability: "available", receivedDate, stockIssue: chosen.get(item.id) ? "damaged" : (item.stockIssue || ""), preorderOrigin: isPreorderOrigin(item) } : item);
}
