import { useState, useEffect, useCallback, useMemo } from "react";
import { load, save } from "./supabase.js";

const DEF_CATEGORIES = ["Sneakers", "Apparel", "Accessories", "Collectables"];
const DEF_PLATFORMS = ["eBay AU", "StockX", "Facebook Marketplace", "Instagram", "Depop", "Discord", "GOAT", "CSFloat", "Bonusbank", "Other"];
const TIME_RANGES = ["1D", "1W", "1M", "MTD", "3M", "YTD", "ALL", "Custom"];
const DEF_SIZE_MAP = {
  Sneakers: ["US 3","US 3.5","US 4","US 4.5","US 5","US 5.5","US 6","US 6.5","US 7","US 7.5","US 8","US 8.5","US 9","US 9.5","US 10","US 10.5","US 11","US 11.5","US 12","US 12.5","US 13","US 14","US 15"],
  Apparel: ["XXS","XS","S","M","L","XL","XXL"],
};
const getDefaultSize = (cat) => DEF_SIZE_MAP[cat]?.[0] || "OS";
const getSizes = (cat) => DEF_SIZE_MAP[cat] || ["OS"];
const EXP_CATEGORIES = ["Shipping & Fulfillment", "Botting Resources", "Cook Groups & Retail Memberships", "Matched Betting", "Software & Subs", "Inventory Parts", "Other"];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const currency = (v) => { const n = Number(v); if (isNaN(n)) return "AU$0"; return (n < 0 ? "-AU$" : "AU$") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const getFilterDate = (range) => {
  const now = new Date();
  switch (range) {
    case "1D": return today(); case "1W": return daysAgo(7); case "1M": return daysAgo(30);
    case "MTD": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    case "3M": return daysAgo(90);
    case "YTD": return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    default: return "2000-01-01";
  }
};

// Styles
const inp = { width: "100%", padding: "9px 11px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, color: "#e5e7eb", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const sel = { ...inp, appearance: "none" };
const primaryBtn = { padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const ghostBtn = { padding: "9px 18px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const cb = { width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" };
const badge = (bg, fg) => ({ fontSize: 9, background: bg, color: fg, padding: "1px 5px", borderRadius: 3, marginLeft: 5 });

// ─── Shared UI ───
function ConfirmDialog({ open, msg, onConfirm, onCancel, label }) {
  if (!open) return null;
  return (<div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 24, maxWidth: 380, width: "100%" }}>
      <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 18, lineHeight: 1.5 }}>{msg}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={onConfirm} style={{ ...primaryBtn, background: "#dc2626" }}>{label || "Delete"}</button>
      </div>
    </div>
  </div>);
}

function UnsavedDialog({ open, onDiscard, onCancel }) {
  if (!open) return null;
  return (<div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 24, maxWidth: 380, width: "100%" }}>
      <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 6, fontWeight: 600 }}>Unsaved changes</div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18 }}>Are you sure you want to close? Changes will be lost.</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={ghostBtn}>Keep editing</button>
        <button onClick={onDiscard} style={{ ...primaryBtn, background: "#dc2626" }}>Discard</button>
      </div>
    </div>
  </div>);
}

function Modal({ open, onClose, title, children, guardedClose }) {
  if (!open) return null;
  const close = guardedClose || onClose;
  return (<div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #1f2937" }}>
        <h3 style={{ margin: 0, color: "#f1f5f9", fontSize: 15, fontWeight: 600 }}>{title}</h3>
        <button onClick={close} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  </div>);
}

const Field = ({ label, req, children }) => (<div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5, fontWeight: 500 }}>{label}{req && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>{children}</div>);
const Row = ({ children, cols = 2 }) => <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>{children}</div>;
function KPI({ label, value, accent }) { return (<div style={{ background: "#111827", borderRadius: 10, padding: "14px 16px", border: "1px solid #1f2937", flex: 1, minWidth: 140 }}><div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color: accent || "#f1f5f9" }}>{value}</div></div>); }

function Spark({ data, color = "#3b82f6" }) {
  const w = 500, h = 100;
  if (!data || data.length < 2) return <div style={{ height: h, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>No trend data yet</div>;
  const max = Math.max(...data), min = Math.min(...data), r = max - min || 1;
  const pts = data.map((v, i) => [((i / (data.length - 1)) * (w - 8)) + 4, h - 8 - ((v - min) / r) * (h - 16)]);
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
  const area = line + ` L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`;
  return (<svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={area} fill="url(#sg)" /><path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" /><circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={color} /></svg>);
}

// ─── Edit Inv Modal ───
function EditInvModal({ item, onSave, onClose, categories, customers }) {
  const [ef, setEf] = useState({ name: item.name, category: item.category, size: item.size || getDefaultSize(item.category), price: item.price, brand: item.brand || "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate || "", inTransit: item.inTransit || false, tags: item.tags || "", customer: item.customer || "" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const gc = () => { setShowU(true); };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit item">
    <Field label="Product name" req><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field>
    <Row cols={3}><Field label="Category"><select value={ef.category} onChange={(e) => up({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Size"><select value={ef.size} onChange={(e) => up({ size: e.target.value })} style={sel}>{getSizes(ef.category).map((s) => <option key={s}>{s}</option>)}</select></Field>
    <Field label="Price (AU$)"><input type="number" step="0.01" value={ef.price} onChange={(e) => up({ price: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field><Field label="Purchase date"><input type="date" value={ef.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Preorder date"><input type="date" value={ef.preorderDate} onChange={(e) => up({ preorderDate: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={ef.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Customer"><input list="cust-list" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-list">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={ef.inTransit} onChange={(e) => up({ inTransit: e.target.checked })} style={cb} /> In Transit</label></Field></Row>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...ef, price: parseFloat(ef.price) })} style={primaryBtn}>Save</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Edit Sale Modal (with unsaved warning) ───
function EditSaleModal({ sale, onSave, onClose, platforms, customers }) {
  const [ef, setEf] = useState({ name: sale.name, category: sale.category, costPrice: sale.costPrice, salePrice: sale.salePrice, shippingPrice: sale.shippingPrice, platformFees: sale.platformFees, platform: sale.platform, saleDate: sale.saleDate, tags: sale.tags || "", brand: sale.brand || "", customer: sale.customer || "" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const gc = () => { setShowU(true); };
  const sp = parseFloat(ef.salePrice)||0, ship = parseFloat(ef.shippingPrice)||0, fees = parseFloat(ef.platformFees)||0, cost = parseFloat(ef.costPrice)||0;
  const preview = sp - cost - ship - fees;
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{ef.name}</div><div style={{ fontSize: 12, color: "#4b5563" }}>{ef.category} · {sale.size || "OS"}{sale.brand ? ` · ${sale.brand}` : ""}</div></div>
    <Row><Field label="Item name"><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field><Field label="Cost (AU$)"><input type="number" step="0.01" value={ef.costPrice} onChange={(e) => up({ costPrice: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Sale price (AU$)" req><input type="number" step="0.01" value={ef.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={ef.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={ef.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} /></Field><Field label="Fees"><input type="number" step="0.01" value={ef.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} /></Field><Field label="Platform"><select value={ef.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-list2" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} /><datalist id="cust-list2">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(cost)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
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
  const preview = sp - item.price - ship - fees;
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Create a new sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{item.name}</div><div style={{ fontSize: 12, color: "#4b5563" }}>Cost: {currency(item.price)} · {item.category} · {item.size||"OS"}{item.brand ? ` · ${item.brand}` : ""}</div></div>
    <Row><Field label="Sale price" req><input type="number" step="0.01" value={sf.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} placeholder="0" autoFocus /></Field><Field label="Sale date"><input type="date" value={sf.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={sf.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Fees"><input type="number" step="0.01" value={sf.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Platform" req><select value={sf.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-sell" value={sf.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-sell">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    {sp > 0 && <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(item.price)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </div>}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!sf.salePrice) return; onSell(sf); }} style={primaryBtn}>Create sale</button></div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Bulk Edit Modal ───
function BulkEditModal({ items, onSave, onClose, categories }) {
  const [cat, setCat] = useState(""); const [transit, setTransit] = useState(""); const [brand, setBrand] = useState("");
  return (<Modal open={true} onClose={onClose} title={`Bulk edit ${items.length} items`}>
    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
    <Field label="Category (all selected)"><select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}><option value="">— No change —</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Brand"><input value={brand} onChange={(e) => setBrand(e.target.value)} style={inp} placeholder="Leave blank to keep current" /></Field>
    <Field label="In Transit"><select value={transit} onChange={(e) => setTransit(e.target.value)} style={sel}><option value="">— No change —</option><option value="true">Yes</option><option value="false">No</option></select></Field>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}><button onClick={onClose} style={ghostBtn}>Cancel</button>
    <button onClick={() => { const updates = {}; if (cat) updates.category = cat; if (brand) updates.brand = brand; if (transit) updates.inTransit = transit === "true"; onSave(updates); }} style={primaryBtn}>Apply to {items.length} items</button></div>
  </Modal>);
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
    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>Leave blank to keep current values.</p>
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
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Selected</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{items.length} sales</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </div>
    <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
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
    return { ...item, sp, ship, fees, profit: sp - item.price - ship - fees };
  });
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const allPriced = previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={`Sell ${items.length} items`}>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Items</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{items.length}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Total profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </div>
    <Row cols={3}><Field label="Platform" req><select value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input list="cust-bulk" value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-bulk">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field></Row>
    <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 8, marginTop: 4 }}>Per-item pricing</div>
    <div style={{ maxHeight: 280, overflowY: "auto", borderRadius: 8, border: "1px solid #1f2937" }}>
      {items.map((item) => {
        const r = rows.find((x) => x.id === item.id) || {};
        const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
        const profit = sp - item.price - ship - fees;
        return (<div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #1f293744", background: "#0d1117" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <div><span style={{ color: "#e5e7eb", fontSize: 13 }}>{item.name}</span><span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>{item.size||"OS"}</span></div>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Cost: {currency(item.price)}</span>
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

// ═══ MAIN APP ═══
export default function App({ onLogout, userEmail }) {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState({ categories: DEF_CATEGORIES, platforms: DEF_PLATFORMS, customers: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [range, setRange] = useState("MTD");
  const [customFrom, setCustomFrom] = useState(daysAgo(30));
  const [customTo, setCustomTo] = useState(today());
  const [dashCat, setDashCat] = useState("All");
  const [dashPlat, setDashPlat] = useState("All");
  const [saveStatus, setSaveStatus] = useState("");

  // Modals
  const [addInvOpen, setAddInvOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(null);
  const [addExpOpen, setAddExpOpen] = useState(false);
  const [editInvOpen, setEditInvOpen] = useState(null);
  const [editSaleOpen, setEditSaleOpen] = useState(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [selectedInv, setSelectedInv] = useState(new Set());
  const [showUnsavedAdd, setShowUnsavedAdd] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const [editExpOpen, setEditExpOpen] = useState(null);
  const [notepadOpen, setNotepadOpen] = useState(false);
  const [notepadText, setNotepadText] = useState("");
  const [selectedExp, setSelectedExp] = useState(new Set());
  const [bulkEditExpOpen, setBulkEditExpOpen] = useState(false);
  const [selectedSales, setSelectedSales] = useState(new Set());
  const [bulkEditSaleOpen, setBulkEditSaleOpen] = useState(false);

  // Filters
  const [invSearch, setInvSearch] = useState(""); const [invCat, setInvCat] = useState("All"); const [invSort, setInvSort] = useState("name_asc"); const [invCollapse, setInvCollapse] = useState(true);
  const [saleSearch, setSaleSearch] = useState(""); const [saleCat, setSaleCat] = useState("All"); const [salePlat, setSalePlat] = useState("All"); const [saleSort, setSaleSort] = useState("date_desc");
  const [expSearch, setExpSearch] = useState(""); const [expFrom, setExpFrom] = useState(""); const [expTo, setExpTo] = useState(""); const [expCatFilter, setExpCatFilter] = useState("All"); const [expSort, setExpSort] = useState("date_desc");
  const [backupStatus, setBackupStatus] = useState("");

  // Settings UI
  const [newCat, setNewCat] = useState(""); const [newPlat, setNewPlat] = useState(""); const [newCust, setNewCust] = useState("");

  const CATS = settings.categories; const PLATS = settings.platforms; const CUSTS = settings.customers;

  const emptyInv = { name: "", category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||""), price: "", quantity: "1", purchaseDate: today(), preorderDate: "", brand: "", inTransit: false, tags: "", customer: "" };
  const [invForm, setInvForm] = useState(emptyInv);
  const emptyExp = { name: "", amount: "", purchaseDate: today(), tags: "", expCategory: EXP_CATEGORIES[0] };
  const [expForm, setExpForm] = useState(emptyExp);

  useEffect(() => {
    (async () => {
      const [i, s, e, st, np] = await Promise.all([load("arch-inv2", []), load("arch-sales2", []), load("arch-exp2", []), load("arch-settings", { categories: DEF_CATEGORIES, platforms: DEF_PLATFORMS, customers: [] }), load("arch-notepad", "")]);
      setInventory(i); setSales(s); setExpenses(e); setSettings(st); setNotepadText(np); setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (key, data, setter) => {
    setSaveStatus("saving"); await save(key, data); setter(data); setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 1500);
  }, []);
  const persistInv = useCallback(async (d) => persist("arch-inv2", d, setInventory), [persist]);
  const persistSales = useCallback(async (d) => persist("arch-sales2", d, setSales), [persist]);
  const persistExp = useCallback(async (d) => persist("arch-exp2", d, setExpenses), [persist]);
  const persistSettings = useCallback(async (d) => { await save("arch-settings", d); setSettings(d); }, []);

  const updateNotepad = useCallback(async (text) => {
    setNotepadText(text);
    await save("arch-notepad", text);
  }, []);

  // Auto-save customer on sell
  const addCustomer = useCallback(async (name) => {
    if (!name || CUSTS.includes(name)) return;
    const ns = { ...settings, customers: [...CUSTS, name] };
    await persistSettings(ns);
  }, [settings, CUSTS, persistSettings]);

  const updateInvForm = (u) => { setInvForm({ ...invForm, ...u }); setAddDirty(true); };
  const guardedCloseAdd = () => { if (addDirty) setShowUnsavedAdd(true); else { setAddInvOpen(false); setAddDirty(false); } };

  const addInventory = async () => {
    if (!invForm.name || !invForm.price) return;
    const qty = Math.max(1, parseInt(invForm.quantity) || 1);
    const items = Array.from({ length: qty }, () => ({ id: genId(), name: invForm.name, category: invForm.category, size: invForm.size, price: parseFloat(invForm.price), purchaseDate: invForm.purchaseDate, preorderDate: invForm.preorderDate, brand: invForm.brand, inTransit: invForm.inTransit, tags: invForm.tags, customer: invForm.customer, addedAt: Date.now() }));
    await persistInv([...items, ...inventory]);
    setInvForm(emptyInv); setAddInvOpen(false); setAddDirty(false);
  };

  const duplicateItem = async (item) => { await persistInv([{ ...item, id: genId(), addedAt: Date.now() }, ...inventory]); };

  const handleSell = async (item, sf) => {
    const sp = parseFloat(sf.salePrice)||0, ship = parseFloat(sf.shippingPrice)||0, fees = parseFloat(sf.platformFees)||0;
    const sale = { id: genId(), name: item.name, category: item.category, size: item.size||"OS", brand: item.brand||"", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: sp-item.price-ship-fees, platform: sf.platform, saleDate: sf.saleDate, tags: sf.tags, purchaseDate: item.purchaseDate, preorderDate: item.preorderDate||"", customer: sf.customer||"" };
    await persistSales([sale, ...sales]);
    await persistInv(inventory.filter((i) => i.id !== item.id));
    if (sf.customer) addCustomer(sf.customer);
    setSellOpen(null);
  };

  const handleBulkSell = async (shared, rows) => {
    const soldIds = new Set();
    const newSales = [];
    for (const item of inventory.filter((i) => selectedInv.has(i.id))) {
      const r = rows.find((x) => x.id === item.id);
      if (!r) continue;
      const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
      newSales.push({ id: genId(), name: item.name, category: item.category, size: item.size||"OS", brand: item.brand||"", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: sp-item.price-ship-fees, platform: shared.platform, saleDate: shared.saleDate, tags: "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate||"", customer: shared.customer||"" });
      soldIds.add(item.id);
    }
    await persistSales([...newSales, ...sales]);
    await persistInv(inventory.filter((i) => !soldIds.has(i.id)));
    if (shared.customer) addCustomer(shared.customer);
    setSelectedInv(new Set());
    setBulkSellOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    if (confirmDel.type === "inv") await persistInv(inventory.filter((i) => i.id !== confirmDel.id));
    else if (confirmDel.type === "sale") await persistSales(sales.filter((s) => s.id !== confirmDel.id));
    else if (confirmDel.type === "exp") await persistExp(expenses.filter((e) => e.id !== confirmDel.id));
    else if (confirmDel.type === "multi") { await persistInv(inventory.filter((i) => !selectedInv.has(i.id))); setSelectedInv(new Set()); }
    else if (confirmDel.type === "multi-exp") { await persistExp(expenses.filter((e) => !selectedExp.has(e.id))); setSelectedExp(new Set()); }
    else if (confirmDel.type === "multi-sale") { await persistSales(sales.filter((s) => !selectedSales.has(s.id))); setSelectedSales(new Set()); }
    setConfirmDel(null);
  };

  const handleBulkEdit = async (updates) => {
    const ids = selectedInv;
    await persistInv(inventory.map((i) => ids.has(i.id) ? { ...i, ...updates } : i));
    setBulkEditOpen(false); setSelectedInv(new Set());
  };

  // ─── Export ───
  const exportJSON = () => {
    const data = JSON.stringify({ inventory, sales, expenses, settings, exportedAt: new Date().toISOString(), version: 3 }, null, 2);
    const blob = new Blob([data], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `archivedash-backup-${today()}.json`; a.click(); URL.revokeObjectURL(url);
    setBackupStatus("JSON backup downloaded!"); setTimeout(() => setBackupStatus(""), 3000);
  };
  const exportCSV = () => {
    const headers = ["Name","Category","Size","Brand","Cost Price","Sale Price","Shipping","Fees","Profit","Platform","Sale Date","Purchase Date","Customer","Tags"];
    const rows = sales.map((s) => [s.name,s.category,s.size||"OS",s.brand||"",s.costPrice,s.salePrice,s.shippingPrice,s.platformFees,s.profit,s.platform,s.saleDate,s.purchaseDate||"",s.customer||"",s.tags||""].map((v) => `"${String(v).replace(/"/g,'""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `archivedash-sales-${today()}.csv`; a.click(); URL.revokeObjectURL(url);
    setBackupStatus("CSV exported!"); setTimeout(() => setBackupStatus(""), 3000);
  };

  const importBackup = (mode = "merge") => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data.inventory || !data.sales || !data.expenses) { setBackupStatus("Invalid file"); return; }
        if (mode === "replace") { await persistInv(data.inventory); await persistSales(data.sales); await persistExp(data.expenses); if (data.settings) await persistSettings(data.settings); setBackupStatus("Replaced all data!"); }
        else {
          const sFps = new Set(sales.map((s) => `${s.name}|${s.saleDate}|${s.salePrice}|${s.profit}`));
          const iIds = new Set(inventory.map((i) => i.id)); const eIds = new Set(expenses.map((e) => e.id));
          const ni = data.inventory.filter((i) => !iIds.has(i.id));
          const ns = data.sales.filter((s) => { const fp = `${s.name}|${s.saleDate}|${s.salePrice}|${s.profit}`; if (sFps.has(fp)) return false; sFps.add(fp); return true; });
          const ne = data.expenses.filter((e) => !eIds.has(e.id));
          if (ni.length) await persistInv([...inventory, ...ni]);
          if (ns.length) await persistSales([...sales, ...ns].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")));
          if (ne.length) await persistExp([...expenses, ...ne].sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"")));
          setBackupStatus(`Merged: +${ni.length} items, +${ns.length} sales, +${ne.length} expenses`);
        }
        setTimeout(() => setBackupStatus(""), 5000);
      } catch { setBackupStatus("Failed to read file"); setTimeout(() => setBackupStatus(""), 3000); }
    };
    input.click();
  };

  // ─── Dashboard Stats ───
  const stats = useMemo(() => {
    const cutFrom = range === "Custom" ? customFrom : getFilterDate(range);
    const cutTo = range === "Custom" ? customTo : "2099-12-31";
    let fs = sales.filter((s) => s.saleDate >= cutFrom && s.saleDate <= cutTo);
    let fe = expenses.filter((e) => e.purchaseDate >= cutFrom && e.purchaseDate <= cutTo);
    if (dashCat !== "All") fs = fs.filter((s) => s.category === dashCat);
    if (dashPlat !== "All") fs = fs.filter((s) => s.platform === dashPlat);
    const salesIncome = fs.reduce((a, s) => a + s.salePrice, 0), grossProfit = fs.reduce((a, s) => a + s.profit, 0);
    const totalExpenses = fe.reduce((a, e) => a + e.amount, 0), netProfit = grossProfit - totalExpenses;
    const invValue = inventory.reduce((a, i) => a + i.price, 0), cnt = fs.length, aov = cnt > 0 ? salesIncome / cnt : 0;
    const sellThrough = (inventory.length + cnt) > 0 ? cnt / (inventory.length + cnt) : 0;
    const totalFees = fs.reduce((a, s) => a + (s.platformFees||0), 0);
    const grossMargin = salesIncome > 0 ? grossProfit / salesIncome : 0;
    const netMargin = salesIncome > 0 ? netProfit / salesIncome : 0;
    const pbd = {}; fs.forEach((s) => { pbd[s.saleDate] = (pbd[s.saleDate]||0) + s.profit; });
    let cum = 0; const spark = Object.keys(pbd).sort().map((d) => { cum += pbd[d]; return cum; });
    const ri = [...inventory].sort((a, b) => (b.addedAt||0) - (a.addedAt||0)).slice(0, 7);
    const rs = [...fs].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")).slice(0, 7);
    return { salesIncome, grossProfit, totalExpenses, netProfit, invValue, cnt, aov, sellThrough, totalFees, grossMargin, netMargin, spark, ri, rs };
  }, [inventory, sales, expenses, range, customFrom, customTo, dashCat, dashPlat]);

  // ─── Filtered Inventory (with collapsible groups) ───
  const filteredInv = useMemo(() => {
    let f = inventory;
    if (invSearch) f = f.filter((i) => i.name.toLowerCase().includes(invSearch.toLowerCase()) || (i.brand||"").toLowerCase().includes(invSearch.toLowerCase()));
    if (invCat !== "All") f = f.filter((i) => i.category === invCat);
    const sorted = [...f];
    switch (invSort) {
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "price_desc": sorted.sort((a, b) => b.price - a.price); break;
      case "price_asc": sorted.sort((a, b) => a.price - b.price); break;
      case "date_desc": sorted.sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"")); break;
      case "date_asc": sorted.sort((a, b) => (a.purchaseDate||"").localeCompare(b.purchaseDate||"")); break;
    }
    return sorted;
  }, [inventory, invSearch, invCat, invSort]);

  const groupedInv = useMemo(() => {
    if (!invCollapse) return filteredInv.map((i) => ({ ...i, _group: false }));
    const groups = new Map();
    filteredInv.forEach((i) => {
      const key = i.name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    const result = [];
    groups.forEach((items, key) => {
      if (items.length > 1) {
        const totalValue = items.reduce((a, x) => a + x.price, 0);
        result.push({ ...items[0], _group: true, _items: items, _count: items.length, _totalValue: totalValue });
      } else result.push({ ...items[0], _group: false });
    });
    return result;
  }, [filteredInv, invCollapse]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const toggleGroup = (key) => setExpandedGroups((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const filteredSales = useMemo(() => {
    let f = sales;
    if (saleSearch) f = f.filter((s) => s.name.toLowerCase().includes(saleSearch.toLowerCase()) || (s.brand||"").toLowerCase().includes(saleSearch.toLowerCase()));
    if (saleCat !== "All") f = f.filter((s) => s.category === saleCat);
    if (salePlat !== "All") f = f.filter((s) => s.platform === salePlat);
    const sorted = [...f];
    switch (saleSort) {
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "date_desc": sorted.sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")); break;
      case "date_asc": sorted.sort((a, b) => (a.saleDate||"").localeCompare(b.saleDate||"")); break;
      case "sale_desc": sorted.sort((a, b) => b.salePrice - a.salePrice); break;
      case "profit_desc": sorted.sort((a, b) => b.profit - a.profit); break;
      case "profit_asc": sorted.sort((a, b) => a.profit - b.profit); break;
    }
    return sorted;
  }, [sales, saleSearch, saleCat, salePlat, saleSort]);

  const filteredExp = useMemo(() => {
    let f = expenses;
    if (expSearch) f = f.filter((e) => e.name.toLowerCase().includes(expSearch.toLowerCase()));
    if (expCatFilter !== "All") f = f.filter((e) => (e.expCategory || "Other") === expCatFilter);
    if (expFrom) f = f.filter((e) => e.purchaseDate >= expFrom);
    if (expTo) f = f.filter((e) => e.purchaseDate <= expTo);
    const sorted = [...f];
    switch (expSort) {
      case "date_desc": sorted.sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"")); break;
      case "date_asc": sorted.sort((a, b) => (a.purchaseDate||"").localeCompare(b.purchaseDate||"")); break;
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "amount_desc": sorted.sort((a, b) => b.amount - a.amount); break;
      case "amount_asc": sorted.sort((a, b) => a.amount - b.amount); break;
    }
    return sorted;
  }, [expenses, expSearch, expCatFilter, expFrom, expTo, expSort]);

  const selectedValue = useMemo(() => inventory.filter((i) => selectedInv.has(i.id)).reduce((a, i) => a + i.price, 0), [inventory, selectedInv]);
  const toggleSel = (id) => setSelectedInv((p) => { const n = new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => { if (selectedInv.size === filteredInv.length) setSelectedInv(new Set()); else setSelectedInv(new Set(filteredInv.map((i) => i.id))); };

  const selectedExpValue = useMemo(() => expenses.filter((e) => selectedExp.has(e.id)).reduce((a, e) => a + e.amount, 0), [expenses, selectedExp]);
  const toggleSelExp = (id) => setSelectedExp((p) => { const n = new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAllExp = () => { if (selectedExp.size === filteredExp.length) setSelectedExp(new Set()); else setSelectedExp(new Set(filteredExp.map((e) => e.id))); };
  const handleBulkEditExp = async (updates) => {
    const ids = selectedExp;
    await persistExp(expenses.map((e) => ids.has(e.id) ? { ...e, ...updates } : e));
    setBulkEditExpOpen(false); setSelectedExp(new Set());
  };
  const deleteSelectedExp = () => {
    if (selectedExp.size === 0) return;
    setConfirmDel({ type: "multi-exp", name: `${selectedExp.size} expenses` });
  };

  const selectedSalesProfit = useMemo(() => sales.filter((s) => selectedSales.has(s.id)).reduce((a, s) => a + s.profit, 0), [sales, selectedSales]);
  const selectedSalesRevenue = useMemo(() => sales.filter((s) => selectedSales.has(s.id)).reduce((a, s) => a + s.salePrice, 0), [sales, selectedSales]);
  const toggleSelSale = (id) => setSelectedSales((p) => { const n = new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAllSales = () => { if (selectedSales.size === filteredSales.length) setSelectedSales(new Set()); else setSelectedSales(new Set(filteredSales.map((s) => s.id))); };
  const handleBulkEditSale = async (updates) => {
    const ids = selectedSales;
    await persistSales(sales.map((s) => ids.has(s.id) ? { ...s, ...updates } : s));
    setBulkEditSaleOpen(false); setSelectedSales(new Set());
  };
  const deleteSelectedSales = () => {
    if (selectedSales.size === 0) return;
    setConfirmDel({ type: "multi-sale", name: `${selectedSales.size} sales` });
  };

  if (loading) return <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>Loading...</div>;

  const navItems = [
    { id: "dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
    { id: "inventory", icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12" },
    { id: "sales", icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01" },
    { id: "expenses", icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
    { id: "backup", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" },
    { id: "settings", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z" },
  ];

  // Notepad toggle (separate from page nav)
  const notepadIcon = "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8";
  const rb = (r) => ({ padding: "5px 10px", fontSize: 11, fontWeight: range === r ? 600 : 400, borderRadius: 6, background: range === r ? "#1d4ed8" : "transparent", color: range === r ? "#fff" : "#6b7280", border: "none", cursor: "pointer" });

  // Click anywhere on row to select (skip if clicking button/input)
  const rowClick = (e, toggleFn, id) => { if (e.target.closest("button") || e.target.tagName === "INPUT") return; toggleFn(id); };

  const invRow = (item, isGroupChild) => (
    <div key={item.id} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ display: "grid", gridTemplateColumns: "30px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: isGroupChild ? "8px 16px 8px 46px" : "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: selectedInv.has(item.id) ? "#1e293b" : isGroupChild ? "#0d111788" : "transparent", cursor: "pointer" }}>
      <input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={cb} />
      <div style={{ overflow: "hidden" }}><div style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}{item.inTransit && <span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}{item.preorderDate && <span style={badge("#3b1f2b","#f472b6")}>PRE</span>}</div>{item.brand && <div style={{ fontSize: 10, color: "#6b7280" }}>{item.brand}</div>}</div>
      <span style={{ color: "#9ca3af", fontSize: 12 }}>{item.category}</span>
      <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 500 }}>{item.size||"OS"}</span>
      <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(item.price)}</span>
      <span style={{ color: "#6b7280", fontSize: 11 }}>{item.purchaseDate}</span>
      <div style={{ display: "flex", gap: 3 }}>
        <button onClick={() => setSellOpen(item)} style={{ padding: "4px 7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Sell</button>
        <button onClick={() => setEditInvOpen(item)} style={{ padding: "4px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
        <button onClick={() => duplicateItem(item)} title="Duplicate" style={{ padding: "4px 7px", background: "#1f2937", color: "#a78bfa", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>⧉</button>
        <button onClick={() => setConfirmDel({ type: "inv", id: item.id, name: item.name })} style={{ padding: "4px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0f19", color: "#e5e7eb", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      {/* SIDEBAR */}
      <div style={{ width: 54, background: "#0b0f19", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 2, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 15, fontWeight: 800, color: "#fff" }}>A</div>
        {navItems.map((n) => (<button key={n.id} onClick={() => setPage(n.id)} title={n.id} style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", background: page===n.id?"#1e293b":"transparent", color: page===n.id?"#60a5fa":"#4b5563" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg></button>))}
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <button onClick={() => setNotepadOpen(!notepadOpen)} title="Notepad" style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", background: notepadOpen ? "#1e293b" : "transparent", color: notepadOpen ? "#facc15" : "#4b5563" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={notepadIcon} /></svg>
          </button>
          {saveStatus === "saving" ? <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} /> : saveStatus === "saved" ? <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399" }} /> : <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1f2937" }} />}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>

        {/* ══ DASHBOARD ══ */}
        {page === "dashboard" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Dashboard</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventory.length} in stock · {sales.length} total sales</p></div>
            <div style={{ display: "flex", gap: 3, background: "#111827", borderRadius: 8, padding: 3, border: "1px solid #1f2937", flexWrap: "wrap" }}>{TIME_RANGES.map((r) => <button key={r} style={rb(r)} onClick={() => setRange(r)}>{r}</button>)}</div>
          </div>
          {range === "Custom" && <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}><span style={{ fontSize: 12, color: "#6b7280" }}>From</span><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...inp, maxWidth: 160 }} /><span style={{ fontSize: 12, color: "#6b7280" }}>To</span><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...inp, maxWidth: 160 }} /></div>}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <select value={dashCat} onChange={(e) => setDashCat(e.target.value)} style={{ ...sel, maxWidth: 150 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={dashPlat} onChange={(e) => setDashPlat(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Net Profit</div><div style={{ fontSize: 28, fontWeight: 700, color: stats.netProfit>=0?"#34d399":"#f87171" }}>{currency(stats.netProfit)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#6b7280" }}>Inventory value</div><div style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>{currency(stats.invValue)}</div></div>
            </div>
            <Spark data={stats.spark.length>1?stats.spark:undefined} color={stats.netProfit>=0?"#3b82f6":"#ef4444"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 10 }}>
            <KPI label="Sales income" value={currency(stats.salesIncome)} /><KPI label="Net profit" value={currency(stats.netProfit)} accent={stats.netProfit>=0?"#34d399":"#f87171"} /><KPI label="Gross profit" value={currency(stats.grossProfit)} accent={stats.grossProfit>=0?"#34d399":"#f87171"} /><KPI label="Inventory value" value={currency(stats.invValue)} /><KPI label="Sales count" value={stats.cnt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
            <KPI label="Avg. order value" value={currency(stats.aov)} /><KPI label="Net margin" value={(stats.netMargin * 100).toFixed(1) + "%"} accent={stats.netMargin>=0?"#34d399":"#f87171"} /><KPI label="Gross margin" value={(stats.grossMargin * 100).toFixed(1) + "%"} accent={stats.grossMargin>=0?"#34d399":"#f87171"} /><KPI label="Total expenses" value={currency(stats.totalExpenses)} accent="#f59e0b" /><KPI label="Platform fees" value={currency(stats.totalFees)} accent="#f59e0b" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Sales</div>
              {stats.rs.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No sales</div>:stats.rs.map((s) => (<div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722" }}><div><div style={{ fontSize: 13, color: "#e5e7eb" }}>{s.name}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{s.platform} · {s.size||"OS"} · {s.saleDate}{s.customer?` · ${s.customer}`:""}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(s.salePrice)}</div><div style={{ fontSize: 11, color: s.profit>=0?"#34d399":"#f87171" }}>{currency(s.profit)}</div></div></div>))}
            </div>
            <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Inventory</div>
              {stats.ri.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No items</div>:stats.ri.map((i) => (<div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722" }}><div><div style={{ fontSize: 13, color: "#e5e7eb" }}>{i.name}{i.inTransit&&<span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{i.category} · {i.size||"OS"}{i.brand?` · ${i.brand}`:""}</div></div><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(i.price)}</div></div>))}
            </div>
          </div>
        </div>)}

        {/* ══ INVENTORY ══ */}
        {page === "inventory" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Inventory</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventory.length} items · {currency(inventory.reduce((a, i) => a + i.price, 0))}</p></div>
            <div style={{ display: "flex", gap: 6 }}>
              {selectedInv.size > 0 && <><button onClick={() => setBulkSellOpen(true)} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sell {selectedInv.size}</button><button onClick={() => setBulkEditOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedInv.size}</button><button onClick={() => setConfirmDel({ type: "multi", name: `${selectedInv.size} items` })} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedInv.size}</button></>}
              <button onClick={() => { setInvForm({ ...emptyInv, category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||"") }); setAddDirty(false); setAddInvOpen(true); }} style={primaryBtn}>+ Add inventory</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
            <select value={invCat} onChange={(e) => setInvCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={invSort} onChange={(e) => setInvSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option><option value="price_desc">Price ↓</option><option value="price_asc">Price ↑</option><option value="date_desc">Newest</option><option value="date_asc">Oldest</option></select>
            <label style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={invCollapse} onChange={(e) => setInvCollapse(e.target.checked)} style={cb} />Group</label>
            {(invSearch||invCat!=="All"||invSort!=="name_asc")&&<button onClick={() => { setInvSearch(""); setInvCat("All"); setInvSort("name_asc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredInv.length} items{selectedInv.size>0&&` · ${selectedInv.size} selected · ${currency(selectedValue)}`}</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "30px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center" }}>
              <input type="checkbox" checked={selectedInv.size===filteredInv.length&&filteredInv.length>0} onChange={toggleAll} style={cb} /><span>Name</span><span>Category</span><span>Size</span><span>Price</span><span>Date</span><span>Actions</span>
            </div>
            {groupedInv.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No inventory</div>}
            {groupedInv.map((item) => {
              if (!item._group) return invRow(item, false);
              const key = item.name;
              const isExpanded = expandedGroups.has(key);
              return (<div key={key}>
                <div onClick={() => toggleGroup(key)} style={{ display: "grid", gridTemplateColumns: "30px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293722", cursor: "pointer", background: "#0d111766" }}>
                  <span style={{ color: "#6b7280", fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>
                  <div><span style={{ color: "#e5e7eb" }}>{item.name}</span><span style={badge("#1f2937","#60a5fa")}>×{item._count}</span>{item.brand&&<div style={{ fontSize: 10, color: "#6b7280" }}>{item.brand}</div>}</div>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{item.category}</span>
                  <span style={{ color: "#60a5fa", fontSize: 12 }}></span>
                  <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(item._totalValue)}</span>
                  <span style={{ color: "#6b7280", fontSize: 11 }}>{item._count} units</span>
                  <span style={{ fontSize: 11, color: "#4b5563" }}>{isExpanded ? "Collapse" : "Expand"}</span>
                </div>
                {isExpanded && item._items.map((sub) => invRow(sub, true))}
              </div>);
            })}
          </div>
        </div>)}

        {/* ══ SALES ══ */}
        {page === "sales" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Sales</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{sales.length} sales · {currency(sales.reduce((a, s) => a + s.salePrice, 0))} revenue · {currency(sales.reduce((a, s) => a + s.profit, 0))} profit</p></div>
            <div style={{ display: "flex", gap: 6 }}>
              {selectedSales.size > 0 && <><button onClick={() => setBulkEditSaleOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedSales.size}</button><button onClick={deleteSelectedSales} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedSales.size}</button></>}
            </div>
          </div>
          {selectedSales.size > 0 && (
            <div style={{ background: "#111827", borderRadius: 10, border: "1px solid #1f2937", padding: "10px 16px", marginBottom: 12, display: "flex", gap: 24, alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "#6b7280" }}>{selectedSales.size} selected</span>
              <span style={{ color: "#f1f5f9" }}>Revenue: <strong>{currency(selectedSalesRevenue)}</strong></span>
              <span style={{ color: selectedSalesProfit >= 0 ? "#34d399" : "#f87171" }}>Profit: <strong>{currency(selectedSalesProfit)}</strong></span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} style={{ ...inp, maxWidth: 190 }} />
            <select value={saleCat} onChange={(e) => setSaleCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={salePlat} onChange={(e) => setSalePlat(e.target.value)} style={{ ...sel, maxWidth: 160 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
            <select value={saleSort} onChange={(e) => setSaleSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A-Z</option><option value="profit_desc">Profit ↓</option><option value="profit_asc">Profit ↑</option><option value="sale_desc">Sale ↓</option></select>
            {(saleSearch||saleCat!=="All"||salePlat!=="All"||saleSort!=="date_desc")&&<button onClick={() => { setSaleSearch(""); setSaleCat("All"); setSalePlat("All"); setSaleSort("date_desc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredSales.length} · {currency(filteredSales.reduce((a, s) => a + s.profit, 0))} profit</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "30px 1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center" }}>
              <input type="checkbox" checked={selectedSales.size===filteredSales.length&&filteredSales.length>0} onChange={toggleAllSales} style={cb} />
              <span>Item</span><span>Platform</span><span>Size</span><span>Date</span><span>Cost</span><span>Sale</span><span>Profit</span><span>Actions</span>
            </div>
            {filteredSales.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No sales</div>}
            {filteredSales.map((s) => (<div key={s.id} onClick={(e) => rowClick(e, toggleSelSale, s.id)} style={{ display: "grid", gridTemplateColumns: "30px 1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: selectedSales.has(s.id) ? "#1e293b" : "transparent", cursor: "pointer" }}>
              <input type="checkbox" checked={selectedSales.has(s.id)} onChange={() => toggleSelSale(s.id)} style={cb} />
              <div><span style={{ color: "#e5e7eb" }}>{s.name}</span><div style={{ fontSize: 10, color: "#4b5563" }}>{s.category}{s.brand?` · ${s.brand}`:""}{s.customer?` · ${s.customer}`:""}{s.purchaseDate?` · bought ${s.purchaseDate}`:""}</div></div>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>{s.platform}</span>
              <span style={{ color: "#60a5fa", fontSize: 12 }}>{s.size||"OS"}</span>
              <span style={{ color: "#6b7280", fontSize: 11 }}>{s.saleDate}</span>
              <span style={{ color: "#6b7280", fontSize: 12 }}>{currency(s.costPrice)}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 500, fontSize: 12 }}>{currency(s.salePrice)}</span>
              <span style={{ color: s.profit>=0?"#34d399":"#f87171", fontWeight: 600, fontSize: 12 }}>{currency(s.profit)}</span>
              <div style={{ display: "flex", gap: 4 }}><button onClick={() => setEditSaleOpen(s)} style={{ padding: "3px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button><button onClick={() => setConfirmDel({ type: "sale", id: s.id, name: s.name })} style={{ padding: "3px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button></div>
            </div>))}
          </div>
        </div>)}

        {/* ══ EXPENSES ══ */}
        {page === "expenses" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Expenses</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{expenses.length} expenses · {currency(expenses.reduce((a, e) => a + e.amount, 0))}</p></div>
            <div style={{ display: "flex", gap: 6 }}>
              {selectedExp.size > 0 && <><button onClick={() => setBulkEditExpOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedExp.size}</button><button onClick={deleteSelectedExp} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedExp.size}</button></>}
              <button onClick={() => { setExpForm(emptyExp); setAddExpOpen(true); }} style={primaryBtn}>+ Add expense</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search..." value={expSearch} onChange={(e) => setExpSearch(e.target.value)} style={{ ...inp, maxWidth: 180 }} />
            <select value={expCatFilter} onChange={(e) => setExpCatFilter(e.target.value)} style={{ ...sel, maxWidth: 200 }}><option value="All">All Categories</option>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={expSort} onChange={(e) => setExpSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A-Z</option><option value="amount_desc">Price ↓</option><option value="amount_asc">Price ↑</option></select>
            <span style={{ fontSize: 12, color: "#6b7280" }}>From</span><input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} style={{ ...inp, maxWidth: 140 }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>To</span><input type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} style={{ ...inp, maxWidth: 140 }} />
            {(expSearch||expFrom||expTo||expCatFilter!=="All"||expSort!=="date_desc")&&<button onClick={() => { setExpSearch(""); setExpFrom(""); setExpTo(""); setExpCatFilter("All"); setExpSort("date_desc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredExp.length}{selectedExp.size>0&&` · ${selectedExp.size} selected · ${currency(selectedExpValue)}`} · {currency(filteredExp.reduce((a, e) => a + e.amount, 0))}</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "30px 2fr 1.2fr 90px 100px 80px", gap: 6, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center" }}>
              <input type="checkbox" checked={selectedExp.size===filteredExp.length&&filteredExp.length>0} onChange={toggleAllExp} style={cb} />
              <span>Name</span><span>Category</span><span>Price</span><span>Date</span><span>Actions</span>
            </div>
            {filteredExp.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No expenses</div>}
            {filteredExp.map((e) => (<div key={e.id} onClick={(ev) => rowClick(ev, toggleSelExp, e.id)} style={{ display: "grid", gridTemplateColumns: "30px 2fr 1.2fr 90px 100px 80px", gap: 6, padding: "11px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: selectedExp.has(e.id) ? "#1e293b" : "transparent", cursor: "pointer" }}>
              <input type="checkbox" checked={selectedExp.has(e.id)} onChange={() => toggleSelExp(e.id)} style={cb} />
              <span style={{ color: "#e5e7eb" }}>{e.name}{e.tags&&<span style={{ fontSize: 10, color: "#4b5563", marginLeft: 6 }}>{e.tags}</span>}</span>
              <span style={{ color: "#9ca3af", fontSize: 11 }}>{e.expCategory || "Other"}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(e.amount)}</span>
              <span style={{ color: "#6b7280", fontSize: 12 }}>{e.purchaseDate}</span>
              <div style={{ display: "flex", gap: 4 }}><button onClick={() => setEditExpOpen(e)} style={{ padding: "3px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button><button onClick={() => setConfirmDel({ type: "exp", id: e.id, name: e.name })} style={{ padding: "3px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button></div>
            </div>))}
          </div>
        </div>)}

        {/* ══ BACKUP ══ */}
        {page === "backup" && (<div style={{ padding: "20px 24px", maxWidth: 600 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Backup & Restore</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#4b5563" }}>Export or import your data.</p>
          {backupStatus&&<div style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#93c5fd" }}>{backupStatus}</div>}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Export</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>{inventory.length} items · {sales.length} sales · {expenses.length} expenses</p>
            <div style={{ display: "flex", gap: 8 }}><button onClick={exportJSON} style={primaryBtn}>Download JSON</button><button onClick={exportCSV} style={ghostBtn}>Export Sales CSV</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Import</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Merge adds new records safely. Replace overwrites everything.</p>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => importBackup("merge")} style={primaryBtn}>Merge import (safe)</button><button onClick={() => { if (confirm("Replace ALL data?")) importBackup("replace"); }} style={{ ...ghostBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}>Replace import</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #ef444433", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Danger Zone</div>
            <button onClick={async () => { if (confirm("Delete ALL data?")) { await persistInv([]); await persistSales([]); await persistExp([]); } }} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Clear all data</button>
          </div>
        </div>)}

        {/* ══ SETTINGS ══ */}
        {page === "settings" && (<div style={{ padding: "20px 24px", maxWidth: 600 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Settings</h2>
          {/* Categories */}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Categories</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CATS.map((c) => (<div key={c} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{c}<button onClick={async () => { const ns = { ...settings, categories: CATS.filter((x) => x !== c) }; await persistSettings(ns); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newCat} onChange={(e) => setNewCat(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="New category" /><button onClick={async () => { if (newCat && !CATS.includes(newCat)) { await persistSettings({ ...settings, categories: [...CATS, newCat] }); setNewCat(""); } }} style={primaryBtn}>Add</button></div>
          </div>
          {/* Platforms */}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Platforms</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {PLATS.map((p) => (<div key={p} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{p}<button onClick={async () => { await persistSettings({ ...settings, platforms: PLATS.filter((x) => x !== p) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newPlat} onChange={(e) => setNewPlat(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="New platform" /><button onClick={async () => { if (newPlat && !PLATS.includes(newPlat)) { await persistSettings({ ...settings, platforms: [...PLATS, newPlat] }); setNewPlat(""); } }} style={primaryBtn}>Add</button></div>
          </div>
          {/* Customers */}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Customer Database</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>Customers auto-save when you sell. You can also add them here.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CUSTS.map((c) => (<div key={c} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{c}<button onClick={async () => { await persistSettings({ ...settings, customers: CUSTS.filter((x) => x !== c) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
              {CUSTS.length===0&&<span style={{ fontSize: 12, color: "#4b5563" }}>No customers yet</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newCust} onChange={(e) => setNewCust(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="Customer name" /><button onClick={async () => { if (newCust && !CUSTS.includes(newCust)) { await persistSettings({ ...settings, customers: [...CUSTS, newCust] }); setNewCust(""); } }} style={primaryBtn}>Add</button></div>
          </div>
          {/* Account */}
          {onLogout && <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Account</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Signed in as {userEmail}</p>
            <button onClick={onLogout} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Log out</button>
          </div>}
        </div>)}
      </div>

      {/* ══ NOTEPAD PANEL ══ */}
      {notepadOpen && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 340, background: "#111827", borderLeft: "1px solid #1f2937", zIndex: 150, display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1f2937" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Notepad</span>
            <button onClick={() => setNotepadOpen(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1px solid #1f2937" }}>
            {[["bold","B","fontWeight:800"],["italic","I","fontStyle:italic"],["underline","U","textDecoration:underline"]].map(([cmd, label, style]) => {
              const [k,v] = style.split(":"); 
              return <button key={cmd} onMouseDown={(e) => { e.preventDefault(); document.execCommand(cmd, false, null); }} style={{ width: 30, height: 28, background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 13, cursor: "pointer", [k]: v }}>{label}</button>;
            })}
          </div>
          <div
            ref={(el) => { if (el && !el.dataset.loaded && notepadText) { el.innerHTML = notepadText; el.dataset.loaded = "1"; } }}
            contentEditable
            onInput={(e) => updateNotepad(e.currentTarget.innerHTML)}
            suppressContentEditableWarning
            data-placeholder="Write notes here..."
            style={{ flex: 1, background: "#0d1117", color: "#e5e7eb", border: "none", padding: 16, fontSize: 13, lineHeight: 1.7, outline: "none", fontFamily: "'DM Sans', sans-serif", overflowY: "auto", minHeight: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          />
        </div>
      )}

      {/* ══ MODALS ══ */}
      <Modal open={addInvOpen} onClose={() => { setAddInvOpen(false); setAddDirty(false); }} guardedClose={guardedCloseAdd} title="Add inventory">
        <Field label="Product name" req><input value={invForm.name} onChange={(e) => updateInvForm({ name: e.target.value })} style={inp} placeholder="e.g. Nike Dunk Low Panda" /></Field>
        <Row cols={3}><Field label="Category" req><select value={invForm.category} onChange={(e) => updateInvForm({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Size"><select value={invForm.size} onChange={(e) => updateInvForm({ size: e.target.value })} style={sel}>{getSizes(invForm.category).map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Price (AU$)" req><input type="number" step="0.01" value={invForm.price} onChange={(e) => updateInvForm({ price: e.target.value })} style={inp} placeholder="0.00" /></Field></Row>
        <Row><Field label="Brand"><input value={invForm.brand} onChange={(e) => updateInvForm({ brand: e.target.value })} style={inp} placeholder="e.g. Nike" /></Field><Field label="Purchase date"><input type="date" value={invForm.purchaseDate} onChange={(e) => updateInvForm({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
        <Row><Field label="Quantity"><input type="number" min="1" value={invForm.quantity} onChange={(e) => updateInvForm({ quantity: e.target.value })} style={inp} /></Field><Field label="Preorder date"><input type="date" value={invForm.preorderDate} onChange={(e) => updateInvForm({ preorderDate: e.target.value })} style={inp} /></Field></Row>
        <Row><Field label="Tags"><input value={invForm.tags} onChange={(e) => updateInvForm({ tags: e.target.value })} style={inp} /></Field><Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={invForm.inTransit} onChange={(e) => updateInvForm({ inTransit: e.target.checked })} style={cb} /> In Transit</label></Field></Row>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}><button onClick={guardedCloseAdd} style={ghostBtn}>Cancel</button><button onClick={addInventory} style={primaryBtn}>Add {parseInt(invForm.quantity)>1?`${invForm.quantity} items`:"item"}</button></div>
      </Modal>
      <UnsavedDialog open={showUnsavedAdd} onDiscard={() => { setAddInvOpen(false); setAddDirty(false); setShowUnsavedAdd(false); }} onCancel={() => setShowUnsavedAdd(false)} />

      <Modal open={addExpOpen} onClose={() => setAddExpOpen(false)} title="Create expense">
        <Field label="Name" req><input value={expForm.name} onChange={(e) => setExpForm({ ...expForm, name: e.target.value })} style={inp} placeholder="e.g. eBay Sub" /></Field>
        <Row><Field label="Price (AU$)" req><input type="number" step="0.01" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} style={inp} /></Field><Field label="Date"><input type="date" value={expForm.purchaseDate} onChange={(e) => setExpForm({ ...expForm, purchaseDate: e.target.value })} style={inp} /></Field></Row>
        <Row><Field label="Category"><select value={expForm.expCategory} onChange={(e) => setExpForm({ ...expForm, expCategory: e.target.value })} style={sel}>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Tags"><input value={expForm.tags} onChange={(e) => setExpForm({ ...expForm, tags: e.target.value })} style={inp} /></Field></Row>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}><button onClick={() => setAddExpOpen(false)} style={ghostBtn}>Cancel</button><button onClick={async () => { if (!expForm.name||!expForm.amount) return; await persistExp([{ id: genId(), name: expForm.name, amount: parseFloat(expForm.amount), purchaseDate: expForm.purchaseDate, tags: expForm.tags, expCategory: expForm.expCategory }, ...expenses]); setExpForm(emptyExp); setAddExpOpen(false); }} style={primaryBtn}>Create</button></div>
      </Modal>

      {sellOpen && <SellModal item={sellOpen} onSell={(sf) => handleSell(sellOpen, sf)} onClose={() => setSellOpen(null)} platforms={PLATS} customers={CUSTS} />}
      {editInvOpen && <EditInvModal item={editInvOpen} onSave={async (ef) => { await persistInv(inventory.map((i) => i.id===editInvOpen.id?{...i,...ef}:i)); setEditInvOpen(null); }} onClose={() => setEditInvOpen(null)} categories={CATS} customers={CUSTS} />}
      {editSaleOpen && <EditSaleModal sale={editSaleOpen} onSave={async (u) => { await persistSales(sales.map((s) => s.id===editSaleOpen.id?u:s)); if (u.customer) addCustomer(u.customer); setEditSaleOpen(null); }} onClose={() => setEditSaleOpen(null)} platforms={PLATS} customers={CUSTS} />}
      {editExpOpen && <EditExpModal expense={editExpOpen} onSave={async (u) => { await persistExp(expenses.map((e) => e.id===editExpOpen.id?u:e)); setEditExpOpen(null); }} onClose={() => setEditExpOpen(null)} />}
      {bulkEditOpen && <BulkEditModal items={inventory.filter((i) => selectedInv.has(i.id))} onSave={handleBulkEdit} onClose={() => setBulkEditOpen(false)} categories={CATS} />}
      {bulkSellOpen && <BulkSellModal items={inventory.filter((i) => selectedInv.has(i.id))} onSell={handleBulkSell} onClose={() => setBulkSellOpen(false)} platforms={PLATS} customers={CUSTS} />}
      {bulkEditExpOpen && <BulkEditExpModal items={expenses.filter((e) => selectedExp.has(e.id))} onSave={handleBulkEditExp} onClose={() => setBulkEditExpOpen(false)} />}
      {bulkEditSaleOpen && <BulkEditSaleModal items={sales.filter((s) => selectedSales.has(s.id))} onSave={handleBulkEditSale} onClose={() => setBulkEditSaleOpen(false)} platforms={PLATS} />}
      <ConfirmDialog open={!!confirmDel} msg={confirmDel?.type==="multi"||confirmDel?.type==="multi-exp"||confirmDel?.type==="multi-sale"?`Delete ${confirmDel.name}?`:`Delete "${confirmDel?.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}
