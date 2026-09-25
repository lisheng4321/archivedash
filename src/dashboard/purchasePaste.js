import { canonicalPurchaseSource } from "./inventory.js";
import { getDefaultSize, getSizes } from "./shared/constants.js";

const aliases = {
  name: ["product", "product name", "item", "item name", "name"],
  quantity: ["quantity", "qty", "units"],
  price: ["landed cost per unit", "landed cost / unit", "unit landed cost", "unit cost", "cost per unit", "price per unit"],
  purchaseSource: ["retailer", "source", "purchase source"],
  purchasedBy: ["purchased by", "account", "profile", "email"],
  category: ["category"], brand: ["brand"], size: ["size"],
  purchaseDate: ["purchase date", "date"],
  releaseExpectedDate: ["release date", "expected date", "release / expected date"],
  availability: ["availability", "status"], tags: ["tags"],
};
const normalizeHeader = (value) => value.toLowerCase().replace(/\*\*/g, "").replace(/\s*\((?:au\$|aud|\$)\)/g, "").trim();

function splitRow(line, delimiter) {
  const cells = [];
  let cell = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const character = line[i];
    if (delimiter === "|" && character === "\\" && line[i + 1] === "|") { cell += "|"; i++; }
    else if (character === '"' && delimiter !== "|") {
      if (quoted && line[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell.trim()) quoted = !quoted;
      else cell += character;
    } else if (character === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += character;
  }
  if (quoted) throw new Error("Unclosed quoted cell. Keep each product on one line.");
  cells.push(cell.trim());
  return cells;
}

function parseDate(value) {
  let date = value;
  const local = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (local) date = `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

export function parsePurchasePaste(text, defaults, categories) {
  const errors = [], rows = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows, errors };
  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes("|") ? "|" : ",";
  const read = (line) => splitRow(delimiter === "|" ? line.trim().replace(/^\|/, "").replace(/\|$/, "") : line, delimiter);
  let headers;
  try { headers = read(lines[0]); } catch (error) { return { rows, errors: [error.message] }; }
  const fields = headers.map((header) => Object.keys(aliases).find((field) => aliases[field].includes(normalizeHeader(header))));
  headers.forEach((header, i) => { if (!fields[i]) errors.push(`Unrecognised column “${header}”. Use the example headers; costs must be per unit.`); });
  for (const field of ["name", "quantity", "price"]) if (!fields.includes(field)) errors.push(`Missing ${aliases[field][0]} column.`);
  if (new Set(fields).size !== fields.length) errors.push("Each column must appear only once.");
  if (errors.length) return { rows, errors };
  const data = lines.slice(1).filter((line) => !(delimiter === "|" && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line)));
  if (!data.length) return { rows, errors: ["Add at least one product below the header."] };
  if (data.length > 200) return { rows, errors: ["Paste up to 200 product rows at a time."] };
  data.forEach((line, index) => {
    const prefix = `Row ${index + 1}: `;
    let cells;
    try { cells = read(line); } catch (error) { errors.push(prefix + error.message); return; }
    if (cells.length !== fields.length) { errors.push(prefix + "the number of cells does not match the header."); return; }
    const supplied = Object.fromEntries(fields.map((field, i) => [field, cells[i]]));
    const draft = { ...defaults, name: "", price: "", quantity: "", listedPlatforms: [], ebayListedPrice: "", customer: "", tags: "" };
    Object.entries(supplied).forEach(([field, value]) => { if (value || ["name", "price", "quantity"].includes(field)) draft[field] = value; });
    draft.name = String(draft.name).replace(/^\*\*|\*\*$/g, "").trim();
    const rawCost = String(draft.price).replace(/^(?:AU\$|AUD\s*|\$)\s*/i, "").trim();
    const costValid = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(rawCost);
    draft.price = Number(rawCost.replace(/,/g, ""));
    draft.quantity = Number(draft.quantity);
    if (!draft.name) errors.push(prefix + "enter a product name.");
    if (!Number.isSafeInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 5000) errors.push(prefix + "quantity must be a whole number from 1 to 5,000.");
    if (!costValid || !Number.isFinite(draft.price)) errors.push(prefix + "landed cost per unit must be a number of zero or more.");
    const category = categories.find((item) => item.toLowerCase() === String(draft.category).toLowerCase());
    if (!category) errors.push(prefix + `unknown category “${draft.category}”.`);
    else draft.category = category;
    if (!supplied.size) draft.size = supplied.category ? getDefaultSize(draft.category) : (defaults.size || getDefaultSize(draft.category));
    if (!getSizes(draft.category).includes(draft.size)) errors.push(prefix + `invalid size “${draft.size}” for ${draft.category}.`);
    const statuses = { available: "available", preorder: "preorder", preorders: "preorder", "in transit": "in_transit", in_transit: "in_transit", "awaiting dispatch": "in_transit" };
    draft.availability = statuses[String(draft.availability).toLowerCase()];
    if (!draft.availability) errors.push(prefix + "status must be Available, In transit or Preorder.");
    for (const field of ["purchaseDate", "releaseExpectedDate"]) {
      if (!draft[field] && field === "releaseExpectedDate") continue;
      const parsed = parseDate(String(draft[field] || ""));
      if (!parsed) errors.push(prefix + `${field === "purchaseDate" ? "purchase date" : "release date"} must be a valid YYYY-MM-DD or DD/MM/YYYY date.`);
      else draft[field] = parsed;
    }
    draft.purchaseSource = canonicalPurchaseSource(draft.purchaseSource);
    rows.push(draft);
  });
  if (rows.reduce((sum, row) => sum + (Number.isFinite(row.quantity) ? row.quantity : 0), 0) > 5000) errors.push("Paste up to 5,000 units per batch.");
  return { rows, errors };
}
