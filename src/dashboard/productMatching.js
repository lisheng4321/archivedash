import { canonicalPurchaseSource } from "./inventory.js";

const norm = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
const variant = (item) => JSON.stringify([norm(item.category), norm(item.brand), norm(item.size || "OS")]);
export const sameVariant = (a, b) => variant(a) === variant(b);
export const productIdentity = (item) => item.productId || `legacy:${JSON.stringify([norm(item.name), variant(item)])}`;
const catalogueKey = (item) => JSON.stringify([productIdentity(item), variant(item)]);

export function productCatalogue(records) {
  const products = new Map();
  records.forEach((item) => {
    const key = catalogueKey(item);
    if (!products.has(key)) products.set(key, { key, item, records: [] });
    products.get(key).records.push(item);
  });
  return [...products.values()].sort((a, b) => String(a.item.name).localeCompare(String(b.item.name)));
}

export function suggestProduct(draft, records) {
  const source = norm(canonicalPurchaseSource(draft.purchaseSource));
  if (!source || source === "unknown") return null;
  const scoped = records.filter((item) => norm(canonicalPurchaseSource(item.purchaseSource)) === source && variant(item) === variant(draft));
  const sku = norm(draft.retailerSku);
  const skuMatches = sku ? scoped.filter((item) => norm(item.retailerSku) === sku) : [];
  const aliasMatches = scoped.filter((item) => item.productMatchApproved === true && norm(item.receiptTitle) === norm(draft.name));
  const candidates = skuMatches.length ? skuMatches : aliasMatches;
  if (!candidates.length || new Set(candidates.map(productIdentity)).size !== 1) return null;
  return { key: catalogueKey(candidates[0]), item: candidates[0], reason: skuMatches.length ? "Source + SKU" : "Approved retailer alias" };
}

export function approveProductMatch(draft, product) {
  if (variant(draft) !== variant(product.item)) throw new Error("Choose a product with the same category, brand and size, or keep this as a different variant.");
  return { ...draft, name: product.item.name, receiptTitle: draft.receiptTitle || draft.name, productId: productIdentity(product.item), productMatchApproved: true };
}
