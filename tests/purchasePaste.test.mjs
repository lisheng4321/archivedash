import test from "node:test";
import assert from "node:assert/strict";
import { parsePurchasePaste } from "../src/dashboard/purchasePaste.js";
import { createInventoryBatchSave } from "../src/dashboard/inventoryBatchSave.js";

const defaults = { category: "TCG", size: "OS", purchaseDate: "2026-09-25", availability: "in_transit", purchaseSource: "Kmart", purchasedBy: "Ollie", releaseExpectedDate: "" };
const parse = (text) => parsePurchasePaste(text, defaults, ["TCG", "Collectables", "Sneakers"]);

test("spreadsheet rows carry defaults and compute quantities without changing unit costs", () => {
  const result = parse("Product\tQuantity\tLanded cost per unit\nProduct A\t20\t25\nProduct B\t5\t70\nProduct C\t50\t35");
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.reduce((sum, row) => sum + row.quantity, 0), 75);
  assert.equal(result.rows.reduce((sum, row) => sum + row.quantity * row.price, 0), 2600);
  assert.equal(result.rows[0].purchaseSource, "Kmart");
  assert.equal(result.rows[0].purchasedBy, "Ollie");
  assert.equal(result.rows[0].price, 25);
});

test("Markdown tables support currency, account columns and Australian dates", () => {
  const result = parse("| Product | Qty | Unit cost | Retailer | Account | Purchase date |\n| :--- | ---: | ---: | --- | --- | --- |\n| Coin | 5 | AU$50.25 | Royal Australian Mint | Charlie | 24/09/2026 |");
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].purchaseDate, "2026-09-24");
  assert.equal(result.rows[0].price, 50.25);
  assert.equal(result.rows[0].purchasedBy, "Charlie");
});

test("quoted CSV names, thousands separators and blank final spreadsheet cells", () => {
  const csv = parse('Product,Quantity,Unit cost\n"Coin, special edition",2,"AU$1,200.50"');
  assert.deepEqual(csv.errors, []);
  assert.equal(csv.rows[0].name, "Coin, special edition");
  assert.equal(csv.rows[0].price, 1200.5);
  assert.deepEqual(parse("Product\tQty\tUnit cost\tBrand\nCoin\t2\t20\t").errors, []);
});

test("bad quantities, ambiguous totals, malformed tables and impossible dates block import", () => {
  for (const text of [
    "Product,Qty,Total cost\nCoin,2,100",
    "Product,Qty,Unit cost\nCoin,0,10",
    "Product,Qty,Unit cost\nCoin,1.5,10",
    "Product,Qty,Unit cost\nCoin,2,-10",
    "Product,Qty,Unit cost\nCoin,2,Infinity",
    "Product,Qty,Unit cost\nCoin,2,10,extra",
    'Product,Qty,Unit cost\n"Coin,2,10',
    "Product,Qty,Unit cost,Date\nCoin,2,10,31/02/2026",
    "Product,Qty,Unit cost,Category\nCoin,2,10,Unknown",
    "Product,Qty,Unit cost,Status\nCoin,2,10,Shipped maybe",
  ]) assert.ok(parse(text).errors.length, text);
});

test("failed save retries use the same IDs despite optimistic inventory updates", async () => {
  const items = [{ id: "one", price: 10 }, { id: "two", price: 20 }];
  const attempt = createInventoryBatchSave(items);
  let visible = [{ id: "existing" }], writes = 0;
  const persist = async (next) => { visible = next; return { ok: ++writes > 1 }; };
  assert.equal((await attempt.save(visible, persist)).ok, false);
  assert.equal((await attempt.save(visible, persist)).ok, true);
  assert.deepEqual(visible.map((item) => item.id), ["one", "two", "existing"]);
});

test("repeat save clicks share one pending write and a thrown failure can be retried", async () => {
  const attempt = createInventoryBatchSave([{ id: "one" }]);
  let writes = 0;
  const failure = async () => { writes++; throw new Error("Offline"); };
  const first = attempt.save([], failure), second = attempt.save([], failure);
  assert.equal(first, second);
  await assert.rejects(first, /Offline/);
  assert.equal(writes, 1);
  assert.equal((await attempt.save([], async () => ({ ok: true }))).ok, true);
});
