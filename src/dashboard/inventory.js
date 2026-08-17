import { getSizes } from "./shared.jsx";

const PURCHASE_SOURCES = [
  "EB Games",
  "JB Hi-Fi",
  "Kmart",
  "BIG W",
  "Target",
  "Pokémon Center",
  "Premium Bandai Australia",
  "Premium Bandai Singapore",
  "Mattel Creations",
  "OzWheels",
  "Gamersroom",
  "Finalmouse",
  "Nike",
  "Ultra Football",
  "Amazon US",
  "Amazon Japan",
  "Kinokuniya",
];

const PURCHASE_SOURCE_ALIASES = new Map([
  ["eb games", "EB Games"],
  ["ebgames", "EB Games"],
  ["jb hi-fi", "JB Hi-Fi"],
  ["jb hifi", "JB Hi-Fi"],
  ["jbhifi", "JB Hi-Fi"],
  ["big w", "BIG W"],
  ["bigw", "BIG W"],
  ["pokemon center", "Pokémon Center"],
  ["pokémon center", "Pokémon Center"],
  ["premium bandai au", "Premium Bandai Australia"],
  ["premium bandai australia", "Premium Bandai Australia"],
  ["premium bandai sg", "Premium Bandai Singapore"],
  ["premium bandai singapore", "Premium Bandai Singapore"],
  ["amazon au", "Amazon AU"],
  ["amazon us", "Amazon US"],
  ["amazon japan", "Amazon Japan"],
]);

const canonicalPurchaseSource = (value = "") => {
  const source = String(value || "").trim();
  if (!source) return "";
  return PURCHASE_SOURCE_ALIASES.get(source.toLowerCase()) || source;
};

const purchaseSourceFor = (record = {}) => canonicalPurchaseSource(record.purchaseSource) || "Unknown";
const releaseExpectedDateFor = (record = {}) => record.releaseExpectedDate || record.preorderDate || "";
const explicitAvailabilityFor = (record = {}) => ["preorder", "available"].includes(record.availability) ? record.availability : "";
const isPreorderOrigin = (record = {}) => Boolean(record.preorderOrigin || record.preorderDate || explicitAvailabilityFor(record) === "preorder");
const isInventoryAvailable = (record = {}, todayKey = "") => {
  const availability = explicitAvailabilityFor(record);
  if (availability === "available") return true;
  const releaseDate = releaseExpectedDateFor(record);
  if (availability === "preorder") return Boolean(releaseDate && releaseDate <= todayKey);
  return !releaseDate || releaseDate <= todayKey;
};
const isUnreleasedPreorder = (record = {}, todayKey = "") => !isInventoryAvailable(record, todayKey);
const inventoryAgeStart = (record = {}) => {
  const releaseDate = releaseExpectedDateFor(record);
  return isPreorderOrigin(record) && releaseDate ? releaseDate : (record.purchaseDate || "");
};

const customerKey = (name = "") => String(name || "").trim().toLowerCase().replace(/\s+/g, " ") || "unknown";

const listedPlatformsFor = (item = {}) => Array.isArray(item.listedPlatforms) ? item.listedPlatforms.filter(Boolean) : [];

const platformShortName = (platform = "") => {
  const p = String(platform).toLowerCase();
  if (p.includes("facebook")) return "FB";
  if (p.includes("ebay")) return "eBay";
  if (p.includes("instagram")) return "IG";
  return String(platform || "Listed").replace(/\s+marketplace/i, "");
};

const explicitOrderIdForSale = (sale = {}) => {
  const direct = sale.orderId || sale.order_id || sale.ebayOrderId || sale.ebay_order_id;
  if (direct) return String(direct).trim();
  const tags = String(sale.tags || "");
  const ebayMatch = tags.match(/\bebay\s+([a-z0-9-]{6,})\b/i);
  if (ebayMatch) return ebayMatch[1];
  const orderMatch = tags.match(/\border[:#\s-]*([a-z0-9-]{6,})\b/i);
  return orderMatch ? orderMatch[1] : "";
};

const orderKeyForSale = (sale = {}) => {
  const platform = platformShortName(sale.platform || "Other").toLowerCase();
  const explicitOrderId = explicitOrderIdForSale(sale);
  if (explicitOrderId) return `${platform}:order:${explicitOrderId.toLowerCase()}`;

  const customer = customerKey(sale.customer);
  if (customer === "unknown") return `sale:${sale.id || `${platform}:${sale.name || ""}:${sale.saleDate || ""}`}`;

  return `${platform}:manual:${customer}:${sale.saleDate || "undated"}`;
};

const sortedListedPlatformsFor = (item = {}) => {
  const items = Array.isArray(item._items) ? item._items : [item];
  const platforms = new Map();
  items.forEach((source) => {
    listedPlatformsFor(source).forEach((platform) => {
      const key = platformShortName(platform).toLowerCase();
      if (!platforms.has(key)) platforms.set(key, platform);
    });
  });
  return [...platforms.values()].sort((a, b) => (
    platformShortName(a).localeCompare(platformShortName(b), undefined, { sensitivity: "base" }) ||
    String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
  ));
};

const parseSizeParts = (size = "") => {
  const raw = String(size || "OS").trim();
  const apparelOrder = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  const apparelIndex = apparelOrder.indexOf(raw.toUpperCase());
  if (apparelIndex >= 0) return { type: "apparel", value: apparelIndex, label: raw };
  const numeric = raw.match(/^(.*?)(\d+(?:\.\d+)?)\s*$/);
  if (numeric) return { type: "numeric", prefix: numeric[1].trim().toUpperCase(), value: Number(numeric[2]), label: raw };
  if (raw.toUpperCase() === "OS") return { type: "os", value: 0, label: raw };
  return { type: "text", value: raw.toLowerCase(), label: raw };
};

const compareSizeValues = (a = "", b = "", category = "") => {
  const sizes = getSizes(category);
  const ai = sizes.indexOf(a || "OS");
  const bi = sizes.indexOf(b || "OS");
  if (ai >= 0 && bi >= 0) return ai - bi;
  const pa = parseSizeParts(a);
  const pb = parseSizeParts(b);
  const typeOrder = { numeric: 0, apparel: 1, os: 2, text: 3 };
  if (pa.type !== pb.type) return (typeOrder[pa.type] ?? 9) - (typeOrder[pb.type] ?? 9);
  if (pa.type === "numeric") return pa.prefix.localeCompare(pb.prefix) || pa.value - pb.value;
  if (typeof pa.value === "number" && typeof pb.value === "number") return pa.value - pb.value;
  return String(pa.value).localeCompare(String(pb.value), undefined, { numeric: true, sensitivity: "base" });
};

const compareInventorySize = (a = {}, b = {}) => (
  compareSizeValues(a.size || "OS", b.size || "OS", a.category || b.category || "") ||
  (Number(a.price) || 0) - (Number(b.price) || 0) ||
  (a.purchaseDate || "").localeCompare(b.purchaseDate || "") ||
  String(a.id || "").localeCompare(String(b.id || ""))
);

export {
  PURCHASE_SOURCES,
  canonicalPurchaseSource,
  compareInventorySize,
  compareSizeValues,
  customerKey,
  explicitAvailabilityFor,
  inventoryAgeStart,
  isInventoryAvailable,
  isPreorderOrigin,
  isUnreleasedPreorder,
  listedPlatformsFor,
  orderKeyForSale,
  platformShortName,
  purchaseSourceFor,
  releaseExpectedDateFor,
  sortedListedPlatformsFor,
};
