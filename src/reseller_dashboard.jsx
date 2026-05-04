import { useState, useEffect, useCallback, useMemo, useRef } from "react";

const DEF_CATEGORIES = ["Sneakers", "Apparel", "Accessories", "Collectables"];
const DEF_PLATFORMS = ["eBay AU", "StockX", "Facebook Marketplace", "Instagram", "Depop", "Discord", "GOAT", "CSFloat", "Bonusbank", "Other"];
const TIME_RANGES = ["1W", "1M", "MTD", "3M", "YTD", "ALL", "Custom"];
const DEF_SIZE_MAP = {
  Sneakers: ["US 3","US 3.5","US 4","US 4.5","US 5","US 5.5","US 6","US 6.5","US 7","US 7.5","US 8","US 8.5","US 9","US 9.5","US 10","US 10.5","US 11","US 11.5","US 12","US 12.5","US 13","US 14","US 15"],
  Apparel: ["XXS","XS","S","M","L","XL","XXL"],
};
const FREQ_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];
const FREQ_LABEL = Object.fromEntries(FREQ_OPTIONS.map((f) => [f.value, f.label]));
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32];
const PREORDER_THRESHOLD = 40; // business days before release
const VERSION = "0.3.1";

const TEMPLATES = [
  {
    name: "Presale listing",
    body: `Item: 
Source: 
Cost per unit: AU$
Quantity: 
Release date: 
eBay title (80c): 

- [ ] AU comps researched
- [ ] Listing photos
- [ ] Listed on eBay
- [ ] Posted to FB groups
- [ ] Customer DMs sent
- [ ] Restock check`,
  },
  {
    name: "Restock checklist",
    body: `Restock — ${"${date}"}

- [ ] Diecast (Mini GT, Kaido House, Tarmac, Inno64)
- [ ] Pokémon TCG sealed
- [ ] OPTCG presales
- [ ] Coins (presale + back catalogue)
- [ ] Update eBay storefront banners
- [ ] Refresh listing titles for top watchers`,
  },
  {
    name: "FB group post cluster",
    body: `Post cluster — ${"${date}"}

- [ ] Pokémon TCG groups
- [ ] Diecast groups
- [ ] AHUA Auctions
- [ ] OPTCG groups
- [ ] Coins groups (verify 2 disabled)

Caption: 
Photos: 
Pricing anchor: `,
  },
  {
    name: "Customer order",
    body: `Customer: 
Item: 
Sale price: AU$
Platform: 
Sale date: 

- [ ] Payment received
- [ ] Packed
- [ ] Shipped
- [ ] Tracking sent
- [ ] Delivered
- [ ] Feedback left`,
  },
  {
    name: "HK sourcing trip",
    body: `HK Sourcing — targets

- [ ] HK Toycar Salon exclusives
- [ ] Tarmac / Inno64 store exclusives
- [ ] Pop Mart releases
- [ ] Pokémon / OPTCG sealed
- [ ] BAPE HK exclusives
- [ ] Compare HKD vs AUD margins
- [ ] Negotiate multi-unit pricing`,
  },
];

const renderTemplate = (body) => body.replace("${date}", new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" }));

const toggleChecklistLine = (content, lineIdx) => {
  const lines = content.split("\n");
  if (lineIdx >= lines.length) return content;
  const m = lines[lineIdx].match(/^(\s*-\s*\[)([ xX])(\].*)$/);
  if (!m) return content;
  const newMark = m[2].toLowerCase() === "x" ? " " : "x";
  lines[lineIdx] = m[1] + newMark + m[3];
  return lines.join("\n");
};

const getDefaultSize = (cat) => DEF_SIZE_MAP[cat]?.[0] || "OS";
const getSizes = (cat) => DEF_SIZE_MAP[cat] || ["OS"];

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const currency = (v) => { const n = Number(v); if (isNaN(n)) return "AU$0"; return (n < 0 ? "-AU$" : "AU$") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };

const load = async (key, fb) => { try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fb; } catch { return fb; } };
const save = async (key, d) => { try { await window.storage.set(key, JSON.stringify(d)); } catch (e) { console.error(e); } };

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const getFilterDate = (range) => {
  const now = new Date();
  switch (range) {
    case "1W": return daysAgo(7); case "1M": return daysAgo(30);
    case "MTD": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    case "3M": return daysAgo(90);
    case "YTD": return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    default: return "2000-01-01";
  }
};

// ─── New helpers ───
const businessDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const past = target < now;
  const start = past ? new Date(target) : new Date(now);
  const end = past ? new Date(now) : new Date(target);
  let days = 0;
  const cur = new Date(start);
  while (cur < end) { cur.setDate(cur.getDate() + 1); const dow = cur.getDay(); if (dow !== 0 && dow !== 6) days++; }
  return past ? -days : days;
};
const advanceDate = (dateStr, freq) => {
  const d = new Date(dateStr + "T00:00:00");
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "fortnightly") d.setDate(d.getDate() + 14);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};
const monthlyEquiv = (amount, freq) => {
  if (freq === "weekly") return amount * 52 / 12;
  if (freq === "fortnightly") return amount * 26 / 12;
  if (freq === "monthly") return amount;
  if (freq === "yearly") return amount / 12;
  return amount;
};
const sydneyParts = (date) => {
  try {
    const fmt = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short", day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false, timeZoneName: "short",
    });
    return fmt.format(date);
  } catch { return date.toLocaleString(); }
};

// Styles
const inp = { width: "100%", padding: "9px 11px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, color: "#e5e7eb", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const sel = { ...inp, appearance: "none" };
const primaryBtn = { padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const ghostBtn = { padding: "9px 18px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const cb = { width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" };
const badge = (bg, fg) => ({ fontSize: 9, background: bg, color: fg, padding: "1px 5px", borderRadius: 3, marginLeft: 5 });

// Preorder badge styling tier
const preorderBadge = (bdays) => {
  if (bdays === null || bdays === undefined) return null;
  if (bdays < 0) return { bg: "#3b1f2b", fg: "#f472b6", text: `RELEASED` };
  if (bdays <= 5) return { bg: "#3b1414", fg: "#fca5a5", text: `${bdays}bd` };
  if (bdays <= 15) return { bg: "#3b2814", fg: "#fbbf24", text: `${bdays}bd` };
  if (bdays <= PREORDER_THRESHOLD) return { bg: "#1e3a5f", fg: "#60a5fa", text: `${bdays}bd` };
  return { bg: "#1f2937", fg: "#9ca3af", text: `PRE` };
};

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

// ─── Top bar with live Sydney time ───
function TopBar({ saveStatus }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const statusColor = saveStatus === "saving" ? "#f59e0b" : saveStatus === "saved" ? "#34d399" : "#1f2937";
  const statusText = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Idle";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 24px", borderBottom: "1px solid #1f2937", background: "rgba(11,15,25,0.95)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        <span style={{ color: "#e5e7eb", fontFeatureSettings: "'tnum'", fontVariantNumeric: "tabular-nums" }}>{sydneyParts(now)}</span>
        <span style={{ color: "#4b5563", fontSize: 11 }}>· Sydney</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, transition: "background 200ms" }} />
        <span>{statusText}</span>
      </div>
    </div>
  );
}

// ─── Checkbox-aware preview for notes ───
function CheckboxPreview({ content, fontSize, onToggle }) {
  const lines = (content || "").split("\n");
  return (
    <div style={{
      flex: 1, padding: 18, background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12,
      color: "#e5e7eb", fontSize, fontFamily: "'JetBrains Mono', 'Menlo', monospace",
      lineHeight: 1.6, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>
      {lines.map((line, idx) => {
        const m = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
        if (m) {
          const checked = m[2].toLowerCase() === "x";
          return (
            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "1px 0" }}>
              <span style={{ whiteSpace: "pre" }}>{m[1]}</span>
              <input type="checkbox" checked={checked} onChange={() => onToggle(idx)} style={{ ...cb, marginTop: Math.max(2, fontSize * 0.25) }} />
              <span style={{ textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.5 : 1, flex: 1 }}>{m[3]}</span>
            </div>
          );
        }
        return <div key={idx} style={{ minHeight: line ? "auto" : "0.6em" }}>{line}</div>;
      })}
    </div>
  );
}

// ─── Edit Inv Modal ───
function EditInvModal({ item, onSave, onClose, categories, customers }) {
  const [ef, setEf] = useState({ name: item.name, category: item.category, size: item.size || getDefaultSize(item.category), price: item.price, brand: item.brand || "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate || "", inTransit: item.inTransit || false, tags: item.tags || "", customer: item.customer || "" });
  const [dirty, setDirty] = useState(false); const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
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

// ─── Edit Sale Modal ───
function EditSaleModal({ sale, onSave, onClose, platforms, customers }) {
  const [ef, setEf] = useState({ name: sale.name, category: sale.category, costPrice: sale.costPrice, salePrice: sale.salePrice, shippingPrice: sale.shippingPrice, platformFees: sale.platformFees, platform: sale.platform, saleDate: sale.saleDate, tags: sale.tags || "", brand: sale.brand || "", customer: sale.customer || "" });
  const [dirty, setDirty] = useState(false); const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
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

// ─── Subscription Modal ───
function SubModal({ sub, onSave, onClose }) {
  const isEdit = !!sub;
  const [sf, setSf] = useState(sub ? { ...sub } : { name: "", amount: "", frequency: "monthly", nextDue: today(), tags: "", active: true });
  const [dirty, setDirty] = useState(false); const [showU, setShowU] = useState(false);
  const up = (u) => { setSf({ ...sf, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const amount = parseFloat(sf.amount) || 0;
  const me = monthlyEquiv(amount, sf.frequency);
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={isEdit ? "Edit subscription" : "Add subscription"}>
    <Field label="Name" req><input value={sf.name} onChange={(e) => up({ name: e.target.value })} style={inp} placeholder="e.g. eBay Store Subscription" /></Field>
    <Row cols={3}>
      <Field label="Amount (AU$)" req><input type="number" step="0.01" value={sf.amount} onChange={(e) => up({ amount: e.target.value })} style={inp} placeholder="0.00" /></Field>
      <Field label="Frequency"><select value={sf.frequency} onChange={(e) => up({ frequency: e.target.value })} style={sel}>{FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></Field>
      <Field label="Next due" req><input type="date" value={sf.nextDue} onChange={(e) => up({ nextDue: e.target.value })} style={inp} /></Field>
    </Row>
    <Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} placeholder="e.g. ebay, software" /></Field>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", marginBottom: 10 }}><input type="checkbox" checked={sf.active} onChange={(e) => up({ active: e.target.checked })} style={cb} /> Active (auto-log when due)</label>
    {amount > 0 && <div style={{ background: "#0d1117", borderRadius: 10, padding: 12, marginBottom: 4, fontSize: 12, color: "#9ca3af" }}>Monthly cost equivalent: <span style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(me)}</span> · Annual: <span style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(me * 12)}</span></div>}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
      <button onClick={gc} style={ghostBtn}>Cancel</button>
      <button onClick={() => { if (!sf.name || !sf.amount || !sf.nextDue) return; onSave({ ...sf, amount: parseFloat(sf.amount), id: sf.id || genId() }); }} style={primaryBtn}>{isEdit ? "Save" : "Add subscription"}</button>
    </div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ═══ MAIN APP ═══
export default function App() {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [subs, setSubs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [noteMode, setNoteMode] = useState("edit"); // "edit" | "preview"
  const [noteSearch, setNoteSearch] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
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
  const [subModalOpen, setSubModalOpen] = useState(null); // null | "new" | sub object
  const [confirmDel, setConfirmDel] = useState(null);
  const [selectedInv, setSelectedInv] = useState(new Set());
  const [showUnsavedAdd, setShowUnsavedAdd] = useState(false);
  const [addDirty, setAddDirty] = useState(false);

  // Filters
  const [invSearch, setInvSearch] = useState(""); const [invCat, setInvCat] = useState("All"); const [invSort, setInvSort] = useState("name_asc"); const [invCollapse, setInvCollapse] = useState(true);
  const [saleSearch, setSaleSearch] = useState(""); const [saleCat, setSaleCat] = useState("All"); const [salePlat, setSalePlat] = useState("All"); const [saleSort, setSaleSort] = useState("date_desc");
  const [expSearch, setExpSearch] = useState(""); const [expFrom, setExpFrom] = useState(""); const [expTo, setExpTo] = useState("");
  const [backupStatus, setBackupStatus] = useState("");

  // Settings UI
  const [newCat, setNewCat] = useState(""); const [newPlat, setNewPlat] = useState(""); const [newCust, setNewCust] = useState("");

  const CATS = settings.categories; const PLATS = settings.platforms; const CUSTS = settings.customers;

  const emptyInv = { name: "", category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||""), price: "", quantity: "1", purchaseDate: today(), preorderDate: "", brand: "", inTransit: false, tags: "", customer: "" };
  const [invForm, setInvForm] = useState(emptyInv);
  const emptyExp = { name: "", amount: "", purchaseDate: today(), tags: "" };
  const [expForm, setExpForm] = useState(emptyExp);

  // Notepad debounce
  const noteTimerRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    (async () => {
      const [i, s, e, sb, existingNotes, oldNotepad, savedActiveId, st] = await Promise.all([
        load("arch-inv2", []),
        load("arch-sales2", []),
        load("arch-exp2", []),
        load("arch-subs", []),
        load("arch-notes", null),
        load("arch-notepad", null),
        load("arch-notes-active", null),
        load("arch-settings", { categories: DEF_CATEGORIES, platforms: DEF_PLATFORMS, customers: [] })
      ]);

      // Migrate old single-notepad → first note in new model
      let initialNotes = existingNotes;
      if (!initialNotes) {
        if (oldNotepad && oldNotepad.content) {
          initialNotes = [{
            id: genId(),
            title: "Imported notes",
            content: oldNotepad.content,
            fontSize: oldNotepad.fontSize || 14,
            pinned: false,
            createdAt: oldNotepad.updatedAt || Date.now(),
            updatedAt: oldNotepad.updatedAt || Date.now(),
          }];
        } else {
          initialNotes = [];
        }
        await save("arch-notes", initialNotes);
      }

      setInventory(i); setSales(s); setExpenses(e); setSubs(sb);
      setNotes(initialNotes); setSettings(st); setLoading(false);

      // Restore previously active note, or pick the most recently updated
      const validId = savedActiveId && initialNotes.some((n) => n.id === savedActiveId);
      if (validId) setActiveNoteId(savedActiveId);
      else if (initialNotes.length) {
        const sorted = [...initialNotes].sort((a, b) => (b.pinned - a.pinned) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
        setActiveNoteId(sorted[0].id);
      }
    })();
  }, []);

  const persist = useCallback(async (key, data, setter) => {
    setSaveStatus("saving"); await save(key, data); setter(data); setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 1500);
  }, []);
  const persistInv = useCallback(async (d) => persist("arch-inv2", d, setInventory), [persist]);
  const persistSales = useCallback(async (d) => persist("arch-sales2", d, setSales), [persist]);
  const persistExp = useCallback(async (d) => persist("arch-exp2", d, setExpenses), [persist]);
  const persistSubs = useCallback(async (d) => persist("arch-subs", d, setSubs), [persist]);
  const persistSettings = useCallback(async (d) => { await save("arch-settings", d); setSettings(d); }, []);

  // Auto-save customer on sell
  const addCustomer = useCallback(async (name) => {
    if (!name || CUSTS.includes(name)) return;
    const ns = { ...settings, customers: [...CUSTS, name] };
    await persistSettings(ns);
  }, [settings, CUSTS, persistSettings]);

  // Persist active-note id whenever it changes
  useEffect(() => {
    if (activeNoteId) save("arch-notes-active", activeNoteId);
  }, [activeNoteId]);

  // Multi-note CRUD with 800ms debounced save
  const persistNotesNow = useCallback(async (next) => {
    setNotes(next);
    if (noteTimerRef.current) clearTimeout(noteTimerRef.current);
    noteTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      await save("arch-notes", next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 1500);
    }, 800);
  }, []);

  const updateNote = useCallback((id, changes) => {
    const next = notes.map((n) => n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n);
    persistNotesNow(next);
  }, [notes, persistNotesNow]);

  const createNote = useCallback(async (seed = {}) => {
    const newNote = {
      id: genId(),
      title: seed.title || "Untitled",
      content: seed.content || "",
      fontSize: seed.fontSize || 14,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [newNote, ...notes];
    setNotes(next);
    setActiveNoteId(newNote.id);
    setNoteMode("edit");
    await save("arch-notes", next);
    return newNote.id;
  }, [notes]);

  const deleteNote = useCallback(async (id) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (activeNoteId === id) {
      const fallback = next.length ? next[0].id : null;
      setActiveNoteId(fallback);
    }
    await save("arch-notes", next);
  }, [notes, activeNoteId]);

  const togglePin = useCallback((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    updateNote(id, { pinned: !note.pinned });
  }, [notes, updateNote]);

  const insertAtCursor = useCallback((text) => {
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    const ta = editorRef.current;
    if (ta && noteMode === "edit") {
      const s = ta.selectionStart, e = ta.selectionEnd;
      const v = note.content;
      const sep = (s > 0 && v[s - 1] !== "\n") ? "\n\n" : "";
      const next = v.substring(0, s) + sep + text + v.substring(e);
      updateNote(note.id, { content: next });
      requestAnimationFrame(() => {
        if (editorRef.current) {
          const pos = s + sep.length + text.length;
          editorRef.current.selectionStart = editorRef.current.selectionEnd = pos;
          editorRef.current.focus();
        }
      });
    } else {
      const sep = note.content && !note.content.endsWith("\n") ? "\n\n" : "";
      updateNote(note.id, { content: note.content + sep + text });
    }
  }, [notes, activeNoteId, noteMode, updateNote]);

  const insertTemplate = (tpl) => {
    insertAtCursor(renderTemplate(tpl.body));
    setTemplateMenuOpen(false);
  };

  const insertStamp = () => {
    const stamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    insertAtCursor(`── ${stamp} ──`);
  };

  const toggleCheckboxAt = (lineIdx) => {
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return;
    updateNote(note.id, { content: toggleChecklistLine(note.content, lineIdx) });
  };

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

  const handleDelete = async () => {
    if (!confirmDel) return;
    if (confirmDel.type === "inv") await persistInv(inventory.filter((i) => i.id !== confirmDel.id));
    else if (confirmDel.type === "sale") await persistSales(sales.filter((s) => s.id !== confirmDel.id));
    else if (confirmDel.type === "exp") await persistExp(expenses.filter((e) => e.id !== confirmDel.id));
    else if (confirmDel.type === "sub") await persistSubs(subs.filter((s) => s.id !== confirmDel.id));
    else if (confirmDel.type === "note") await deleteNote(confirmDel.id);
    else if (confirmDel.type === "multi") { await persistInv(inventory.filter((i) => !selectedInv.has(i.id))); setSelectedInv(new Set()); }
    setConfirmDel(null);
  };

  const handleBulkEdit = async (updates) => {
    const ids = selectedInv;
    await persistInv(inventory.map((i) => ids.has(i.id) ? { ...i, ...updates } : i));
    setBulkEditOpen(false); setSelectedInv(new Set());
  };

  // ─── Sub helpers ───
  const saveSub = async (sub) => {
    const exists = subs.find((s) => s.id === sub.id);
    if (exists) await persistSubs(subs.map((s) => s.id === sub.id ? sub : s));
    else await persistSubs([sub, ...subs]);
    setSubModalOpen(null);
  };

  const logSubPayment = async (sub) => {
    // Single instance — log current nextDue and advance once
    const newExp = { id: genId(), name: `${sub.name} (${FREQ_LABEL[sub.frequency]})`, amount: sub.amount, purchaseDate: sub.nextDue, tags: sub.tags ? `subscription,${sub.tags}` : "subscription", subId: sub.id };
    const updated = subs.map((s) => s.id === sub.id ? { ...s, nextDue: advanceDate(s.nextDue, s.frequency), lastLogged: s.nextDue } : s);
    await persistExp([newExp, ...expenses]);
    await persistSubs(updated);
  };

  const logAllOverdue = async () => {
    const todayStr = today();
    const newExpenses = [];
    const updated = subs.map((s) => {
      if (!s.active) return s;
      let nd = s.nextDue, last = s.lastLogged;
      while (nd <= todayStr) {
        newExpenses.push({ id: genId(), name: `${s.name} (${FREQ_LABEL[s.frequency]})`, amount: s.amount, purchaseDate: nd, tags: s.tags ? `subscription,${s.tags}` : "subscription", subId: s.id });
        last = nd;
        nd = advanceDate(nd, s.frequency);
      }
      return { ...s, nextDue: nd, lastLogged: last };
    });
    if (newExpenses.length === 0) return;
    await persistExp([...newExpenses, ...expenses]);
    await persistSubs(updated);
  };

  // ─── Export / Import ───
  const exportJSON = () => {
    const data = JSON.stringify({ inventory, sales, expenses, subs, notes, settings, exportedAt: new Date().toISOString(), version: 5, appVersion: VERSION }, null, 2);
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
        if (mode === "replace") {
          await persistInv(data.inventory); await persistSales(data.sales); await persistExp(data.expenses);
          if (data.subs) await persistSubs(data.subs);
          // Notes: prefer new array; fall back to legacy single notepad
          if (Array.isArray(data.notes)) {
            setNotes(data.notes);
            await save("arch-notes", data.notes);
            if (data.notes.length) setActiveNoteId(data.notes[0].id);
          } else if (data.notepad && data.notepad.content) {
            const migrated = [{
              id: genId(), title: "Imported notes", content: data.notepad.content,
              fontSize: data.notepad.fontSize || 14, pinned: false,
              createdAt: data.notepad.updatedAt || Date.now(), updatedAt: data.notepad.updatedAt || Date.now(),
            }];
            setNotes(migrated); setActiveNoteId(migrated[0].id);
            await save("arch-notes", migrated);
          }
          if (data.settings) await persistSettings(data.settings);
          setBackupStatus("Replaced all data!");
        }
        else {
          const sFps = new Set(sales.map((s) => `${s.name}|${s.saleDate}|${s.salePrice}|${s.profit}`));
          const iIds = new Set(inventory.map((i) => i.id)); const eIds = new Set(expenses.map((e) => e.id)); const sbIds = new Set(subs.map((s) => s.id)); const noteIds = new Set(notes.map((n) => n.id));
          const ni = data.inventory.filter((i) => !iIds.has(i.id));
          const ns = data.sales.filter((s) => { const fp = `${s.name}|${s.saleDate}|${s.salePrice}|${s.profit}`; if (sFps.has(fp)) return false; sFps.add(fp); return true; });
          const ne = data.expenses.filter((e) => !eIds.has(e.id));
          const nsb = (data.subs || []).filter((s) => !sbIds.has(s.id));
          let nn = [];
          if (Array.isArray(data.notes)) {
            nn = data.notes.filter((n) => !noteIds.has(n.id));
          } else if (data.notepad && data.notepad.content) {
            // Legacy single notepad → bring in as a new note (always appended, never duplicates)
            nn = [{
              id: genId(), title: "Imported notes", content: data.notepad.content,
              fontSize: data.notepad.fontSize || 14, pinned: false,
              createdAt: data.notepad.updatedAt || Date.now(), updatedAt: data.notepad.updatedAt || Date.now(),
            }];
          }
          if (ni.length) await persistInv([...inventory, ...ni]);
          if (ns.length) await persistSales([...sales, ...ns].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")));
          if (ne.length) await persistExp([...expenses, ...ne].sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"")));
          if (nsb.length) await persistSubs([...subs, ...nsb]);
          if (nn.length) {
            const merged = [...notes, ...nn];
            setNotes(merged);
            await save("arch-notes", merged);
          }
          setBackupStatus(`Merged: +${ni.length} items, +${ns.length} sales, +${ne.length} expenses, +${nsb.length} subs, +${nn.length} notes`);
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
    const pbd = {}; fs.forEach((s) => { pbd[s.saleDate] = (pbd[s.saleDate]||0) + s.profit; });
    let cum = 0; const spark = Object.keys(pbd).sort().map((d) => { cum += pbd[d]; return cum; });
    const ri = [...inventory].sort((a, b) => (b.addedAt||0) - (a.addedAt||0)).slice(0, 7);
    const rs = [...fs].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")).slice(0, 7);
    return { salesIncome, grossProfit, totalExpenses, netProfit, invValue, cnt, aov, sellThrough, totalFees, spark, ri, rs };
  }, [inventory, sales, expenses, range, customFrom, customTo, dashCat, dashPlat]);

  // ─── Preorder reminders ───
  const upcomingPreorders = useMemo(() => {
    return inventory
      .filter((i) => i.preorderDate)
      .map((i) => ({ ...i, _bdays: businessDaysUntil(i.preorderDate) }))
      .filter((i) => i._bdays !== null && i._bdays >= 0 && i._bdays <= PREORDER_THRESHOLD)
      .sort((a, b) => a._bdays - b._bdays);
  }, [inventory]);

  // ─── Subscription summary ───
  const subStats = useMemo(() => {
    const active = subs.filter((s) => s.active);
    const monthlyBurn = active.reduce((a, s) => a + monthlyEquiv(s.amount, s.frequency), 0);
    const overdue = active.filter((s) => s.nextDue <= today());
    const dueSoon = active.filter((s) => {
      if (s.nextDue <= today()) return false;
      const d = new Date(s.nextDue); const now = new Date(); now.setHours(0,0,0,0);
      const diffDays = Math.round((d - now) / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    });
    return { monthlyBurn, overdue, dueSoon, activeCount: active.length };
  }, [subs]);

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
    if (expFrom) f = f.filter((e) => e.purchaseDate >= expFrom);
    if (expTo) f = f.filter((e) => e.purchaseDate <= expTo);
    return f;
  }, [expenses, expSearch, expFrom, expTo]);

  const sortedSubs = useMemo(() => [...subs].sort((a, b) => (a.nextDue||"").localeCompare(b.nextDue||"")), [subs]);

  const selectedValue = useMemo(() => inventory.filter((i) => selectedInv.has(i.id)).reduce((a, i) => a + i.price, 0), [inventory, selectedInv]);
  const toggleSel = (id) => setSelectedInv((p) => { const n = new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => { if (selectedInv.size === filteredInv.length) setSelectedInv(new Set()); else setSelectedInv(new Set(filteredInv.map((i) => i.id))); };

  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);
  const sortedNotes = useMemo(() => {
    let f = notes;
    if (noteSearch) {
      const q = noteSearch.toLowerCase();
      f = f.filter((n) => (n.title || "").toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q));
    }
    return [...f].sort((a, b) => (b.pinned - a.pinned) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
  }, [notes, noteSearch]);
  const noteWordCount = activeNote && activeNote.content.trim() ? activeNote.content.trim().split(/\s+/).length : 0;
  const noteCharCount = activeNote ? activeNote.content.length : 0;

  if (loading) return <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>Loading...</div>;

  const navItems = [
    { id: "dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
    { id: "inventory", icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12" },
    { id: "sales", icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01" },
    { id: "expenses", icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
    { id: "subs", icon: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M20.49 15a9 9 0 01-14.85 3.36L1 14" },
    { id: "notepad", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
    { id: "backup", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" },
    { id: "settings", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z" },
  ];
  const rb = (r) => ({ padding: "5px 10px", fontSize: 11, fontWeight: range === r ? 600 : 400, borderRadius: 6, background: range === r ? "#1d4ed8" : "transparent", color: range === r ? "#fff" : "#6b7280", border: "none", cursor: "pointer" });

  const renderPreBadge = (item) => {
    if (!item.preorderDate) return null;
    const bd = businessDaysUntil(item.preorderDate);
    const b = preorderBadge(bd);
    if (!b) return null;
    return <span style={badge(b.bg, b.fg)}>{b.text}</span>;
  };

  const invRow = (item, isGroupChild) => (
    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "30px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: isGroupChild ? "8px 16px 8px 46px" : "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: selectedInv.has(item.id) ? "#1e293b" : isGroupChild ? "#0d111788" : "transparent" }}>
      <input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={cb} />
      <div style={{ overflow: "hidden" }}><div style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}{item.inTransit && <span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}{renderPreBadge(item)}</div>{item.brand && <div style={{ fontSize: 10, color: "#6b7280" }}>{item.brand}</div>}</div>
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
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {/* SIDEBAR */}
      <div style={{ width: 54, background: "#0b0f19", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 2, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 15, fontWeight: 800, color: "#fff" }}>A</div>
        {navItems.map((n) => (<button key={n.id} onClick={() => setPage(n.id)} title={n.id} style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", background: page===n.id?"#1e293b":"transparent", color: page===n.id?"#60a5fa":"#4b5563", position: "relative" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
          {n.id === "subs" && subStats.overdue.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />}
          {n.id === "dashboard" && upcomingPreorders.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#60a5fa" }} />}
        </button>))}
        <div style={{ marginTop: "auto", paddingBottom: 12, fontSize: 9, color: "#374151", letterSpacing: 0.5, fontWeight: 600 }} title="Version">v{VERSION}</div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Live Sydney time bar */}
        <TopBar saveStatus={saveStatus} />

        {/* ══ DASHBOARD ══ */}
        {page === "dashboard" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Dashboard</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventory.length} in stock · {sales.length} total sales</p></div>
            <div style={{ display: "flex", gap: 3, background: "#111827", borderRadius: 8, padding: 3, border: "1px solid #1f2937", flexWrap: "wrap" }}>{TIME_RANGES.map((r) => <button key={r} style={rb(r)} onClick={() => setRange(r)}>{r}</button>)}</div>
          </div>

          {/* Preorder reminder banner */}
          {upcomingPreorders.length > 0 && (<div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #1f2937 100%)", border: "1px solid #2563eb55", borderRadius: 12, padding: "14px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
                <span style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>Preorders releasing soon</span>
                <span style={{ background: "#2563eb", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{upcomingPreorders.length}</span>
              </div>
              <button onClick={() => setPage("inventory")} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>View all</button>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {upcomingPreorders.slice(0, 5).map((i) => {
                const b = preorderBadge(i._bdays);
                return (<div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#0d1117aa", borderRadius: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                    {i.brand && <span style={{ color: "#4b5563", fontSize: 11 }}>· {i.brand}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#6b7280", fontSize: 11 }}>{i.preorderDate}</span>
                    <span style={{ background: b.bg, color: b.fg, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{b.text}</span>
                  </div>
                </div>);
              })}
              {upcomingPreorders.length > 5 && <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center", paddingTop: 4 }}>+{upcomingPreorders.length - 5} more</div>}
            </div>
          </div>)}

          {/* Subscription overdue banner */}
          {subStats.overdue.length > 0 && (<div style={{ background: "#3b1414", border: "1px solid #ef444455", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, color: "#fca5a5" }}>
              <strong>{subStats.overdue.length}</strong> subscription{subStats.overdue.length>1?"s":""} due — {currency(subStats.overdue.reduce((a, s) => a + s.amount, 0))} total
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={logAllOverdue} style={{ ...primaryBtn, background: "#dc2626", padding: "6px 12px", fontSize: 12 }}>Log all due</button>
              <button onClick={() => setPage("subs")} style={{ ...ghostBtn, padding: "6px 12px", fontSize: 12 }}>Manage</button>
            </div>
          </div>)}

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            <KPI label="Sales income" value={currency(stats.salesIncome)} /><KPI label="Net profit" value={currency(stats.netProfit)} accent={stats.netProfit>=0?"#34d399":"#f87171"} /><KPI label="Gross profit" value={currency(stats.grossProfit)} accent={stats.grossProfit>=0?"#34d399":"#f87171"} /><KPI label="Inventory value" value={currency(stats.invValue)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
            <KPI label="Sales count" value={stats.cnt} /><KPI label="Avg. order value" value={currency(stats.aov)} /><KPI label="Total expenses" value={currency(stats.totalExpenses)} accent="#f59e0b" /><KPI label="Monthly subs burn" value={currency(subStats.monthlyBurn)} accent="#f59e0b" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Sales</div>
              {stats.rs.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No sales</div>:stats.rs.map((s) => (<div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722" }}><div><div style={{ fontSize: 13, color: "#e5e7eb" }}>{s.name}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{s.platform} · {s.size||"OS"} · {s.saleDate}{s.customer?` · ${s.customer}`:""}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(s.salePrice)}</div><div style={{ fontSize: 11, color: s.profit>=0?"#34d399":"#f87171" }}>{currency(s.profit)}</div></div></div>))}
            </div>
            <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Inventory</div>
              {stats.ri.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No items</div>:stats.ri.map((i) => (<div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722" }}><div><div style={{ fontSize: 13, color: "#e5e7eb" }}>{i.name}{i.inTransit&&<span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}{renderPreBadge(i)}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{i.category} · {i.size||"OS"}{i.brand?` · ${i.brand}`:""}</div></div><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(i.price)}</div></div>))}
            </div>
          </div>
        </div>)}

        {/* ══ INVENTORY ══ */}
        {page === "inventory" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Inventory</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventory.length} items · {currency(inventory.reduce((a, i) => a + i.price, 0))}</p></div>
            <div style={{ display: "flex", gap: 6 }}>
              {selectedInv.size > 0 && <><button onClick={() => setBulkEditOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedInv.size}</button><button onClick={() => setConfirmDel({ type: "multi", name: `${selectedInv.size} items` })} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedInv.size}</button></>}
              <button onClick={() => { setInvForm({ ...emptyInv, category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||"") }); setAddDirty(false); setAddInvOpen(true); }} style={primaryBtn}>+ Add inventory</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
            <select value={invCat} onChange={(e) => setInvCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={invSort} onChange={(e) => setInvSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option><option value="price_desc">Price ↓</option><option value="price_asc">Price ↑</option><option value="date_desc">Newest</option><option value="date_asc">Oldest</option></select>
            <label style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={invCollapse} onChange={(e) => setInvCollapse(e.target.checked)} style={cb} />Group</label>
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
          <div style={{ marginBottom: 16 }}><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Sales</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{sales.length} sales · {currency(sales.reduce((a, s) => a + s.salePrice, 0))} revenue · {currency(sales.reduce((a, s) => a + s.profit, 0))} profit</p></div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} style={{ ...inp, maxWidth: 190 }} />
            <select value={saleCat} onChange={(e) => setSaleCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={salePlat} onChange={(e) => setSalePlat(e.target.value)} style={{ ...sel, maxWidth: 160 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
            <select value={saleSort} onChange={(e) => setSaleSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A-Z</option><option value="profit_desc">Profit ↓</option><option value="profit_asc">Profit ↑</option><option value="sale_desc">Sale ↓</option></select>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredSales.length} · {currency(filteredSales.reduce((a, s) => a + s.profit, 0))} profit</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600 }}><span>Item</span><span>Platform</span><span>Size</span><span>Date</span><span>Cost</span><span>Sale</span><span>Profit</span><span>Actions</span></div>
            {filteredSales.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No sales</div>}
            {filteredSales.map((s) => (<div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711" }}>
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
            <button onClick={() => { setExpForm(emptyExp); setAddExpOpen(true); }} style={primaryBtn}>+ Add expense</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search..." value={expSearch} onChange={(e) => setExpSearch(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>From</span><input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} style={{ ...inp, maxWidth: 150 }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>To</span><input type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} style={{ ...inp, maxWidth: 150 }} />
            {(expFrom||expTo)&&<button onClick={() => { setExpFrom(""); setExpTo(""); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredExp.length} · {currency(filteredExp.reduce((a, e) => a + e.amount, 0))}</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2.5fr 120px 120px 50px", gap: 8, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600 }}><span>Name</span><span>Price</span><span>Date</span><span></span></div>
            {filteredExp.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No expenses</div>}
            {filteredExp.map((e) => (<div key={e.id} style={{ display: "grid", gridTemplateColumns: "2.5fr 120px 120px 50px", gap: 8, padding: "11px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711" }}><span style={{ color: "#e5e7eb" }}>{e.name}{e.tags&&<span style={{ fontSize: 10, color: "#4b5563", marginLeft: 6 }}>{e.tags}</span>}</span><span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(e.amount)}</span><span style={{ color: "#6b7280", fontSize: 12 }}>{e.purchaseDate}</span><button onClick={() => setConfirmDel({ type: "exp", id: e.id, name: e.name })} style={{ padding: "4px 8px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>✕</button></div>))}
          </div>
        </div>)}

        {/* ══ SUBSCRIPTIONS ══ */}
        {page === "subs" && (<div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Subscriptions</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{subStats.activeCount} active · {currency(subStats.monthlyBurn)}/mo · {currency(subStats.monthlyBurn * 12)}/yr</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {subStats.overdue.length > 0 && <button onClick={logAllOverdue} style={{ ...primaryBtn, background: "#dc2626" }}>Log {subStats.overdue.length} overdue</button>}
              <button onClick={() => setSubModalOpen("new")} style={primaryBtn}>+ Add subscription</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
            <KPI label="Active subs" value={subStats.activeCount} />
            <KPI label="Monthly burn" value={currency(subStats.monthlyBurn)} accent="#f59e0b" />
            <KPI label="Annual cost" value={currency(subStats.monthlyBurn * 12)} accent="#f59e0b" />
          </div>

          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 110px 110px 110px 110px 130px", gap: 6, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600 }}>
              <span>Name</span><span>Amount</span><span>Frequency</span><span>Monthly eq.</span><span>Next due</span><span>Actions</span>
            </div>
            {sortedSubs.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No subscriptions yet — add one to track recurring costs like eBay store fees.</div>}
            {sortedSubs.map((s) => {
              const overdue = s.active && s.nextDue <= today();
              const me = monthlyEquiv(s.amount, s.frequency);
              return (<div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 110px 110px 110px 110px 130px", gap: 6, padding: "11px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: overdue ? "#3b141433" : "transparent" }}>
                <div>
                  <div style={{ color: s.active ? "#e5e7eb" : "#6b7280" }}>{s.name}{!s.active && <span style={badge("#1f2937","#6b7280")}>PAUSED</span>}{overdue && <span style={badge("#3b1414","#fca5a5")}>OVERDUE</span>}</div>
                  {s.tags && <div style={{ fontSize: 10, color: "#4b5563" }}>{s.tags}</div>}
                </div>
                <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(s.amount)}</span>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>{FREQ_LABEL[s.frequency]}</span>
                <span style={{ color: "#f59e0b", fontSize: 12 }}>{currency(me)}</span>
                <span style={{ color: overdue ? "#fca5a5" : "#6b7280", fontSize: 11 }}>{s.nextDue}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  <button onClick={() => logSubPayment(s)} title="Log this payment" style={{ padding: "4px 7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Log</button>
                  <button onClick={() => setSubModalOpen(s)} style={{ padding: "4px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
                  <button onClick={async () => { await persistSubs(subs.map((x) => x.id === s.id ? { ...x, active: !x.active } : x)); }} title={s.active ? "Pause" : "Resume"} style={{ padding: "4px 7px", background: "#1f2937", color: s.active ? "#fbbf24" : "#34d399", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>{s.active ? "⏸" : "▶"}</button>
                  <button onClick={() => setConfirmDel({ type: "sub", id: s.id, name: s.name })} style={{ padding: "4px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
                </div>
              </div>);
            })}
          </div>
          <p style={{ fontSize: 11, color: "#4b5563", marginTop: 10, lineHeight: 1.5 }}>Subscriptions auto-flag when overdue. Click <strong>Log</strong> to record a single payment as an expense and advance the next-due date. <strong>Log all overdue</strong> catches up any missed cycles in one click.</p>
        </div>)}

        {/* ══ NOTEPAD ══ */}
        {page === "notepad" && (<div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", height: "calc(100vh - 41px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Notepad</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>
                {notes.length} note{notes.length === 1 ? "" : "s"}
                {activeNote ? ` · ${noteWordCount} words · ${noteCharCount} chars` : ""}
                {activeNote && activeNote.updatedAt ? ` · saved ${new Date(activeNote.updatedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}` : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0 }}>
            {/* LEFT: Notes list */}
            <div style={{ width: 240, background: "#111827", borderRadius: 12, border: "1px solid #1f2937", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ padding: 10, borderBottom: "1px solid #1f2937" }}>
                <button onClick={() => createNote()} style={{ ...primaryBtn, width: "100%", padding: "7px 10px", fontSize: 12 }}>+ New note</button>
              </div>
              <div style={{ padding: "8px 10px 0" }}>
                <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search…" style={{ ...inp, padding: "6px 10px", fontSize: 12 }} />
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "8px 6px" }}>
                {sortedNotes.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#374151" }}>No notes yet.<br />Hit "+ New note".</div>}
                {sortedNotes.map((n) => {
                  const isActive = n.id === activeNoteId;
                  const preview = (n.content || "").replace(/\n/g, " ").slice(0, 40) || "Empty";
                  const dateStr = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short" }) : "";
                  return (
                    <div key={n.id} onClick={() => setActiveNoteId(n.id)} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 3, cursor: "pointer", background: isActive ? "#1e293b" : "transparent", border: isActive ? "1px solid #2563eb55" : "1px solid transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        {n.pinned && <span style={{ fontSize: 9, color: "#fbbf24" }}>●</span>}
                        <div style={{ fontSize: 13, color: isActive ? "#f1f5f9" : "#d1d5db", fontWeight: isActive ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{n.title || "Untitled"}</div>
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>
                      <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{dateStr}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Editor */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              {!activeNote ? (
                <div style={{ flex: 1, background: "#111827", borderRadius: 12, border: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                  <div style={{ color: "#4b5563", fontSize: 13 }}>No note selected</div>
                  <button onClick={() => createNote()} style={primaryBtn}>+ Create your first note</button>
                </div>
              ) : (
                <>
                  {/* Title + actions row */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} placeholder="Note title" style={{ ...inp, flex: 1, minWidth: 200, fontSize: 15, fontWeight: 600 }} />
                    <button onClick={() => togglePin(activeNote.id)} title={activeNote.pinned ? "Unpin" : "Pin"} style={{ ...ghostBtn, padding: "7px 10px", fontSize: 12, color: activeNote.pinned ? "#fbbf24" : "#9ca3af" }}>{activeNote.pinned ? "★ Pinned" : "☆ Pin"}</button>
                    <button onClick={() => setConfirmDel({ type: "note", id: activeNote.id, name: activeNote.title || "Untitled" })} style={{ ...ghostBtn, padding: "7px 10px", fontSize: 12, color: "#f87171" }}>Delete</button>
                  </div>

                  {/* Toolbar row */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, padding: 6 }}>
                    <div style={{ display: "flex", gap: 2, background: "#1f2937", borderRadius: 6, padding: 2 }}>
                      <button onClick={() => setNoteMode("edit")} style={{ padding: "5px 12px", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", background: noteMode === "edit" ? "#2563eb" : "transparent", color: noteMode === "edit" ? "#fff" : "#9ca3af" }}>Edit</button>
                      <button onClick={() => setNoteMode("preview")} style={{ padding: "5px 12px", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", background: noteMode === "preview" ? "#2563eb" : "transparent", color: noteMode === "preview" ? "#fff" : "#9ca3af" }}>Preview</button>
                    </div>
                    <span style={{ width: 1, height: 22, background: "#1f2937", margin: "0 2px" }} />
                    <span style={{ fontSize: 11, color: "#6b7280" }}>Font</span>
                    <button onClick={() => { const idx = FONT_SIZES.indexOf(activeNote.fontSize); if (idx > 0) updateNote(activeNote.id, { fontSize: FONT_SIZES[idx - 1] }); }} style={{ ...ghostBtn, padding: "4px 9px", fontSize: 12, fontWeight: 700 }}>A−</button>
                    <select value={activeNote.fontSize} onChange={(e) => updateNote(activeNote.id, { fontSize: parseInt(e.target.value) })} style={{ ...sel, maxWidth: 75, padding: "5px 7px", fontSize: 12 }}>
                      {FONT_SIZES.map((f) => <option key={f} value={f}>{f}px</option>)}
                    </select>
                    <button onClick={() => { const idx = FONT_SIZES.indexOf(activeNote.fontSize); if (idx < FONT_SIZES.length - 1) updateNote(activeNote.id, { fontSize: FONT_SIZES[idx + 1] }); }} style={{ ...ghostBtn, padding: "4px 9px", fontSize: 14, fontWeight: 700 }}>A+</button>
                    <span style={{ width: 1, height: 22, background: "#1f2937", margin: "0 2px" }} />
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setTemplateMenuOpen((o) => !o)} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>+ Template ▾</button>
                      {templateMenuOpen && (
                        <>
                          <div onClick={() => setTemplateMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#0b0f19", border: "1px solid #1f2937", borderRadius: 8, padding: 4, minWidth: 200, zIndex: 11, boxShadow: "0 6px 18px rgba(0,0,0,0.5)" }}>
                            {TEMPLATES.map((t) => (
                              <button key={t.name} onClick={() => insertTemplate(t)} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#d1d5db", fontSize: 12, cursor: "pointer", borderRadius: 5, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#1f2937"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{t.name}</button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <button onClick={insertStamp} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }} title="Insert Sydney timestamp">+ Stamp</button>
                    <button onClick={() => insertAtCursor("- [ ] ")} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }} title="Insert checkbox">☐ Task</button>
                    <button onClick={() => {
                      if (!activeNote.content) return;
                      const safe = (activeNote.title || "note").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
                      const blob = new Blob([activeNote.content], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a"); a.href = url; a.download = `${safe}-${today()}.txt`; a.click(); URL.revokeObjectURL(url);
                    }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Export .txt</button>
                  </div>

                  {/* Body: edit or preview */}
                  {noteMode === "edit" ? (
                    <textarea
                      ref={editorRef}
                      value={activeNote.content}
                      onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                      placeholder={`Free-form notes for "${activeNote.title || "Untitled"}". Try - [ ] for tasks. Auto-saves as you type.`}
                      style={{
                        flex: 1, minHeight: 300, width: "100%", padding: 18,
                        background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12,
                        color: "#e5e7eb", fontSize: activeNote.fontSize,
                        fontFamily: "'JetBrains Mono', 'Menlo', monospace",
                        lineHeight: 1.6, outline: "none", resize: "none",
                        boxSizing: "border-box", tabSize: 2,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Tab") {
                          e.preventDefault();
                          const t = e.target;
                          const s = t.selectionStart, en = t.selectionEnd;
                          const v = activeNote.content;
                          const next = v.substring(0, s) + "  " + v.substring(en);
                          updateNote(activeNote.id, { content: next });
                          requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
                        }
                      }}
                    />
                  ) : (
                    <CheckboxPreview content={activeNote.content} fontSize={activeNote.fontSize} onToggle={toggleCheckboxAt} />
                  )}
                </>
              )}
            </div>
          </div>
        </div>)}

        {/* ══ BACKUP ══ */}
        {page === "backup" && (<div style={{ padding: "20px 24px", maxWidth: 600 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Backup & Restore</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#4b5563" }}>Export or import your data.</p>
          {backupStatus&&<div style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#93c5fd" }}>{backupStatus}</div>}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Export</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>{inventory.length} items · {sales.length} sales · {expenses.length} expenses · {subs.length} subs · {notes.length} notes</p>
            <div style={{ display: "flex", gap: 8 }}><button onClick={exportJSON} style={primaryBtn}>Download JSON</button><button onClick={exportCSV} style={ghostBtn}>Export Sales CSV</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Import</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Merge adds new records safely. Replace overwrites everything.</p>
            <div style={{ display: "flex", gap: 8 }}><button onClick={() => importBackup("merge")} style={primaryBtn}>Merge import (safe)</button><button onClick={() => { if (confirm("Replace ALL data?")) importBackup("replace"); }} style={{ ...ghostBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}>Replace import</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #ef444433", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Danger Zone</div>
            <button onClick={async () => { if (confirm("Delete ALL data?")) { await persistInv([]); await persistSales([]); await persistExp([]); await persistSubs([]); } }} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Clear all data</button>
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
        </div>)}
      </div>

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
        <Field label="Tags"><input value={expForm.tags} onChange={(e) => setExpForm({ ...expForm, tags: e.target.value })} style={inp} /></Field>
        <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 10px" }}>For recurring costs (e.g. eBay store fees), use <strong>Subscriptions</strong> instead — they auto-flag when due.</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}><button onClick={() => setAddExpOpen(false)} style={ghostBtn}>Cancel</button><button onClick={async () => { if (!expForm.name||!expForm.amount) return; await persistExp([{ id: genId(), name: expForm.name, amount: parseFloat(expForm.amount), purchaseDate: expForm.purchaseDate, tags: expForm.tags }, ...expenses]); setExpForm(emptyExp); setAddExpOpen(false); }} style={primaryBtn}>Create</button></div>
      </Modal>

      {sellOpen && <SellModal item={sellOpen} onSell={(sf) => handleSell(sellOpen, sf)} onClose={() => setSellOpen(null)} platforms={PLATS} customers={CUSTS} />}
      {editInvOpen && <EditInvModal item={editInvOpen} onSave={async (ef) => { await persistInv(inventory.map((i) => i.id===editInvOpen.id?{...i,...ef}:i)); setEditInvOpen(null); }} onClose={() => setEditInvOpen(null)} categories={CATS} customers={CUSTS} />}
      {editSaleOpen && <EditSaleModal sale={editSaleOpen} onSave={async (u) => { await persistSales(sales.map((s) => s.id===editSaleOpen.id?u:s)); if (u.customer) addCustomer(u.customer); setEditSaleOpen(null); }} onClose={() => setEditSaleOpen(null)} platforms={PLATS} customers={CUSTS} />}
      {bulkEditOpen && <BulkEditModal items={inventory.filter((i) => selectedInv.has(i.id))} onSave={handleBulkEdit} onClose={() => setBulkEditOpen(false)} categories={CATS} />}
      {subModalOpen && <SubModal sub={subModalOpen === "new" ? null : subModalOpen} onSave={saveSub} onClose={() => setSubModalOpen(null)} />}
      <ConfirmDialog open={!!confirmDel} msg={confirmDel?.type==="multi"?`Delete ${confirmDel.name}?`:`Delete "${confirmDel?.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />

      {/* ══ QUICK NOTE FLOATING WIDGET — visible on all pages except notepad ══ */}
      {page !== "notepad" && (
        <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 80 }}>
          {!quickNoteOpen ? (
            <button
              onClick={() => setQuickNoteOpen(true)}
              title="Quick note"
              style={{ width: 46, height: 46, borderRadius: "50%", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 6px 16px rgba(37,99,235,0.45)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 150ms" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
              </svg>
            </button>
          ) : (
            <div style={{ width: 340, height: 380, background: "#111827", borderRadius: 12, border: "1px solid #1f2937", display: "flex", flexDirection: "column", boxShadow: "0 12px 32px rgba(0,0,0,0.55)", overflow: "hidden" }}>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: 6 }}>
                {notes.length > 0 ? (
                  <select value={activeNoteId || ""} onChange={(e) => setActiveNoteId(e.target.value)} style={{ ...sel, flex: 1, padding: "5px 8px", fontSize: 12 }}>
                    {sortedNotes.map((n) => <option key={n.id} value={n.id}>{n.pinned ? "★ " : ""}{n.title || "Untitled"}</option>)}
                  </select>
                ) : (
                  <span style={{ flex: 1, fontSize: 12, color: "#6b7280" }}>No notes yet</span>
                )}
                <button onClick={() => createNote()} title="New note" style={{ ...ghostBtn, padding: "4px 8px", fontSize: 12 }}>+</button>
                <button onClick={() => { setPage("notepad"); setQuickNoteOpen(false); }} title="Open in notepad" style={{ ...ghostBtn, padding: "4px 8px", fontSize: 12 }}>↗</button>
                <button onClick={() => setQuickNoteOpen(false)} title="Close" style={{ ...ghostBtn, padding: "4px 8px", fontSize: 12 }}>✕</button>
              </div>
              {activeNote ? (
                <textarea
                  value={activeNote.content}
                  onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                  placeholder="Quick note… auto-saves."
                  style={{ flex: 1, padding: 12, background: "#0d1117", border: "none", color: "#e5e7eb", fontSize: 13, fontFamily: "'JetBrains Mono', 'Menlo', monospace", lineHeight: 1.5, outline: "none", resize: "none", boxSizing: "border-box" }}
                />
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, color: "#4b5563", textAlign: "center" }}>Create a note to start capturing ideas.</div>
                  <button onClick={() => createNote()} style={primaryBtn}>+ New note</button>
                </div>
              )}
              <div style={{ padding: "5px 10px", borderTop: "1px solid #1f2937", fontSize: 10, color: "#4b5563", display: "flex", justifyContent: "space-between" }}>
                <span>{activeNote ? `${activeNote.content.length} chars` : ""}</span>
                <span>Auto-saving</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
