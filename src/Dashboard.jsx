import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { load, save, supabase, isSupabaseConfigured } from "./supabase.js";
import Calculator from "./Calculator";
import CustomersPage from "./dashboard/pages/CustomersPage.jsx";
import HealthPage from "./dashboard/pages/HealthPage.jsx";
import InventoryPage from "./dashboard/pages/InventoryPage.jsx";
import PricingPage from "./dashboard/pages/PricingPage.jsx";
import ReportsPage from "./dashboard/pages/ReportsPage.jsx";
import SalesPage from "./dashboard/pages/SalesPage.jsx";

import { DEF_CATEGORIES, DEF_PLATFORMS, TIME_RANGES, DEF_SIZE_MAP, getDefaultSize, getSizes, EXP_CATEGORIES, SUB_CATEGORIES, VERSION, PREORDER_THRESHOLD, FREQ_OPTIONS, FREQ_LABEL, EBAY_AU_FEE_RATE, EBAY_AU_FIXED_ORDER_FEE, FONT_SIZES, TEMPLATES, renderTemplate, stripHtml, businessDaysUntil, advanceDate, monthlyEquiv, frequencyLabel, formatMoney, subAmountAud, subMonthlyAud, preorderBadge, genId, currency, sydneyDate, today, daysAgo, getFilterDate, useIsMobile, inp, sel, primaryBtn, ghostBtn, cb, badge, ConfirmDialog, UnsavedDialog, Modal, Field, Row, KPI, TopBar } from "./dashboard/shared.jsx";

import { EditInvModal, EditSaleModal, SellModal, BulkEditModal, EditExpModal, BulkEditExpModal, BulkEditSaleModal, BulkSellModal, ManualSaleModal, EbaySaleReviewModal, GmailInventoryReviewModal, NotepadEditor, SubModal, TemplateManagerModal } from "./dashboard/modals.jsx";

const DEFAULT_NAV_UTILITY_IDS = ["settings"];
const DEFAULT_BACKUP_SETTINGS = { autoWeekly: false, destination: "supabase", retention: 12, lastRunAt: "" };
const defaultSettings = () => ({ categories: DEF_CATEGORIES, platforms: DEF_PLATFORMS, customers: [], customerProfiles: {}, hiddenCustomerKeys: [], dashboardCards: {}, navOrder: [], navUtilityIds: DEFAULT_NAV_UTILITY_IDS, backup: DEFAULT_BACKUP_SETTINGS });
const normalizeSettings = (settings = {}) => ({
  categories: settings.categories || DEF_CATEGORIES,
  platforms: settings.platforms || DEF_PLATFORMS,
  customers: settings.customers || [],
  customerProfiles: settings.customerProfiles || {},
  hiddenCustomerKeys: Array.isArray(settings.hiddenCustomerKeys) ? settings.hiddenCustomerKeys : [],
  dashboardCards: settings.dashboardCards || {},
  navOrder: Array.isArray(settings.navOrder) ? settings.navOrder : [],
  navUtilityIds: Array.isArray(settings.navUtilityIds) ? settings.navUtilityIds : DEFAULT_NAV_UTILITY_IDS,
  backup: { ...DEFAULT_BACKUP_SETTINGS, ...(settings.backup || {}) },
});
const customerKey = (name = "") => String(name || "").trim().toLowerCase().replace(/\s+/g, " ") || "unknown";
const listedPlatformsFor = (item = {}) => Array.isArray(item.listedPlatforms) ? item.listedPlatforms.filter(Boolean) : [];
const platformShortName = (platform = "") => {
  const p = String(platform).toLowerCase();
  if (p.includes("facebook")) return "FB";
  if (p.includes("ebay")) return "eBay";
  if (p.includes("instagram")) return "IG";
  return String(platform || "Listed").replace(/\s+marketplace/i, "");
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
const shortDateLabel = (dateStr = "") => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr || "";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};
const PeriodComparisonChart = ({ points = [], isMobile }) => {
  const [hoverIndex, setHoverIndex] = useState(null);
  const chartPoints = points.length ? points : [
    { key: "empty-1", label: "Start", currentDate: "", previousDate: "", current: 0, previous: 0, currentSales: 0, previousSales: 0 },
    { key: "empty-2", label: "End", currentDate: "", previousDate: "", current: 0, previous: 0, currentSales: 0, previousSales: 0 },
  ];
  const width = 1000;
  const height = isMobile ? 180 : 168;
  const pad = { top: 10, right: 22, bottom: 28, left: 76 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = chartPoints.flatMap((p) => [Number(p.current) || 0, Number(p.previous) || 0, 0]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawSpan = Math.max(1, rawMax - rawMin);
  const niceStep = (range) => {
    const rough = Math.max(1, range / 5);
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
  };
  const step = niceStep(rawSpan);
  const paddedMin = rawMin - rawSpan * 0.12;
  const paddedMax = rawMax + rawSpan * 0.12;
  const min = Math.floor(paddedMin / step) * step;
  const max = Math.ceil(paddedMax / step) * step;
  const span = max === min ? 1 : max - min;
  const tickValues = [];
  for (let value = min; value <= max + step / 2; value += step) tickValues.push(Math.abs(value) < 0.0001 ? 0 : value);
  const xFor = (index) => pad.left + (chartPoints.length <= 1 ? plotW / 2 : (index / (chartPoints.length - 1)) * plotW);
  const yFor = (value) => pad.top + ((max - value) / span) * plotH;
  const pathFor = (key) => chartPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(Number(p[key]) || 0).toFixed(2)}`).join(" ");
  const labelIndexes = [...new Set([0, Math.floor((chartPoints.length - 1) / 2), chartPoints.length - 1])];
  const hoverPoint = hoverIndex === null ? chartPoints[chartPoints.length - 1] : chartPoints[hoverIndex];
  const hoverX = xFor(hoverIndex === null ? chartPoints.length - 1 : hoverIndex);
  const hoverY = yFor(Math.max(Number(hoverPoint.current) || 0, Number(hoverPoint.previous) || 0));
  const tooltipLeft = hoverX < 120 ? "110px" : hoverX > width - 120 ? "calc(100% - 110px)" : `${(hoverX / width) * 100}%`;
  const hoverBand = chartPoints.length <= 1 ? plotW : plotW / Math.max(1, chartPoints.length - 1);

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label="Net profit current period compared with previous period" style={{ display: "block", overflow: "visible" }}>
        {tickValues.map((value) => (
          <g key={value}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(value)} y2={yFor(value)} stroke={value === 0 ? "#334155" : "#1f2937"} strokeWidth={value === 0 ? "1.2" : "1"} />
          </g>
        ))}
        <path d={pathFor("previous")} fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 7" />
        <path d={pathFor("current")} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chartPoints.map((p, i) => (
          <g key={p.key || `${p.currentDate}-${i}`}>
            <rect
              x={Math.max(pad.left, xFor(i) - hoverBand / 2)}
              y={pad.top}
              width={Math.min(hoverBand, width - pad.right - Math.max(pad.left, xFor(i) - hoverBand / 2))}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          </g>
        ))}
        {hoverIndex !== null && <>
          <line x1={hoverX} x2={hoverX} y1={pad.top} y2={pad.top + plotH} stroke="#1d4ed8" strokeWidth="1" opacity="0.7" />
          <circle cx={hoverX} cy={yFor(Number(hoverPoint.current) || 0)} r="4" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
          <circle cx={hoverX} cy={yFor(Number(hoverPoint.previous) || 0)} r="4" fill="#64748b" stroke="#0f172a" strokeWidth="2" />
        </>}
      </svg>
      {tickValues.map((value) => (
        <div key={value} style={{ position: "absolute", left: 0, top: yFor(value) - 7, width: 68, textAlign: "right", color: value === 0 ? "#94a3b8" : "#64748b", fontSize: 11, pointerEvents: "none" }}>{currency(value)}</div>
      ))}
      {labelIndexes.map((index) => {
        const point = chartPoints[index];
        const transform = index === 0 ? "translateX(0)" : index === chartPoints.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
        return (
          <div key={`${point?.key || index}-label`} style={{ position: "absolute", left: `${(xFor(index) / width) * 100}%`, bottom: 18, transform, color: "#64748b", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none" }}>{point?.label}</div>
        );
      })}
      {hoverIndex !== null && <div style={{ position: "absolute", top: Math.max(8, Math.min(height - 88, hoverY - 64)), left: tooltipLeft, transform: "translateX(-50%)", width: 210, padding: "8px 10px", borderRadius: 8, background: "#0b1220", border: "1px solid #1f2937", boxShadow: "0 12px 28px rgba(0,0,0,.35)", pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 700 }}>{hoverPoint.currentDate || "Current"}</span>
          <span style={{ color: "#bfdbfe", fontSize: 11, fontWeight: 700 }}>{currency(hoverPoint.current || 0)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>{hoverPoint.previousDate || "Previous"}</span>
          <span style={{ color: "#cbd5e1", fontSize: 11, fontWeight: 700 }}>{currency(hoverPoint.previous || 0)}</span>
        </div>
        <div style={{ color: "#64748b", fontSize: 11 }}>Units sold: <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{hoverPoint.currentSales || 0}</span> vs <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{hoverPoint.previousSales || 0}</span></div>
      </div>}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: -10, fontSize: 11, color: "#94a3b8" }}>
        <span><span style={{ display: "inline-block", width: 18, height: 3, background: "#3b82f6", borderRadius: 999, marginRight: 6, verticalAlign: "middle" }} />Current period</span>
        <span><span style={{ display: "inline-block", width: 18, height: 0, borderTop: "3px dashed #64748b", marginRight: 6, verticalAlign: "middle" }} />Previous period</span>
      </div>
    </div>
  );
};
const subCategory = (sub) => SUB_CATEGORIES.includes(sub?.category) ? sub.category : "Other";
const subCategoryColor = (cat) => ({
  Botting: ["#1e3a5f", "#93c5fd"],
  AI: ["#312e81", "#c4b5fd"],
  Marketplaces: ["#1f3b2d", "#86efac"],
  Domains: ["#3b2f1f", "#fbbf24"],
  Infrastructure: ["#1f2937", "#cbd5e1"],
  Finance: ["#3b1f2b", "#f9a8d4"],
  Other: ["#111827", "#9ca3af"],
}[cat] || ["#111827", "#9ca3af"]);

// ═══ MAIN APP ═══
export default function App({ onLogout, userEmail }) {
  const isMobile = useIsMobile();
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [subs, setSubs] = useState([]);
  const [fxRates, setFxRates] = useState({ AUD: 1 });
  const [subModalOpen, setSubModalOpen] = useState(null); // null | "new" | sub object
  const [settings, setSettings] = useState(defaultSettings());
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
  const [invSearch, setInvSearch] = useState(""); const [invCat, setInvCat] = useState("All"); const [invStatus, setInvStatus] = useState("All"); const [invSort, setInvSort] = useState("name_asc"); const [invCollapse, setInvCollapse] = useState(true);
  const [saleSearch, setSaleSearch] = useState(""); const [saleCat, setSaleCat] = useState("All"); const [salePlat, setSalePlat] = useState("All"); const [saleSort, setSaleSort] = useState("date_desc");
  const [customerSearch, setCustomerSearch] = useState(""); const [customerPlatform, setCustomerPlatform] = useState("All"); const [customerSort, setCustomerSort] = useState("profit_desc"); const [activeCustomerKey, setActiveCustomerKey] = useState(null);
  const [expSearch, setExpSearch] = useState(""); const [expFrom, setExpFrom] = useState(""); const [expTo, setExpTo] = useState(""); const [expCatFilter, setExpCatFilter] = useState("All"); const [expSort, setExpSort] = useState("date_desc");
  const [subSearch, setSubSearch] = useState(""); const [subCatFilter, setSubCatFilter] = useState("All"); const [subSort, setSubSort] = useState("nextDue_asc");
  const [backupStatus, setBackupStatus] = useState("");
  const [backups, setBackups] = useState([]);
  const autoBackupAttemptRef = useRef("");
  const [dashboardCustomizeOpen, setDashboardCustomizeOpen] = useState(false);
  const [navDragId, setNavDragId] = useState(null);
  const [mobileNavMoreOpen, setMobileNavMoreOpen] = useState(false);
  const [settingsCustomersOpen, setSettingsCustomersOpen] = useState(false);

  // Settings UI
  const [newCat, setNewCat] = useState(""); const [newPlat, setNewPlat] = useState(""); const [newCust, setNewCust] = useState("");

  const CATS = settings.categories; const PLATS = settings.platforms; const CUSTS = settings.customers;
  const listingPlatforms = useMemo(() => PLATS.filter((p) => !["StockX", "GOAT", "CSFloat", "Bonusbank"].includes(p)), [PLATS]);

  const emptyInv = { name: "", category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||""), price: "", ebayListedPrice: "", quantity: "1", purchaseDate: today(), preorderDate: "", brand: "", inTransit: false, listedPlatforms: [], tags: "", customer: "" };
  const [invForm, setInvForm] = useState(emptyInv);
  const emptyExp = { name: "", amount: "", purchaseDate: today(), tags: "", expCategory: EXP_CATEGORIES[0] };
  const [expForm, setExpForm] = useState(emptyExp);
  const dashboardCardDefaults = {
    actionStrip: true,
    preorderAlerts: true,
    netProfitGraph: true,
    salesIncome: true,
    netProfit: true,
    grossProfit: true,
    inventoryValue: false,
    salesCount: true,
    avgOrderValue: false,
    netMargin: true,
    grossMargin: true,
    totalExpenses: true,
    platformFees: true,
    monthlySubs: false,
    aging: true,
    velocity: true,
    recentSales: true,
    recentInventory: true,
  };
  const dashboardCardLabels = [
    ["actionStrip", "Action strip"],
    ["preorderAlerts", "Preorder alerts"],
    ["netProfitGraph", "Net profit graph"],
    ["salesIncome", "Sales income"],
    ["netProfit", "Net profit"],
    ["grossProfit", "Gross profit"],
    ["salesCount", "Sales count"],
    ["netMargin", "Net margin"],
    ["grossMargin", "Gross margin"],
    ["totalExpenses", "Total expenses"],
    ["platformFees", "Platform fees"],
    ["aging", "Aging"],
    ["velocity", "Velocity"],
    ["recentSales", "Recent sales"],
    ["recentInventory", "Recent inventory"],
  ];

  useEffect(() => {
    (async () => {
      const [i, s, e, sb, st, existingNotes, oldNotepad, savedActiveId, existingTpls, existingBackups] = await Promise.all([
        load("arch-inv2", []),
        load("arch-sales2", []),
        load("arch-exp2", []),
        load("arch-subs", []),
        load("arch-settings", defaultSettings()),
        load("arch-notes", null),
        load("arch-notepad", null),
        load("arch-notes-active", null),
        load("arch-templates", null),
        load("arch-backups", []),
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

      setInventory(i); setSales(s); setExpenses(e); setSubs(sb); setSettings(normalizeSettings(st));
      setNotes(initialNotes);
      setBackups(Array.isArray(existingBackups) ? existingBackups : []);

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

  useEffect(() => {
    const codes = [...new Set(subs.map((s) => String(s.currency || "AUD").toUpperCase()).filter((c) => c && c !== "AUD"))];
    if (!codes.length) {
      setFxRates({ AUD: 1 });
      return;
    }
    let alive = true;
    Promise.all(codes.map((code) =>
      fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(code)}/AUD`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => [code, Number(data?.rate)])
        .catch(() => [code, 0])
    )).then((entries) => {
      if (!alive) return;
      const next = { AUD: 1 };
      entries.forEach(([code, rate]) => { if (rate) next[code] = rate; });
      setFxRates(next);
    });
    return () => { alive = false; };
  }, [subs]);

  const persist = useCallback(async (key, data, setter) => {
    setSaveStatus("saving"); await save(key, data); setter(data); setSaveStatus("saved"); setTimeout(() => setSaveStatus(""), 1500);
  }, []);
  const persistInv = useCallback(async (d) => persist("arch-inv2", d, setInventory), [persist]);
  const persistSales = useCallback(async (d) => persist("arch-sales2", d, setSales), [persist]);
  const persistExp = useCallback(async (d) => persist("arch-exp2", d, setExpenses), [persist]);
  const persistSubs = useCallback(async (d) => persist("arch-subs", d, setSubs), [persist]);
  const persistSettings = useCallback(async (d) => { await save("arch-settings", d); setSettings(d); }, []);
  const dashboardCards = { ...dashboardCardDefaults, ...(settings.dashboardCards || {}), inventoryValue: false, avgOrderValue: false, monthlySubs: false };
  const backupSettings = { ...DEFAULT_BACKUP_SETTINGS, ...(settings.backup || {}) };
  const setDashboardCard = (key, enabled) => persistSettings({ ...settings, dashboardCards: { ...(settings.dashboardCards || {}), [key]: enabled } });
  const customerProfiles = settings.customerProfiles || {};
  const hiddenCustomerKeys = Array.isArray(settings.hiddenCustomerKeys) ? settings.hiddenCustomerKeys : [];
  const updateCustomerProfile = (key, updates) => persistSettings({
    ...settings,
    customerProfiles: {
      ...customerProfiles,
      [key]: { ...(customerProfiles[key] || {}), ...updates, updatedAt: Date.now() },
    },
  });
  const removeCustomer = (key) => {
    const nextProfiles = { ...customerProfiles };
    delete nextProfiles[key];
    const hidden = new Set(hiddenCustomerKeys);
    hidden.add(key);
    return persistSettings({
      ...settings,
      customers: CUSTS.filter((name) => customerKey(name) !== key),
      customerProfiles: nextProfiles,
      hiddenCustomerKeys: [...hidden],
    });
  };

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
    const result = await supabase.functions.invoke("gmail-sync-inventory", { body: { days: 90, maxResults: 25 } });
    setGmailBusy(false);
    let data = result.data;
    const error = result.error;
    if (error?.context?.json) {
      data = await error.context.json().catch(() => data);
    }
    if (error) {
      const detailText = data?.details
        ? ` ${typeof data.details === "string" ? data.details : JSON.stringify(data.details).slice(0, 500)}`
        : "";
      const message = data?.reconnectRequired
        ? "Reconnect Gmail from Settings, then try Sync Gmail again."
        : `${data?.error || error.message || "Could not sync Gmail inventory."}${detailText}`;
      setGmailStatus(message);
      return;
    }
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
  const addCustomer = useCallback(async (name, profileUpdates = {}) => {
    if (!name && !profileUpdates.name) return;
    const displayName = name || profileUpdates.name;
    const key = customerKey(displayName);
    const nextCustomers = displayName && !CUSTS.includes(displayName) ? [...CUSTS, displayName] : CUSTS;
    const nextProfiles = Object.keys(profileUpdates).length ? {
      ...(settings.customerProfiles || {}),
      [key]: { ...((settings.customerProfiles || {})[key] || {}), ...profileUpdates, updatedAt: Date.now() },
    } : (settings.customerProfiles || {});
    const ns = { ...settings, customers: nextCustomers, customerProfiles: nextProfiles, hiddenCustomerKeys: (settings.hiddenCustomerKeys || []).filter((hiddenKey) => hiddenKey !== key) };
    await persistSettings(ns);
    return key;
  }, [settings, CUSTS, persistSettings]);

  const updateInvForm = (u) => { setInvForm({ ...invForm, ...u }); setAddDirty(true); };
  const guardedCloseAdd = () => { if (addDirty) setShowUnsavedAdd(true); else { setAddInvOpen(false); setAddDirty(false); } };

  const addInventory = async () => {
    if (!invForm.name || !invForm.price) return;
    const qty = Math.max(1, parseInt(invForm.quantity) || 1);
    const items = Array.from({ length: qty }, () => ({ id: genId(), name: invForm.name, category: invForm.category, size: invForm.size, price: parseFloat(invForm.price), ebayListedPrice: invForm.ebayListedPrice ? parseFloat(invForm.ebayListedPrice) : undefined, purchaseDate: invForm.purchaseDate, preorderDate: invForm.preorderDate, brand: invForm.brand, inTransit: invForm.inTransit, listedPlatforms: listedPlatformsFor(invForm), tags: invForm.tags, customer: invForm.customer, addedAt: Date.now() }));
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
      const feeTotal = Number(draft.platform_fees || 0) > 0 ? Number(draft.platform_fees || 0) : Number((Number(draft.sale_price || 0) * EBAY_AU_FEE_RATE + EBAY_AU_FIXED_ORDER_FEE).toFixed(2));
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
    const eBayProfile = Object.fromEntries(Object.entries({
      name: draft.buyer_full_name || shared.customer,
      defaultPlatform: "eBay",
      ebayUsername: draft.buyer_username || shared.customer,
      ebayBuyerId: draft.buyer_username || shared.customer,
      email: draft.buyer_email,
      phone: draft.buyer_phone,
      companyName: draft.buyer_company,
      address: [draft.buyer_address_line1, draft.buyer_address_line2, draft.buyer_city, draft.buyer_state, draft.buyer_postcode, draft.buyer_country].filter(Boolean).join(", "),
      addressLine1: draft.buyer_address_line1,
      addressLine2: draft.buyer_address_line2,
      city: draft.buyer_city,
      state: draft.buyer_state,
      postcode: draft.buyer_postcode,
      country: draft.buyer_country,
      county: draft.buyer_county,
      shippingCarrier: draft.shipping_carrier_code,
      shippingService: draft.shipping_service_code,
      shipToReferenceId: draft.ship_to_reference_id,
      fulfillmentType: draft.fulfillment_instruction_type,
      ebaySupportedFulfillment: draft.ebay_supported_fulfillment,
      contactSource: draft.buyer_contact_source,
      lastEbayOrderId: draft.order_id,
      lastImportedAt: new Date().toISOString(),
    }).filter(([, value]) => value));
    if (shared.customer || eBayProfile.name) await addCustomer(shared.customer || eBayProfile.name, eBayProfile);
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
    const subCurrency = String(sub.currency || "AUD").toUpperCase();
    const originalCharge = subCurrency !== "AUD" ? `${formatMoney(sub.amount, subCurrency)} @ ${Number(fxRates[subCurrency] || sub.fxRateToAud || 1).toFixed(4)}` : "";
    const newExp = { id: genId(), name: sub.name, amount: subAmountAud(sub, fxRates), purchaseDate: sub.nextDue, tags: [subCategory(sub), sub.tags || "", originalCharge].filter(Boolean).join(" · "), expCategory: "Software & Subs" };
    await persistExp([newExp, ...expenses]);
    await persistSubs(subs.map((s) => s.id === sub.id ? { ...s, fxRateToAud: subCurrency !== "AUD" ? (fxRates[subCurrency] || s.fxRateToAud || 1) : 1, nextDue: advanceDate(s.nextDue, s.frequency, s.customDays), lastLogged: sub.nextDue } : s));
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
      const subCurrency = String(sub.currency || "AUD").toUpperCase();
      while (cur <= t) {
        const originalCharge = subCurrency !== "AUD" ? `${formatMoney(sub.amount, subCurrency)} @ ${Number(fxRates[subCurrency] || sub.fxRateToAud || 1).toFixed(4)}` : "";
        newExpenses.push({ id: genId(), name: sub.name, amount: subAmountAud(sub, fxRates), purchaseDate: cur, tags: [subCategory(sub), sub.tags || "", originalCharge].filter(Boolean).join(" · "), expCategory: "Software & Subs" });
        lastLogged = cur;
        cur = advanceDate(cur, sub.frequency, sub.customDays);
      }
      updatedSubs = updatedSubs.map((s) => s.id === sub.id ? { ...s, fxRateToAud: subCurrency !== "AUD" ? (fxRates[subCurrency] || s.fxRateToAud || 1) : 1, nextDue: cur, lastLogged } : s);
    }
    await persistExp([...newExpenses, ...expenses]);
    await persistSubs(updatedSubs);
  };

  const toggleSubActive = async (sub) => {
    await persistSubs(subs.map((s) => s.id === sub.id ? { ...s, active: !s.active } : s));
  };

  const handleBulkEdit = async (updates) => {
    const ids = selectedInv;
    const { addListedPlatform, clearListingPlatforms, ...rest } = updates;
    await persistInv(inventory.map((i) => {
      if (!ids.has(i.id)) return i;
      const next = { ...i, ...rest };
      if (clearListingPlatforms) next.listedPlatforms = [];
      if (addListedPlatform) next.listedPlatforms = [...new Set([...listedPlatformsFor(next), addListedPlatform])];
      return next;
    }));
    setBulkEditOpen(false); setSelectedInv(new Set());
  };

  // ─── Export ───
  const buildBackupSnapshot = (reason = "manual") => ({
    id: genId(),
    reason,
    createdAt: new Date().toISOString(),
    version: 6,
    appVersion: VERSION,
    counts: { inventory: inventory.length, sales: sales.length, expenses: expenses.length, subs: subs.length, notes: notes.length },
    data: { inventory, sales, expenses, subs, notes, settings, templates: userTemplates || [] },
  });

  const createSupabaseBackup = useCallback(async (reason = "manual") => {
    if (!supabase) {
      setBackupStatus("Supabase backups need Supabase to be configured.");
      setTimeout(() => setBackupStatus(""), 4000);
      return false;
    }
    const snapshot = buildBackupSnapshot(reason);
    const retention = Math.max(1, Number(backupSettings.retention) || DEFAULT_BACKUP_SETTINGS.retention);
    const nextBackups = [snapshot, ...backups].slice(0, retention);
    await save("arch-backups", nextBackups);
    setBackups(nextBackups);
    await persistSettings({ ...settings, backup: { ...backupSettings, lastRunAt: snapshot.createdAt } });
    setBackupStatus(`${reason === "auto" ? "Weekly" : "Supabase"} backup saved: ${snapshot.counts.inventory} items, ${snapshot.counts.sales} sales, ${snapshot.counts.expenses} expenses.`);
    setTimeout(() => setBackupStatus(""), 5000);
    return true;
  }, [inventory, sales, expenses, subs, notes, settings, userTemplates, backups, backupSettings, persistSettings]);

  const updateBackupSettings = async (updates) => {
    await persistSettings({ ...settings, backup: { ...backupSettings, ...updates } });
  };
  const restoreSupabaseBackup = async (snapshot) => {
    if (!snapshot || !window.confirm(`Restore backup from ${new Date(snapshot.createdAt).toLocaleString()}? This replaces current local data.`)) return;
    const data = snapshot.data || {};
    await persistInv(Array.isArray(data.inventory) ? data.inventory : []);
    await persistSales(Array.isArray(data.sales) ? data.sales : []);
    await persistExp(Array.isArray(data.expenses) ? data.expenses : []);
    await persistSubs(Array.isArray(data.subs) ? data.subs : []);
    if (Array.isArray(data.notes)) {
      setNotes(data.notes);
      await save("arch-notes", data.notes);
      setActiveNoteId(data.notes[0]?.id || null);
    }
    if (data.settings) await persistSettings(normalizeSettings(data.settings));
    setBackupStatus("Backup restored.");
    setTimeout(() => setBackupStatus(""), 4000);
  };

  useEffect(() => {
    if (loading || !backupSettings.autoWeekly) return;
    const todayKey = today();
    if (autoBackupAttemptRef.current === todayKey) return;
    const lastRun = backupSettings.lastRunAt ? new Date(backupSettings.lastRunAt) : null;
    const due = !lastRun || Number.isNaN(lastRun.getTime()) || (Date.now() - lastRun.getTime()) >= 7 * 86400000;
    if (!due) return;
    autoBackupAttemptRef.current = todayKey;
    createSupabaseBackup("auto");
  }, [loading, backupSettings.autoWeekly, backupSettings.lastRunAt, createSupabaseBackup]);

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

  const daysHeld = (dateStr) => {
    if (!dateStr) return 0;
    const start = new Date(`${dateStr}T00:00:00`);
    const end = new Date(`${today()}T00:00:00`);
    if (isNaN(start.getTime())) return 0;
    return Math.max(0, Math.floor((end - start) / 86400000));
  };
  const dateObj = (dateStr) => new Date(`${dateStr}T00:00:00`);
  const dateKey = (date) => sydneyDate(date);
  const addDaysToKey = (dateStr, days) => {
    const d = dateObj(dateStr);
    d.setDate(d.getDate() + days);
    return dateKey(d);
  };
  const daysInclusive = (from, to) => Math.max(1, Math.round((dateObj(to) - dateObj(from)) / 86400000) + 1);
  const activePeriod = useMemo(() => {
    const fallbackDates = [...sales.map((s) => s.saleDate), ...expenses.map((e) => e.purchaseDate)].filter(Boolean).sort();
    const currentEnd = range === "Custom" ? customTo : today();
    const currentStart = range === "Custom" ? customFrom : range === "ALL" ? fallbackDates[0] || today() : getFilterDate(range);
    const periodDays = daysInclusive(currentStart, currentEnd);
    const previousEnd = addDaysToKey(currentStart, -1);
    const previousStart = addDaysToKey(previousEnd, -(periodDays - 1));
    return { currentStart, currentEnd, previousStart, previousEnd, periodDays };
  }, [range, customFrom, customTo, sales, expenses]);

  // ─── Dashboard Stats ───
  const stats = useMemo(() => {
    const cutFrom = activePeriod.currentStart;
    const cutTo = activePeriod.currentEnd;
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
    const pbd = {};
    fs.forEach((s) => { pbd[s.saleDate] = (pbd[s.saleDate] || 0) + (Number(s.profit) || 0); });
    fe.forEach((e) => { pbd[e.purchaseDate] = (pbd[e.purchaseDate] || 0) - (Number(e.amount) || 0); });
    const dates = activePeriod.periodDays > 730 ? Object.keys(pbd).sort() : [];
    if (!dates.length && activePeriod.periodDays <= 730) {
      for (let d = cutFrom; d <= cutTo; d = addDaysToKey(d, 1)) dates.push(d);
    }
    let cum = 0; const spark = dates.map((d) => { cum += pbd[d] || 0; return cum; });
    const ri = [...inventory].sort((a, b) => (b.addedAt||0) - (a.addedAt||0)).slice(0, 7);
    const rs = [...fs].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")).slice(0, 7);
    return { salesIncome, grossProfit, totalExpenses, netProfit, invValue, cnt, aov, sellThrough, totalFees, grossMargin, netMargin, spark, ri, rs };
  }, [inventory, sales, expenses, activePeriod, dashCat, dashPlat]);

  const periodComparison = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd } = activePeriod;
    const matchesFilters = (s) => (dashCat === "All" || s.category === dashCat) && (dashPlat === "All" || s.platform === dashPlat);
    const currentSales = sales.filter((s) => s.saleDate >= currentStart && s.saleDate <= currentEnd && matchesFilters(s));
    const previousSales = sales.filter((s) => s.saleDate >= previousStart && s.saleDate <= previousEnd && matchesFilters(s));
    const currentSalesProfit = currentSales.reduce((a, s) => a + (s.profit || 0), 0);
    const currentExpenses = expenses.filter((e) => e.purchaseDate >= currentStart && e.purchaseDate <= currentEnd).reduce((a, e) => a + (e.amount || 0), 0);
    const previousSalesProfit = previousSales.reduce((a, s) => a + (s.profit || 0), 0);
    const previousExpenses = expenses.filter((e) => e.purchaseDate >= previousStart && e.purchaseDate <= previousEnd).reduce((a, e) => a + (e.amount || 0), 0);
    const current = currentSalesProfit - currentExpenses;
    const previous = previousSalesProfit - previousExpenses;
    const delta = current - previous;
    const pct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
    const salesDelta = currentSales.length - previousSales.length;
    const salesPct = previousSales.length ? (salesDelta / previousSales.length) * 100 : null;
    return { current, previous, delta, pct, currentStart, currentEnd, previousStart, previousEnd, salesCount: currentSales.length, previousSalesCount: previousSales.length, salesDelta, salesPct };
  }, [sales, expenses, dashCat, dashPlat, activePeriod]);

  const periodTrend = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd, periodDays } = activePeriod;
    const matchesFilters = (s) => (dashCat === "All" || s.category === dashCat) && (dashPlat === "All" || s.platform === dashPlat);
    const saleUnits = (s) => Math.max(1, Number(s.quantity) || 1);
    const salesMap = (from, to) => {
      const map = new Map();
      sales.filter((s) => s.saleDate >= from && s.saleDate <= to && matchesFilters(s)).forEach((s) => {
        const row = map.get(s.saleDate) || { profit: 0, units: 0 };
        row.profit += Number(s.profit) || 0;
        row.units += saleUnits(s);
        map.set(s.saleDate, row);
      });
      return map;
    };
    const expenseMap = (from, to) => {
      const map = new Map();
      expenses.filter((e) => e.purchaseDate >= from && e.purchaseDate <= to).forEach((e) => {
        map.set(e.purchaseDate, (map.get(e.purchaseDate) || 0) + (Number(e.amount) || 0));
      });
      return map;
    };
    const currentSalesByDate = salesMap(currentStart, currentEnd);
    const previousSalesByDate = salesMap(previousStart, previousEnd);
    const currentExpensesByDate = expenseMap(currentStart, currentEnd);
    const previousExpensesByDate = expenseMap(previousStart, previousEnd);
    const sampleCount = periodDays <= 120 ? periodDays : 120;
    const offsets = Array.from({ length: Math.max(1, sampleCount) }, (_, index) => {
      if (sampleCount === 1) return 0;
      return Math.round(((periodDays - 1) * index) / (sampleCount - 1));
    });
    let currentProfit = 0;
    let previousProfit = 0;
    let currentUnits = 0;
    let previousUnits = 0;
    let lastOffset = -1;
    const points = offsets.map((offset) => {
      for (let step = lastOffset + 1; step <= offset; step += 1) {
        const currentDate = addDaysToKey(currentStart, step);
        const previousDate = addDaysToKey(previousStart, step);
        const currentSale = currentSalesByDate.get(currentDate) || { profit: 0, units: 0 };
        const previousSale = previousSalesByDate.get(previousDate) || { profit: 0, units: 0 };
        currentProfit += currentSale.profit - (currentExpensesByDate.get(currentDate) || 0);
        previousProfit += previousSale.profit - (previousExpensesByDate.get(previousDate) || 0);
        currentUnits += currentSale.units;
        previousUnits += previousSale.units;
      }
      lastOffset = offset;
      const currentDate = addDaysToKey(currentStart, offset);
      const previousDate = addDaysToKey(previousStart, offset);
      return {
        key: `${currentDate}-${previousDate}`,
        label: shortDateLabel(currentDate),
        currentDate,
        previousDate,
        current: currentProfit,
        previous: previousProfit,
        currentSales: currentUnits,
        previousSales: previousUnits,
      };
    });
    if (periodDays === 1) {
      return [
        { key: "baseline", label: "Start", currentDate: currentStart, previousDate: previousStart, current: 0, previous: 0, currentSales: 0, previousSales: 0 },
        ...points,
      ];
    }
    return points;
  }, [sales, expenses, dashCat, dashPlat, activePeriod]);

  const agingStats = useMemo(() => {
    const aged90 = inventory.filter((i) => daysHeld(i.purchaseDate) >= 90);
    const aged180 = inventory.filter((i) => daysHeld(i.purchaseDate) >= 180);
    const oldest = [...inventory]
      .map((i) => ({ ...i, _daysHeld: daysHeld(i.purchaseDate) }))
      .sort((a, b) => b._daysHeld - a._daysHeld)
      .slice(0, 6);
    const avgDays = inventory.length ? Math.round(inventory.reduce((a, i) => a + daysHeld(i.purchaseDate), 0) / inventory.length) : 0;
    const agedValue = aged90.reduce((a, i) => a + (Number(i.price) || 0), 0);
    return { aged90, aged180, oldest, avgDays, agedValue };
  }, [inventory]);

  const velocityStats = useMemo(() => {
    const since30 = daysAgo(30);
    const since90 = daysAgo(90);
    const sold30 = sales.filter((s) => s.saleDate >= since30);
    const sold90 = sales.filter((s) => s.saleDate >= since90);
    const monthlySellThrough = (inventory.length + sold30.length) > 0 ? sold30.length / (inventory.length + sold30.length) : 0;
    const dailyRate = sold30.length / 30;
    const daysCover = dailyRate > 0 ? Math.round(inventory.length / dailyRate) : null;
    const categoryMap = new Map();
    sold90.forEach((s) => {
      const key = s.category || "Other";
      const prev = categoryMap.get(key) || { category: key, count: 0, revenue: 0, profit: 0 };
      prev.count += 1;
      prev.revenue += Number(s.salePrice) || 0;
      prev.profit += Number(s.profit) || 0;
      categoryMap.set(key, prev);
    });
    const topCategories = [...categoryMap.values()].sort((a, b) => b.count - a.count || b.profit - a.profit).slice(0, 5);
    return { sold30, sold90, monthlySellThrough, daysCover, topCategories };
  }, [inventory.length, sales]);

  const reportStats = useMemo(() => {
    const cutFrom = range === "Custom" ? customFrom : getFilterDate(range);
    const cutTo = range === "Custom" ? customTo : "2099-12-31";
    let fs = sales.filter((s) => s.saleDate >= cutFrom && s.saleDate <= cutTo);
    let fe = expenses.filter((e) => e.purchaseDate >= cutFrom && e.purchaseDate <= cutTo);
    if (dashCat !== "All") fs = fs.filter((s) => s.category === dashCat);
    if (dashPlat !== "All") fs = fs.filter((s) => s.platform === dashPlat);
    const revenue = fs.reduce((a, s) => a + (Number(s.salePrice) || 0), 0);
    const cogs = fs.reduce((a, s) => a + (Number(s.costPrice) || 0), 0);
    const shipping = fs.reduce((a, s) => a + (Number(s.shippingPrice) || 0), 0);
    const fees = fs.reduce((a, s) => a + (Number(s.platformFees) || 0), 0);
    const grossProfit = revenue - cogs - shipping - fees;
    const operatingExpenses = fe.reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const netProfit = grossProfit - operatingExpenses;
    const group = (items, keyFn, amountFn) => {
      const map = new Map();
      items.forEach((item) => {
        const key = keyFn(item) || "Other";
        const row = map.get(key) || { name: key, count: 0, amount: 0 };
        row.count += 1;
        row.amount += amountFn(item);
        map.set(key, row);
      });
      return [...map.values()].sort((a, b) => b.amount - a.amount);
    };
    return {
      cutFrom,
      cutTo,
      sales: fs,
      expenses: fe,
      revenue,
      cogs,
      shipping,
      fees,
      grossProfit,
      operatingExpenses,
      netProfit,
      platformRows: group(fs, (s) => s.platform, (s) => Number(s.salePrice) || 0),
      categoryRows: group(fs, (s) => s.category, (s) => Number(s.profit) || 0),
      expenseRows: group(fe, (e) => e.expCategory, (e) => Number(e.amount) || 0),
    };
  }, [sales, expenses, range, customFrom, customTo, dashCat, dashPlat]);

  const exportReportCSV = () => {
    const headers = ["Section", "Name", "Count", "Amount"];
    const rows = [
      ["P&L", "Revenue", reportStats.sales.length, reportStats.revenue],
      ["P&L", "Cost of goods", reportStats.sales.length, reportStats.cogs],
      ["P&L", "Shipping", reportStats.sales.length, reportStats.shipping],
      ["P&L", "Platform fees", reportStats.sales.length, reportStats.fees],
      ["P&L", "Gross profit", reportStats.sales.length, reportStats.grossProfit],
      ["P&L", "Operating expenses", reportStats.expenses.length, reportStats.operatingExpenses],
      ["P&L", "Net profit", reportStats.sales.length, reportStats.netProfit],
      ...reportStats.platformRows.map((r) => ["Platform revenue", r.name, r.count, r.amount]),
      ...reportStats.categoryRows.map((r) => ["Category profit", r.name, r.count, r.amount]),
      ...reportStats.expenseRows.map((r) => ["Expense category", r.name, r.count, r.amount]),
    ];
    const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archivedash-profit-report-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Preorders within the reminder window ───
  const upcomingPreorders = useMemo(() => {
    return inventory
      .map((i) => ({ ...i, _bdays: businessDaysUntil(i.preorderDate) }))
      .filter((i) => i._bdays !== null && i._bdays >= 0 && i._bdays <= PREORDER_THRESHOLD)
      .sort((a, b) => a._bdays - b._bdays);
  }, [inventory]);
  const upcomingPreorderGroups = useMemo(() => {
    const groups = new Map();
    upcomingPreorders.forEach((item) => {
      const key = `${item.name}|${item.preorderDate || ""}`;
      const existing = groups.get(key) || { ...item, _items: [], _count: 0, _totalValue: 0 };
      existing._items.push(item);
      existing._count += 1;
      existing._totalValue += Number(item.price) || 0;
      existing._bdays = Math.min(existing._bdays ?? item._bdays, item._bdays);
      groups.set(key, existing);
    });
    return [...groups.values()].sort((a, b) => a._bdays - b._bdays || a.name.localeCompare(b.name));
  }, [upcomingPreorders]);

  // ─── Subscription stats ───
  const subStats = useMemo(() => {
    const t = today();
    const active = subs.filter((s) => s.active);
    const overdue = active.filter((s) => s.nextDue && s.nextDue <= t);
    const monthlyBurn = active.reduce((a, s) => a + subMonthlyAud(s, fxRates), 0);
    const byCategory = SUB_CATEGORIES
      .map((category) => {
        const categorySubs = active.filter((s) => subCategory(s) === category);
        const monthly = categorySubs.reduce((a, s) => a + subMonthlyAud(s, fxRates), 0);
        return { category, count: categorySubs.length, monthly };
      })
      .filter((row) => row.count > 0)
      .sort((a, b) => b.monthly - a.monthly);
    return { active, overdue, monthlyBurn, annualCost: monthlyBurn * 12, byCategory };
  }, [subs, fxRates]);

  const health = useMemo(() => {
    const releasedPreorders = inventory.filter((i) => {
      const bdays = businessDaysUntil(i.preorderDate);
      return bdays !== null && bdays < 0;
    }).length;
    const emptyCategories = CATS.length === 0;
    const emptyPlatforms = PLATS.length === 0;
    const checks = [
      { key: "supabase", label: "Supabase", state: isSupabaseConfigured ? "ok" : "issue", detail: isSupabaseConfigured ? "Frontend keys found." : "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY." },
      { key: "account", label: "Account", state: userEmail ? "ok" : "warn", detail: userEmail ? `Signed in as ${userEmail}.` : "No signed-in user detected." },
      { key: "ebay", label: "eBay", state: !isSupabaseConfigured ? "warn" : ebayStatus.startsWith("Could not") ? "issue" : ebayImports.length > 0 ? "action" : "ok", detail: ebayImports.length > 0 ? `${ebayImports.length} sale draft${ebayImports.length === 1 ? "" : "s"} waiting.` : ebayStatus || "Ready to connect or sync." },
      { key: "gmail", label: "Gmail", state: !isSupabaseConfigured ? "warn" : gmailStatus.startsWith("Could not") ? "issue" : gmailImports.length > 0 ? "action" : "ok", detail: gmailImports.length > 0 ? `${gmailImports.length} inventory draft${gmailImports.length === 1 ? "" : "s"} waiting.` : gmailStatus || "Ready to connect or sync." },
      { key: "preorders", label: "Preorders", state: releasedPreorders > 0 ? "action" : "ok", detail: releasedPreorders > 0 ? `${releasedPreorders} preorder${releasedPreorders === 1 ? "" : "s"} may already be released.` : "No released preorder flags." },
      { key: "settings", label: "Lists", state: emptyCategories || emptyPlatforms ? "issue" : "ok", detail: emptyCategories || emptyPlatforms ? "Categories or platforms need at least one entry." : `${CATS.length} categories and ${PLATS.length} platforms configured.` },
    ];
    const issues = checks.filter((c) => c.state === "issue").length;
    const warnings = checks.filter((c) => c.state === "warn").length;
    const actions = checks.filter((c) => c.state === "action").length;
    return { checks, issues, warnings, actions, releasedPreorders };
  }, [inventory, CATS, PLATS, userEmail, ebayStatus, gmailStatus, ebayImports.length, gmailImports.length]);

  const sortedSubs = useMemo(() => {
    const term = subSearch.trim().toLowerCase();
    const filtered = subs.filter((s) => {
      const cat = subCategory(s);
      const matchesCat = subCatFilter === "All" || cat === subCatFilter;
      const matchesSearch = !term || [s.name, s.tags, s.currency, s.frequency, cat].some((v) => String(v || "").toLowerCase().includes(term));
      return matchesCat && matchesSearch;
    });
    const sorted = [...filtered];
    const dir = subSort.endsWith("_desc") ? -1 : 1;
    const field = subSort.replace(/_(asc|desc)$/, "");
    sorted.sort((a, b) => {
      if (field === "name") return dir * String(a.name || "").localeCompare(String(b.name || ""));
      if (field === "category") return dir * subCategory(a).localeCompare(subCategory(b));
      if (field === "amount") return dir * (subAmountAud(a, fxRates) - subAmountAud(b, fxRates));
      if (field === "monthly") return dir * (subMonthlyAud(a, fxRates) - subMonthlyAud(b, fxRates));
      if (field === "frequency") return dir * frequencyLabel(a.frequency, a.customDays).localeCompare(frequencyLabel(b.frequency, b.customDays));
      if (field === "status") return dir * Number(Boolean(a.active)).toString().localeCompare(Number(Boolean(b.active)).toString());
      return dir * String(a.nextDue || "").localeCompare(String(b.nextDue || ""));
    });
    return sorted;
  }, [subs, subSearch, subCatFilter, subSort, fxRates]);

  const setSubSortField = (field) => {
    setSubSort((prev) => {
      const prevField = prev.replace(/_(asc|desc)$/, "");
      const prevDir = prev.endsWith("_desc") ? "desc" : "asc";
      const nextDir = prevField === field && prevDir === "asc" ? "desc" : "asc";
      return `${field}_${nextDir}`;
    });
  };
  const subSortIcon = (field) => subSort.startsWith(`${field}_`) ? (subSort.endsWith("_asc") ? " ↑" : " ↓") : "";
  const subHeaderBtn = (field, label) => (
    <button onClick={() => setSubSortField(field)} style={{ background: "transparent", border: "none", color: subSort.startsWith(`${field}_`) ? "#93c5fd" : "#4b5563", padding: 0, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
      {label}{subSortIcon(field)}
    </button>
  );
  const subCatChip = (cat) => {
    const [bg, fg] = subCategoryColor(cat);
    return <span style={{ display: "inline-flex", alignItems: "center", width: "fit-content", padding: "2px 7px", borderRadius: 999, background: bg, color: fg, fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{cat}</span>;
  };

  // ─── Filtered Inventory ───
  const filteredInv = useMemo(() => {
    let f = inventory;
    if (invSearch) {
      const q = invSearch.toLowerCase();
      f = f.filter((i) => [i.name, i.brand, i.tags, ...listedPlatformsFor(i)].some((v) => String(v || "").toLowerCase().includes(q)));
    }
    if (invCat !== "All") f = f.filter((i) => i.category === invCat);
    if (invStatus !== "All") {
      f = f.filter((i) => {
        const listed = listedPlatformsFor(i);
        const hasPreorder = Boolean(i.preorderDate);
        if (invStatus === "Preorders") return hasPreorder;
        if (invStatus === "Listed") return listed.length > 0;
        if (invStatus === "Unlisted") return listed.length === 0;
        if (invStatus === "Facebook") return listed.some((p) => String(p).toLowerCase().includes("facebook"));
        if (invStatus === "eBay") return listed.some((p) => String(p).toLowerCase().includes("ebay"));
        return true;
      });
    }
    const sorted = [...f];
    switch (invSort) {
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "price_desc": sorted.sort((a, b) => b.price - a.price); break;
      case "price_asc": sorted.sort((a, b) => a.price - b.price); break;
      case "date_desc": sorted.sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"")); break;
      case "date_asc": sorted.sort((a, b) => (a.purchaseDate||"").localeCompare(b.purchaseDate||"")); break;
      case "preorder_asc": sorted.sort((a, b) => (a.preorderDate || "9999-12-31").localeCompare(b.preorderDate || "9999-12-31") || a.name.localeCompare(b.name)); break;
      case "preorder_desc": sorted.sort((a, b) => (b.preorderDate || "").localeCompare(a.preorderDate || "") || a.name.localeCompare(b.name)); break;
    }
    return sorted;
  }, [inventory, invSearch, invCat, invStatus, invSort]);

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
        const preorderDates = items.map((x) => x.preorderDate).filter(Boolean).sort();
        result.push({ ...items[0], preorderDate: preorderDates[0] || items[0].preorderDate || "", _group: true, _items: items, _count: items.length, _totalValue: totalValue });
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

  const customerRows = useMemo(() => {
    const platformGroup = (platform = "") => {
      const p = String(platform).toLowerCase();
      if (p.includes("ebay")) return "eBay";
      if (p.includes("facebook")) return "Facebook";
      if (p.includes("discord")) return "Discord";
      return "Other";
    };
    const keyFor = customerKey;
    const rows = new Map();
    const ensure = (rawName, forcedKey) => {
      const key = forcedKey || keyFor(rawName);
      const profile = customerProfiles[key] || {};
      if (!rows.has(key)) {
        rows.set(key, {
          key,
          name: profile.name || rawName || "Unknown customer",
          profile,
          sales: [],
          platforms: new Set(),
          platformGroups: new Set(),
          categories: new Set(),
          brands: new Set(),
          orderCount: 0,
          revenue: 0,
          profit: 0,
          lastPurchase: "",
        });
      }
      return rows.get(key);
    };
    CUSTS.forEach((name) => ensure(name));
    Object.entries(customerProfiles).forEach(([key, profile]) => {
      if (!rows.has(key)) ensure(profile.name || key, key);
    });
    sales.forEach((sale) => {
      const row = ensure(sale.customer || "Unknown customer");
      row.sales.push(sale);
      row.orderCount += 1;
      row.revenue += Number(sale.salePrice) || 0;
      row.profit += Number(sale.profit) || 0;
      if (sale.platform) row.platforms.add(sale.platform);
      row.platformGroups.add(platformGroup(sale.platform));
      if (sale.category) row.categories.add(sale.category);
      if (sale.brand) row.brands.add(sale.brand);
      if (sale.saleDate && sale.saleDate > row.lastPurchase) row.lastPurchase = sale.saleDate;
    });
    let result = [...rows.values()].map((row) => ({
      ...row,
      averageOrder: row.orderCount ? row.revenue / row.orderCount : 0,
      platformsList: [...row.platforms],
      platformGroupsList: [...row.platformGroups],
      categoriesList: [...row.categories],
      brandsList: [...row.brands],
      defaultPlatform: row.profile.defaultPlatform || [...row.platformGroups][0] || "Other",
    })).filter((row) => !hiddenCustomerKeys.includes(row.key));
    const q = customerSearch.trim().toLowerCase();
    if (q) {
      result = result.filter((row) => [
        row.name,
        row.profile.email,
        row.profile.phone,
        row.profile.companyName,
        row.profile.address,
        row.profile.addressLine1,
        row.profile.addressLine2,
        row.profile.city,
        row.profile.state,
        row.profile.postcode,
        row.profile.country,
        row.profile.ebayUsername,
        row.profile.ebayBuyerId,
        row.profile.shippingCarrier,
        row.profile.shippingService,
        row.profile.shipToReferenceId,
        row.profile.facebookName,
        row.profile.discordHandle,
        row.profile.notes,
        row.profile.tags,
        ...row.platformsList,
      ].some((v) => String(v || "").toLowerCase().includes(q)));
    }
    if (customerPlatform !== "All") {
      result = result.filter((row) => row.platformGroupsList.includes(customerPlatform) || row.defaultPlatform === customerPlatform);
    }
    switch (customerSort) {
      case "name_asc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "last_desc": result.sort((a, b) => (b.lastPurchase || "").localeCompare(a.lastPurchase || "")); break;
      case "orders_desc": result.sort((a, b) => b.orderCount - a.orderCount); break;
      case "revenue_desc": result.sort((a, b) => b.revenue - a.revenue); break;
      case "profit_desc":
      default: result.sort((a, b) => b.profit - a.profit); break;
    }
    return result;
  }, [sales, CUSTS, customerProfiles, hiddenCustomerKeys, customerSearch, customerPlatform, customerSort]);

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
  const preorderInvCount = useMemo(() => inventory.filter((i) => i.preorderDate).length, [inventory]);
  const listedInvCount = useMemo(() => inventory.filter((i) => listedPlatformsFor(i).length > 0).length, [inventory]);
  const facebookListedInvCount = useMemo(() => inventory.filter((i) => listedPlatformsFor(i).some((p) => String(p).toLowerCase().includes("facebook"))).length, [inventory]);
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

  const inventoryProductCount = useMemo(() => new Set(inventory.map((item) => String(item.name || "").trim().toLowerCase()).filter(Boolean)).size, [inventory]);
  const expenseMonthSummary = useMemo(() => {
    const monthStart = today().slice(0, 7);
    const rows = expenses.filter((expense) => String(expense.purchaseDate || "").startsWith(monthStart));
    return { count: rows.length, amount: rows.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0) };
  }, [expenses]);

  if (loading) return <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>Loading...</div>;

  const navItems = [
    { id: "dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
    { id: "inventory", icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12" },
    { id: "sales", icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01" },
    { id: "pricing", icon: "M12 2v4 M12 18v4 M2 12h4 M18 12h4 M19.07 4.93l-2.83 2.83 M7.76 16.24l-2.83 2.83 M19.07 19.07l-2.83-2.83 M7.76 7.76L4.93 4.93 M12 8a4 4 0 100 8 4 4 0 000-8z" },
    { id: "customers", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" },
    { id: "expenses", icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
    { id: "reports", icon: "M3 3v18h18 M7 15l3-3 3 2 4-6 M7 19h10" },
    { id: "notepad", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
    { id: "calculator", icon: "M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2z M8 6h8 M16 14v4 M16 10h0.01 M12 10h0.01 M8 10h0.01 M12 14h0.01 M8 14h0.01 M12 18h0.01 M8 18h0.01" },
    { id: "settings", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z" },
  ];

  const notepadIcon = "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8";
  const rb = (r) => ({ padding: "5px 10px", fontSize: 11, fontWeight: range === r ? 600 : 400, borderRadius: 6, background: range === r ? "#1d4ed8" : "transparent", color: range === r ? "#fff" : "#6b7280", border: "none", cursor: "pointer" });
  const defaultUtilityIds = DEFAULT_NAV_UTILITY_IDS;
  const navRank = new Map((Array.isArray(settings.navOrder) ? settings.navOrder : []).map((id, index) => [id, index]));
  const orderedNavItems = [...navItems].sort((a, b) => (navRank.has(a.id) ? navRank.get(a.id) : navItems.findIndex((n) => n.id === a.id) + 1000) - (navRank.has(b.id) ? navRank.get(b.id) : navItems.findIndex((n) => n.id === b.id) + 1000));
  const utilityIds = Array.isArray(settings.navUtilityIds) ? settings.navUtilityIds : defaultUtilityIds;
  const utilityIdSet = new Set(utilityIds);
  const moveNavItem = (fromId, toId, zone) => {
    if (!fromId || (toId && fromId === toId)) return;
    const ids = orderedNavItems.map((n) => n.id);
    const fromIndex = ids.indexOf(fromId);
    const firstUtilityIndex = ids.findIndex((id) => utilityIdSet.has(id));
    const toIndex = toId ? ids.indexOf(toId) : zone === "utility" && firstUtilityIndex >= 0 ? firstUtilityIndex : ids.length;
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    next.splice(adjustedToIndex, 0, moved);
    const nextUtilityIds = new Set(utilityIds);
    const targetZone = zone || (toId && utilityIdSet.has(toId) ? "utility" : "main");
    if (targetZone === "utility") nextUtilityIds.add(fromId);
    if (targetZone === "main") nextUtilityIds.delete(fromId);
    persistSettings({ ...settings, navOrder: next, navUtilityIds: [...nextUtilityIds].filter((id) => next.includes(id)) });
  };
  const mainNavItems = orderedNavItems.filter((n) => !utilityIdSet.has(n.id));
  const utilityNavItems = orderedNavItems.filter((n) => utilityIdSet.has(n.id));
  const navLabels = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    sales: "Sales",
    pricing: "Market Review",
    customers: "Customers",
    expenses: "Expenses",
    reports: "Reports",
    notepad: "Notepad",
    calculator: "Calculator",
    settings: "Settings",
  };
  const mobilePrimaryNavIds = ["dashboard", "inventory", "sales", "customers", "reports"];
  const mobilePrimaryNavItems = orderedNavItems.filter((n) => mobilePrimaryNavIds.includes(n.id));
  const mobileMoreNavItems = orderedNavItems.filter((n) => !mobilePrimaryNavIds.includes(n.id));
  const mobileMoreActive = mobileMoreNavItems.some((n) => n.id === page);
  const activeNavId = page === "subs" ? "expenses" : ["health", "backup"].includes(page) ? "settings" : page;
  const renderNavIcon = (n) => {
    if (n.id === "pricing") {
      return (
        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", justifyContent: "center", fontFamily: "Arial, Helvetica, sans-serif", fontSize: isMobile ? 10 : 10, fontWeight: 900, letterSpacing: 0, lineHeight: 1 }}>
          <span style={{ color: "#e53238" }}>e</span>
          <span style={{ color: "#0064d2" }}>b</span>
          <span style={{ color: "#f5af02" }}>a</span>
          <span style={{ color: "#86b817" }}>y</span>
        </span>
      );
    }
    return (
      <svg width={isMobile ? 17 : 18} height={isMobile ? 17 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
    );
  };
  const renderNavButton = (n, zone) => (
    <button key={n.id} draggable={!isMobile} onDragStart={(e) => { setNavDragId(n.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", n.id); }} onDragOver={(e) => { if (!isMobile) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData("text/plain") || navDragId; moveNavItem(fromId, n.id, zone); setNavDragId(null); }} onDragEnd={() => setNavDragId(null)} onClick={() => { setPage(n.id); setMobileNavMoreOpen(false); }} title={`${navLabels[n.id] || n.id}${isMobile ? "" : " - drag to reorder"}`} style={{ width: isMobile ? 42 : 38, height: isMobile ? 38 : 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: isMobile ? "pointer" : "grab", background: activeNavId===n.id?"#1e293b":"transparent", color: activeNavId===n.id?"#60a5fa":"#4b5563", position: "relative", flexShrink: 0, opacity: navDragId === n.id ? 0.45 : 1 }}>
      {renderNavIcon(n)}
      {n.id === "expenses" && subStats.overdue.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />}
      {n.id === "dashboard" && upcomingPreorders.length > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: "#60a5fa" }} />}
      {n.id === "settings" && (health.issues > 0 || health.warnings > 0 || health.actions > 0) && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: health.issues > 0 ? "#ef4444" : health.warnings > 0 ? "#f59e0b" : "#60a5fa" }} />}
    </button>
  );

  const renderPreBadge = (item) => {
    if (!item.preorderDate) return null;
    const bd = businessDaysUntil(item.preorderDate);
    const b = preorderBadge(bd);
    if (!b) return null;
    return <span style={badge(b.bg, b.fg)}>{b.text}</span>;
  };
  const renderListingBadges = (item) => {
    const platforms = sortedListedPlatformsFor(item);
    if (!platforms.length) return null;
    return platforms.map((p) => {
      const isFacebook = String(p).toLowerCase().includes("facebook");
      return <span key={p} style={badge(isFacebook ? "#123326" : "#1f2937", isFacebook ? "#86efac" : "#93c5fd")}>{platformShortName(p)}</span>;
    });
  };

  const rowClick = (e, toggleFn, id) => { if (e.target.closest("button") || e.target.tagName === "INPUT") return; toggleFn(id); };

  const pagePad = isMobile ? "14px 12px" : "20px 24px";
  const inventoryGridColumns = "48px 2fr 115px 0.7fr 80px 85px 100px 55px 130px";
  const rowBg = (index, selected = false) => selected ? "#1e293b" : (index % 2 === 0 ? "#0d131f" : "#111827");
  const groupAccent = { boxShadow: "inset 3px 0 0 #2563eb66" };
  const childAccent = { boxShadow: "inset 3px 0 0 #1f2937" };
  const groupDateLabel = (items = []) => {
    const dates = [...new Set(items.map((i) => i.purchaseDate).filter(Boolean))].sort();
    if (dates.length <= 1) return dates[0] || "";
    return `${dates[0]} - ${dates[dates.length - 1]}`;
  };
  const sizeLabel = (item) => item.size || "OS";
  const groupSizeLabel = (items = []) => {
    const sizes = [...new Set(items.map(sizeLabel).map((s) => String(s).trim()).filter(Boolean))];
    if (sizes.length === 0) return "OS";
    if (sizes.length === 1) return sizes[0];
    const parsed = sizes.map((size) => {
      const match = size.match(/^(.*?)(\d+(?:\.\d+)?)$/);
      if (!match) return null;
      return { prefix: match[1].trim(), value: Number(match[2]) };
    });
    if (parsed.every(Boolean) && new Set(parsed.map((s) => s.prefix)).size === 1) {
      const values = parsed.map((s) => s.value).sort((a, b) => a - b);
      const format = (value) => Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
      const prefix = parsed[0].prefix;
      const range = values[0] === values[values.length - 1] ? format(values[0]) : `${format(values[0])} - ${format(values[values.length - 1])}`;
      return prefix ? `${prefix} ${range}` : range;
    }
    return sizes.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ");
  };

  // ─── Inventory row (mobile + desktop) ───
  const invRow = (item, isGroupChild, index = 0) => {
    if (isMobile) {
      return (
        <div key={item.id} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ padding: isGroupChild ? "10px 12px 10px 28px" : "10px 12px", borderBottom: "1px solid #1f293722", background: rowBg(index, selectedInv.has(item.id)), cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", ...(isGroupChild ? childAccent : {}) }}>
          <input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={{ ...cb, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.name}{renderPreBadge(item)}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(item.price)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.category} · {item.size||"OS"}{item.brand?` · ${item.brand}`:""} · {item.purchaseDate}
                </div>
                {sortedListedPlatformsFor(item).length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>{renderListingBadges(item)}</div>
                )}
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
      <div key={item.id} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ display: "grid", gridTemplateColumns: inventoryGridColumns, gap: 5, padding: isGroupChild ? "8px 16px 8px 46px" : "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", background: rowBg(index, selectedInv.has(item.id)), cursor: "pointer", ...(isGroupChild ? childAccent : {}) }}>
        <input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={cb} />
        <div style={{ overflow: "hidden" }}><div style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}{renderPreBadge(item)}</div>{item.brand && <div style={{ fontSize: 10, color: "#6b7280" }}>{item.brand}</div>}</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{renderListingBadges(item)}</div>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{item.category}</span>
        <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 500 }}>{item.size||"OS"}</span>
        <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(item.price)}</span>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{item.purchaseDate}</span>
        <span style={{ color: "#6b7280", fontSize: 11 }}>1</span>
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
              <span style={{ color: "#e5e7eb", fontSize: 13 }}>{item.name}{renderPreBadge(item)}</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 13 }}>{currency(item._totalValue)}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 3 }}>{item.category} · {groupSizeLabel(item._items || [])}{item.brand?` · ${item.brand}`:""} · {item._count} units</div>
          </div>
        </div>
      );
    }
    return (
      <div onClick={() => toggleGroup(key)} style={{ display: "grid", gridTemplateColumns: inventoryGridColumns, gap: 5, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293722", cursor: "pointer", background: rowBg(index, false), ...groupAccent }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <input type="checkbox" checked={groupChecked} onChange={(e) => { e.stopPropagation(); toggleGroupSelection(item._items || []); }} onClick={(e) => e.stopPropagation()} style={cb} />
          <span style={{ color: "#6b7280", fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>
        </div>
        <div><span style={{ color: "#e5e7eb" }}>{item.name}{renderPreBadge(item)}</span>{item.brand&&<div style={{ fontSize: 10, color: "#6b7280" }}>{item.brand}</div>}</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{renderListingBadges(item)}</div>
        <span style={{ color: "#9ca3af", fontSize: 12 }}>{item.category}</span>
        <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>{groupSizeLabel(item._items || [])}</span>
        <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{currency(item._totalValue)}</span>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{groupDateLabel(item._items || [])}</span>
        <span style={{ color: "#6b7280", fontSize: 11 }}>{item._count}</span>
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
        <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>{e.tags&&<div style={{ fontSize: 10, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.tags}</div>}</div>
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
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", background: "#0b0f19", color: "#e5e7eb", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`.np-edit ul,.np-edit ol{padding-left:24px;margin:6px 0}.np-edit li{margin:3px 0}.np-edit input[type="checkbox"]{margin-right:6px;cursor:pointer;accent-color:#2563eb;vertical-align:middle}.np-edit label{display:inline-flex;align-items:flex-start;gap:6px;cursor:default}.np-edit label input[type="checkbox"]:checked + *,.np-edit input[type="checkbox"]:checked ~ *{opacity:0.55}`}</style>
      {/* SIDEBAR */}
      <div style={isMobile ? { position: "fixed", left: 0, right: 0, bottom: 0, height: 58, background: "#0b0f19", borderTop: "1px solid #1f2937", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-around", padding: "6px 8px", gap: 1, zIndex: 140, boxSizing: "border-box" } : { width: 54, background: "#0b0f19", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 2, flexShrink: 0 }}>
        {!isMobile && <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 15, fontWeight: 800, color: "#fff" }}>A</div>}
        {(isMobile ? mobilePrimaryNavItems : mainNavItems).map((n) => renderNavButton(n, "main"))}
        {isMobile && (
          <>
            <button
              onClick={() => setMobileNavMoreOpen((v) => !v)}
              title="More"
              style={{ width: 42, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", background: mobileMoreActive || mobileNavMoreOpen ? "#1e293b" : "transparent", color: mobileMoreActive || mobileNavMoreOpen ? "#60a5fa" : "#4b5563", position: "relative", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12h.01 M19 12h.01 M5 12h.01" /></svg>
            </button>
            {mobileNavMoreOpen && (
              <div style={{ position: "fixed", left: 10, right: 10, bottom: 66, zIndex: 160, background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, boxShadow: "0 -12px 28px rgba(0,0,0,0.36)" }}>
                {mobileMoreNavItems.map((n) => (
                  <button key={n.id} onClick={() => { setPage(n.id); setMobileNavMoreOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, padding: "9px 10px", borderRadius: 8, border: "1px solid #1f2937", background: activeNavId === n.id ? "#1e293b" : "#0d1117", color: activeNavId === n.id ? "#93c5fd" : "#d1d5db", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={n.icon} /></svg>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{navLabels[n.id] || n.id}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {!isMobile && <div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); moveNavItem(e.dataTransfer.getData("text/plain") || navDragId, null, "utility"); setNavDragId(null); }} title="Drop here to move below the separator" style={{ width: 24, height: 1, background: navDragId ? "#60a5fa" : "#1f2937", margin: "9px 0 7px", opacity: navDragId ? 1 : 0.9 }} />}
        {!isMobile && utilityNavItems.map((n) => renderNavButton(n, "utility"))}
      </div>

      <div style={{ flex: 1, overflow: "auto", minWidth: 0, paddingBottom: isMobile ? 66 : 0 }}>
        <TopBar saveStatus={saveStatus} isMobile={isMobile} />

        {/* ══ DASHBOARD ══ */}
        {page === "dashboard" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Dashboard</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{inventoryProductCount} products / {inventory.length} units - {currency(stats.invValue)} stock - {velocityStats.sold30.length} sold 30d</p></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button onClick={() => setDashboardCustomizeOpen((v) => !v)} style={{ ...ghostBtn, padding: "7px 12px", fontSize: 12 }}>Cards</button>
              <div style={{ display: "flex", gap: 3, background: "#111827", borderRadius: 8, padding: 3, border: "1px solid #1f2937", flexWrap: "wrap" }}>{TIME_RANGES.map((r) => <button key={r} style={rb(r)} onClick={() => setRange(r)}>{r}</button>)}</div>
            </div>
          </div>
          {dashboardCustomizeOpen && (
            <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Dashboard cards</div>
                <button onClick={() => persistSettings({ ...settings, dashboardCards: {} })} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11 }}>Reset</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, minmax(130px, 1fr))", gap: 8 }}>
                {dashboardCardLabels.map(([key, label]) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9ca3af", cursor: "pointer", minWidth: 0 }}>
                    <input type="checkbox" checked={dashboardCards[key]} onChange={(e) => setDashboardCard(key, e.target.checked)} style={cb} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {range === "Custom" && <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 12, color: "#6b7280" }}>From</span><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...inp, maxWidth: 160 }} /><span style={{ fontSize: 12, color: "#6b7280" }}>To</span><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...inp, maxWidth: 160 }} /></div>}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <select value={dashCat} onChange={(e) => setDashCat(e.target.value)} style={{ ...sel, maxWidth: 150 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={dashPlat} onChange={(e) => setDashPlat(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          {dashboardCards.actionStrip && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
              {[
                { label: "eBay queue", value: ebayImports.length, detail: "awaiting postage", tone: ebayImports.length ? "#60a5fa" : "#6b7280", onClick: async () => { setPage("sales"); setEbayQueueOpen(true); if (!ebayImports.length) await loadEbayImports(); } },
                { label: "Gmail queue", value: gmailImports.length, detail: "inventory drafts", tone: gmailImports.length ? "#60a5fa" : "#6b7280", onClick: async () => { setPage("inventory"); setGmailQueueOpen(true); if (!gmailImports.length) await loadGmailImports(); } },
                { label: "Preorders", value: upcomingPreorderGroups.length, detail: upcomingPreorders.length === upcomingPreorderGroups.length ? "release window" : `${upcomingPreorders.length} units due`, tone: upcomingPreorders.length ? "#60a5fa" : "#6b7280", onClick: () => { setPage("inventory"); setInvStatus("Preorders"); setInvSort("preorder_asc"); } },
                { label: "Aged stock", value: agingStats.aged90.length, detail: "90+ days held", tone: agingStats.aged90.length ? "#f59e0b" : "#6b7280", onClick: () => setPage("inventory") },
              ].map((a) => (
                <button key={a.label} onClick={a.onClick} style={{ textAlign: "left", background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{a.label}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: a.tone }}>{a.value}</span>
                    <span style={{ fontSize: 11, color: "#4b5563" }}>{a.detail}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {dashboardCards.preorderAlerts && upcomingPreorderGroups.length > 0 && (
            <div style={{ background: "linear-gradient(180deg, #0f1a2e 0%, #111827 100%)", border: "1px solid #2563eb55", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
                  <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 600 }}>Preorders releasing soon</span>
                  <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 600 }}>{upcomingPreorderGroups.length}</span>
                </div>
                <button onClick={() => setPage("inventory")} style={{ padding: "3px 10px", background: "transparent", color: "#60a5fa", border: "none", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>View all</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {upcomingPreorderGroups.slice(0, isMobile ? 4 : 6).map((i) => {
                  const b = preorderBadge(i._bdays);
                  return (
                    <div key={`${i.id}-${i.preorderDate}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#0d1117", borderRadius: 6, border: "1px solid #1f293766" }}>
                      <span style={{ fontSize: 13, color: "#e5e7eb", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                      {i._count > 1 && <span style={{ fontSize: 10, color: "#93c5fd", background: "#1e3a5f", borderRadius: 999, padding: "2px 7px", fontWeight: 700, flexShrink: 0 }}>{i._count} units</span>}
                      {!isMobile && <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{i.preorderDate}</span>}
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: b.bg, color: b.fg, fontWeight: 600, flexShrink: 0 }}>{b.text}</span>
                    </div>
                  );
                })}
                {upcomingPreorderGroups.length > (isMobile ? 4 : 6) && (
                  <div style={{ fontSize: 11, color: "#4b5563", textAlign: "center", paddingTop: 4 }}>+ {upcomingPreorderGroups.length - (isMobile ? 4 : 6)} more groups</div>
                )}
              </div>
            </div>
          )}
          {subStats.overdue.length > 0 && (
            <div style={{ background: "#111827", border: "1px solid #ef444455", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>{subStats.overdue.length} subscription{subStats.overdue.length === 1 ? "" : "s"} overdue · {currency(subStats.overdue.reduce((a, s) => a + subAmountAud(s, fxRates), 0))}</span>
              <button onClick={logAllOverdue} style={{ padding: "4px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Log all due</button>
            </div>
          )}
          {dashboardCards.netProfitGraph && <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: "16px 20px 12px", marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 3 }}>Net Profit</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: stats.netProfit>=0?"#34d399":"#f87171" }}>{currency(stats.netProfit)}</div>
                  <div title={`Current period ${periodComparison.currentStart} to ${periodComparison.currentEnd}: ${currency(periodComparison.current)} - Previous period ${periodComparison.previousStart} to ${periodComparison.previousEnd}: ${currency(periodComparison.previous)}`} style={{ fontSize: 12, color: periodComparison.delta >= 0 ? "#34d399" : "#f87171", background: periodComparison.delta >= 0 ? "#0d1f17" : "#1f1215", border: `1px solid ${periodComparison.delta >= 0 ? "#16653466" : "#7f1d1d66"}`, borderRadius: 999, padding: "3px 8px", fontWeight: 700 }}>
                    {periodComparison.pct === null ? "new vs previous period" : `${periodComparison.delta >= 0 ? "+" : ""}${periodComparison.pct.toFixed(1)}% vs previous period`}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#6b7280" }}>Sales volume</div><div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: "#f1f5f9" }}>{periodComparison.salesCount}</div><div title={`Previous period ${periodComparison.previousStart} to ${periodComparison.previousEnd}: ${periodComparison.previousSalesCount} sales`} style={{ fontSize: 11, color: periodComparison.salesDelta >= 0 ? "#34d399" : "#f87171", marginTop: 2 }}>{periodComparison.salesPct === null ? "new vs previous" : `${periodComparison.salesDelta >= 0 ? "+" : ""}${periodComparison.salesPct.toFixed(1)}% vs previous`}</div></div>
            </div>
            <PeriodComparisonChart points={periodTrend} isMobile={isMobile} />
          </div>}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
            {dashboardCards.salesIncome && <KPI label="Sales income" value={currency(stats.salesIncome)} />}
            {dashboardCards.netProfit && <KPI label="Net profit" value={currency(stats.netProfit)} accent={stats.netProfit>=0?"#34d399":"#f87171"} />}
            {dashboardCards.grossProfit && <KPI label="Gross profit" value={currency(stats.grossProfit)} accent={stats.grossProfit>=0?"#34d399":"#f87171"} />}
            {dashboardCards.inventoryValue && <KPI label="Inventory value" value={currency(stats.invValue)} />}
            {dashboardCards.salesCount && <KPI label="Sales count" value={stats.cnt} />}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
            {dashboardCards.avgOrderValue && <KPI label="Avg. order value" value={currency(stats.aov)} />}
            {dashboardCards.netMargin && <KPI label="Net margin" value={(stats.netMargin * 100).toFixed(1) + "%"} accent={stats.netMargin>=0?"#34d399":"#f87171"} />}
            {dashboardCards.grossMargin && <KPI label="Gross margin" value={(stats.grossMargin * 100).toFixed(1) + "%"} accent={stats.grossMargin>=0?"#34d399":"#f87171"} />}
            {dashboardCards.totalExpenses && <KPI label="Total expenses" value={currency(stats.totalExpenses)} accent="#f59e0b" />}
            {dashboardCards.platformFees && <KPI label="Platform fees" value={currency(stats.totalFees)} accent="#f59e0b" />}
            {dashboardCards.monthlySubs && <KPI label="Monthly subs" value={currency(subStats.monthlyBurn)} accent="#f59e0b" />}
          </div>
          {(dashboardCards.aging || dashboardCards.velocity) && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
              {dashboardCards.aging && (
                <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>Inventory Aging</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                    <KPI label="Avg. held" value={`${agingStats.avgDays}d`} />
                    <KPI label="90+ days" value={agingStats.aged90.length} accent={agingStats.aged90.length ? "#f59e0b" : undefined} />
                    <KPI label="Aged value" value={currency(agingStats.agedValue)} accent={agingStats.agedValue ? "#f59e0b" : undefined} />
                  </div>
                  {agingStats.oldest.length === 0 ? <div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No inventory yet</div> : agingStats.oldest.slice(0, 4).map((i) => (
                    <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid #1f293722" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</div>
                        <div style={{ fontSize: 11, color: "#4b5563" }}>{i.category} - bought {i.purchaseDate || "unknown"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 700 }}>{i._daysHeld}d</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{currency(i.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {dashboardCards.velocity && (
                <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>Inventory Velocity</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                    <KPI label="Sold 30d" value={velocityStats.sold30.length} />
                    <KPI label="Sell-through" value={`${(velocityStats.monthlySellThrough * 100).toFixed(1)}%`} accent="#60a5fa" />
                    <KPI label="Stock cover" value={velocityStats.daysCover === null ? "n/a" : `${velocityStats.daysCover}d`} />
                  </div>
                  {velocityStats.topCategories.length === 0 ? <div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No recent sales data</div> : velocityStats.topCategories.map((r) => (
                    <div key={r.category} style={{ display: "grid", gridTemplateColumns: "1fr 60px 90px", gap: 8, padding: "7px 0", borderBottom: "1px solid #1f293722", fontSize: 12, alignItems: "center" }}>
                      <span style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.category}</span>
                      <span style={{ color: "#9ca3af" }}>{r.count} sold</span>
                      <span style={{ color: r.profit >= 0 ? "#34d399" : "#f87171", textAlign: "right", fontWeight: 700 }}>{currency(r.profit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
            {dashboardCards.recentSales && <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Sales</div>
              {stats.rs.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No sales</div>:stats.rs.map((s) => (<div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{s.platform} · {s.size||"OS"} · {s.saleDate}{s.customer?` · ${s.customer}`:""}</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(s.salePrice)}</div><div style={{ fontSize: 11, color: s.profit>=0?"#34d399":"#f87171" }}>{currency(s.profit)}</div></div></div>))}
            </div>}
            {dashboardCards.recentInventory && <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Inventory</div>
              {stats.ri.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No items</div>:stats.ri.map((i) => (<div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1f293722", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}{i.inTransit&&<span style={badge("#1e3a5f","#60a5fa")}>TRANSIT</span>}{renderPreBadge(i)}</div><div style={{ fontSize: 11, color: "#4b5563" }}>{i.category} · {i.size||"OS"}{i.brand?` · ${i.brand}`:""}</div></div><div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{currency(i.price)}</div></div>))}
            </div>}
          </div>
        </div>)}

        {/* INVENTORY */}
        {page === "inventory" && <InventoryPage ctx={{ pagePad, inventory, selectedInv, setBulkSellOpen, setBulkEditOpen, setConfirmDel, syncGmailInventory, gmailBusy, setGmailQueueOpen, gmailImports, loadGmailImports, setInvForm, emptyInv, CATS, listingPlatforms, setAddDirty, setAddInvOpen, gmailQueueOpen, gmailQueuePanel, invSearch, setInvSearch, invCat, setInvCat, invStatus, setInvStatus, invSort, setInvSort, invCollapse, setInvCollapse, filteredInv, selectedValue, preorderInvCount, listedInvCount, facebookListedInvCount, isMobile, toggleAll, mobileSelectAll, groupedInv, invRow, expandedGroups, groupRow }} />}

        {/* SALES */}
        {page === "sales" && <SalesPage ctx={{ pagePad, sales, stats, selectedSales, setAddSaleOpen, setBulkEditSaleOpen, setConfirmDel, syncEbayOrders, ebayBusy, setEbayQueueOpen, ebayImports, loadEbayImports, ebayQueueOpen, ebayQueuePanel, saleSearch, setSaleSearch, saleCat, setSaleCat, CATS, salePlat, setSalePlat, PLATS, saleSort, setSaleSort, filteredSales, selectedSalesRevenue, selectedSalesProfit, isMobile, toggleAllSales, mobileSelectAll, saleRow }} />}

        {/* PRICING */}
        {page === "pricing" && <PricingPage ctx={{ pagePad, inventory, isMobile, connectEbay }} />}

        {/* CUSTOMERS */}
        {page === "customers" && <CustomersPage ctx={{ pagePad, isMobile, customerRows, customerSearch, setCustomerSearch, customerPlatform, setCustomerPlatform, customerSort, setCustomerSort, activeCustomerKey, setActiveCustomerKey, updateCustomerProfile, addCustomer, removeCustomer, setAddSaleOpen }} />}

        {/* REPORTS */}
        {page === "reports" && <ReportsPage ctx={{ pagePad, isMobile, range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, dashCat, setDashCat, dashPlat, setDashPlat, CATS, PLATS, reportStats, velocityStats, agingStats, exportReportCSV }} />}

        {/* ══ EXPENSES ══ */}
        {page === "expenses" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Expenses</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>This month: {expenseMonthSummary.count} expenses - {currency(expenseMonthSummary.amount)}{subStats.overdue.length ? ` - ${subStats.overdue.length} overdue subscription${subStats.overdue.length === 1 ? "" : "s"}` : ""}</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedExp.size > 0 && <><button onClick={() => setBulkEditExpOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedExp.size}</button><button onClick={deleteSelectedExp} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedExp.size}</button></>}
              <button onClick={() => { setExpForm(emptyExp); setAddExpOpen(true); }} style={primaryBtn}>+ Add expense</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("expenses")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>Expenses</button>
            <button onClick={() => setPage("subs")} style={ghostBtn}>Subscriptions{subStats.overdue.length > 0 ? ` (${subStats.overdue.length})` : ""}</button>
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
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("expenses")} style={ghostBtn}>Expenses</button>
            <button onClick={() => setPage("subs")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>Subscriptions{subStats.overdue.length > 0 ? ` (${subStats.overdue.length})` : ""}</button>
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
          {subStats.byCategory.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
              {subStats.byCategory.map(({ category, count, monthly }) => {
                const [bg, fg] = subCategoryColor(category);
                return (
                  <button key={category} onClick={() => setSubCatFilter(category)} style={{ background: subCatFilter === category ? bg : "#111827", border: `1px solid ${subCatFilter === category ? fg : "#1f2937"}`, borderRadius: 8, padding: "9px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ color: fg, fontSize: 12, fontWeight: 800 }}>{category}</span>
                      <span style={{ color: "#6b7280", fontSize: 10 }}>{count}</span>
                    </div>
                    <div style={{ marginTop: 4, color: "#f1f5f9", fontSize: 14, fontWeight: 800 }}>{currency(monthly)}<span style={{ color: "#6b7280", fontSize: 10, fontWeight: 600 }}> /mo</span></div>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search subscriptions..." value={subSearch} onChange={(e) => setSubSearch(e.target.value)} style={{ ...inp, maxWidth: 210 }} />
            <select value={subCatFilter} onChange={(e) => setSubCatFilter(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All categories</option>{SUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={subSort} onChange={(e) => setSubSort(e.target.value)} style={{ ...sel, maxWidth: 150 }}><option value="nextDue_asc">Next due ↑</option><option value="nextDue_desc">Next due ↓</option><option value="monthly_desc">Monthly ↓</option><option value="monthly_asc">Monthly ↑</option><option value="category_asc">Category A-Z</option><option value="name_asc">Name A-Z</option></select>
            {(subSearch || subCatFilter !== "All" || subSort !== "nextDue_asc") && <button onClick={() => { setSubSearch(""); setSubCatFilter("All"); setSubSort("nextDue_asc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{sortedSubs.length} shown · {currency(sortedSubs.reduce((a, s) => a + subMonthlyAud(s, fxRates), 0))}/mo</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 150px 125px 100px 100px 180px", gap: 8, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600 }}>
                {subHeaderBtn("name", "Name")}{subHeaderBtn("category", "Category")}{subHeaderBtn("amount", "Amount")}{subHeaderBtn("frequency", "Frequency")}{subHeaderBtn("monthly", "Monthly")}{subHeaderBtn("nextDue", "Next due")}<span>Actions</span>
              </div>
            )}
            {sortedSubs.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No subscriptions yet. Add eBay Pro, software subs, etc.</div>}
            {sortedSubs.map((s) => {
              const t = today();
              const isOverdue = s.active && s.nextDue && s.nextDue <= t;
              const me = subMonthlyAud(s, fxRates);
              const amountAud = subAmountAud(s, fxRates);
              const code = String(s.currency || "AUD").toUpperCase();
              const amountLabel = code === "AUD" ? currency(s.amount) : `${formatMoney(s.amount, code)} (${currency(amountAud)})`;
              const freqText = frequencyLabel(s.frequency, s.customDays);
              const category = subCategory(s);
              if (isMobile) {
                return (
                  <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid #1f293711", opacity: s.active ? 1 : 0.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 500 }}>{s.name}{!s.active && <span style={badge("#1f2937","#6b7280")}>PAUSED</span>}{isOverdue && <span style={badge("#3b1f1f","#f87171")}>OVERDUE</span>}</div>
                      <div style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 600 }}>{amountLabel}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>{subCatChip(category)}<span style={{ fontSize: 11, color: "#6b7280" }}>{freqText} · {currency(me)}/mo · due {s.nextDue}</span></div>
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
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 120px 150px 125px 100px 100px 180px", gap: 8, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #1f293711", opacity: s.active ? 1 : 0.5 }}>
                  <div><span style={{ color: "#e5e7eb" }}>{s.name}</span>{!s.active && <span style={badge("#1f2937","#6b7280")}>PAUSED</span>}{isOverdue && <span style={badge("#3b1f1f","#f87171")}>OVERDUE</span>}{s.tags && <div style={{ fontSize: 10, color: "#6b7280" }}>{s.tags}</div>}</div>
                  <span>{subCatChip(category)}</span>
                  <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{amountLabel}</span>
                  <span style={{ color: "#9ca3af", fontSize: 12 }}>{freqText}</span>
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
            <div style={{ width: isMobile ? "100%" : 240, maxHeight: isMobile ? 150 : "none", background: "#111827", borderRadius: 12, border: "1px solid #1f2937", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
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

        {/* ?? HEALTH ?? */}
        {page === "health" && (<div style={{ padding: pagePad, maxWidth: 1120 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Settings</h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("settings")} style={ghostBtn}>General</button>
            <button onClick={() => setPage("health")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>System Health</button>
            <button onClick={() => setPage("backup")} style={ghostBtn}>Backup & Restore</button>
          </div>
          <HealthPage ctx={{ pagePad: 0, isMobile, health, loadEbayImports, loadGmailImports, supabase, ebayBusy, gmailBusy, ebayImports, gmailImports, setPage, setEbayQueueOpen, setGmailQueueOpen, syncEbayOrders, syncGmailInventory, inventory, sales }} />
        </div>)}

        {/* ══ BACKUP ══ */}
        {page === "backup" && (<div style={{ padding: pagePad, maxWidth: 1120 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Settings</h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("settings")} style={ghostBtn}>General</button>
            <button onClick={() => setPage("health")} style={ghostBtn}>System Health</button>
            <button onClick={() => setPage("backup")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>Backup & Restore</button>
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Backup & Restore</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#4b5563" }}>Export or import your data.</p>
          {backupStatus&&<div style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#93c5fd" }}>{backupStatus}</div>}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 14, alignItems: "start" }}>
          <div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>Weekly Supabase backup</div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Saves a full snapshot when ArchiveDash opens after 7 days.</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>
                <input type="checkbox" checked={backupSettings.autoWeekly} onChange={(e) => updateBackupSettings({ autoWeekly: e.target.checked })} style={cb} />
                Enabled
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Destination<br /><span style={{ color: "#e5e7eb", fontWeight: 600 }}>Supabase</span></div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Last backup<br /><span style={{ color: "#e5e7eb", fontWeight: 600 }}>{backupSettings.lastRunAt ? new Date(backupSettings.lastRunAt).toLocaleString() : "Never"}</span></div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Keep snapshots
                <input type="number" min="1" max="52" value={backupSettings.retention} onChange={(e) => updateBackupSettings({ retention: Math.max(1, Math.min(52, Number(e.target.value) || DEFAULT_BACKUP_SETTINGS.retention)) })} style={{ ...inp, marginTop: 5, maxWidth: 90 }} />
              </label>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Saved snapshots<br /><span style={{ color: "#e5e7eb", fontWeight: 600 }}>{backups.length}</span></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => createSupabaseBackup("manual")} disabled={!supabase} style={primaryBtn}>Run backup now</button>
              {!supabase && <span style={{ fontSize: 12, color: "#f59e0b", alignSelf: "center" }}>Supabase is not configured.</span>}
            </div>
          </div>
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
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Snapshot history</div>
              <span style={{ fontSize: 11, color: "#4b5563" }}>{backups.length} saved</span>
            </div>
            {backups.length === 0 ? (
              <div style={{ color: "#374151", fontSize: 13, textAlign: "center", padding: "26px 10px", background: "#0d1117", borderRadius: 10 }}>No Supabase snapshots yet.</div>
            ) : backups.slice(0, 8).map((snapshot) => (
              <div key={snapshot.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid #1f293722" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 700 }}>{new Date(snapshot.createdAt).toLocaleString()}</div>
                  <div style={{ color: "#6b7280", fontSize: 11 }}>{snapshot.counts?.inventory || 0} items - {snapshot.counts?.sales || 0} sales - {snapshot.counts?.notes || 0} notes</div>
                </div>
                <button onClick={() => restoreSupabaseBackup(snapshot)} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Restore</button>
              </div>
            ))}
          </div>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #ef444433", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Danger Zone</div>
            <button onClick={async () => { if (confirm("Delete ALL data?")) { await persistInv([]); await persistSales([]); await persistExp([]); } }} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Clear all data</button>
          </div>
        </div>)}

        {/* ══ SETTINGS ══ */}
        {page === "settings" && (<div style={{ padding: pagePad, maxWidth: 1120 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Settings</h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("settings")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>General</button>
            <button onClick={() => setPage("health")} style={ghostBtn}>System Health</button>
            <button onClick={() => setPage("backup")} style={ghostBtn}>Backup & Restore</button>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>eBay Connection</div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Connect or refresh eBay here. Orders power Sales; active listings power Market Review.</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={connectEbay} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Connect / refresh eBay</button>
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
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>{CUSTS.length} saved customers. Full profiles live on the Customers page.</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: settingsCustomersOpen ? 12 : 0 }}>
              <button onClick={() => setPage("customers")} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Manage customers</button>
              <button onClick={() => setSettingsCustomersOpen((v) => !v)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>{settingsCustomersOpen ? "Hide quick add" : "Quick add"}</button>
            </div>
            {settingsCustomersOpen && (<>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CUSTS.map((c) => (<div key={c} style={{ display: "flex", alignItems: "center", gap: 4, background: "#1f2937", borderRadius: 6, padding: "5px 10px", fontSize: 13, color: "#e5e7eb" }}>{c}<button onClick={async () => { await persistSettings({ ...settings, customers: CUSTS.filter((x) => x !== c) }); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, padding: 0, marginLeft: 4 }}>×</button></div>))}
              {CUSTS.length===0&&<span style={{ fontSize: 12, color: "#4b5563" }}>No customers yet</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}><input value={newCust} onChange={(e) => setNewCust(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder="Customer name" /><button onClick={async () => { if (newCust && !CUSTS.includes(newCust)) { await persistSettings({ ...settings, customers: [...CUSTS, newCust] }); setNewCust(""); } }} style={primaryBtn}>Add</button></div>
            </>)}
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
      {!isMobile && page !== "notepad" && !notepadOpen && (
        <button
          onClick={() => setNotepadOpen(true)}
          title="Quick notes"
          style={{ position: "fixed", bottom: isMobile ? 74 : 18, right: 18, width: 46, height: 46, borderRadius: "50%", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 6px 16px rgba(37,99,235,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, transition: "transform 150ms" }}
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
        <Row cols={3}><Field label="Category" req><select value={invForm.category} onChange={(e) => updateInvForm({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Size"><select value={invForm.size} onChange={(e) => updateInvForm({ size: e.target.value })} style={sel}>{getSizes(invForm.category).map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Cost (AU$)" req><input type="number" step="0.01" value={invForm.price} onChange={(e) => updateInvForm({ price: e.target.value })} style={inp} placeholder="0.00" /></Field></Row>
        <Row><Field label="Brand"><input value={invForm.brand} onChange={(e) => updateInvForm({ brand: e.target.value })} style={inp} placeholder="e.g. Nike" /></Field><Field label="Purchase date"><input type="date" value={invForm.purchaseDate} onChange={(e) => updateInvForm({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
        <Row><Field label="Quantity"><input type="number" min="1" value={invForm.quantity} onChange={(e) => updateInvForm({ quantity: e.target.value })} style={inp} /></Field><Field label="Preorder date"><input type="date" value={invForm.preorderDate} onChange={(e) => updateInvForm({ preorderDate: e.target.value })} style={inp} /></Field></Row>
        <Field label="Listed on"><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{listingPlatforms.map((p) => <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}><input type="checkbox" checked={listedPlatformsFor(invForm).includes(p)} onChange={(e) => { const next = new Set(listedPlatformsFor(invForm)); e.target.checked ? next.add(p) : next.delete(p); updateInvForm({ listedPlatforms: [...next] }); }} style={cb} /> {platformShortName(p)}</label>)}</div></Field>
        {listedPlatformsFor(invForm).some((p) => String(p).toLowerCase().includes("ebay")) && <Field label="eBay listed price (AU$)"><input type="number" step="0.01" value={invForm.ebayListedPrice || ""} onChange={(e) => updateInvForm({ ebayListedPrice: e.target.value })} style={inp} placeholder="Current eBay listing price" /></Field>}
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
      {editInvOpen && <EditInvModal item={editInvOpen} onSave={async (ef) => { await persistInv(inventory.map((i) => i.id===editInvOpen.id?{...i,...ef}:i)); setEditInvOpen(null); }} onClose={() => setEditInvOpen(null)} categories={CATS} customers={CUSTS} platforms={listingPlatforms} />}
      {editSaleOpen && <EditSaleModal sale={editSaleOpen} onSave={async (u) => { await persistSales(sales.map((s) => s.id===editSaleOpen.id?u:s)); if (u.customer) addCustomer(u.customer); setEditSaleOpen(null); }} onClose={() => setEditSaleOpen(null)} platforms={PLATS} customers={CUSTS} />}
      {editExpOpen && <EditExpModal expense={editExpOpen} onSave={async (u) => { await persistExp(expenses.map((e) => e.id===editExpOpen.id?u:e)); setEditExpOpen(null); }} onClose={() => setEditExpOpen(null)} />}
      {bulkEditOpen && <BulkEditModal items={inventory.filter((i) => selectedInv.has(i.id))} onSave={handleBulkEdit} onClose={() => setBulkEditOpen(false)} categories={CATS} platforms={listingPlatforms} />}
      {subModalOpen && <SubModal sub={subModalOpen === "new" ? null : subModalOpen} onSave={saveSub} onClose={() => setSubModalOpen(null)} />}
      {tplManagerOpen && userTemplates && <TemplateManagerModal templates={userTemplates} onSave={async (next) => { await persistTemplates(next); setTplManagerOpen(false); }} onClose={() => setTplManagerOpen(false)} />}
      {bulkSellOpen && <BulkSellModal items={inventory.filter((i) => selectedInv.has(i.id))} onSell={handleBulkSell} onClose={() => setBulkSellOpen(false)} platforms={PLATS} customers={CUSTS} />}
      {bulkEditExpOpen && <BulkEditExpModal items={expenses.filter((e) => selectedExp.has(e.id))} onSave={handleBulkEditExp} onClose={() => setBulkEditExpOpen(false)} />}
      {bulkEditSaleOpen && <BulkEditSaleModal items={sales.filter((s) => selectedSales.has(s.id))} onSave={handleBulkEditSale} onClose={() => setBulkEditSaleOpen(false)} platforms={PLATS} />}
      <ConfirmDialog open={!!confirmDel} msg={confirmDel?.type==="multi"||confirmDel?.type==="multi-exp"||confirmDel?.type==="multi-sale"?`Delete ${confirmDel.name}?`:`Delete "${confirmDel?.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  );
}
