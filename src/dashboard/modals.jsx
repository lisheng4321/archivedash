import { useEffect, useMemo, useRef, useState } from "react";
import { DEF_CATEGORIES, getDefaultSize, getSizes, EBAY_AU_FEE_RATE, EBAY_AU_FIXED_ORDER_FEE, FONT_SIZES, TEMPLATES, FREQ_OPTIONS, FREQ_LABEL, CURRENCY_OPTIONS, SUB_CATEGORIES, renderTemplate, sanitizeHtml, stripHtml, genId, formatMoney, currency, computeProfit, estimateEbayFee, today, frequencyLabel, subAmountAud, subMonthlyAud, inp, sel, primaryBtn, ghostBtn, cb, badge, Modal, UnsavedDialog, Field, Row } from "./shared.jsx";

// ─── Edit Inv Modal ───
function EditInvModal({ item, onSave, onClose, categories, customers, platforms = [] }) {
  const [ef, setEf] = useState({ name: item.name, category: item.category, size: item.size || getDefaultSize(item.category), price: item.price, ebayListedPrice: item.ebayListedPrice || "", brand: item.brand || "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate || "", listedPlatforms: Array.isArray(item.listedPlatforms) ? item.listedPlatforms : [], tags: item.tags || "", customer: item.customer || "" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const listed = Array.isArray(ef.listedPlatforms) ? ef.listedPlatforms : [];
  const toggleListedPlatform = (platform, checked) => {
    const next = new Set(listed);
    checked ? next.add(platform) : next.delete(platform);
    up({ listedPlatforms: [...next] });
  };
  const gc = () => { setShowU(true); };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit item">
    <Field label="Product name" req><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field>
    <Row cols={3}><Field label="Category"><select value={ef.category} onChange={(e) => up({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Size"><select value={ef.size} onChange={(e) => up({ size: e.target.value })} style={sel}>{getSizes(ef.category).map((s) => <option key={s}>{s}</option>)}</select></Field>
    <Field label="Cost (AU$)"><input type="number" step="0.01" value={ef.price} onChange={(e) => up({ price: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field><Field label="Purchase date"><input type="date" value={ef.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Preorder date"><input type="date" value={ef.preorderDate} onChange={(e) => up({ preorderDate: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={ef.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <Field label="Listed on"><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{platforms.map((p) => <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}><input type="checkbox" checked={listed.includes(p)} onChange={(e) => toggleListedPlatform(p, e.target.checked)} style={cb} /> {p}</label>)}</div></Field>
    {listed.some((p) => String(p).toLowerCase().includes("ebay")) && <Field label="eBay listed price (AU$)"><input type="number" step="0.01" value={ef.ebayListedPrice || ""} onChange={(e) => up({ ebayListedPrice: e.target.value })} style={inp} placeholder="Current eBay listing price" /></Field>}
    <Field label="Customer"><input list="cust-list" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-list">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...ef, price: parseFloat(ef.price), ebayListedPrice: ef.ebayListedPrice ? parseFloat(ef.ebayListedPrice) : undefined })} style={primaryBtn}>Save</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Edit Sale Modal ───
function EditSaleModal({ sale, onSave, onClose, platforms, customers }) {
  const [ef, setEf] = useState({ name: sale.name, category: sale.category, costPrice: sale.costPrice, salePrice: sale.salePrice, shippingPrice: sale.shippingPrice, platformFees: sale.platformFees, platform: sale.platform, saleDate: sale.saleDate, tags: sale.tags || "", brand: sale.brand || "", customer: sale.customer || "" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const gc = () => { setShowU(true); };
  const sp = parseFloat(ef.salePrice)||0, ship = parseFloat(ef.shippingPrice)||0, fees = parseFloat(ef.platformFees)||0, cost = parseFloat(ef.costPrice)||0;
  const preview = computeProfit({ salePrice: sp, cost, shipping: ship, fees });
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{ef.name}</div><div style={{ fontSize: 12, color: "#56627a" }}>{ef.category} · {sale.size || "OS"}{sale.brand ? ` · ${sale.brand}` : ""}</div></div>
    <Row><Field label="Item name"><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field><Field label="Cost (AU$)"><input type="number" step="0.01" value={ef.costPrice} onChange={(e) => up({ costPrice: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Sale price (AU$)" req><input type="number" step="0.01" value={ef.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={ef.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={ef.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} /></Field><Field label="Fees"><input type="number" step="0.01" value={ef.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} /></Field><Field label="Platform"><select value={ef.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-list2" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} /><datalist id="cust-list2">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(cost)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...sale, ...ef, costPrice: cost, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: preview })} style={primaryBtn}>Save</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Sell Modal ───
function SellModal({ item, onSell, onClose, platforms, customers }) {
  const [sf, setSf] = useState({ platform: platforms[0]||"Other", salePrice: "", shippingPrice: "", platformFees: "", saleDate: today(), tags: "", customer: "" });
  const [dirty, setDirty] = useState(false); const [showU, setShowU] = useState(false);
  const up = (u) => { setSf({ ...sf, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const sp = parseFloat(sf.salePrice)||0, ship = parseFloat(sf.shippingPrice)||0, fees = parseFloat(sf.platformFees)||0;
  const preview = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Create a new sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{item.name}</div><div style={{ fontSize: 12, color: "#56627a" }}>Cost: {currency(item.price)} · {item.category} · {item.size||"OS"}{item.brand ? ` · ${item.brand}` : ""}</div></div>
    <Row><Field label="Sale price" req><input type="number" step="0.01" value={sf.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} placeholder="0" autoFocus /></Field><Field label="Sale date"><input type="date" value={sf.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={sf.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Fees"><input type="number" step="0.01" value={sf.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Platform" req><select value={sf.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-sell" value={sf.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-sell">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    {sp > 0 && <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(item.price)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </div>}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!sf.salePrice) return; onSell(sf); }} style={primaryBtn}>Create sale</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Bulk Edit Modal ───
function BulkEditModal({ items, onSave, onClose, categories, platforms = [] }) {
  const [nameSet, setNameSet] = useState("");
  const [titleFind, setTitleFind] = useState("");
  const [titleReplace, setTitleReplace] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [titleSuffix, setTitleSuffix] = useState("");
  const [cat, setCat] = useState("");
  const [size, setSize] = useState("");
  const [cost, setCost] = useState("");
  const [brand, setBrand] = useState("");
  const [clearBrand, setClearBrand] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [preorderDate, setPreorderDate] = useState("");
  const [clearPreorderDate, setClearPreorderDate] = useState(false);
  const [customer, setCustomer] = useState("");
  const [clearCustomer, setClearCustomer] = useState(false);
  const [setTags, setSetTags] = useState("");
  const [addTags, setAddTags] = useState("");
  const [clearTags, setClearTags] = useState(false);
  const [ebayListedPrice, setEbayListedPrice] = useState("");
  const [clearEbayListedPrice, setClearEbayListedPrice] = useState(false);
  const [addListedPlatform, setAddListedPlatform] = useState("");
  const [clearListingPlatforms, setClearListingPlatforms] = useState(false);
  const [showU, setShowU] = useState(false);
  const sizes = cat ? getSizes(cat) : [...new Set(items.flatMap((item) => getSizes(item.category || "")))];
  const totalValue = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const productCount = new Set(items.map((item) => String(item.name || "").trim().toLowerCase()).filter(Boolean)).size;
  const listedCount = items.filter((item) => Array.isArray(item.listedPlatforms) && item.listedPlatforms.length > 0).length;
  const withEbayPrice = items.filter((item) => item.ebayListedPrice !== undefined && item.ebayListedPrice !== "").length;
  const summarize = (values, empty = "Mixed") => {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return empty;
    const extra = counts.size - top.length;
    return `${top.map(([value, count]) => `${value} (${count})`).join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
  };
  const summaryRows = [
    ["Units", items.length],
    ["Products", productCount],
    ["Value", currency(totalValue)],
    ["Categories", summarize(items.map((item) => item.category), "None")],
    ["Brands", summarize(items.map((item) => item.brand), "None")],
    ["Listed", `${listedCount} units`],
    ["eBay price", `${withEbayPrice} units`],
  ];
  const previewNames = [...new Set(items.map((item) => item.name).filter(Boolean))].slice(0, 5);
  const hasDraft = [nameSet, titleFind, titleReplace, titlePrefix, titleSuffix, cat, size, cost, brand, purchaseDate, preorderDate, customer, setTags, addTags, ebayListedPrice, addListedPlatform].some((value) => String(value || "").length > 0) || clearBrand || clearPreorderDate || clearCustomer || clearTags || clearEbayListedPrice || clearListingPlatforms;
  const requestClose = () => { if (hasDraft) setShowU(true); else onClose(); };
  const apply = () => {
    const updates = {};
    if (nameSet.trim()) updates.nameSet = nameSet.trim();
    if (titleFind) updates.titleFind = titleFind;
    if (titleReplace) updates.titleReplace = titleReplace;
    if (titlePrefix) updates.titlePrefix = titlePrefix;
    if (titleSuffix) updates.titleSuffix = titleSuffix;
    if (cat) updates.category = cat;
    if (size) updates.size = size;
    if (cost !== "") updates.price = parseFloat(cost);
    if (clearBrand) updates.brand = "";
    else if (brand) updates.brand = brand;
    if (purchaseDate) updates.purchaseDate = purchaseDate;
    if (clearPreorderDate) updates.preorderDate = "";
    else if (preorderDate) updates.preorderDate = preorderDate;
    if (clearCustomer) updates.customer = "";
    else if (customer) updates.customer = customer;
    if (clearTags) updates.clearTags = true;
    if (setTags) updates.setTags = setTags;
    if (addTags) updates.addTags = addTags;
    if (clearEbayListedPrice) updates.ebayListedPrice = undefined;
    else if (ebayListedPrice !== "") updates.ebayListedPrice = parseFloat(ebayListedPrice);
    if (addListedPlatform) updates.addListedPlatform = addListedPlatform;
    if (clearListingPlatforms) updates.clearListingPlatforms = true;
    onSave(updates);
  };
  return (<><Modal open={true} onClose={onClose} guardedClose={requestClose} title={`Bulk edit ${items.length} items`} maxWidth={980}>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 560px", minWidth: 0 }}>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
    <Field label="Set product title"><input value={nameSet} onChange={(e) => setNameSet(e.target.value)} style={inp} placeholder="Same title for all selected" /></Field>
    <Row><Field label="Find in title"><input value={titleFind} onChange={(e) => setTitleFind(e.target.value)} style={inp} placeholder="Text to replace" /></Field>
    <Field label="Replace with"><input value={titleReplace} onChange={(e) => setTitleReplace(e.target.value)} style={inp} placeholder="Replacement text" /></Field></Row>
    <Row><Field label="Title prefix"><input value={titlePrefix} onChange={(e) => setTitlePrefix(e.target.value)} style={inp} placeholder="Add before title" /></Field>
    <Field label="Title suffix"><input value={titleSuffix} onChange={(e) => setTitleSuffix(e.target.value)} style={inp} placeholder="Add after title" /></Field></Row>
    <Row cols={3}><Field label="Category"><select value={cat} onChange={(e) => { setCat(e.target.value); setSize(""); }} style={sel}><option value="">No change</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Size"><select value={size} onChange={(e) => setSize(e.target.value)} style={sel}><option value="">No change</option>{sizes.map((s) => <option key={s}>{s}</option>)}</select></Field>
    <Field label="Cost (AU$)"><input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} style={inp} placeholder="No change" /></Field></Row>
    <Row><Field label="Brand"><input value={brand} onChange={(e) => { setBrand(e.target.value); if (e.target.value) setClearBrand(false); }} style={inp} placeholder="No change" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearBrand} onChange={(e) => { setClearBrand(e.target.checked); if (e.target.checked) setBrand(""); }} style={cb} /> Clear brand</label></Field></Row>
    <Row cols={3}><Field label="Purchase date"><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} style={inp} /></Field>
    <Field label="Preorder date"><input type="date" value={preorderDate} onChange={(e) => { setPreorderDate(e.target.value); if (e.target.value) setClearPreorderDate(false); }} style={inp} /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearPreorderDate} onChange={(e) => { setClearPreorderDate(e.target.checked); if (e.target.checked) setPreorderDate(""); }} style={cb} /> Clear preorder</label></Field></Row>
    <Row><Field label="Customer"><input value={customer} onChange={(e) => { setCustomer(e.target.value); if (e.target.value) setClearCustomer(false); }} style={inp} placeholder="No change" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearCustomer} onChange={(e) => { setClearCustomer(e.target.checked); if (e.target.checked) setCustomer(""); }} style={cb} /> Clear customer</label></Field></Row>
    <Row cols={3}><Field label="Set tags"><input value={setTags} onChange={(e) => { setSetTags(e.target.value); if (e.target.value) setClearTags(false); }} style={inp} placeholder="Replace tags" /></Field>
    <Field label="Add tags"><input value={addTags} onChange={(e) => setAddTags(e.target.value)} style={inp} placeholder="Append tags" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearTags} onChange={(e) => { setClearTags(e.target.checked); if (e.target.checked) setSetTags(""); }} style={cb} /> Clear tags</label></Field></Row>
    <Row><Field label="Add listed platform"><select value={addListedPlatform} onChange={(e) => setAddListedPlatform(e.target.value)} style={sel}><option value="">No change</option>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearListingPlatforms} onChange={(e) => setClearListingPlatforms(e.target.checked)} style={cb} /> Clear listed platforms</label></Field></Row>
    <Row><Field label="eBay listed price (AU$)"><input type="number" step="0.01" value={ebayListedPrice} onChange={(e) => { setEbayListedPrice(e.target.value); if (e.target.value) setClearEbayListedPrice(false); }} style={inp} placeholder="No change" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearEbayListedPrice} onChange={(e) => { setClearEbayListedPrice(e.target.checked); if (e.target.checked) setEbayListedPrice(""); }} style={cb} /> Clear listed price</label></Field></Row>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={requestClose} style={ghostBtn}>Cancel</button>
    <button onClick={apply} style={primaryBtn}>Apply to {items.length} items</button></div>
      </div>
      <aside style={{ flex: "0 1 240px", position: "sticky", top: 0, background: "#0d1117", border: "1px solid #232c3c", borderRadius: 10, padding: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.25)" }}>
        <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Selection summary</div>
        <div style={{ display: "grid", gap: 8 }}>
          {summaryRows.map(([label, value]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "76px 1fr", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: "#56627a", fontSize: 11 }}>{label}</span>
              <span style={{ color: "#d1d5db", fontSize: 12, fontWeight: 650, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
            </div>
          ))}
        </div>
        {previewNames.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #232c3c" }}>
            <div style={{ color: "#56627a", fontSize: 11, marginBottom: 6 }}>Titles</div>
            <div style={{ display: "grid", gap: 5 }}>
              {previewNames.map((name) => <div key={name} title={name} style={{ color: "#9ca3af", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>)}
              {productCount > previewNames.length && <div style={{ color: "#56627a", fontSize: 11 }}>+{productCount - previewNames.length} more</div>}
            </div>
          </div>
        )}
      </aside>
    </div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Edit Expense Modal ───
function EditExpModal({ expense, onSave, onClose }) {
  const [ef, setEf] = useState({ name: expense.name, amount: expense.amount, purchaseDate: expense.purchaseDate, tags: expense.tags || "", expCategory: expense.expCategory || "Other" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const gc = () => { setShowU(true); };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit expense">
    <Field label="Name" req><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field>
    <Row><Field label="Amount (AU$)" req><input type="number" step="0.01" value={ef.amount} onChange={(e) => up({ amount: e.target.value })} style={inp} /></Field><Field label="Date"><input type="date" value={ef.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Category"><select value={ef.expCategory} onChange={(e) => up({ expCategory: e.target.value })} style={sel}>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Tags"><input value={ef.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...expense, ...ef, amount: parseFloat(ef.amount) })} style={primaryBtn}>Save</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Bulk Edit Expense Modal ───
function BulkEditExpModal({ items, onSave, onClose }) {
  const [cat, setCat] = useState("");
  return (<Modal open={true} onClose={onClose} title={`Bulk edit ${items.length} expenses`}>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave blank to keep current values.</p>
    <Field label="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}><option value="">— No change —</option>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={onClose} style={ghostBtn}>Cancel</button>
    <button onClick={() => { const updates = {}; if (cat) updates.expCategory = cat; onSave(updates); }} style={primaryBtn}>Apply to {items.length} expenses</button></div>
  </Modal>);
}

// ─── Bulk Edit Sale Modal ───
function BulkEditSaleModal({ items, onSave, onClose, platforms }) {
  const [plat, setPlat] = useState(""); const [cat, setCat] = useState("");
  const totalProfit = items.reduce((a, s) => a + s.profit, 0);
  const totalRevenue = items.reduce((a, s) => a + s.salePrice, 0);
  return (<Modal open={true} onClose={onClose} title={`Bulk edit ${items.length} sales`}>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Selected</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{items.length} sales</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </div>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
    <Row><Field label="Platform"><select value={plat} onChange={(e) => setPlat(e.target.value)} style={sel}><option value="">— No change —</option>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field>
    <Field label="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}><option value="">— No change —</option>{DEF_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field></Row>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={onClose} style={ghostBtn}>Cancel</button>
    <button onClick={() => { const updates = {}; if (plat) updates.platform = plat; if (cat) updates.category = cat; onSave(updates); }} style={primaryBtn}>Apply to {items.length} sales</button></div>
  </Modal>);
}

// ─── Bulk Sell Modal ───
function BulkSellModal({ items, onSell, onClose, platforms, customers }) {
  const [shared, setShared] = useState({ platform: platforms[0]||"Other", saleDate: today(), customer: "" });
  const [rows, setRows] = useState(items.map((i) => ({ id: i.id, salePrice: "", shippingPrice: "", platformFees: "" })));
  const [showU, setShowU] = useState(false);
  const gc = () => setShowU(true);
  const updateRow = (id, u) => setRows(rows.map((r) => r.id === id ? { ...r, ...u } : r));

  const previews = items.map((item) => {
    const r = rows.find((x) => x.id === item.id) || {};
    const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
    return { ...item, sp, ship, fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }) };
  });
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const allPriced = previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={`Sell ${items.length} items`}>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Items</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{items.length}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Total profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </div>
    <Row cols={3}><Field label="Platform" req><select value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input list="cust-bulk" value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-bulk">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field></Row>
    <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 8, marginTop: 4 }}>Per-item pricing</div>
    <div style={{ maxHeight: 280, overflowY: "auto", borderRadius: 8, border: "1px solid #232c3c" }}>
      {items.map((item) => {
        const r = rows.find((x) => x.id === item.id) || {};
        const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
        const profit = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
        return (<div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c44", background: "#0d1117" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div><span style={{ color: "#e5e7eb", fontSize: 13 }}>{item.name}</span><span style={{ fontSize: 11, color: "#7c8aa0", marginLeft: 6 }}>{item.size||"OS"}</span></div>
            <span style={{ fontSize: 11, color: "#7c8aa0" }}>Cost: {currency(item.price)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", gap: 6, alignItems: "center" }}>
            <input type="number" step="0.01" placeholder="Sale $" value={r.salePrice} onChange={(e) => updateRow(item.id, { salePrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            <input type="number" step="0.01" placeholder="Ship $" value={r.shippingPrice} onChange={(e) => updateRow(item.id, { shippingPrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            <input type="number" step="0.01" placeholder="Fees $" value={r.platformFees} onChange={(e) => updateRow(item.id, { platformFees: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: sp>0?(profit>=0?"#34d399":"#f87171"):"#374151", textAlign: "right" }}>{sp>0?currency(profit):"—"}</span>
          </div>
        </div>);
      })}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!allPriced) return; onSell(shared, rows); }} style={{ ...primaryBtn, opacity: allPriced?1:0.5 }}>Sell {items.length} items</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Reusable rich-text notepad editor ───
// Used by both the full notepad page and the slide-out quick-access panel.
// contentEditable-based, supports B/I/U/bullets via execCommand, plus
// custom buttons for insert-checkbox, template insert, font sizing, and export.
function ManualSaleModal({ inventory, onSell, onClose, platforms, customers }) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [shared, setShared] = useState({ platform: platforms[0]||"Other", saleDate: today(), customer: "" });
  const [rows, setRows] = useState({});
  const [showU, setShowU] = useState(false);
  const gc = () => setShowU(true);
  const q = query.trim().toLowerCase();
  const filtered = inventory
    .filter((item) => !q || [item.name, item.brand, item.category, item.tags, item.customer].some((v) => String(v || "").toLowerCase().includes(q)))
    .slice(0, 80);
  const selectedItems = inventory.filter((item) => selectedIds.has(item.id));
  const toggle = (item) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    setRows((prev) => prev[item.id] ? prev : { ...prev, [item.id]: { salePrice: "", shippingPrice: "", platformFees: "" } });
  };
  const updateRow = (id, u) => setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...u } }));
  const preparedRows = selectedItems.map((item) => ({ id: item.id, ...(rows[item.id] || {}) }));
  const previews = selectedItems.map((item) => {
    const r = rows[item.id] || {};
    const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
    return { ...item, sp, ship, fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }) };
  });
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const allPriced = selectedItems.length > 0 && previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Add Sale" maxWidth={980}>
    <Row cols={3}><Field label="Platform" req><select value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input list="cust-manual-sale" value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-manual-sale">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Selected</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </div>
    <Field label="Search inventory"><input value={query} onChange={(e) => setQuery(e.target.value)} style={inp} placeholder="Search name, brand, category..." autoFocus /></Field>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 0.95fr) minmax(500px, 1.3fr)", gap: 14, minHeight: 360 }}>
      <div style={{ border: "1px solid #232c3c", borderRadius: 8, overflow: "auto", maxHeight: 360, background: "#0d1117" }}>
        {filtered.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#56627a", fontSize: 12 }}>No inventory matches.</div>}
        {filtered.map((item, index) => {
          const checked = selectedIds.has(item.id);
          return (
            <div key={item.id} onClick={() => toggle(item)} style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #232c3c22", background: checked ? "#1e293b" : (index % 2 === 0 ? "#0d131f" : "#121a2b") }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(item)} onClick={(e) => e.stopPropagation()} style={cb} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ color: "#7c8aa0", fontSize: 10 }}>{item.category}{item.brand ? ` · ${item.brand}` : ""} · {item.size || "OS"}</div>
              </div>
              <div style={{ color: "#f3f6fb", fontSize: 12, fontWeight: 700 }}>{currency(item.price)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ border: "1px solid #232c3c", borderRadius: 8, overflow: "auto", maxHeight: 360, background: "#0d1117" }}>
        {selectedItems.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#56627a", fontSize: 12 }}>Select inventory to price the sale.</div>}
        {selectedItems.map((item) => {
          const r = rows[item.id] || {};
          const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
          const profit = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
          return (
            <div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c44", background: "#0d1117" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div><div style={{ fontSize: 10, color: "#7c8aa0" }}>Cost {currency(item.price)}</div></div>
                <button onClick={() => toggle(item)} style={{ ...ghostBtn, padding: "3px 7px", fontSize: 11, color: "#f87171" }}>Remove</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(120px, 1fr)) 92px", gap: 8, alignItems: "end" }}>
                <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Sale</div><input type="number" step="0.01" placeholder="Sale price" value={r.salePrice || ""} onChange={(e) => updateRow(item.id, { salePrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "7px 9px" }} /></div>
                <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Shipping</div><input type="number" step="0.01" placeholder="Shipping" value={r.shippingPrice || ""} onChange={(e) => updateRow(item.id, { shippingPrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "7px 9px" }} /></div>
                <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Fees</div><input type="number" step="0.01" placeholder="Fees" value={r.platformFees || ""} onChange={(e) => updateRow(item.id, { platformFees: e.target.value })} style={{ ...inp, fontSize: 12, padding: "7px 9px" }} /></div>
                <span style={{ fontSize: 12, fontWeight: 700, color: sp>0?(profit>=0?"#34d399":"#f87171"):"#374151", textAlign: "right", paddingBottom: 8 }}>{sp>0?currency(profit):"—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!allPriced) return; onSell(selectedItems, shared, preparedRows); }} style={{ ...primaryBtn, opacity: allPriced?1:0.5 }}>Record {selectedItems.length || ""} Sale{selectedItems.length === 1 ? "" : "s"}</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

function EbaySaleReviewModal({ draft, items, onRecord, onClose }) {
  const qty = Math.max(1, Number(draft.quantity || 1));
  const saleTotal = Number(draft.sale_price || 0);
  const shipTotal = Number(draft.shipping_price || 0);
  const rawFeeTotal = Number(draft.platform_fees || 0);
  const feeTotal = rawFeeTotal > 0 ? rawFeeTotal : estimateEbayFee(saleTotal);
  const [shared, setShared] = useState({
    platform: "eBay AU",
    saleDate: draft.sale_date || today(),
    customer: draft.buyer_username || "",
  });
  const [rows, setRows] = useState(items.map((item) => ({
    id: item.id,
    salePrice: (saleTotal / qty).toFixed(2),
    shippingPrice: (shipTotal / qty).toFixed(2),
    platformFees: (feeTotal / qty).toFixed(2),
  })));
  const [showU, setShowU] = useState(false);
  const updateRow = (id, u) => setRows(rows.map((r) => r.id === id ? { ...r, ...u } : r));
  const previews = items.map((item) => {
    const r = rows.find((x) => x.id === item.id) || {};
    const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
    return { ...item, sp, ship, fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }) };
  });
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const totalShip = previews.reduce((a, p) => a + p.ship, 0);
  const totalFees = previews.reduce((a, p) => a + p.fees, 0);
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const allPriced = previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={() => setShowU(true)} title="Review eBay Sale">
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{draft.item_title}</div>
      <div style={{ color: "#7c8aa0", fontSize: 11 }}>Order {draft.order_id || "unknown"} · qty {qty} · {draft.buyer_username || "Unknown buyer"}</div>
    </div>
    <Row cols={3}><Field label="Platform"><input value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} /></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Shipping</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{currency(totalShip)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Fees</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{currency(totalFees)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 800 }}>{currency(totalProfit)}</div></div>
    </div>
    {rawFeeTotal <= 0 && <div style={{ fontSize: 11, color: "#fbbf24", margin: "-2px 0 10px" }}>Fees are estimated from eBay AU Pro Basic Tier 4 at {(EBAY_AU_FEE_RATE * 100).toFixed(2)}% + {currency(EBAY_AU_FIXED_ORDER_FEE)}. Edit them before recording if eBay shows a different amount.</div>}
    <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 8, border: "1px solid #232c3c" }}>
      {items.map((item) => {
        const r = rows.find((x) => x.id === item.id) || {};
        const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
        const profit = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
        return (<div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c44", background: "#0d1117" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
            <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div><div style={{ color: "#7c8aa0", fontSize: 11 }}>{item.category} · cost {currency(item.price)}</div></div>
            <div style={{ color: profit>=0?"#34d399":"#f87171", fontSize: 13, fontWeight: 800 }}>{currency(profit)}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <Field label="Sale price"><input type="number" step="0.01" value={r.salePrice} onChange={(e) => updateRow(item.id, { salePrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></Field>
            <Field label="Shipping"><input type="number" step="0.01" value={r.shippingPrice} onChange={(e) => updateRow(item.id, { shippingPrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></Field>
            <Field label="Fees"><input type="number" step="0.01" value={r.platformFees} onChange={(e) => updateRow(item.id, { platformFees: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></Field>
          </div>
        </div>);
      })}
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={() => setShowU(true)} style={ghostBtn}>Cancel</button><button onClick={() => { if (!allPriced) return; onRecord(draft, { items, shared, rows }); }} style={{ ...primaryBtn, opacity: allPriced?1:0.5 }}>Record Sale</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

function GmailInventoryReviewModal({ draft, categories, onAdd, onClose }) {
  const defaultCat = categories.includes("Collectables") ? "Collectables" : (categories[0] || "Other");
  const [form, setForm] = useState({
    name: draft.item_title || "",
    category: defaultCat,
    size: getDefaultSize(defaultCat),
    price: draft.unit_cost || draft.total_cost || "",
    quantity: Math.max(1, Number(draft.quantity || 1)),
    purchaseDate: draft.email_date || today(),
    preorderDate: draft.preorder_date || "",
    brand: draft.vendor || "",
    tags: draft.order_reference ? `Gmail ${draft.order_reference}` : "Gmail import",
    customer: "",
  });
  const [showU, setShowU] = useState(false);
  const up = (u) => setForm({ ...form, ...u });
  const total = (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 1);

  return (<><Modal open={true} onClose={onClose} guardedClose={() => setShowU(true)} title="Review Gmail Inventory" maxWidth={720}>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{draft.subject || draft.item_title}</div>
      <div style={{ color: "#7c8aa0", fontSize: 11 }}>{draft.sender || "Unknown sender"} · {draft.email_date || "No date"}</div>
    </div>
    <Field label="Product name" req><input value={form.name} onChange={(e) => up({ name: e.target.value })} style={inp} autoFocus /></Field>
    <Row cols={3}><Field label="Category"><select value={form.category} onChange={(e) => up({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Size"><select value={form.size} onChange={(e) => up({ size: e.target.value })} style={sel}>{getSizes(form.category).map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Unit cost"><input type="number" step="0.01" value={form.price} onChange={(e) => up({ price: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Quantity"><input type="number" min="1" value={form.quantity} onChange={(e) => up({ quantity: e.target.value })} style={inp} /></Field><Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field><Field label="Preorder date"><input type="date" value={form.preorderDate} onChange={(e) => up({ preorderDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Brand / vendor"><input value={form.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={form.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Source</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{draft.vendor || "Gmail"}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Quantity</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{form.quantity || 1}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Total cost</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{currency(total)}</div></div>
    </div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button onClick={() => setShowU(true)} style={ghostBtn}>Cancel</button><button onClick={() => { if (!form.name || !form.price) return; onAdd(draft, form); }} style={primaryBtn}>Add Inventory</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

function NotepadEditor({ note, onUpdate, height = "100%", showTemplates = true, isMobile = false, templates = [], onManageTemplates, onExport, compact = false }) {
  const editorRef = useRef(null);
  const [tplOpen, setTplOpen] = useState(false);
  const lastNoteId = useRef(null);

  // Load fresh HTML when active note changes
  useEffect(() => {
    if (!editorRef.current || !note) return;
    if (lastNoteId.current !== note.id) {
      editorRef.current.innerHTML = sanitizeHtml(note.content || "");
      lastNoteId.current = note.id;
    }
  }, [note?.id]);

  if (!note) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontSize: 13, padding: 20 }}>
        Select or create a note to start writing.
      </div>
    );
  }

  const fontSize = note.fontSize || 14;
  const locked = Boolean(note.locked);
  const updateContent = () => {
    if (locked) return;
    if (editorRef.current) onUpdate({ content: sanitizeHtml(editorRef.current.innerHTML) });
  };

  const exec = (cmd, val = null) => {
    if (locked) return;
    document.execCommand(cmd, false, val);
    updateContent();
  };

  const undoRedo = (cmd) => {
    if (locked || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd);
    requestAnimationFrame(updateContent);
  };

  const insertHtml = (html) => {
    if (locked || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertHTML", false, sanitizeHtml(html));
    updateContent();
  };

  const insertPlainText = (text) => {
    const tmp = document.createElement("div");
    tmp.textContent = text || "";
    insertHtml(tmp.innerHTML.replace(/\n/g, "<br>"));
  };

  const insertCheckbox = () => {
    insertHtml(`<div><label><input type="checkbox"> </label></div>`);
  };

  const insertTemplate = (tpl) => {
    insertHtml(renderTemplate(tpl.body));
    setTplOpen(false);
  };

  const bumpFont = (delta) => {
    if (locked) return;
    const idx = FONT_SIZES.indexOf(fontSize);
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, (idx === -1 ? 2 : idx) + delta));
    onUpdate({ fontSize: FONT_SIZES[nextIdx] });
  };

  // Click handler for any rendered checkbox inside the editor
  const onEditorClick = (e) => {
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "checkbox") {
      if (locked) {
        e.preventDefault();
        return;
      }
      if (t.checked) t.setAttribute("checked", "checked"); else t.removeAttribute("checked");
      requestAnimationFrame(updateContent);
    }
  };

  const onEditorPaste = (e) => {
    e.preventDefault();
    if (locked) return;
    const html = e.clipboardData?.getData("text/html");
    const text = e.clipboardData?.getData("text/plain") || "";
    if (html) insertHtml(html);
    else insertPlainText(text);
  };

  const tBtn = { width: isMobile ? 28 : 30, height: isMobile ? 26 : 28, background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 13, cursor: "pointer", flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height, minHeight: 0 }}>
      <div style={{ display: "flex", gap: isMobile ? 3 : 4, padding: isMobile ? "6px 8px" : "8px 12px", borderBottom: "1px solid #232c3c", flexWrap: "wrap", alignItems: "center" }}>
        <button onMouseDown={(e) => { e.preventDefault(); undoRedo("undo"); }} title="Undo" style={tBtn}>↶</button>
        <button onMouseDown={(e) => { e.preventDefault(); undoRedo("redo"); }} title="Redo" style={tBtn}>↷</button>
        <span style={{ width: 1, height: 18, background: "#232c3c", margin: "0 2px" }} />
        <button onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} title="Bold" style={{ ...tBtn, fontWeight: 800 }}>B</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} title="Italic" style={{ ...tBtn, fontStyle: "italic" }}>I</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} title="Underline" style={{ ...tBtn, textDecoration: "underline" }}>U</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} title="Bullet list" style={{ ...tBtn, fontSize: 16, lineHeight: 1 }}>•</button>
        <button onMouseDown={(e) => { e.preventDefault(); insertCheckbox(); }} title="Insert checkbox" style={{ ...tBtn, fontSize: 12 }}>☑</button>

        {!compact && !isMobile && (<>
          <span style={{ width: 1, height: 18, background: "#232c3c", margin: "0 2px" }} />
          <button onMouseDown={(e) => { e.preventDefault(); bumpFont(-1); }} title="Smaller text" style={{ ...tBtn, fontWeight: 700 }}>A−</button>
          <select disabled={locked} value={fontSize} onChange={(e) => !locked && onUpdate({ fontSize: parseInt(e.target.value) })} title="Font size" style={{ ...sel, height: 28, padding: "0 6px", fontSize: 12, width: 64, flexShrink: 0, opacity: locked ? 0.45 : 1, cursor: locked ? "not-allowed" : "pointer" }}>
            {FONT_SIZES.map((f) => <option key={f} value={f}>{f}px</option>)}
          </select>
          <button onMouseDown={(e) => { e.preventDefault(); bumpFont(1); }} title="Bigger text" style={{ ...tBtn, fontSize: 15, fontWeight: 700 }}>A+</button>
        </>)}

        {showTemplates && !isMobile && templates.length > 0 && (
          <div style={{ position: "relative", marginLeft: 4 }}>
            <button onMouseDown={(e) => { e.preventDefault(); setTplOpen((o) => !o); }} title="Insert template" style={{ ...tBtn, width: "auto", padding: "0 10px", fontSize: 11 }}>+ Template ▾</button>
            {tplOpen && (
              <>
                <div onClick={() => setTplOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#0b0f19", border: "1px solid #232c3c", borderRadius: 8, padding: 4, minWidth: 220, zIndex: 11, boxShadow: "0 6px 18px rgba(0,0,0,0.5)" }}>
                  {templates.map((t) => (
                    <button key={t.id} onMouseDown={(e) => { e.preventDefault(); insertTemplate(t); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#d1d5db", fontSize: 12, cursor: "pointer", borderRadius: 5, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#232c3c"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{t.name}</button>
                  ))}
                  {onManageTemplates && (<>
                    <div style={{ height: 1, background: "#232c3c", margin: "4px 0" }} />
                    <button onMouseDown={(e) => { e.preventDefault(); setTplOpen(false); onManageTemplates(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer", borderRadius: 5, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#232c3c"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>⚙ Manage templates…</button>
                  </>)}
                </div>
              </>
            )}
          </div>
        )}

        {!compact && !isMobile && onExport && (
          <button onClick={onExport} title="Export this note as .txt" style={{ ...tBtn, width: "auto", padding: "0 10px", fontSize: 11, marginLeft: "auto" }}>Export .txt</button>
        )}
      </div>
      <div
        ref={editorRef}
        className="np-edit"
        contentEditable={!locked}
        aria-readonly={locked}
        onInput={updateContent}
        onClick={onEditorClick}
        onPaste={onEditorPaste}
        onDrop={(e) => e.preventDefault()}
        suppressContentEditableWarning
        style={{ flex: 1, background: locked ? "#0b1220" : "#0d1117", color: locked ? "#cbd5e1" : "#e5e7eb", border: "none", padding: 16, fontSize, lineHeight: 1.7, outline: "none", fontFamily: "'DM Sans', sans-serif", overflowY: "auto", minHeight: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", cursor: locked ? "default" : "text" }}
      />
    </div>
  );
}

// ─── Subscription Modal ───
function SubModal({ sub, onSave, onClose }) {
  const [sf, setSf] = useState(sub ? { category: "Other", currency: "AUD", fxRateToAud: 1, customDays: "", ...sub } : { name: "", category: "Other", amount: "", currency: "AUD", fxRateToAud: 1, fxUpdatedAt: "", frequency: "monthly", customDays: "", nextDue: today(), tags: "", active: true });
  const [dirty, setDirty] = useState(false);
  const [showU, setShowU] = useState(false);
  const [fxStatus, setFxStatus] = useState("");
  const up = (u) => { setSf((prev) => ({ ...prev, ...u })); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const currencyCode = String(sf.currency || "AUD").toUpperCase();
  const isForeign = currencyCode !== "AUD";
  const audAmount = subAmountAud(sf);
  const me = subMonthlyAud(sf);
  useEffect(() => {
    let alive = true;
    if (!isForeign) {
      setFxStatus("");
      setSf((prev) => ({ ...prev, fxRateToAud: 1, fxUpdatedAt: "" }));
      return () => { alive = false; };
    }
    setFxStatus("Refreshing AUD rate...");
    fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(currencyCode)}/AUD`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("rate")))
      .then((data) => {
        if (!alive || !Number(data.rate)) return;
        setSf((prev) => ({ ...prev, fxRateToAud: data.rate, fxUpdatedAt: data.date || today() }));
        setFxStatus(`Live rate loaded${data.date ? ` (${data.date})` : ""}`);
      })
      .catch(() => { if (alive) setFxStatus("Could not refresh. You can enter the rate manually."); });
    return () => { alive = false; };
  }, [currencyCode, isForeign]);
  const save = () => {
    if (!sf.name || !sf.amount || !sf.nextDue) return;
    const customDays = sf.frequency === "custom" ? Math.max(1, parseInt(sf.customDays, 10) || 0) : "";
    if (sf.frequency === "custom" && !customDays) return;
    onSave({
      ...sf,
      category: SUB_CATEGORIES.includes(sf.category) ? sf.category : "Other",
      amount: parseFloat(sf.amount),
      currency: currencyCode,
      fxRateToAud: isForeign ? (parseFloat(sf.fxRateToAud) || 1) : 1,
      fxUpdatedAt: isForeign ? (sf.fxUpdatedAt || today()) : "",
      customDays,
    });
  };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={sub ? "Edit subscription" : "Add subscription"}>
    <Field label="Name" req><input value={sf.name} onChange={(e) => up({ name: e.target.value })} style={inp} placeholder="e.g. eBay Pro Basic" autoFocus /></Field>
    <Row cols={3}>
      <Field label="Amount" req><input type="number" step="0.01" value={sf.amount} onChange={(e) => up({ amount: e.target.value })} style={inp} placeholder="0.00" /></Field>
      <Field label="Currency"><select value={currencyCode} onChange={(e) => up({ currency: e.target.value })} style={sel}>{CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label="AUD rate"><input type="number" step="0.0001" disabled={!isForeign} value={isForeign ? sf.fxRateToAud : 1} onChange={(e) => up({ fxRateToAud: e.target.value, fxUpdatedAt: today() })} style={{ ...inp, opacity: isForeign ? 1 : 0.55 }} placeholder="1.0000" /></Field>
    </Row>
    {isForeign && <div style={{ margin: "-4px 0 10px", fontSize: 11, color: fxStatus.startsWith("Could") ? "#fbbf24" : "#7c8aa0" }}>{fxStatus || "Rate is stored on this subscription and can be edited per charge."}</div>}
    <Row cols={3}>
      <Field label="Category"><select value={sf.category || "Other"} onChange={(e) => up({ category: e.target.value })} style={sel}>{SUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Frequency"><select value={sf.frequency} onChange={(e) => up({ frequency: e.target.value })} style={sel}>{FREQ_OPTIONS.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}</select></Field>
      <Field label={sf.frequency === "custom" ? "Every X days" : "Next due"} req>{sf.frequency === "custom" ? <input type="number" min="1" step="1" value={sf.customDays} onChange={(e) => up({ customDays: e.target.value })} style={inp} placeholder="28" /> : <input type="date" value={sf.nextDue} onChange={(e) => up({ nextDue: e.target.value })} style={inp} />}</Field>
    </Row>
    {sf.frequency === "custom" ? <Row><Field label="Next due" req><input type="date" value={sf.nextDue} onChange={(e) => up({ nextDue: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row> : <Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field>}
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", marginBottom: 10 }}><input type="checkbox" checked={sf.active} onChange={(e) => up({ active: e.target.checked })} style={cb} /> Active (auto-log when due)</label>
    {parseFloat(sf.amount) > 0 && (
      <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, fontSize: 12, color: "#9ca3af" }}>
        <div>Charge: <span style={{ color: "#f3f6fb", fontWeight: 600 }}>{formatMoney(sf.amount, currencyCode)}</span>{isForeign && <span style={{ color: "#56627a" }}> = {currency(audAmount)}</span>}</div>
        <div style={{ marginTop: 4 }}>Monthly equivalent: <span style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(me)}</span><span style={{ color: "#56627a" }}> · {currency(me * 12)}/yr · {frequencyLabel(sf.frequency, sf.customDays)}</span></div>
      </div>
    )}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={save} style={primaryBtn}>{sub ? "Save" : "Add subscription"}</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Template manager modal ───
// Lets the user add / rename / edit body / delete templates. Built-in seeds
// can also be deleted — they're treated identically once loaded into storage.
function TemplateManagerModal({ templates, onSave, onClose }) {
  const [list, setList] = useState(templates.map((t) => ({ ...t })));
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", body: "" });
  const [dirty, setDirty] = useState(false);
  const [showU, setShowU] = useState(false);

  const startEdit = (t) => { setEditingId(t.id); setDraft({ name: t.name, body: t.body }); };
  const cancelEdit = () => { setEditingId(null); setDraft({ name: "", body: "" }); };
  const saveEdit = () => {
    if (!draft.name.trim()) return;
    if (editingId === "new") {
      setList([...list, { id: genId(), name: draft.name.trim(), body: draft.body, builtIn: false }]);
    } else {
      setList(list.map((t) => t.id === editingId ? { ...t, name: draft.name.trim(), body: draft.body } : t));
    }
    setDirty(true);
    cancelEdit();
  };
  const removeTpl = (id) => { setList(list.filter((t) => t.id !== id)); setDirty(true); };

  const gc = () => { if (dirty || editingId) setShowU(true); else onClose(); };

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Manage templates">
    <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 12px" }}>
      Templates inserted from the notepad toolbar. HTML is allowed. Use <code style={{ background: "#232c3c", padding: "1px 4px", borderRadius: 3 }}>{"${date}"}</code> to insert today's Sydney date when used.
    </p>

    {editingId ? (
      <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <Field label="Name" req><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inp} placeholder="e.g. Quick listing" autoFocus /></Field>
        <Field label="Body (HTML allowed)">
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} style={{ ...inp, minHeight: 160, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.5, resize: "vertical" }} placeholder='<b>Title</b><div>Item: </div><div><label><input type="checkbox"> Step 1</label></div>' />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={cancelEdit} style={ghostBtn}>Cancel</button>
          <button onClick={saveEdit} style={primaryBtn}>{editingId === "new" ? "Add" : "Save"}</button>
        </div>
      </div>
    ) : (
      <button onClick={() => { setEditingId("new"); setDraft({ name: "", body: "" }); }} style={{ ...primaryBtn, marginBottom: 12, width: "100%" }}>+ New template</button>
    )}

    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
      {list.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#374151" }}>No templates. Add one above.</div>}
      {list.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#0d1117", borderRadius: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}{t.builtIn && <span style={badge("#232c3c", "#7c8aa0")}>SEED</span>}</div>
            <div style={{ fontSize: 10, color: "#7c8aa0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtml(t.body).slice(0, 80) || "Empty"}</div>
          </div>
          <button onClick={() => startEdit(t)} style={{ padding: "4px 9px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
          <button onClick={() => removeTpl(t.id)} style={{ padding: "4px 9px", background: "#232c3c", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      ))}
    </div>

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
      <button onClick={() => { if (confirm("Reset all templates to the built-in defaults? Your custom templates will be lost.")) { setList(TEMPLATES.map((t) => ({ id: genId(), name: t.name, body: t.body, builtIn: true }))); setDirty(true); } }} style={{ ...ghostBtn, fontSize: 11, padding: "5px 10px" }}>Reset to defaults</button>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={gc} style={ghostBtn}>Cancel</button>
        <button onClick={() => onSave(list)} style={primaryBtn}>Save changes</button>
      </div>
    </div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}


export {
  EditInvModal,
  EditSaleModal,
  SellModal,
  BulkEditModal,
  EditExpModal,
  BulkEditExpModal,
  BulkEditSaleModal,
  BulkSellModal,
  ManualSaleModal,
  EbaySaleReviewModal,
  GmailInventoryReviewModal,
  NotepadEditor,
  SubModal,
  TemplateManagerModal
};
