import test from "node:test";
import assert from "node:assert/strict";
import { groupInventory, inventoryPreorderBadge, isInventoryInTransit, sortInventory } from "../src/dashboard/inventoryView.js";
import { isInventoryAvailable, isUnreleasedPreorder } from "../src/dashboard/inventory.js";
import { calendarDaysUntil } from "../src/dashboard/shared/dates.js";

const item = (id, fields = {}) => ({ id, name: id, category: "Sneakers", size: "US 9", price: 20, availability: "preorder", ...fields });
const transit = item("Z transit", { size: "US 12", price: "12.50" });
const early = item("A early", { releaseExpectedDate: "2099-01-10" });
const late = item("B late", { preorderDate: "2099-02-20" });
const sorts = ["name_asc", "name_desc", "price_asc", "price_desc", "date_asc", "date_desc", "preorder_asc", "preorder_desc"];

test("undated legacy preorders belong to transit, not the preorder queue", () => {
  for (const fields of [{}, { preorderDate: "", releaseExpectedDate: "" }, { preorderDate: null, releaseExpectedDate: null }]) {
    const record = item("transit", fields);
    assert.equal(isInventoryInTransit(record), true);
    assert.equal(isUnreleasedPreorder(record, "2026-09-15"), false);
    assert.equal(isInventoryAvailable(record, "2026-09-15"), false);
    assert.equal(inventoryPreorderBadge(record).text, "In transit");
  }
});

test("available items and historical preorders without dates are not in transit", () => {
  for (const record of [{}, item("available", { availability: "available" }), { preorderOrigin: true }]) {
    assert.equal(isInventoryInTransit(record), false);
    assert.equal(inventoryPreorderBadge(record), null);
  }
});

test("both date fields retain countdown badges and released status", () => {
  for (const record of [early, late]) {
    const date = record.releaseExpectedDate || record.preorderDate;
    assert.equal(isInventoryInTransit(record), false);
    assert.equal(inventoryPreorderBadge(record).text, `${calendarDaysUntil(date)}d`);
  }
  assert.equal(inventoryPreorderBadge(item("old", { preorderDate: "2000-01-01" })).text, "In transit");
});

for (const sort of sorts) {
  test(`preorders keep transit first with ${sort}, without mutating inventory`, () => {
    const input = Object.freeze([Object.freeze(early), Object.freeze(late), Object.freeze(transit)]);
    const result = sortInventory(input, sort, "preorders");
    assert.equal(result[0].id, transit.id);
    assert.deepEqual(input.map((record) => record.id), [early.id, late.id, transit.id]);
    if (sort === "preorder_asc") assert.deepEqual(result.slice(1), [early, late]);
    if (sort === "preorder_desc") assert.deepEqual(result.slice(1), [late, early]);
  });
}

test("normal sorting outside the preorder queue is preserved", () => {
  assert.deepEqual(sortInventory([transit, early, late], "name_asc", "all"), [early, late, transit]);
  for (const sort of ["preorder_asc", "preorder_desc"]) {
    assert.equal(sortInventory([early, transit], sort, "all")[0], transit);
  }
});

test("mixed date groups keep their transit badge, top position, and transit children first", () => {
  const datedUnit = item("dated unit", { name: transit.name, size: "US 4", releaseExpectedDate: "2099-03-01", price: "20" });
  for (const sort of sorts) {
    const sorted = sortInventory([early, datedUnit, transit], sort, "preorders");
    const grouped = groupInventory(sorted, true, "preorders");
    assert.equal(grouped[0].name, transit.name);
    assert.equal(grouped[0]._items[0], transit);
    assert.equal(grouped[0]._count, 2);
    assert.equal(grouped[0]._totalValue, 32.5);
    assert.equal(inventoryPreorderBadge(grouped[0]).text, "In transit");
    assert.equal(inventoryPreorderBadge(grouped[0]._items[1]).text, `${calendarDaysUntil(datedUnit.releaseExpectedDate)}d`);
    const ungrouped = groupInventory(sorted, false, "preorders");
    assert.equal(ungrouped[0].id, transit.id);
    assert.equal(ungrouped.every((record) => !record._group), true);
  }
});

test("group transit status is derived from its children even when a dated unit is first", () => {
  const group = groupInventory([item("small", { name: transit.name, releaseExpectedDate: "2099-04-01", size: "US 3" }), transit], true, "all")[0];
  assert.equal(group._items[0].id, "small");
  assert.equal(inventoryPreorderBadge(group).text, "In transit");
});

test("all-undated groups have a transit badge and dated groups retain earliest countdown", () => {
  const undatedGroup = groupInventory([transit, { ...transit, id: "second" }], true, "preorders")[0];
  assert.equal(inventoryPreorderBadge(undatedGroup).text, "In transit");
  const datedGroup = groupInventory([early, { ...late, name: early.name }], true, "preorders")[0];
  assert.equal(inventoryPreorderBadge(datedGroup).text, `${calendarDaysUntil(early.releaseExpectedDate)}d`);
  assert.deepEqual(groupInventory([], true, "preorders"), []);
});

test("imported missing names cannot crash sorting", () => {
  for (const sort of sorts) {
    assert.doesNotThrow(() => sortInventory([item("one", { name: null }), item("two", { name: undefined })], sort, "preorders"));
  }
});
