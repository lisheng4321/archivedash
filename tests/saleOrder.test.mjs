import test from "node:test";
import assert from "node:assert/strict";
import { allocateOrderAmount, manualSaleRows, saleProductGroups, prepareManualSaleOrders } from "../src/dashboard/saleOrder.js";
import { computeProfit, toCents } from "../src/dashboard/shared/money.js";
import { inventoryStatusFor, orderKeyForSale } from "../src/dashboard/inventory.js";
import { normalizeSettings } from "../src/dashboard/settings.js";

test("release never turns unreceived stock into available stock", () => {
  const date = "2026-09-25";
  assert.equal(inventoryStatusFor({ availability: "preorder", releaseExpectedDate: "2026-09-26" }, date), "preorder");
  for (const releaseExpectedDate of ["2026-09-24", date, ""]) {
    assert.equal(inventoryStatusFor({ availability: "preorder", releaseExpectedDate }, date), "in_transit");
  }
  assert.equal(inventoryStatusFor({ availability: "in_transit", releaseExpectedDate: "2099-01-01" }, date), "in_transit");
  assert.equal(inventoryStatusFor({ availability: "available", releaseExpectedDate: "2099-01-01" }, date), "available");
});

test("order expense allocations retain every cent, including tiny totals", () => {
  for (const amount of [0, 0.01, 0.02, 1, 12.34, 99.99]) {
    for (const count of [1, 3, 7, 100]) {
      const parts = allocateOrderAmount(amount, count);
      assert.equal(parts.reduce((sum, part) => sum + Math.round(part * 100), 0), Math.round(amount * 100));
      assert.equal(parts.length, count);
    }
  }
});

test("bulk product groups preserve distinct sizes, costs and stock statuses", () => {
  const item = { name: "Product", size: "OS", category: "TCG", price: 10, availability: "available" };
  const groups = saleProductGroups([{ ...item, id: "1" }, { ...item, id: "2" }, { ...item, id: "3", price: 11 }, { ...item, id: "4", availability: "in_transit" }]);
  assert.deepEqual(groups.map((group) => group.items.length), [2, 1, 1]);
});

test("different orders from the same buyer on the same day remain separate", () => {
  const sale = { customer: "Buyer", saleDate: "2026-09-25", platform: "Discord" };
  assert.notEqual(orderKeyForSale({ ...sale, orderId: "one" }), orderKeyForSale({ ...sale, orderId: "two" }));
  assert.equal(orderKeyForSale({ ...sale, orderId: "one", id: "1" }), orderKeyForSale({ ...sale, orderId: "one", id: "2" }));
});

test("custom sources survive settings normalization and an empty list stays empty", () => {
  assert.deepEqual(normalizeSettings({ purchaseSources: ["Local shop"] }).purchaseSources, ["Local shop"]);
  assert.deepEqual(normalizeSettings({ purchaseSources: [] }).purchaseSources, []);
});

const queueStock = [{ id: "a", name: "Product", price: 10 }, { id: "b", name: "Product", price: 10 }, { id: "c", name: "Other", price: 20 }];
const queuedOrder = (items, customer, price, shipping = 0, fees = 0) => ({
  items,
  shared: { customer, platform: "Other", paymentMethod: "Cash", saleDate: "2026-10-05" },
  rows: items.map((item, i) => ({ id: item.id, salePrice: price, shippingPrice: allocateOrderAmount(shipping, items.length)[i], platformFees: allocateOrderAmount(fees, items.length)[i] })),
});

test("queued orders retain each buyer's items and costs with separate order IDs", () => {
  let id = 0;
  const orders = [queuedOrder(queueStock.slice(0, 2), "Alice", 30, 1.01, 0.03), queuedOrder(queueStock.slice(2), "Bob", 45, 4, 2)];
  const { entries, soldIds } = prepareManualSaleOrders(orders, queueStock, () => `order-${++id}`, "2026-10-05");
  assert.deepEqual(entries.map((entry) => [entry.item.id, entry.shared.customer, entry.orderId]), [["a", "Alice", "order-1"], ["b", "Alice", "order-1"], ["c", "Bob", "order-2"]]);
  assert.deepEqual(entries.map((entry) => entry.row.salePrice), [30, 30, 45]);
  assert.deepEqual(entries.map((entry) => entry.row.shippingPrice), [0.51, 0.5, 4]);
  assert.deepEqual(entries.map((entry) => entry.row.platformFees), [0.02, 0.01, 2]);
  assert.equal(soldIds.size, 3);
});

test("a queue rejects duplicate or missing stock before any sale is committed", () => {
  const order = queuedOrder([queueStock[0]], "Alice", 30);
  assert.throws(() => prepareManualSaleOrders([order, order], queueStock, () => "id", "2026-10-05"), /same inventory unit/);
  assert.throws(() => prepareManualSaleOrders([order], queueStock.slice(1), () => "id", "2026-10-05"), /no longer in inventory/);
});

test("invalid queued money and future dates reject the entire batch", () => {
  for (const value of ["", -1, Infinity, "abc", undefined]) {
    const order = queuedOrder([queueStock[0]], "Alice", value);
    assert.throws(() => prepareManualSaleOrders([order], queueStock, () => "id", "2026-10-05"), /Check the prices/);
  }
  const order = queuedOrder([queueStock[0]], "Alice", 0);
  assert.equal(prepareManualSaleOrders([order], queueStock, () => "id", "2026-10-05").entries.length, 1);
  assert.throws(() => prepareManualSaleOrders([order], queueStock, () => "id", "2026-10-04"), /date/);
});

test("ten items sold for $400 plus $17.80 shipping save $417.80 received", () => {
  const items = Array.from({ length: 10 }, (_, id) => ({ id, name: "Mini tin", price: 18 }));
  const rows = manualSaleRows([{ key: "tins", items, quantity: 10 }], { tins: "40" }, "17.80", "17.80", "");
  assert.equal(rows.length, 10);
  assert(rows.every((row) => row.salePrice === 41.78 && row.shippingPrice === 1.78));
  assert.equal(rows.reduce((sum, row) => sum + toCents(row.salePrice), 0), 41780);
  assert.equal(rows.reduce((sum, row) => sum + toCents(computeProfit({ salePrice: row.salePrice, cost: 18, shipping: row.shippingPrice })), 0), 22000);
});

test("buyer shipping retains remainder cents across mixed products without changing costs", () => {
  const selected = [{ key: "one", quantity: 2, items: queueStock.slice(0, 2) }, { key: "two", quantity: 1, items: queueStock.slice(2) }];
  const rows = manualSaleRows(selected, { one: "10", two: "20" }, "0.02", "1.01", "0.01");
  assert.deepEqual(rows.map((row) => row.salePrice), [10.01, 10.01, 20]);
  assert.equal(rows.reduce((sum, row) => sum + toCents(row.shippingPrice), 0), 101);
  assert.equal(rows.reduce((sum, row) => sum + toCents(row.platformFees), 0), 1);
  assert.deepEqual(manualSaleRows(selected, { one: "10", two: "20" }).map((row) => row.salePrice), [10, 10, 20]);
});

test("queued buyer shipping is included exactly once and stays with its own order", () => {
  const first = queuedOrder(queueStock.slice(0, 2), "Alice", 30);
  first.rows = manualSaleRows([{ key: "one", quantity: 2, items: first.items }], { one: 30 }, 5);
  const second = queuedOrder(queueStock.slice(2), "Bob", 45);
  second.rows = manualSaleRows([{ key: "two", quantity: 1, items: second.items }], { two: 45 }, 2);
  let id = 0;
  const { entries } = prepareManualSaleOrders([first, second], queueStock, () => ++id, "2026-10-05");
  assert.deepEqual(entries.map(({ shared, row }) => [shared.customer, row.salePrice]), [["Alice", 32.5], ["Alice", 32.5], ["Bob", 47]]);
});
