import { useState, useEffect, useRef } from "react";

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
const SUB_CATEGORIES = ["Botting", "AI", "Marketplaces", "Domains", "Infrastructure", "Finance", "Other"];

const VERSION = "0.6.19";
const PREORDER_THRESHOLD = 40; // business days before release that triggers a reminder
const FREQ_OPTIONS = ["weekly", "fortnightly", "monthly", "yearly", "custom"];
const FREQ_LABEL = { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", yearly: "Yearly", custom: "Custom days" };
const CURRENCY_OPTIONS = ["AUD", "GBP", "EUR", "USD", "NZD", "JPY", "HKD", "CAD", "SGD"];
const EBAY_AU_FEE_RATE = 0.1177;
const EBAY_AU_FIXED_ORDER_FEE = 0.33;

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

const frequencyDays = (freq, customDays) => {
  if (freq === "weekly") return 7;
  if (freq === "fortnightly") return 14;
  if (freq === "monthly") return 365.2425 / 12;
  if (freq === "yearly") return 365.2425;
  if (freq === "custom") {
    const days = parseInt(customDays, 10) || 0;
    return days > 0 ? days : 365.2425 / 12;
  }
  return 365.2425 / 12;
};

const frequencyLabel = (freq, customDays) => {
  if (freq === "custom") {
    const days = parseInt(customDays, 10) || 0;
    return days > 0 ? `Every ${days} day${days === 1 ? "" : "s"}` : "Custom days";
  }
  return FREQ_LABEL[freq] || "Monthly";
};

const advanceDate = (dateStr, freq, customDays) => {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return today();
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "fortnightly") d.setDate(d.getDate() + 14);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  else if (freq === "custom") d.setDate(d.getDate() + frequencyDays(freq, customDays));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthlyEquiv = (amount, freq, customDays) => {
  const a = parseFloat(amount) || 0;
  if (freq === "weekly" || freq === "fortnightly" || freq === "custom") return a * (365.2425 / frequencyDays(freq, customDays)) / 12;
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
const formatMoney = (v, code = "AUD") => {
  const n = Number(v);
  const c = String(code || "AUD").toUpperCase();
  if (isNaN(n)) return c === "AUD" ? "AU$0" : `${c} 0`;
  if (c === "AUD") return (n < 0 ? "-AU$" : "AU$") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${c} ${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const currency = (v) => formatMoney(v, "AUD");
const subFxRate = (sub, liveRates = {}) => {
  const code = String(sub?.currency || "AUD").toUpperCase();
  if (code === "AUD") return 1;
  return Number(liveRates[code]) || Number(sub?.fxRateToAud) || 1;
};
const subAmountAud = (sub, liveRates = {}) => (parseFloat(sub?.amount) || 0) * subFxRate(sub, liveRates);
const subMonthlyAud = (sub, liveRates = {}) => monthlyEquiv(subAmountAud(sub, liveRates), sub?.frequency, sub?.customDays);

const sydneyDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};
const today = () => sydneyDate(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return sydneyDate(d); };
const getFilterDate = (range) => {
  const [year, month] = today().split("-");
  switch (range) {
    case "1D": return today(); case "1W": return daysAgo(7); case "1M": return daysAgo(30);
    case "MTD": return `${year}-${month}-01`;
    case "3M": return daysAgo(90);
    case "YTD": return `${year}-01-01`;
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
  const backdropPointerDown = useRef(false);
  if (!open) return null;
  const close = guardedClose || onClose;
  const backdropDown = (e) => { backdropPointerDown.current = e.target === e.currentTarget; };
  const backdropUp = (e) => {
    if (backdropPointerDown.current && e.target === e.currentTarget) close();
    backdropPointerDown.current = false;
  };
  return (<div onMouseDown={backdropDown} onMouseUp={backdropUp} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", width: "100%", maxWidth, maxHeight: "90vh", overflowY: "auto" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, transition: "background 200ms" }} />
        {!isMobile && <span>{dotLabel}</span>}
        <span title="Version" style={{ marginLeft: isMobile ? 0 : 6, padding: "2px 6px", borderRadius: 999, border: "1px solid #1f2937", background: "#111827", color: "#93c5fd", fontSize: 10, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.2 }}>v{VERSION}</span>
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


export {
  DEF_CATEGORIES,
  DEF_PLATFORMS,
  TIME_RANGES,
  DEF_SIZE_MAP,
  getDefaultSize,
  getSizes,
  EXP_CATEGORIES,
  SUB_CATEGORIES,
  VERSION,
  PREORDER_THRESHOLD,
  FREQ_OPTIONS,
  FREQ_LABEL,
  CURRENCY_OPTIONS,
  EBAY_AU_FEE_RATE,
  EBAY_AU_FIXED_ORDER_FEE,
  FONT_SIZES,
  TEMPLATES,
  renderTemplate,
  stripHtml,
  businessDaysUntil,
  frequencyDays,
  frequencyLabel,
  advanceDate,
  monthlyEquiv,
  preorderBadge,
  genId,
  formatMoney,
  currency,
  subFxRate,
  subAmountAud,
  subMonthlyAud,
  sydneyDate,
  today,
  daysAgo,
  getFilterDate,
  useIsMobile,
  inp,
  sel,
  primaryBtn,
  ghostBtn,
  cb,
  badge,
  ConfirmDialog,
  UnsavedDialog,
  Modal,
  Field,
  Row,
  KPI,
  TopBar,
  Spark
};
