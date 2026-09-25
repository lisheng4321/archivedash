import test from "node:test";
import assert from "node:assert/strict";
import { allocateOrderAmount, saleProductGroups } from "../src/dashboard/saleOrder.js";
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
