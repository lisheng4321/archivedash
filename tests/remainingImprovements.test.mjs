import test from 'node:test';
import assert from 'node:assert/strict';
import { financialCompleteness, financialIssue, knownMoney } from '../src/dashboard/financialCompleteness.js';
import { productCatalogue, suggestProduct, approveProductMatch, productIdentity } from '../src/dashboard/productMatching.js';
import { scopeTotals } from '../src/dashboard/scopeTotals.js';
import { parsePurchasePaste } from '../src/dashboard/purchasePaste.js';
import { saleProductGroups } from '../src/dashboard/saleOrder.js';
import { orderKeyForSale } from '../src/dashboard/inventory.js';
import { groupInventory } from '../src/dashboard/inventoryView.js';

test('intentional zero cost is known; missing, invalid and estimated amounts are incomplete', () => {
  assert.equal(knownMoney(0), true);
  for (const value of [null, undefined, '', ' ', -1, 'bad', Infinity, NaN]) assert.equal(knownMoney(value), false);
  assert.equal(financialIssue({ costPrice: 0 }, 'cost'), false);
  assert.equal(financialIssue({ costPrice: 20, costConfirmed: false }, 'cost'), true);
});
test('legacy zero selling costs need confirmation, and explicit estimates remain unconfirmed', () => {
  assert.equal(financialIssue({ platformFees: 0 }, 'fees'), true);
  assert.equal(financialIssue({ platformFees: 0, feesConfirmed: true }, 'fees'), false);
  assert.equal(financialIssue({ shippingPrice: 10 }, 'postage'), false);
  assert.equal(financialIssue({ shippingPrice: 10, postageConfirmed: false }, 'postage'), true);
  assert.equal(financialIssue({ shippingPrice: null, postageConfirmed: true }, 'postage'), true);
});
test('completeness counts affected records once without summing overlapping problems', () => {
  const sales = [{ costPrice: null, platformFees: 0, shippingPrice: 0 }, { costPrice: 0, platformFees: 0, shippingPrice: 0, feesConfirmed: true, postageConfirmed: true }];
  const result = financialCompleteness(sales, [{ price: null }, { price: 0 }]);
  assert.equal(result.incomplete.length, 1); assert.equal(result.cost.length, 1);
  assert.equal(result.fees.length, 1); assert.equal(result.postage.length, 1); assert.equal(result.stock.length, 1);
  assert.equal(result.salesCount, 2);
});
test('scope totals exclude unknown values, retain free items, and count only visible selection', () => {
  const records = [{ id: 'one', price: 20 }, { id: 'two', price: 0 }, { id: 'three', price: null }, { id: 'four', price: 30, costConfirmed: false }];
  assert.deepEqual(scopeTotals(records, 'price', new Set(['two', 'hidden'])), { units: 4, cost: 20, unknown: 2, selected: 1 });
});
test('SKU suggestions are retailer-scoped and never cross variants or fuzzy names', () => {
  const records = [{ name: 'Canonical Box', category: 'TCG', size: 'OS', brand: '', retailerSku: 'AB-123', purchaseSource: 'QA Shop', productId: 'box' }];
  const draft = { ...records[0], name: 'Retailer box title', retailerSku: 'ab-123' };
  assert.equal(suggestProduct(draft, records).reason, 'Source + SKU');
  assert.equal(suggestProduct({ ...draft, purchaseSource: 'Other shop' }, records), null);
  assert.equal(suggestProduct({ ...draft, size: 'US 9' }, records), null);
  assert.equal(suggestProduct({ ...draft, retailerSku: '', name: 'Canonical Box!' }, records), null);
});
test('conflicting retailer SKUs require manual review rather than choosing the first product', () => {
  const item = { name: 'Box', productId: 'one', category: 'TCG', size: 'OS', retailerSku: 'SKU', purchaseSource: 'QA Shop' };
  assert.equal(suggestProduct(item, [item, { ...item, productId: 'two' }]), null);
});
test('approved aliases are reusable and retain receipt title, prices, quantity, date and source', () => {
  const old = { name: 'Canonical Box', category: 'TCG', size: 'OS', brand: '', purchaseSource: 'QA Shop', price: 20, purchaseLotId: 'old-lot' };
  const draft = { ...old, name: 'Store-specific title', price: 25, quantity: 2, purchaseDate: '2026-10-07', retailerSku: 'SKU2' };
  const approved = approveProductMatch(draft, productCatalogue([old])[0]);
  assert.equal(approved.name, 'Canonical Box'); assert.equal(approved.receiptTitle, 'Store-specific title');
  assert.equal(approved.price, 25); assert.equal(approved.quantity, 2); assert.equal(approved.purchaseDate, '2026-10-07');
  assert.equal(approved.purchaseSource, 'QA Shop'); assert.equal(approved.productId, productIdentity(old));
  assert.equal(suggestProduct({ ...draft, retailerSku: '' }, [approved]).reason, 'Approved retailer alias');
  assert.equal(suggestProduct({ ...draft, retailerSku: '' }, [{ ...approved, productMatchApproved: false }]), null);
  assert.equal(productCatalogue([old, approved]).length, 1);
});
test('catalogue keeps variants distinct even if a historical product ID was reused', () => {
  const one = { productId: 'box', name: 'Box', category: 'TCG', size: 'OS', brand: '' };
  const two = { ...one, brand: 'Other brand' };
  assert.equal(productCatalogue([one, two]).length, 2);
  assert.throws(() => approveProductMatch(two, productCatalogue([one])[0]), /same category/);
});
test('purchase paste accepts retailer SKU and preserves leading zeroes and receipt costs', () => {
  const result = parsePurchasePaste('Product\tQuantity\tLanded cost per unit\tRetailer\tSKU\nRetail title\t2\t25\tQA Shop\t001234', { category: 'TCG', size: 'OS', availability: 'available', purchaseDate: '2026-10-07' }, ['TCG']);
  assert.deepEqual(result.errors, []); assert.equal(result.rows[0].retailerSku, '001234');
  assert.equal(result.rows[0].price, 25);
});
test('approved canonical products still keep independent purchase lots in sale selection', () => {
  const item = { id: 'a', name: 'Box', productId: 'canonical', price: 20, availability: 'available', purchaseLotId: 'one' };
  assert.equal(saleProductGroups([item, { ...item, id: 'b', purchaseLotId: 'two' }]).length, 2);
});
test('legacy sales without an explicit order never group on buyer and date alone', () => {
  const sale = { customer: 'Same Buyer', saleDate: '2026-10-07', platform: 'Other' };
  assert.notEqual(orderKeyForSale({ ...sale, id: 'one' }), orderKeyForSale({ ...sale, id: 'two' }));
  assert.notEqual(orderKeyForSale({ ...sale, _saleKey: 'one' }), orderKeyForSale({ ...sale, _saleKey: 'two' }));
});
test('grouped stock distinguishes a free unit from an unknown or unconfirmed cost', () => {
  const group = groupInventory([{ id: 'free', name: 'Box', price: 0 }, { id: 'missing', name: 'Box', price: null }, { id: 'estimate', name: 'Box', price: 20, costConfirmed: false }], true, 'available')[0];
  assert.equal(group._count, 3); assert.equal(group._totalValue, 0); assert.equal(group._unknownCost, 2);
});
