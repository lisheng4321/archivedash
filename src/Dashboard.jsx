import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { load, save, supabase } from "./supabase.js";
import Calculator from "./Calculator";

const DEF_CATEGORIES = ["Sneakers", "Apparel", "Accessories", "Collectables"];
const DEF_PLATFORMS = ["eBay AU", "StockX", "Facebook Marketplace", "Instagram", "Depop", "Discord", "GOAT", "CSFloat", "Bonusbank", "Other"];
const TIME_RANGES = ["1D", "1W", "1M", "MTD", "3M", "YTD", "1Y", "ALL", "Custom"];
const DEF_SIZE_MAP = {
  Sneakers: ["US 3","US 3.5","US 4","US 4.5","US 5","US 5.5","US 6","US 6.5","US 7","US 7.5","US 8","US 8.5","US 9","US 9.5","US 10","US 10.5","US 11","US 11.5","US 12","US 12.5","US 13","US 14","US 15"],
  Apparel: ["XXS","XS","S","M","L","XL","XXL"],
};
const getDefaultSize = (cat) => DEF_SIZE_MAP[cat]?.[0] || "OS";
const getSizes = (cat) => DEF_SIZE_MAP[cat] || ["OS"];
const EXP_CATEGORIES = ["Shipping & Fulfillment", "Botting Resources", "Cook Groups & Retail Memberships", "Matched Betting", "Software & Subs", "Inventory Parts", "Other"];

const VERSION = "0.6.0";
const PREORDER_THRESHOLD = 40; // business days before release that triggers a reminder
const FREQ_OPTIONS = ["weekly", "fortnightly", "monthly", "yearly"];
const FREQ_LABEL = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", yearly: "Yearly" };
const EBAY_AU_FEE_RATE = 0.1165;

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32];

// ─── Notepad templates ───
// Use ${date} placeholder — replaced with today's Sydney date when inserted.
// HTML allowed (matches the rich-text contentEditable model).
const TEMPLATES = [
  {
    name: "Presale listing",
    body: `<b>Presale — \${date}</b><div>Item: </div><div>Source: </div><div>Cost per unit: AU$</div><div>Quantity: </div><div>Release date: </div><div>eBay title: </div><div><br></div><div><label><input type="checkbox"> AU comps researched</label></div><div><label><input type="checkbox"> Listing photos</label></div><div><label><input type="checkbox"> Listed on eBay</label></div><div><label><input type="checkbox"> Posted to FB groups</label></div><div><label><input type="checkbox"> Customer DMs sent</label></div><div><label><input type="checkbox"> Restock check</label></div>`,
  },
  {
    name: "Restock checklist",
    body: `<b>Restock — \${date}</b><div><br></div><div><label><input type="checkbox"> Diecast (Mini GT, Kaido House, Tarmac, Inno64)</label></div><div><label><input type="checkbox"> Pokémon TCG sealed</label></div><div><label><input type="checkbox"> OPTCG presales</label></div><div><label><input type="checkbox"> Coins (presale + back catalogue)</label></div><div><label><input type="checkbox"> Update eBay storefront banners</label></div><div><label><input type="checkbox"> Refresh listing titles</label></div>`,
  },
  {
    name: "FB group post cluster",
    body: `<b>Post cluster — \${date}</b><div><br></div><div><label><input type="checkbox"> Pokémon TCG groups</label></div><div><label><input type="checkbox"> Diecast groups</label></div><div><label><input type="checkbox"> AHUA Auctions</label></div><div><label><input type="checkbox"> OPTCG groups</label></div><div><label><input type="checkbox"> Coins groups</label></div><div><br></div><div>Caption: </div><div>Photos: </div><div>Pricing anchor: </div>`,
  },
  {
    name: "Customer order",
    body: `<b>Customer order</b><div>Customer: </div><div>Item: </div><div>Sale price: AU$</div><div>Platform: </div><div>Sale date: </div><div><br></div><div><label><input type="checkbox"> Payment received</label></div><div><label><input type="checkbox"> Packed</label></div><div><label><input type="checkbox"> Shipped</label></div><div><label><input type="checkbox"> Tracking sent</label></div><div><label><input type="checkbox"> Delivered</label></div><div><label><input type="checkbox"> Feedback left</label></div>`,
  },
  {
    name: "HK sourcing trip",
    body: `<b>HK Sourcing — targets</b><div><br></div><div><label><input type="checkbox"> HK Toycar Salon exclusives</label></div><div><label><input type="checkbox"> Tarmac / Inno64 store exclusives</label></div><div><label><input type="checkbox"> Pop Mart releases</label></div><div><label><input type="checkbox"> Pokémon / OPTCG sealed</label></div><div><label><input type="checkbox"> BAPE HK exclusives</label></div><div><label><input type="checkbox"> Compare HKD vs AUD margins</label></div><div><label><input type="checkbox"> Negotiate multi-unit pricing</label></div>`,
  },
];

const renderTemplate = (body) => body.replace(/\$\{date\}/g, new Date().toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" }));

// Strip HTML for note previews
const stripHtml = (html) => {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
};

// ─── Business day & subscription helpers ───
const businessDaysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const sign = target >= start ? 1 : -1;
  let count = 0;
  const cur = new Date(start);
  const end = new Date(target);
  if (sign < 0) { cur.setTime(target.getTime()); end.setTime(start.getTime()); }
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return sign * count;
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
  const a = parseFloat(amount) || 0;
  if (freq === "weekly") return a * 52 / 12;
  if (freq === "fortnightly") return a * 26 / 12;
  if (freq === "monthly") return a;
  if (freq === "yearly") return a / 12;
  return a;
};

const preorderBadge = (bdays) => {
  if (bdays === null || bdays === undefined) return null;
  if (bdays < 0) return { bg: "#3b1f2b", fg: "#f472b6", text: "RELEASED" };
  if (bdays <= 5) return { bg: "#3b1f1f", fg: "#f87171", text: `${bdays}bd` };
  if (bdays <= 15) return { bg: "#3b2f1f", fg: "#fbbf24", text: `${bdays}bd` };
  if (bdays <= PREORDER_THRESHOLD) return { bg: "#1e3a5f", fg: "#60a5fa", text: `${bdays}bd` };
  return { bg: "#1f2937", fg: "#9ca3af", text: `${bdays}bd` };
};

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
    case "1Y": return daysAgo(365);
    default: return "2000-01-01";
  }
};

// ─── Mobile detection hook ───
function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const onR = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return m;
}

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

function Modal({ open, onClose, title, children, guardedClose, maxWidth = 560 }) {
  if (!open) return null;
  const close = guardedClose || onClose;
  return (<div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={(e) => e.stopPropagation()} style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto" }}>
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
function KPI({ label, value, accent }) { return (<div style={{ background: "#111827", borderRadius: 10, padding: "14px 16px", border: "1px solid #1f2937", flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, color: accent || "#f1f5f9" }}>{value}</div></div>); }

// ─── Sydney clock + save status top bar ───
function TopBar({ saveStatus, isMobile }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    timeZoneName: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const dateStr = `${get("weekday")}, ${get("day")} ${get("month")}`;
  const timeStr = `${get("hour")}:${get("minute")}:${get("second")}`;
  const tz = get("timeZoneName");
  const dot = saveStatus === "saving" ? "#f59e0b" : saveStatus === "saved" ? "#34d399" : "#374151";
  const dotLabel = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Idle";
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 90, background: "#0b0f19", borderBottom: "1px solid #1f2937", padding: isMobile ? "6px 12px" : "6px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#6b7280", height: 32, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", whiteSpace: "nowrap" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#4b5563", flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{`${dateStr}, ${timeStr} ${tz}`}</span>
        {!isMobile && <span style={{ color: "#4b5563" }}>· Sydney</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, transition: "background 200ms" }} />
        {!isMobile && <span>{dotLabel}</span>}
      </div>
    </div>
  );
}

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

// ─── Edit Sale Modal ───
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
    return { ...item, sp, ship, fees, profit: sp - item.price - ship - fees };
  });
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const allPriced = selectedItems.length > 0 && previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Add Sale" maxWidth={980}>
    <Row cols={3}><Field label="Platform" req><select value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input list="cust-manual-sale" value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-manual-sale">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Selected</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f1f5f9", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </div>
    <Field label="Search inventory"><input value={query} onChange={(e) => setQuery(e.target.value)} style={inp} placeholder="Search name, brand, category..." autoFocus /></Field>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 0.95fr) minmax(500px, 1.3fr)", gap: 14, minHeight: 360 }}>
      <div style={{ border: "1px solid #1f2937", borderRadius: 8, overflow: "auto", maxHeight: 360, background: "#0d1117" }}>
        {filtered.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#4b5563", fontSize: 12 }}>No inventory matches.</div>}
        {filtered.map((item, index) => {
          const checked = selectedIds.has(item.id);
          return (
            <div key={item.id} onClick={() => toggle(item)} style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #1f293722", background: checked ? "#1e293b" : (index % 2 === 0 ? "#0d131f" : "#111827") }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(item)} onClick={(e) => e.stopPropagation()} style={cb} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ color: "#6b7280", fontSize: 10 }}>{item.category}{item.brand ? ` · ${item.brand}` : ""} · {item.size || "OS"}</div>
              </div>
              <div style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700 }}>{currency(item.price)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ border: "1px solid #1f2937", borderRadius: 8, overflow: "auto", maxHeight: 360, background: "#0d1117" }}>
        {selectedItems.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#4b5563", fontSize: 12 }}>Select inventory to price the sale.</div>}
        {selectedItems.map((item) => {
          const r = rows[item.id] || {};
          const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
          const profit = sp - item.price - ship - fees;
          return (
            <div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #1f293744", background: "#0d1117" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
                <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div><div style={{ fontSize: 10, color: "#6b7280" }}>Cost {currency(item.price)}</div></div>
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
  const feeTotal = rawFeeTotal > 0 ? rawFeeTotal : Number((saleTotal * EBAY_AU_FEE_RATE).toFixed(2));
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
    return { ...item, sp, ship, fees, profit: sp - item.price - ship - fees };
  });
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const totalShip = previews.reduce((a, p) => a + p.ship, 0);
  const totalFees = previews.reduce((a, p) => a + p.fees, 0);
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const allPriced = previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={() => setShowU(true)} title="Review eBay Sale">
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{draft.item_title}</div>
      <div style={{ color: "#6b7280", fontSize: 11 }}>Order {draft.order_id || "unknown"} · qty {qty} · {draft.buyer_username || "Unknown buyer"}</div>
    </div>
    <Row cols={3}><Field label="Platform"><input value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} /></Field></Row>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f1f5f9", fontWeight: 700 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Shipping</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{currency(totalShip)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Fees</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{currency(totalFees)}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 800 }}>{currency(totalProfit)}</div></div>
    </div>
    {rawFeeTotal <= 0 && <div style={{ fontSize: 11, color: "#fbbf24", margin: "-2px 0 10px" }}>Fees are estimated from eBay AU at {(EBAY_AU_FEE_RATE * 100).toFixed(2)}%. Edit them before recording if eBay shows a different amount.</div>}
    <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 8, border: "1px solid #1f2937" }}>
      {items.map((item) => {
        const r = rows.find((x) => x.id === item.id) || {};
        const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
        const profit = sp - item.price - ship - fees;
        return (<div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #1f293744", background: "#0d1117" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
            <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div><div style={{ color: "#6b7280", fontSize: 11 }}>{item.category} · cost {currency(item.price)}</div></div>
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
    preorderDate: "",
    brand: draft.vendor || "",
    inTransit: false,
    tags: draft.order_reference ? `Gmail ${draft.order_reference}` : "Gmail import",
    customer: "",
  });
  const [showU, setShowU] = useState(false);
  const up = (u) => setForm({ ...form, ...u });
  const total = (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 1);

  return (<><Modal open={true} onClose={onClose} guardedClose={() => setShowU(true)} title="Review Gmail Inventory" maxWidth={720}>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{draft.subject || draft.item_title}</div>
      <div style={{ color: "#6b7280", fontSize: 11 }}>{draft.sender || "Unknown sender"} · {draft.email_date || "No date"}</div>
    </div>
    <Field label="Product name" req><input value={form.name} onChange={(e) => up({ name: e.target.value })} style={inp} autoFocus /></Field>
    <Row cols={3}><Field label="Category"><select value={form.category} onChange={(e) => up({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Size"><select value={form.size} onChange={(e) => up({ size: e.target.value })} style={sel}>{getSizes(form.category).map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Unit cost"><input type="number" step="0.01" value={form.price} onChange={(e) => up({ price: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Quantity"><input type="number" min="1" value={form.quantity} onChange={(e) => up({ quantity: e.target.value })} style={inp} /></Field><Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field><Field label="Preorder date"><input type="date" value={form.preorderDate} onChange={(e) => up({ preorderDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Brand / vendor"><input value={form.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={form.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", marginBottom: 12 }}><input type="checkbox" checked={form.inTransit} onChange={(e) => up({ inTransit: e.target.checked })} style={cb} /> In Transit</label>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12 }}>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Source</div><div style={{ color: "#f1f5f9", fontWeight: 700 }}>{draft.vendor || "Gmail"}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Quantity</div><div style={{ color: "#f1f5f9", fontWeight: 700 }}>{form.quantity || 1}</div></div>
      <div><div style={{ color: "#4b5563", marginBottom: 2 }}>Total cost</div><div style={{ color: "#f1f5f9", fontWeight: 700 }}>{currency(total)}</div></div>
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
      editorRef.current.innerHTML = note.content || "";
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

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    if (editorRef.current) onUpdate({ content: editorRef.current.innerHTML });
  };

  const insertHtml = (html) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertHTML", false, html);
    onUpdate({ content: editorRef.current.innerHTML });
  };

  const insertCheckbox = () => {
    insertHtml(`<div><label><input type="checkbox"> </label></div>`);
  };

  const insertTemplate = (tpl) => {
    insertHtml(renderTemplate(tpl.body));
    setTplOpen(false);
  };

  const bumpFont = (delta) => {
    const idx = FONT_SIZES.indexOf(fontSize);
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, (idx === -1 ? 2 : idx) + delta));
    onUpdate({ fontSize: FONT_SIZES[nextIdx] });
  };

  // Click handler for any rendered checkbox inside the editor
  const onEditorClick = (e) => {
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "checkbox") {
      if (t.checked) t.setAttribute("checked", "checked"); else t.removeAttribute("checked");
      requestAnimationFrame(() => {
        if (editorRef.current) onUpdate({ content: editorRef.current.innerHTML });
      });
    }
  };

  const tBtn = { width: 30, height: 28, background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 13, cursor: "pointer", flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid #1f2937", flexWrap: "wrap", alignItems: "center" }}>
        <button onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} title="Bold" style={{ ...tBtn, fontWeight: 800 }}>B</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} title="Italic" style={{ ...tBtn, fontStyle: "italic" }}>I</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} title="Underline" style={{ ...tBtn, textDecoration: "underline" }}>U</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} title="Bullet list" style={{ ...tBtn, fontSize: 16, lineHeight: 1 }}>•</button>
        <button onMouseDown={(e) => { e.preventDefault(); insertCheckbox(); }} title="Insert checkbox" style={{ ...tBtn, fontSize: 12 }}>☑</button>

        {!compact && (<>
          <span style={{ width: 1, height: 18, background: "#1f2937", margin: "0 2px" }} />
          <button onMouseDown={(e) => { e.preventDefault(); bumpFont(-1); }} title="Smaller text" style={{ ...tBtn, fontWeight: 700 }}>A−</button>
          <select value={fontSize} onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })} title="Font size" style={{ ...sel, height: 28, padding: "0 6px", fontSize: 12, width: 64, flexShrink: 0 }}>
            {FONT_SIZES.map((f) => <option key={f} value={f}>{f}px</option>)}
          </select>
          <button onMouseDown={(e) => { e.preventDefault(); bumpFont(1); }} title="Bigger text" style={{ ...tBtn, fontSize: 15, fontWeight: 700 }}>A+</button>
        </>)}

        {showTemplates && templates.length > 0 && (
          <div style={{ position: "relative", marginLeft: 4 }}>
            <button onMouseDown={(e) => { e.preventDefault(); setTplOpen((o) => !o); }} title="Insert template" style={{ ...tBtn, width: "auto", padding: "0 10px", fontSize: 11 }}>+ Template ▾</button>
            {tplOpen && (
              <>
                <div onClick={() => setTplOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#0b0f19", border: "1px solid #1f2937", borderRadius: 8, padding: 4, minWidth: 220, zIndex: 11, boxShadow: "0 6px 18px rgba(0,0,0,0.5)" }}>
                  {templates.map((t) => (
                    <button key={t.id} onMouseDown={(e) => { e.preventDefault(); insertTemplate(t); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#d1d5db", fontSize: 12, cursor: "pointer", borderRadius: 5, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#1f2937"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{t.name}</button>
                  ))}
                  {onManageTemplates && (<>
                    <div style={{ height: 1, background: "#1f2937", margin: "4px 0" }} />
                    <button onMouseDown={(e) => { e.preventDefault(); setTplOpen(false); onManageTemplates(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer", borderRadius: 5, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#1f2937"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>⚙ Manage templates…</button>
                  </>)}
                </div>
              </>
            )}
          </div>
        )}

        {!compact && onExport && (
          <button onClick={onExport} title="Export this note as .txt" style={{ ...tBtn, width: "auto", padding: "0 10px", fontSize: 11, marginLeft: "auto" }}>Export .txt</button>
        )}
      </div>
      <div
        ref={editorRef}
        className="np-edit"
        contentEditable
        onInput={(e) => onUpdate({ content: e.currentTarget.innerHTML })}
        onClick={onEditorClick}
        suppressContentEditableWarning
        style={{ flex: 1, background: "#0d1117", color: "#e5e7eb", border: "none", padding: 16, fontSize, lineHeight: 1.7, outline: "none", fontFamily: "'DM Sans', sans-serif", overflowY: "auto", minHeight: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      />
    </div>
  );
}

// ─── Subscription Modal ───
function SubModal({ sub, onSave, onClose }) {
  const [sf, setSf] = useState(sub ? { ...sub } : { name: "", amount: "", frequency: "monthly", nextDue: today(), tags: "", active: true });
  const [dirty, setDirty] = useState(false);
  const [showU, setShowU] = useState(false);
  const up = (u) => { setSf({ ...sf, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const me = monthlyEquiv(sf.amount, sf.frequency);
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={sub ? "Edit subscription" : "Add subscription"}>
    <Field label="Name" req><input value={sf.name} onChange={(e) => up({ name: e.target.value })} style={inp} placeholder="e.g. eBay Pro Basic" autoFocus /></Field>
    <Row><Field label="Amount (AU$)" req><input type="number" step="0.01" value={sf.amount} onChange={(e) => up({ amount: e.target.value })} style={inp} placeholder="0.00" /></Field><Field label="Frequency"><select value={sf.frequency} onChange={(e) => up({ frequency: e.target.value })} style={sel}>{FREQ_OPTIONS.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}</select></Field></Row>
    <Row><Field label="Next due" req><input type="date" value={sf.nextDue} onChange={(e) => up({ nextDue: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", marginBottom: 10 }}><input type="checkbox" checked={sf.active} onChange={(e) => up({ active: e.target.checked })} style={cb} /> Active (auto-log when due)</label>
    {parseFloat(sf.amount) > 0 && (
      <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, fontSize: 12, color: "#9ca3af" }}>
        Monthly equivalent: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{currency(me)}</span>
        <span style={{ color: "#4b5563" }}> · {currency(me * 12)}/yr</span>
      </div>
    )}
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!sf.name || !sf.amount || !sf.nextDue) return; onSave({ ...sf, amount: parseFloat(sf.amount) }); }} style={primaryBtn}>{sub ? "Save" : "Add subscription"}</button></div>
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
    <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
      Templates inserted from the notepad toolbar. HTML is allowed. Use <code style={{ background: "#1f2937", padding: "1px 4px", borderRadius: 3 }}>{"${date}"}</code> to insert today's Sydney date when used.
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
            <div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}{t.builtIn && <span style={badge("#1f2937", "#6b7280")}>SEED</span>}</div>
            <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtml(t.body).slice(0, 80) || "Empty"}</div>
          </div>
          <button onClick={() => startEdit(t)} style={{ padding: "4px 9px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
          <button onClick={() => removeTpl(t.id)} style={{ padding: "4px 9px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
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

// ═══ MAIN APP ═══
export default function App({ onLogout, userEmail }) {
  const isMobile = useIsMobile();
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [subs, setSubs] = useState([]);
  const [subModalOpen, setSubModalOpen] = useState(null); // null | "new" | sub object
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
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState(null); // null = not loaded; array once loaded
  const [tplManagerOpen, setTplManagerOpen] = useState(false);
  const [selectedExp, setSelectedExp] = useState(new Set());
  const [bulkEditExpOpen, setBulkEditExpOpen] = useState(false);
  const [selectedSales, setSelectedSales] = useState(new Set());
  const [bulkEditSaleOpen, setBulkEditSaleOpen] = useState(false);
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [ebayImports, setEbayImports] = useState([]);
  const [ebayBusy, setEbayBusy] = useState(false);
  const [ebayStatus, setEbayStatus] = useState("");
  const [ebayQueueOpen, setEbayQueueOpen] = useState(false);
  const [ebayReviewOpen, setEbayReviewOpen] = useState(null);
  const [gmailImports, setGmailImports] = useState([]);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailStatus, setGmailStatus] = useState("");
  const [gmailQueueOpen, setGmailQueueOpen] = useState(false);
  const [gmailReviewOpen, setGmailReviewOpen] = useState(null);

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
      const [i, s, e, sb, st, existingNotes, oldNotepad, savedActiveId, existingTpls] = await Promise.all([
        load("arch-inv2", []),
        load("arch-sales2", []),
        load("arch-exp2", []),
        load("arch-subs", []),
        load("arch-settings", { categories: DEF_CATEGORIES, platforms: DEF_PLATFORMS, customers: [] }),
        load("arch-notes", null),
        load("arch-notepad", null),
        load("arch-notes-active", null),
        load("arch-templates", null),
      ]);

      // Migrate old single-notepad → first note in multi-note model
      let initialNotes = existingNotes;
      if (!Array.isArray(initialNotes)) {
        if (oldNotepad && (typeof oldNotepad === "string" ? oldNotepad : oldNotepad.content)) {
          const content = typeof oldNotepad === "string" ? oldNotepad : oldNotepad.content;
          initialNotes = [{
            id: genId(),
            title: "Imported notes",
            content,
            pinned: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }];
        } else {
          initialNotes = [];
        }
        await save("arch-notes", initialNotes);
      }

      setInventory(i); setSales(s); setExpenses(e); setSubs(sb); setSettings(st);
      setNotes(initialNotes);

      // Templates: seed from defaults on first run, otherwise use what's in storage
      let initialTpls = existingTpls;
      if (!Array.isArray(initialTpls)) {
        initialTpls = TEMPLATES.map((t) => ({ id: genId(), name: t.name, body: t.body, builtIn: true }));
        await save("arch-templates", initialTpls);
      }
      setUserTemplates(initialTpls);

      // Restore active note
      if (savedActiveId && initialNotes.some((n) => n.id === savedActiveId)) {
        setActiveNoteId(savedActiveId);
      } else if (initialNotes.length) {
        const sorted = [...initialNotes].sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
        setActiveNoteId(sorted[0].id);
      }

      setLoading(false);
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

  const loadEbayImports = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("ebay_import_queue")
      .select("*")
      .eq("status", "draft")
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setEbayStatus("Could not load eBay imports.");
      return;
    }
    setEbayImports(data || []);
  }, []);

  const connectEbay = useCallback(async () => {
    if (!supabase) { setEbayStatus("Supabase is not configured."); return; }
    setEbayBusy(true); setEbayStatus("Opening eBay sign-in...");
    const { data, error } = await supabase.functions.invoke("ebay-oauth-start", { body: {} });
    setEbayBusy(false);
    if (error || !data?.url) { setEbayStatus(error?.message || "Could not start eBay connection."); return; }
    window.location.href = data.url;
  }, []);

  const syncEbayOrders = useCallback(async () => {
    if (!supabase) { setEbayStatus("Supabase is not configured."); return; }
    setEbayBusy(true); setEbayStatus("Syncing eBay orders awaiting postage...");
    const { data, error } = await supabase.functions.invoke("ebay-sync-orders", { body: { days: 30 } });
    setEbayBusy(false);
    if (error) { setEbayStatus(error.message || "Could not sync eBay orders."); return; }
    setEbayStatus(`Synced ${data?.lineItems || 0} eBay line items awaiting postage. ${data?.queuedDrafts || 0} drafts waiting.`);
    await loadEbayImports();
  }, [loadEbayImports]);

  const loadGmailImports = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("gmail_import_queue")
      .select("*")
      .eq("status", "draft")
      .order("email_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setGmailStatus("Could not load Gmail imports.");
      return;
    }
    setGmailImports(data || []);
  }, []);

  const connectGmail = useCallback(async () => {
    if (!supabase) { setGmailStatus("Supabase is not configured."); return; }
    setGmailBusy(true); setGmailStatus("Opening Google sign-in...");
    const { data, error } = await supabase.functions.invoke("gmail-oauth-start", { body: {} });
    setGmailBusy(false);
    if (error || !data?.url) { setGmailStatus(error?.message || "Could not start Gmail connection."); return; }
    window.location.href = data.url;
  }, []);

  const syncGmailInventory = useCallback(async () => {
    if (!supabase) { setGmailStatus("Supabase is not configured."); return; }
    setGmailBusy(true); setGmailStatus("Scanning Gmail for inventory receipts...");
    const { data, error } = await supabase.functions.invoke("gmail-sync-inventory", { body: { days: 90, maxResults: 25 } });
    setGmailBusy(false);
    if (error) { setGmailStatus(error.message || "Could not sync Gmail inventory."); return; }
    setGmailStatus(`Scanned ${data?.searched || 0} Gmail messages. ${data?.queuedDrafts || 0} inventory drafts waiting.`);
    await loadGmailImports();
  }, [loadGmailImports]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ebay = params.get("ebay");
    const gmail = params.get("gmail");
    if (ebay === "connected") {
      setEbayStatus("eBay connected. Sync orders when you're ready.");
      setPage("sales");
      setEbayQueueOpen(true);
      loadEbayImports();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (ebay === "declined") {
      setEbayStatus("eBay connection was cancelled.");
      setPage("settings");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gmail === "connected") {
      setGmailStatus("Gmail connected. Sync inventory emails when you're ready.");
      setPage("inventory");
      setGmailQueueOpen(true);
      loadGmailImports();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gmail === "declined") {
      setGmailStatus("Gmail connection was cancelled.");
      setPage("settings");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadEbayImports, loadGmailImports]);

  // Persist active note id
  useEffect(() => { if (activeNoteId) save("arch-notes-active", activeNoteId); }, [activeNoteId]);

  // Notes CRUD with debounced save (800ms)
  const noteSaveTimer = useRef(null);
  const persistNotes = useCallback(async (next, immediate = false) => {
    setNotes(next);
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    if (immediate) {
      setSaveStatus("saving"); await save("arch-notes", next); setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 1500);
    } else {
      noteSaveTimer.current = setTimeout(async () => {
        setSaveStatus("saving"); await save("arch-notes", next); setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 1500);
      }, 800);
    }
  }, []);

  const updateNote = useCallback((id, changes) => {
    const next = notes.map((n) => n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n);
    persistNotes(next);
  }, [notes, persistNotes]);

  const createNote = useCallback(async (seed = {}) => {
    const newNote = {
      id: genId(),
      title: seed.title || "Untitled",
      content: seed.content || "",
      fontSize: seed.fontSize || 14,
      pinned: false,
      order: Math.min(0, ...notes.map((n) => n.order ?? 0)) - 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [newNote, ...notes];
    setNotes(next);
    setActiveNoteId(newNote.id);
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

  const togglePinNote = useCallback((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    updateNote(id, { pinned: !note.pinned });
  }, [notes, updateNote]);

  const moveNote = useCallback((id, dir) => {
    const ordered = notes.map((n, idx) => ({ ...n, order: n.order ?? idx }));
    const note = ordered.find((n) => n.id === id);
    if (!note) return;
    const samePinned = ordered
      .filter((n) => !!n.pinned === !!note.pinned)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
    const pos = samePinned.findIndex((n) => n.id === id);
    const targetPos = pos + dir;
    if (pos < 0 || targetPos < 0 || targetPos >= samePinned.length) return;
    const target = samePinned[targetPos];
    const next = ordered.map((n) => {
      if (n.id === id) return { ...n, order: target.order, updatedAt: Date.now() };
      if (n.id === target.id) return { ...n, order: note.order, updatedAt: Date.now() };
      return n;
    });
    persistNotes(next, true);
  }, [notes, persistNotes]);

  const persistTemplates = useCallback(async (next) => {
    setUserTemplates(next);
    setSaveStatus("saving"); await save("arch-templates", next); setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 1500);
  }, []);

  // Export a single note as a .txt file (HTML stripped to plain text)
  const exportNoteTxt = useCallback((note) => {
    if (!note) return;
    // Convert <br>, <div>, <p>, <li> to line breaks then strip remaining tags
    const tmp = document.createElement("div");
    tmp.innerHTML = note.content || "";
    // Replace block-level tags with newlines
    tmp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    tmp.querySelectorAll("div, p, li").forEach((el) => { el.append("\n"); });
    // Render checkboxes as [x] / [ ]
    tmp.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.replaceWith(cb.checked ? "[x] " : "[ ] ");
    });
    const txt = (tmp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
    const safeName = (note.title || "note").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40) || "note";
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${safeName}-${today()}.txt`; a.click(); URL.revokeObjectURL(url);
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

  const handleManualSell = async (items, shared, rows) => {
    const soldIds = new Set();
    const newSales = [];
    for (const item of items) {
      const r = rows.find((x) => x.id === item.id);
      if (!r) continue;
      const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
      if (sp <= 0) continue;
      newSales.push({ id: genId(), name: item.name, category: item.category, size: item.size||"OS", brand: item.brand||"", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: sp-item.price-ship-fees, platform: shared.platform, saleDate: shared.saleDate, tags: "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate||"", customer: shared.customer||"" });
      soldIds.add(item.id);
    }
    if (!newSales.length) return;
    await persistSales([...newSales, ...sales]);
    await persistInv(inventory.filter((i) => !soldIds.has(i.id)));
    if (shared.customer) addCustomer(shared.customer);
    setAddSaleOpen(false);
  };

  const ebayMatchScore = (draft, item) => {
    const title = (draft.item_title || "").toLowerCase();
    const name = (item.name || "").toLowerCase();
    if (!title || !name) return 0;
    if (title === name) return 100;
    if (title.includes(name) || name.includes(title)) return 85;
    const words = name.split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) return 0;
    const hits = words.filter((w) => title.includes(w)).length;
    return Math.round((hits / words.length) * 70);
  };

  const findEbayMatches = (draft) => [...inventory]
    .map((item) => ({ item, score: ebayMatchScore(draft, item) }))
    .filter((m) => m.score >= 45)
    .sort((a, b) => b.score - a.score);

  const markEbayImport = async (id, status) => {
    if (!supabase) return;
    await supabase.from("ebay_import_queue").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    await loadEbayImports();
  };

  const reviewEbaySale = (draft) => {
    const qty = Math.max(1, Number(draft.quantity || 1));
    const matches = findEbayMatches(draft).map((m) => m.item).slice(0, qty);
    if (matches.length < qty) {
      alert("Not enough matching inventory found. Edit the inventory name/SKU or record this sale manually for now.");
      return;
    }
    setEbayReviewOpen({ draft, items: matches });
  };

  const recordEbaySale = async (draft, review = null) => {
    const reviewItems = review?.items || [];
    const matches = reviewItems.length ? reviewItems : findEbayMatches(draft).map((m) => m.item).slice(0, Math.max(1, Number(draft.quantity || 1)));
    if (!matches.length) return;
    const shared = review?.shared || { platform: "eBay AU", saleDate: draft.sale_date || today(), customer: draft.buyer_username || "" };
    const rows = review?.rows || matches.map((item) => {
      const qty = Math.max(1, Number(draft.quantity || 1));
      const feeTotal = Number(draft.platform_fees || 0) > 0 ? Number(draft.platform_fees || 0) : Number((Number(draft.sale_price || 0) * EBAY_AU_FEE_RATE).toFixed(2));
      return { id: item.id, salePrice: Number(draft.sale_price || 0) / qty, shippingPrice: Number(draft.shipping_price || 0) / qty, platformFees: feeTotal / qty };
    });
    const newSales = matches.map((item) => {
      const r = rows.find((x) => x.id === item.id) || {};
      const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
      return { id: genId(), name: item.name, category: item.category, size: item.size || "OS", brand: item.brand || "", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: sp - item.price - ship - fees, platform: shared.platform || "eBay AU", saleDate: shared.saleDate || today(), tags: `eBay ${draft.order_id}`, purchaseDate: item.purchaseDate, preorderDate: item.preorderDate || "", customer: shared.customer || "" };
    });
    const soldIds = new Set(matches.map((i) => i.id));
    await persistSales([...newSales, ...sales]);
    await persistInv(inventory.filter((i) => !soldIds.has(i.id)));
    if (shared.customer) await addCustomer(shared.customer);
    await markEbayImport(draft.id, "imported");
    setEbayReviewOpen(null);
  };

  const markGmailImport = async (id, status) => {
    if (!supabase) return;
    await supabase.from("gmail_import_queue").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    await loadGmailImports();
  };

  const recordGmailInventory = async (draft, form) => {
    const qty = Math.max(1, parseInt(form.quantity) || 1);
    const price = parseFloat(form.price) || 0;
    const items = Array.from({ length: qty }, () => ({
      id: genId(),
      name: form.name,
      category: form.category,
      size: form.size,
      price,
      purchaseDate: form.purchaseDate,
      preorderDate: form.preorderDate || "",
      brand: form.brand || "",
      inTransit: !!form.inTransit,
      tags: form.tags || "",
      customer: form.customer || "",
      addedAt: Date.now(),
    }));
    await persistInv([...items, ...inventory]);
    await markGmailImport(draft.id, "imported");
    setGmailReviewOpen(null);
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    if (confirmDel.type === "inv") await persistInv(inventory.filter((i) => i.id !== confirmDel.id));
    else if (confirmDel.type === "sale") await persistSales(sales.filter((s) => s.id !== confirmDel.id));
    else if (confirmDel.type === "exp") await persistExp(expenses.filter((e) => e.id !== confirmDel.id));
    else if (confirmDel.type === "multi") { await persistInv(inventory.filter((i) => !selectedInv.has(i.id))); setSelectedInv(new Set()); }
    else if (confirmDel.type === "multi-exp") { await persistExp(expenses.filter((e) => !selectedExp.has(e.id))); setSelectedExp(new Set()); }
    else if (confirmDel.type === "multi-sale") { await persistSales(sales.filter((s) => !selectedSales.has(s.id))); setSelectedSales(new Set()); }
    else if (confirmDel.type === "sub") await persistSubs(subs.filter((s) => s.id !== confirmDel.id));
    else if (confirmDel.type === "note") await deleteNote(confirmDel.id);
    setConfirmDel(null);
  };

  // ─── Subscription actions ───
  const saveSub = async (sf) => {
    if (subModalOpen === "new") {
      await persistSubs([{ id: genId(), ...sf }, ...subs]);
    } else if (subModalOpen) {
      await persistSubs(subs.map((s) => s.id === subModalOpen.id ? { ...s, ...sf } : s));
    }
    setSubModalOpen(null);
  };

  const logSub = async (sub) => {
    const newExp = { id: genId(), name: sub.name, amount: sub.amount, purchaseDate: sub.nextDue, tags: sub.tags || "", expCategory: "Software & Subs" };
    await persistExp([newExp, ...expenses]);
    await persistSubs(subs.map((s) => s.id === sub.id ? { ...s, nextDue: advanceDate(s.nextDue, s.frequency), lastLogged: sub.nextDue } : s));
  };

  const logAllOverdue = async () => {
    const t = today();
    const dueSubs = subs.filter((s) => s.active && s.nextDue && s.nextDue <= t);
    if (!dueSubs.length) return;
    const newExpenses = [];
    let updatedSubs = [...subs];
    for (const sub of dueSubs) {
      let cur = sub.nextDue;
      let lastLogged = sub.lastLogged;
      while (cur <= t) {
        newExpenses.push({ id: genId(), name: sub.name, amount: sub.amount, purchaseDate: cur, tags: sub.tags || "", expCategory: "Software & Subs" });
        lastLogged = cur;
        cur = advanceDate(cur, sub.frequency);
      }
      updatedSubs = updatedSubs.map((s) => s.id === sub.id ? { ...s, nextDue: cur, lastLogged } : s);
    }
    await persistExp([...newExpenses, ...expenses]);
    await persistSubs(updatedSubs);
  };

  const toggleSubActive = async (sub) => {
    await persistSubs(subs.map((s) => s.id === sub.id ? { ...s, active: !s.active } : s));
  };

  const handleBulkEdit = async (updates) => {
    const ids = selectedInv;
    await persistInv(inventory.map((i) => ids.has(i.id) ? { ...i, ...updates } : i));
    setBulkEditOpen(false); setSelectedInv(new Set());
  };

  // ─── Export ───
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
          // Notes: prefer new array, fall back to legacy notepad
          if (Array.isArray(data.notes)) {
            setNotes(data.notes);
            await save("arch-notes", data.notes);
            if (data.notes.length) setActiveNoteId(data.notes[0].id);
          } else if (data.notepad) {
            const content = typeof data.notepad === "string" ? data.notepad : data.notepad.content;
            if (content) {
              const migrated = [{ id: genId(), title: "Imported notes", content, pinned: false, createdAt: Date.now(), updatedAt: Date.now() }];
              setNotes(migrated); setActiveNoteId(migrated[0].id);
              await save("arch-notes", migrated);
            }
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
          } else if (data.notepad) {
            const content = typeof data.notepad === "string" ? data.notepad : data.notepad.content;
            if (content) nn = [{ id: genId(), title: "Imported notes", content, pinned: false, createdAt: Date.now(), updatedAt: Date.now() }];
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
    const grossMargin = salesIncome > 0 ? grossProfit / salesIncome : 0;
    const netMargin = salesIncome > 0 ? netProfit / salesIncome : 0;
    const pbd = {}; fs.forEach((s) => { pbd[s.saleDate] = (pbd[s.saleDate]||0) + s.profit; });
    let cum = 0; const spark = Object.keys(pbd).sort().map((d) => { cum += pbd[d]; return cum; });
    const ri = [...inventory].sort((a, b) => (b.addedAt||0) - (a.addedAt||0)).slice(0, 7);
    const rs = [...fs].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")).slice(0, 7);
    return { salesIncome, grossProfit, totalExpenses, netProfit, invValue, cnt, aov, sellThrough, totalFees, grossMargin, netMargin, spark, ri, rs };
  }, [inventory, sales, expenses, range, customFrom, customTo, dashCat, dashPlat]);

  // ─── Preorders within the reminder window ───
  const upcomingPreorders = useMemo(() => {
    return inventory
      .map((i) => ({ ...i, _bdays: businessDaysUntil(i.preorderDate) }))
      .filter((i) => i._bdays !== null && i._bdays >= 0 && i._bdays <= PREORDER_THRESHOLD)
      .sort((a, b) => a._bdays - b._bdays);
  }, [inventory]);

  // ─── Subscription stats ───
  const subStats = useMemo(() => {
    const t = today();
    const active = subs.filter((s) => s.active);
    const overdue = active.filter((s) => s.nextDue && s.nextDue <= t);
    const monthlyBurn = active.reduce((a, s) => a + monthlyEquiv(s.amount, s.frequency), 0);
    return { active, overdue, monthlyBurn, annualCost: monthlyBurn * 12 };
  }, [subs]);

  const sortedSubs = useMemo(() => [...subs].sort((a, b) => (a.nextDue || "").localeCompare(b.nextDue || "")), [subs]);

  // ─── Filtered Inventory ───
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
  const toggleGroupSelection = (items = []) => setSelectedInv((p) => {
    const n = new Set(p);
    const allSelected = items.length > 0 && items.every((i) => n.has(i.id));
    items.forEach((i) => { allSelected ? n.delete(i.id) : n.add(i.id); });
    return n;
  });

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

  // ─── Notes derived state ───
  const activeNote = useMemo(() => notes.find((n) => n.id === activeNoteId) || null, [notes, activeNoteId]);
  const sortedNotes = useMemo(() => {
    let f = notes;
    if (noteSearch) {
      const q = noteSearch.toLowerCase();
      f = f.filter((n) => (n.title || "").toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q));
    }
    return [...f].sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || ((a.order ?? 0) - (b.order ?? 0)) || ((b.updatedAt || 0) - (a.updatedAt || 0)));
  }, [notes, noteSearch]);

  if (loading) return <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>Loading...</div>;

  const navItems = [
    { id: "dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
    { id: "inventory", icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12" },
    { id: "sales", icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01" },
    { id: "expenses", icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
    { id: "subs", icon: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M20.49 15a9 9 0 01-14.85 3.36L1 14" },
    { id: "notepad", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
    { id: "calculator", icon: "M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2z M8 6h8 M16 14v4 M16 10h0.01 M12 10h0.01 M8 10h0.01 M12 14h0.01 M8 14h0.01 M12 18h0.01 M8 18h0.01" },
    { id: "backup", icon: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" },
    { id: "settings", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z" },
  ];

  const notepadIcon = "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8";
  const rb = (r) => ({ padding: "5px 10px", fontSize: 11, fontWeight: range === r ? 600 : 400, borderRadius: 6, background: range === r ? "#1d4ed8" : "transparent", color: range === r ? "#fff" : "#6b7280", border: "none", cursor: "pointer" });

  const renderPreBadge = (item) => {
    if (!item.preorderDate) return null;
    const bd = businessDaysUntil(item.preorderDate);
    const b = preorderBadge(bd);
    if (!b) return null;
    return <span style={badge(b.bg, b.fg)}>{b.text}</span>;
  };

  const rowClick = (e, toggleFn, id) => { if (e.target.closest("button") || e.target.tagName === "INPUT") return; toggleFn(id); };

  const pagePad = isMobile ? "14px 12px" : "20px 24px";
  const rowBg = (index, selected = false) => selected ? "#1e293b" : (index % 2 === 0 ? "#0d131f" : "#111827");
  const groupAccent = { boxShadow: "inset 3px 0 0 #2563eb66" };
  const childAccent = { boxShadow: "inset 3px 0 0 #1f2937" };

  // ─── Inventory row (mobile + desktop) ───
  const invRow = (item, isGroupChild, index = 0) => {
    if (isMobile) {
      return (
        <div key={item.id} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ padding: isGroupChild ? "10px 12px 10px 28px" : "10px 12px", borderBottom: "1px solid #1f293722", background: rowBg(index, selectedInv.has(item.id)), cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", ...(isGroupChild ? childAccent : {}) }}>
          <input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={{ ...cb, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.name}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(item.price)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {item.category} · {item.size||"OS"}{item.brand?` · ${item.brand}`:""} · {item.purchaseDate}
                {item.inTransit && <span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}
                {renderPreBadge(item)}
              </div>
              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                <button onClick={() => setSellOpen(item)} style={{ padding: "5px 9px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Sell</button>
                <button onClick={() => setEditInvOpen(item)} style={{ padding: "5px 9px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
                <button onClick={() => setConfirmDel({ type: "inv", id: item.id, name: item.name })} style={{ padding: "5px 9px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={item.id} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ display: "grid", gridTemplateColumns: "48px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: isGroupChild ? "8px 16px 8px 46px" : "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: rowBg(index, selectedInv.has(item.id)), cursor: "pointer", ...(isGroupChild ? childAccent : {}) }}>
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
  };

  // ─── Group row (mobile + desktop) ───
  const groupRow = (item, isExpanded, key, index = 0) => {
    const groupChecked = item._items?.length > 0 && item._items.every((i) => selectedInv.has(i.id));
    if (isMobile) {
      return (
        <div onClick={() => toggleGroup(key)} style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: rowBg(index, false), borderBottom: "1px solid #1f293722", ...groupAccent }}>
          <input type="checkbox" checked={groupChecked} onChange={(e) => { e.stopPropagation(); toggleGroupSelection(item._items || []); }} onClick={(e) => e.stopPropagation()} style={{ ...cb, marginTop: 1 }} />
          <span style={{ color: "#6b7280", fontSize: 12, width: 12 }}>{isExpanded ? "▾" : "▸"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13 }}>{item.name} <span style={badge("#1f2937","#60a5fa")}>×{item._count}</span></span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13 }}>{currency(item._totalValue)}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3 }}>{item.category}{item.brand?` · ${item.brand}`:""} · {item._count} units</div>
          </div>
        </div>
      );
    }
    return (
      <div onClick={() => toggleGroup(key)} style={{ display: "grid", gridTemplateColumns: "48px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293722", cursor: "pointer", background: rowBg(index, false), ...groupAccent }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <input type="checkbox" checked={groupChecked} onChange={(e) => { e.stopPropagation(); toggleGroupSelection(item._items || []); }} onClick={(e) => e.stopPropagation()} style={cb} />
          <span style={{ color: "#6b7280", fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>
        </div>
        <div><span style={{ color: "#e5e7eb" }}>{item.name}</span><span style={badge("#1f2937","#60a5fa")}>×{item._count}</span>{item.brand&&<div style={{ fontSize: 10, color: "#6b7280" }}>{item.brand}</div>}</div>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{item.category}</span>
        <span style={{ color: "#60a5fa", fontSize: 12 }}></span>
        <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(item._totalValue)}</span>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{item._count} units</span>
        <span style={{ fontSize: 11, color: "#4b5563" }}>{isExpanded ? "Collapse" : "Expand"}</span>
      </div>
    );
  };

  // ─── Sales row (mobile + desktop) ───
  const saleRow = (s, index = 0) => {
    if (isMobile) {
      return (
        <div key={s.id} onClick={(e) => rowClick(e, toggleSelSale, s.id)} style={{ padding: "10px 12px", borderBottom: "1px solid #1f293722", background: rowBg(index, selectedSales.has(s.id)), cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input type="checkbox" checked={selectedSales.has(s.id)} onChange={() => toggleSelSale(s.id)} style={{ ...cb, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.name}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(s.salePrice)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {s.platform} · {s.category} · {s.saleDate}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                <span style={{ color: s.profit>=0?"#34d399":"#f87171", fontWeight: 600, fontSize: 12, marginRight: 2 }}>{currency(s.profit)}</span>
                <button onClick={() => setEditSaleOpen(s)} style={{ padding: "4px 8px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
                <button onClick={() => setConfirmDel({ type: "sale", id: s.id, name: s.name })} style={{ padding: "4px 8px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={s.id} onClick={(e) => rowClick(e, toggleSelSale, s.id)} style={{ display: "grid", gridTemplateColumns: "48px 1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: rowBg(index, selectedSales.has(s.id)), cursor: "pointer" }}>
        <input type="checkbox" checked={selectedSales.has(s.id)} onChange={() => toggleSelSale(s.id)} style={cb} />
        <div><span style={{ color: "#e5e7eb" }}>{s.name}</span><div style={{ fontSize: 10, color: "#4b5563" }}>{s.category}{s.brand?` · ${s.brand}`:""}{s.customer?` · ${s.customer}`:""}{s.purchaseDate?` · bought ${s.purchaseDate}`:""}</div></div>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{s.platform}</span>
        <span style={{ color: "#60a5fa", fontSize: 12 }}>{s.size||"OS"}</span>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{s.saleDate}</span>
        <span style={{ color: "#6b7280", fontSize: 12 }}>{currency(s.costPrice)}</span>
        <span style={{ color: "#f1f5f9", fontWeight: 500, fontSize: 12 }}>{currency(s.salePrice)}</span>
        <span style={{ color: s.profit>=0?"#34d399":"#f87171", fontWeight: 600, fontSize: 12 }}>{currency(s.profit)}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setEditSaleOpen(s)} style={{ padding: "3px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
          <button onClick={() => setConfirmDel({ type: "sale", id: s.id, name: s.name })} style={{ padding: "3px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      </div>
    );
  };

  // ─── Expense row (mobile + desktop) ───
  const expRow = (e, index = 0) => {
    if (isMobile) {
      return (
        <div key={e.id} onClick={(ev) => rowClick(ev, toggleSelExp, e.id)} style={{ padding: "10px 12px", borderBottom: "1px solid #1f293722", background: rowBg(index, selectedExp.has(e.id)), cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input type="checkbox" checked={selectedExp.has(e.id)} onChange={() => toggleSelExp(e.id)} style={{ ...cb, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{e.name}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(e.amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{e.expCategory || "Other"} · {e.purchaseDate}</div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setEditExpOpen(e)} style={{ padding: "4px 8px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
                <button onClick={() => setConfirmDel({ type: "exp", id: e.id, name: e.name })} style={{ padding: "4px 8px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={e.id} onClick={(ev) => rowClick(ev, toggleSelExp, e.id)} style={{ display: "grid", gridTemplateColumns: "48px 2fr 1.2fr 90px 100px 80px", gap: 6, padding: "11px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: rowBg(index, selectedExp.has(e.id)), cursor: "pointer" }}>
        <input type="checkbox" checked={selectedExp.has(e.id)} onChange={() => toggleSelExp(e.id)} style={cb} />
        <span style={{ color: "#e5e7eb" }}>{e.name}{e.tags&&<span style={{ fontSize: 10, color: "#4b5563", marginLeft: 6 }}>{e.tags}</span>}</span>
        <span style={{ color: "#9ca3af", fontSize: 11 }}>{e.expCategory || "Other"}</span>
        <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(e.amount)}</span>
        <span style={{ color: "#6b7280", fontSize: 12 }}>{e.purchaseDate}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setEditExpOpen(e)} style={{ padding: "3px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
          <button onClick={() => setConfirmDel({ type: "exp", id: e.id, name: e.name })} style={{ padding: "3px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      </div>
    );
  };

  const ebayQueuePanel = () => (
    <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 700 }}>eBay awaiting postage</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Review synced eBay orders before they become sales.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={async () => { setEbayQueueOpen(true); await syncEbayOrders(); }} disabled={ebayBusy} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sync eBay</button>
          <button onClick={loadEbayImports} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Refresh queue</button>
          <button onClick={() => setEbayQueueOpen(false)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Hide</button>
        </div>
      </div>
      {ebayStatus && <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 10 }}>{ebayStatus}</div>}
      {ebayImports.length === 0 ? (
        <div style={{ fontSize: 12, color: "#4b5563", padding: "10px 0" }}>No eBay sale drafts loaded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflow: "auto" }}>
          {ebayImports.map((draft) => {
            const matches = findEbayMatches(draft);
            const best = matches[0];
            const qty = Math.max(1, Number(draft.quantity || 1));
            const canRecord = !!best && matches.length >= qty;
            return (
              <div key={draft.id} style={{ border: "1px solid #1f2937", borderRadius: 8, padding: "9px 10px", background: "#0d1117" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.item_title}</div>
                    <div style={{ color: "#6b7280", fontSize: 11 }}>{draft.sale_date || "No date"} · qty {draft.quantity || 1} · {draft.buyer_username || "Unknown buyer"}{draft.order_id ? ` · ${draft.order_id}` : ""}</div>
                  </div>
                  <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700 }}>{currency(draft.sale_price)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ color: best ? "#93c5fd" : "#fbbf24", fontSize: 11 }}>
                    {best ? `Match: ${best.item.name} (${best.score}%)` : "No inventory match yet"}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => reviewEbaySale(draft)} disabled={!canRecord} style={{ ...primaryBtn, padding: "5px 9px", fontSize: 11, opacity: canRecord ? 1 : 0.45 }}>Record Sale</button>
                    <button onClick={() => markEbayImport(draft.id, "ignored")} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11, color: "#f87171" }}>Ignore</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const gmailQueuePanel = () => (
    <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 700 }}>Gmail inventory drafts</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Review purchase confirmations before they become inventory.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={async () => { setGmailQueueOpen(true); await syncGmailInventory(); }} disabled={gmailBusy} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sync Gmail</button>
          <button onClick={loadGmailImports} disabled={gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Refresh queue</button>
          <button onClick={() => setGmailQueueOpen(false)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Hide</button>
        </div>
      </div>
      {gmailStatus && <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 10 }}>{gmailStatus}</div>}
      {gmailImports.length === 0 ? (
        <div style={{ fontSize: 12, color: "#4b5563", padding: "10px 0" }}>No Gmail inventory drafts loaded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflow: "auto" }}>
          {gmailImports.map((draft) => (
            <div key={draft.id} style={{ border: "1px solid #1f2937", borderRadius: 8, padding: "9px 10px", background: "#0d1117" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.item_title}</div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>{draft.email_date || "No date"} · qty {draft.quantity || 1} · {draft.vendor || draft.sender || "Unknown source"}</div>
                </div>
                <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700 }}>{currency(draft.total_cost || draft.unit_cost)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: "#93c5fd", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.subject || "Gmail receipt"}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setGmailReviewOpen(draft)} style={{ ...primaryBtn, padding: "5px 9px", fontSize: 11 }}>Add Inventory</button>
                  <button onClick={() => markGmailImport(draft.id, "ignored")} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11, color: "#f87171" }}>Ignore</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Mobile select-all bar
  const mobileSelectAll = (allSelected, toggleFn, count) => isMobile && count > 0 && (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #1f2937", fontSize: 11, color: "#6b7280", background: "#0d1117" }}>
      <input type="checkbox" checked={allSelected} onChange={toggleFn} style={cb} />
      <span>Select all ({count})</span>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0f19", color: "#e5e7eb", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`.np-edit ul,.np-edit ol{padding-left:24px;margin:6px 0}.np-edit li{margin:3px 0}.np-edit input[type="checkbox"]{margin-right:6px;cursor:pointer;accent-color:#2563eb;vertical-align:middle}.np-edit label{display:inline-flex;align-items:flex-start;gap:6px;cursor:default}.np-edit label input[type="checkbox"]:checked + *,.np-edit input[type="checkbox"]:checked ~ *{opacity:0.55}`}</style>
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

      <div style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <TopBar saveStatus={saveStatus} isMobile={isMobile} />

        {/* ══ DASHBOARD ══ */}
        {page === "dashboard" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Dashboard</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventory.length} in stock · {sales.length} total sales</p></div>
            <div style={{ display: "flex", gap: 3, background: "#111827", borderRadius: 8, padding: 3, border: "1px solid #1f2937", flexWrap: "wrap" }}>{TIME_RANGES.map((r) => <button key={r} style={rb(r)} onClick={() => setRange(r)}>{r}</button>)}</div>
          </div>
          {range === "Custom" && <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 12, color: "#6b7280" }}>From</span><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...inp, maxWidth: 160 }} /><span style={{ fontSize: 12, color: "#6b7280" }}>To</span><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...inp, maxWidth: 160 }} /></div>}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <select value={dashCat} onChange={(e) => setDashCat(e.target.value)} style={{ ...sel, maxWidth: 150 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={dashPlat} onChange={(e) => setDashPlat(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          {upcomingPreorders.length > 0 && (
            <div style={{ background: "linear-gradient(180deg, #0f1a2e 0%, #111827 100%)", border: "1px solid #2563eb55", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
                  <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 600 }}>Preorders releasing soon</span>
                  <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 600 }}>{upcomingPreorders.length}</span>
                </div>
                <button onClick={() => setPage("inventory")} style={{ padding: "3px 10px", background: "transparent", color: "#60a5fa", border: "none", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>View all</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {upcomingPreorders.slice(0, isMobile ? 4 : 6).map((i) => {
                  const b = preorderBadge(i._bdays);
                  return (
                    <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#0d1117", borderRadius: 6, border: "1px solid #1f293766" }}>
                      <span style={{ fontSize: 13, color: "#e5e7eb", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                      {!isMobile && <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{i.preorderDate}</span>}
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: b.bg, color: b.fg, fontWeight: 600, flexShrink: 0 }}>{b.text}</span>
                    </div>
                  );
                })}
                {upcomingPreorders.length > (isMobile ? 4 : 6) && (
                  <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center", paddingTop: 4 }}>+ {upcomingPreorders.length - (isMobile ? 4 : 6)} more</div>
                )}
              </div>
            </div>
          )}
          {subStats.overdue.length > 0 && (
            <div style={{ background: "#111827", border: "1px solid #ef444455", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>{subStats.overdue.length} subscription{subStats.overdue.length === 1 ? "" : "s"} overdue · {currency(subStats.overdue.reduce((a, s) => a + s.amount, 0))}</span>
              <button onClick={logAllOverdue} style={{ padding: "4px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Log all due</button>
            </div>
          )}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
              <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Net Profit</div><div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: stats.netProfit>=0?"#34d399":"#f87171" }}>{currency(stats.netProfit)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#6b7280" }}>Inventory value</div><div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: "#f1f5f9" }}>{currency(stats.invValue)}</div></div>
            </div>
            <Spark data={stats.spark.length>1?stats.spark:undefined} color={stats.netProfit>=0?"#3b82f6":"#ef4444"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 10, marginBottom: 10 }}>
            <KPI label="Sales income" value={currency(stats.salesIncome)} /><KPI label="Net profit" value={currency(stats.netProfit)} accent={stats.netProfit>=0?"#34d399":"#f87171"} /><KPI label="Gross profit" value={currency(stats.grossProfit)} accent={stats.grossProfit>=0?"#34d399":"#f87171"} /><KPI label="Inventory value" value={currency(stats.invValue)} /><KPI label="Sales count" value={stats.cnt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(6, 1fr)", gap: 10, marginBottom: 18 }}>
            <KPI label="Avg. order value" value={currency(stats.aov)} /><KPI label="Net margin" value={(stats.netMargin * 100).toFixed(1) + "%"} accent={stats.netMargin>=0?"#34d399":"#f87171"} /><KPI label="Gross margin" value={(stats.grossMargin * 100).toFixed(1) + "%"} accent={stats.grossMargin>=0?"#34d399":"#f87171"} /><KPI label="Total expenses" value={currency(stats.totalExpenses)} accent="#f59e0b" /><KPI label="Platform fees" value={currency(stats.totalFees)} accent="#f59e0b" /><KPI label="Monthly subs" value={currency(subStats.monthlyBurn)} accent="#f59e0b" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Sales</div>
              {stats.rs.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No sales</div>:stats.rs.map((s) => (<div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{s.platform} · {s.size||"OS"} · {s.saleDate}{s.customer?` · ${s.customer}`:""}</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(s.salePrice)}</div><div style={{ fontSize: 11, color: s.profit>=0?"#34d399":"#f87171" }}>{currency(s.profit)}</div></div></div>))}
            </div>
            <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Inventory</div>
              {stats.ri.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No items</div>:stats.ri.map((i) => (<div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}{i.inTransit&&<span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}{renderPreBadge(i)}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{i.category} · {i.size||"OS"}{i.brand?` · ${i.brand}`:""}</div></div><div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{currency(i.price)}</div></div>))}
            </div>
          </div>
        </div>)}

        {/* ══ INVENTORY ══ */}
        {page === "inventory" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Inventory</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventory.length} items · {currency(inventory.reduce((a, i) => a + i.price, 0))}</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedInv.size > 0 && <><button onClick={() => setBulkSellOpen(true)} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sell {selectedInv.size}</button><button onClick={() => setBulkEditOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedInv.size}</button><button onClick={() => setConfirmDel({ type: "multi", name: `${selectedInv.size} items` })} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedInv.size}</button></>}
              <button onClick={async () => { setGmailQueueOpen(true); await syncGmailInventory(); }} disabled={gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", color: "#93c5fd" }}>Sync Gmail</button>
              <button onClick={async () => { setGmailQueueOpen((v) => !v); if (!gmailImports.length) await loadGmailImports(); }} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Gmail queue{gmailImports.length ? ` (${gmailImports.length})` : ""}</button>
              <button onClick={() => { setInvForm({ ...emptyInv, category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||"") }); setAddDirty(false); setAddInvOpen(true); }} style={primaryBtn}>+ Add inventory</button>
            </div>
          </div>
          {gmailQueueOpen && gmailQueuePanel()}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
            <select value={invCat} onChange={(e) => setInvCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={invSort} onChange={(e) => setInvSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option><option value="price_desc">Price ↓</option><option value="price_asc">Price ↑</option><option value="date_desc">Newest</option><option value="date_asc">Oldest</option></select>
            <label style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={invCollapse} onChange={(e) => setInvCollapse(e.target.checked)} style={cb} />Group</label>
            {(invSearch||invCat!=="All"||invSort!=="name_asc")&&<button onClick={() => { setInvSearch(""); setInvCat("All"); setInvSort("name_asc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredInv.length} items{selectedInv.size>0&&` · ${selectedInv.size} selected · ${currency(selectedValue)}`}</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "48px 2fr 0.7fr 55px 85px 85px 140px", gap: 5, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center", background: "#111827" }}>
                <input type="checkbox" checked={selectedInv.size===filteredInv.length&&filteredInv.length>0} onChange={toggleAll} style={cb} /><span>Name</span><span>Category</span><span>Size</span><span>Price</span><span>Date</span><span>Actions</span>
              </div>
            )}
            {mobileSelectAll(selectedInv.size===filteredInv.length&&filteredInv.length>0, toggleAll, filteredInv.length)}
            {groupedInv.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No inventory</div>}
            {groupedInv.map((item, idx) => {
              if (!item._group) return invRow(item, false, idx);
              const key = item.name;
              const isExpanded = expandedGroups.has(key);
              return (<div key={key}>
                {groupRow(item, isExpanded, key, idx)}
                {isExpanded && item._items.map((sub, childIdx) => invRow(sub, true, idx + childIdx + 1))}
              </div>);
            })}
          </div>
        </div>)}

        {/* ══ SALES ══ */}
        {page === "sales" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Sales</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{sales.length} sales · {currency(sales.reduce((a, s) => a + s.salePrice, 0))} revenue · {currency(sales.reduce((a, s) => a + s.profit, 0))} profit</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedSales.size > 0 && <><button onClick={() => setBulkEditSaleOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedSales.size}</button><button onClick={deleteSelectedSales} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedSales.size}</button></>}
              <button onClick={() => setAddSaleOpen(true)} style={primaryBtn}>+ Add Sale</button>
              <button onClick={async () => { setEbayQueueOpen(true); await syncEbayOrders(); }} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", color: "#93c5fd" }}>Sync eBay</button>
              <button onClick={async () => { setEbayQueueOpen((v) => !v); if (!ebayImports.length) await loadEbayImports(); }} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>eBay queue{ebayImports.length ? ` (${ebayImports.length})` : ""}</button>
            </div>
          </div>
          {selectedSales.size > 0 && (
            <div style={{ background: "#111827", borderRadius: 10, border: "1px solid #1f2937", padding: "10px 16px", marginBottom: 12, display: "flex", gap: 24, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#6b7280" }}>{selectedSales.size} selected</span>
              <span style={{ color: "#f1f5f9" }}>Revenue: <strong>{currency(selectedSalesRevenue)}</strong></span>
              <span style={{ color: selectedSalesProfit >= 0 ? "#34d399" : "#f87171" }}>Profit: <strong>{currency(selectedSalesProfit)}</strong></span>
            </div>
          )}
          {ebayQueueOpen && ebayQueuePanel()}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} style={{ ...inp, maxWidth: 190 }} />
            <select value={saleCat} onChange={(e) => setSaleCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={salePlat} onChange={(e) => setSalePlat(e.target.value)} style={{ ...sel, maxWidth: 160 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
            <select value={saleSort} onChange={(e) => setSaleSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A-Z</option><option value="profit_desc">Profit ↓</option><option value="profit_asc">Profit ↑</option><option value="sale_desc">Sale ↓</option></select>
            {(saleSearch||saleCat!=="All"||salePlat!=="All"||saleSort!=="date_desc")&&<button onClick={() => { setSaleSearch(""); setSaleCat("All"); setSalePlat("All"); setSaleSort("date_desc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredSales.length} shown</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "48px 1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center", background: "#111827" }}>
                <input type="checkbox" checked={selectedSales.size===filteredSales.length&&filteredSales.length>0} onChange={toggleAllSales} style={cb} />
                <span>Item</span><span>Platform</span><span>Size</span><span>Date</span><span>Cost</span><span>Sale</span><span>Profit</span><span>Actions</span>
              </div>
            )}
            {mobileSelectAll(selectedSales.size===filteredSales.length&&filteredSales.length>0, toggleAllSales, filteredSales.length)}
            {filteredSales.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No sales</div>}
            {filteredSales.map((s, idx) => saleRow(s, idx))}
          </div>
        </div>)}

        {/* ══ EXPENSES ══ */}
        {page === "expenses" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Expenses</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{expenses.length} expenses · {currency(expenses.reduce((a, e) => a + e.amount, 0))}</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "48px 2fr 1.2fr 90px 100px 80px", gap: 6, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center", background: "#111827" }}>
                <input type="checkbox" checked={selectedExp.size===filteredExp.length&&filteredExp.length>0} onChange={toggleAllExp} style={cb} />
                <span>Name</span><span>Category</span><span>Price</span><span>Date</span><span>Actions</span>
              </div>
            )}
            {mobileSelectAll(selectedExp.size===filteredExp.length&&filteredExp.length>0, toggleAllExp, filteredExp.length)}
            {filteredExp.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No expenses</div>}
            {filteredExp.map((e, idx) => expRow(e, idx))}
          </div>
        </div>)}

        {/* ══ SUBSCRIPTIONS ══ */}
        {page === "subs" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Subscriptions</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{subStats.active.length} active · {currency(subStats.monthlyBurn)}/mo · {currency(subStats.annualCost)}/yr</p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {subStats.overdue.length > 0 && <button onClick={logAllOverdue} style={{ ...primaryBtn, background: "#dc2626" }}>Log {subStats.overdue.length} overdue</button>}
              <button onClick={() => setSubModalOpen("new")} style={primaryBtn}>+ Add subscription</button>
            </div>
          </div>
          {subStats.overdue.length > 0 && (
            <div style={{ background: "#3b1f1f", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#fca5a5" }}>
              {subStats.overdue.length} subscription{subStats.overdue.length === 1 ? " is" : "s are"} overdue. Click "Log overdue" to auto-create expense entries and roll dates forward.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            <KPI label="Active" value={subStats.active.length} />
            <KPI label="Monthly burn" value={currency(subStats.monthlyBurn)} accent="#f59e0b" />
            <KPI label="Annual cost" value={currency(subStats.annualCost)} accent="#f59e0b" />
            <KPI label="Overdue" value={subStats.overdue.length} accent={subStats.overdue.length > 0 ? "#f87171" : undefined} />
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 90px 100px 100px 100px 180px", gap: 8, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600 }}>
                <span>Name</span><span>Amount</span><span>Frequency</span><span>Monthly</span><span>Next due</span><span>Actions</span>
              </div>
            )}
            {sortedSubs.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No subscriptions yet. Add eBay Pro, software subs, etc.</div>}
            {sortedSubs.map((s) => {
              const t = today();
              const isOverdue = s.active && s.nextDue && s.nextDue <= t;
              const me = monthlyEquiv(s.amount, s.frequency);
              if (isMobile) {
                return (
                  <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid #1f293711", opacity: s.active ? 1 : 0.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 500 }}>{s.name}{!s.active && <span style={badge("#1f2937","#6b7280")}>PAUSED</span>}{isOverdue && <span style={badge("#3b1f1f","#f87171")}>OVERDUE</span>}</div>
                      <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 600 }}>{currency(s.amount)}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{FREQ_LABEL[s.frequency]} · {currency(me)}/mo · due {s.nextDue}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {s.active && <button onClick={() => logSub(s)} style={{ padding: "4px 9px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Log</button>}
                      <button onClick={() => setSubModalOpen(s)} style={{ padding: "4px 9px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => toggleSubActive(s)} style={{ padding: "4px 9px", background: "#1f2937", color: s.active ? "#fbbf24" : "#34d399", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>{s.active ? "Pause" : "Resume"}</button>
                      <button onClick={() => setConfirmDel({ type: "sub", id: s.id, name: s.name })} style={{ padding: "4px 9px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 90px 100px 100px 100px 180px", gap: 8, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", opacity: s.active ? 1 : 0.5 }}>
                  <div><span style={{ color: "#e5e7eb" }}>{s.name}</span>{!s.active && <span style={badge("#1f2937","#6b7280")}>PAUSED</span>}{isOverdue && <span style={badge("#3b1f1f","#f87171")}>OVERDUE</span>}{s.tags && <div style={{ fontSize: 10, color: "#6b7280" }}>{s.tags}</div>}</div>
                  <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(s.amount)}</span>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{FREQ_LABEL[s.frequency]}</span>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{currency(me)}</span>
                  <span style={{ color: isOverdue ? "#f87171" : "#6b7280", fontSize: 12 }}>{s.nextDue || "—"}</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {s.active && <button onClick={() => logSub(s)} style={{ padding: "4px 7px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Log</button>}
                    <button onClick={() => setSubModalOpen(s)} style={{ padding: "4px 7px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => toggleSubActive(s)} title={s.active ? "Pause" : "Resume"} style={{ padding: "4px 7px", background: "#1f2937", color: s.active ? "#fbbf24" : "#34d399", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>{s.active ? "⏸" : "▶"}</button>
                    <button onClick={() => setConfirmDel({ type: "sub", id: s.id, name: s.name })} style={{ padding: "4px 7px", background: "#1f2937", color: "#f87171", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>)}

        {/* ══ NOTEPAD (full page) ══ */}
        {page === "notepad" && (<div style={{ padding: pagePad, display: "flex", flexDirection: "column", height: "calc(100vh - 32px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Notepad</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>
                {notes.length} note{notes.length === 1 ? "" : "s"}
                {activeNote && activeNote.updatedAt ? ` · saved ${new Date(activeNote.updatedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}` : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>
            {/* LEFT: Notes list */}
            <div style={{ width: isMobile ? "100%" : 240, maxHeight: isMobile ? 220 : "none", background: "#111827", borderRadius: 12, border: "1px solid #1f2937", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid #1f2937" }}>
                <button onClick={() => createNote()} style={{ ...primaryBtn, width: "100%", padding: "7px 10px", fontSize: 12 }}>+ New note</button>
              </div>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #1f2937" }}>
                <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search notes…" style={{ ...inp, padding: "6px 10px", fontSize: 12 }} />
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "6px" }}>
                {sortedNotes.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#374151" }}>No notes yet.<br />Hit "+ New note".</div>}
                {sortedNotes.map((n) => {
                  const isActive = n.id === activeNoteId;
                  const preview = stripHtml(n.content).slice(0, 60) || "Empty";
                  const dateStr = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short" }) : "";
                  return (
                    <div key={n.id} onClick={() => setActiveNoteId(n.id)} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 3, cursor: "pointer", background: isActive ? "#1e293b" : "transparent", border: isActive ? "1px solid #2563eb55" : "1px solid transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        {n.pinned && <span style={{ fontSize: 9, color: "#fbbf24" }}>●</span>}
                        <div style={{ fontSize: 13, color: isActive ? "#f1f5f9" : "#d1d5db", fontWeight: isActive ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{n.title || "Untitled"}</div>
                        <button onClick={(e) => { e.stopPropagation(); moveNote(n.id, -1); }} title="Move up" style={{ ...ghostBtn, padding: "1px 5px", fontSize: 10 }}>↑</button>
                        <button onClick={(e) => { e.stopPropagation(); moveNote(n.id, 1); }} title="Move down" style={{ ...ghostBtn, padding: "1px 5px", fontSize: 10 }}>↓</button>
                      </div>
                      <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</div>
                      <div style={{ fontSize: 9, color: "#4b5563", marginTop: 2 }}>{dateStr}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Editor */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0, minHeight: 0 }}>
              {!activeNote ? (
                <div style={{ flex: 1, background: "#111827", borderRadius: 12, border: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                  <div style={{ color: "#4b5563", fontSize: 13 }}>No note selected</div>
                  <button onClick={() => createNote()} style={primaryBtn}>+ Create your first note</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input value={activeNote.title} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} placeholder="Note title" style={{ ...inp, flex: 1, minWidth: 200, fontSize: 15, fontWeight: 600 }} />
                    <button onClick={() => togglePinNote(activeNote.id)} title={activeNote.pinned ? "Unpin" : "Pin"} style={{ ...ghostBtn, padding: "7px 10px", fontSize: 12, color: activeNote.pinned ? "#fbbf24" : "#9ca3af" }}>{activeNote.pinned ? "★" : "☆"}</button>
                    <button onClick={() => setConfirmDel({ type: "note", id: activeNote.id, name: activeNote.title || "Untitled" })} style={{ ...ghostBtn, padding: "7px 10px", fontSize: 12, color: "#f87171" }}>Delete</button>
                  </div>
                  <div style={{ flex: 1, background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <NotepadEditor note={activeNote} onUpdate={(changes) => updateNote(activeNote.id, changes)} isMobile={isMobile} templates={userTemplates || []} onManageTemplates={() => setTplManagerOpen(true)} onExport={() => exportNoteTxt(activeNote)} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>)}

        {/* ══ CALCULATOR ══ */}
        {page === "calculator" && <Calculator isMobile={isMobile} />}

        {/* ══ BACKUP ══ */}
        {page === "backup" && (<div style={{ padding: pagePad, maxWidth: 600 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Backup & Restore</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#4b5563" }}>Export or import your data.</p>
          {backupStatus&&<div style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#93c5fd" }}>{backupStatus}</div>}
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Export</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>{inventory.length} items · {sales.length} sales · {expenses.length} expenses · {subs.length} subs · {notes.length} notes</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={exportJSON} style={primaryBtn}>Download JSON</button><button onClick={exportCSV} style={ghostBtn}>Export Sales CSV</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Import</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Merge adds new records safely. Replace overwrites everything.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={() => importBackup("merge")} style={primaryBtn}>Merge import (safe)</button><button onClick={() => { if (confirm("Replace ALL data?")) importBackup("replace"); }} style={{ ...ghostBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}>Replace import</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #ef444433", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Danger Zone</div>
            <button onClick={async () => { if (confirm("Delete ALL data?")) { await persistInv([]); await persistSales([]); await persistExp([]); } }} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Clear all data</button>
          </div>
        </div>)}

        {/* ══ SETTINGS ══ */}
        {page === "settings" && (<div style={{ padding: pagePad, maxWidth: 600 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Settings</h2>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>eBay Sales Import</div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Connect or refresh your eBay account here. Record and review synced orders from Sales.</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={connectEbay} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Connect eBay</button>
                <button onClick={() => { setPage("sales"); setEbayQueueOpen(true); loadEbayImports(); }} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Open sales queue</button>
              </div>
            </div>
            {ebayStatus && <div style={{ fontSize: 12, color: "#93c5fd" }}>{ebayStatus}</div>}
            <div style={{ fontSize: 12, color: "#4b5563" }}>{ebayImports.length} awaiting-postage draft{ebayImports.length === 1 ? "" : "s"} currently loaded.</div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Gmail Inventory Import</div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Connect Gmail here. Review purchase confirmations from Inventory before adding stock.</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={connectGmail} disabled={gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Connect Gmail</button>
                <button onClick={() => { setPage("inventory"); setGmailQueueOpen(true); loadGmailImports(); }} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Open inventory queue</button>
              </div>
            </div>
            {gmailStatus && <div style={{ fontSize: 12, color: "#93c5fd" }}>{gmailStatus}</div>}
            <div style={{ fontSize: 12, color: "#4b5563" }}>{gmailImports.length} inventory draft{gmailImports.length === 1 ? "" : "s"} currently loaded.</div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Categories</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CATS.map((c) => (<div key={c} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{c}<button onClick={async () => { const ns = { ...settings, categories: CATS.filter((x) => x !== c) }; await persistSettings(ns); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newCat} onChange={(e) => setNewCat(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="New category" /><button onClick={async () => { if (newCat && !CATS.includes(newCat)) { await persistSettings({ ...settings, categories: [...CATS, newCat] }); setNewCat(""); } }} style={primaryBtn}>Add</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Platforms</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {PLATS.map((p) => (<div key={p} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{p}<button onClick={async () => { await persistSettings({ ...settings, platforms: PLATS.filter((x) => x !== p) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newPlat} onChange={(e) => setNewPlat(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="New platform" /><button onClick={async () => { if (newPlat && !PLATS.includes(newPlat)) { await persistSettings({ ...settings, platforms: [...PLATS, newPlat] }); setNewPlat(""); } }} style={primaryBtn}>Add</button></div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Customer Database</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>Customers auto-save when you sell. You can also add them here.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CUSTS.map((c) => (<div key={c} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{c}<button onClick={async () => { await persistSettings({ ...settings, customers: CUSTS.filter((x) => x !== c) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
              {CUSTS.length===0&&<span style={{ fontSize: 12, color: "#4b5563" }}>No customers yet</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newCust} onChange={(e) => setNewCust(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="Customer name" /><button onClick={async () => { if (newCust && !CUSTS.includes(newCust)) { await persistSettings({ ...settings, customers: [...CUSTS, newCust] }); setNewCust(""); } }} style={primaryBtn}>Add</button></div>
          </div>
          {onLogout && <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginTop: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Account</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>Signed in as {userEmail}</p>
            <button onClick={onLogout} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Log out</button>
          </div>}
        </div>)}
      </div>

      {/* ══ NOTEPAD PANEL ══ */}
      {/* ══ FLOATING NOTEPAD BUTTON — visible on all pages except notepad and when slide-out is open ══ */}
      {page !== "notepad" && !notepadOpen && (
        <button
          onClick={() => setNotepadOpen(true)}
          title="Quick notes"
          style={{ position: "fixed", bottom: 18, right: 18, width: 46, height: 46, borderRadius: "50%", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 6px 16px rgba(37,99,235,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, transition: "transform 150ms" }}
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
      )}

      {notepadOpen && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: isMobile ? "100%" : 360, background: "#111827", borderLeft: "1px solid #1f2937", zIndex: 150, display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1f2937", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", flexShrink: 0 }}>Notes</span>
            <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "flex-end" }}>
              <button onClick={() => createNote()} title="New note" style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }}>+</button>
              <button onClick={() => { setPage("notepad"); setNotepadOpen(false); }} title="Open full notepad" style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }}>↗</button>
              <button onClick={() => setNotepadOpen(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>
            </div>
          </div>
          {notes.length > 0 ? (
            <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid #1f2937" }}>
              <select value={activeNoteId || ""} onChange={(e) => setActiveNoteId(e.target.value)} style={{ ...sel, padding: "6px 8px", fontSize: 12 }}>
                {sortedNotes.map((n) => <option key={n.id} value={n.id}>{n.pinned ? "★ " : ""}{n.title || "Untitled"}</option>)}
              </select>
            </div>
          ) : null}
          {activeNote ? (
            <NotepadEditor note={activeNote} onUpdate={(changes) => updateNote(activeNote.id, changes)} showTemplates={!isMobile} isMobile={isMobile} templates={userTemplates || []} compact />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#4b5563", textAlign: "center" }}>No notes yet.</div>
              <button onClick={() => createNote()} style={primaryBtn}>+ New note</button>
            </div>
          )}
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
      {addSaleOpen && <ManualSaleModal inventory={inventory} onSell={handleManualSell} onClose={() => setAddSaleOpen(false)} platforms={PLATS} customers={CUSTS} />}
      {ebayReviewOpen && <EbaySaleReviewModal draft={ebayReviewOpen.draft} items={ebayReviewOpen.items} onRecord={recordEbaySale} onClose={() => setEbayReviewOpen(null)} />}
      {gmailReviewOpen && <GmailInventoryReviewModal draft={gmailReviewOpen} categories={CATS} onAdd={recordGmailInventory} onClose={() => setGmailReviewOpen(null)} />}
      {editInvOpen && <EditInvModal item={editInvOpen} onSave={async (ef) => { await persistInv(inventory.map((i) => i.id===editInvOpen.id?{...i,...ef}:i)); setEditInvOpen(null); }} onClose={() => setEditInvOpen(null)} categories={CATS} customers={CUSTS} />}
      {editSaleOpen && <EditSaleModal sale={editSaleOpen} onSave={async (u) => { await persistSales(sales.map((s) => s.id===editSaleOpen.id?u:s)); if (u.customer) addCustomer(u.customer); setEditSaleOpen(null); }} onClose={() => setEditSaleOpen(null)} platforms={PLATS} customers={CUSTS} />}
      {editExpOpen && <EditExpModal expense={editExpOpen} onSave={async (u) => { await persistExp(expenses.map((e) => e.id===editExpOpen.id?u:e)); setEditExpOpen(null); }} onClose={() => setEditExpOpen(null)} />}
      {bulkEditOpen && <BulkEditModal items={inventory.filter((i) => selectedInv.has(i.id))} onSave={handleBulkEdit} onClose={() => setBulkEditOpen(false)} categories={CATS} />}
      {subModalOpen && <SubModal sub={subModalOpen === "new" ? null : subModalOpen} onSave={saveSub} onClose={() => setSubModalOpen(null)} />}
      {tplManagerOpen && userTemplates && <TemplateManagerModal templates={userTemplates} onSave={async (next) => { await persistTemplates(next); setTplManagerOpen(false); }} onClose={() => setTplManagerOpen(false)} />}
      {bulkSellOpen && <BulkSellModal items={inventory.filter((i) => selectedInv.has(i.id))} onSell={handleBulkSell} onClose={() => setBulkSellOpen(false)} platforms={PLATS} customers={CUSTS} />}
      {bulkEditExpOpen && <BulkEditExpModal items={expenses.filter((e) => selectedExp.has(e.id))} onSave={handleBulkEditExp} onClose={() => setBulkEditExpOpen(false)} />}
      {bulkEditSaleOpen && <BulkEditSaleModal items={sales.filter((s) => selectedSales.has(s.id))} onSave={handleBulkEditSale} onClose={() => setBulkEditSaleOpen(false)} platforms={PLATS} />}
      <ConfirmDialog open={!!confirmDel} msg={confirmDel?.type==="multi"||confirmDel?.type==="multi-exp"||confirmDel?.type==="multi-sale"?`Delete ${confirmDel.name}?`:`Delete "${confirmDel?.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}
