import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { load, save, supabase, isSupabaseConfigured } from "./supabase.js";
import Calculator from "./Calculator";
import CustomersPage from "./dashboard/pages/CustomersPage.jsx";
import HealthPage from "./dashboard/pages/HealthPage.jsx";
import BackupPage from "./dashboard/pages/BackupPage.jsx";
import NotepadPage from "./dashboard/pages/NotepadPage.jsx";
import InventoryPage from "./dashboard/pages/InventoryPage.jsx";
import PricingPage from "./dashboard/pages/PricingPage.jsx";
import ReportsPage from "./dashboard/pages/ReportsPage.jsx";
import SalesPage from "./dashboard/pages/SalesPage.jsx";
import SettingsPage from "./dashboard/pages/SettingsPage.jsx";
import SubscriptionsPage from "./dashboard/pages/SubscriptionsPage.jsx";
import { shortDateLabel } from "./dashboard/components/PeriodComparisonChart.jsx";
import PlatformBadge from "./dashboard/components/PlatformBadge.jsx";
import DashboardHomePage from "./dashboard/pages/DashboardHomePage.jsx";
import { matchedBuyerRequestsForItem, mergeCustomerInterests, normalizeBuyerRequests } from "./dashboard/customerMarketing.js";
import { compareInventorySize, compareSizeValues, customerKey, listedPlatformsFor, orderKeyForSale, platformShortName, sortedListedPlatformsFor } from "./dashboard/inventory.js";
import { DEFAULT_BACKUP_SETTINGS, DEFAULT_NAV_UTILITY_IDS, defaultSettings, normalizeSettings, saveLabelFor } from "./dashboard/settings.js";
import { subCategory } from "./dashboard/subscriptions.js";

import { DEF_CATEGORIES, DEF_PLATFORMS, DEF_SIZE_MAP, getDefaultSize, getSizes, EXP_CATEGORIES, SUB_CATEGORIES, VERSION, PREORDER_THRESHOLD, FREQ_OPTIONS, FREQ_LABEL, FONT_SIZES, TEMPLATES, renderTemplate, sanitizeHtml, stripHtml, businessDaysUntil, advanceDate, monthlyEquiv, frequencyLabel, formatMoney, subAmountAud, subMonthlyAud, preorderBadge, genId, currency, computeProfit, estimateEbayFee, sydneyDate, today, daysAgo, getFilterDate, useIsMobile, inp, sel, primaryBtn, ghostBtn, cb, badge, ConfirmDialog, DangerConfirmDialog, UnsavedDialog, Modal, Field, Row, ModalActions, ResponsiveGrid, KPI, TopBar, EmptyState } from "./dashboard/shared.jsx";

import { EditInvModal, EditSaleModal, SellModal, BulkEditModal, EditExpModal, BulkEditExpModal, BulkEditSaleModal, BulkSellModal, ManualSaleModal, EbaySaleReviewModal, GmailInventoryReviewModal, NotepadEditor, SubModal, TemplateManagerModal } from "./dashboard/modals.jsx";

// ═══ SAMPLE / DEMO DATA ═══
// First-run "Explore with sample data" seeds these records. Every demo record is
// tagged with `demo: true` so it can be removed as a set, and carries a "sample"
// tag so it stays visible and exports/imports like normal data. Loading or
// clearing sample data reuses the existing persistence keys; nothing is renamed.
const SAMPLE_TAG = "sample";
const FIRST_RUN_DISMISS_KEY = "archivedash-firstrun-dismissed-v1";
const isDemoRecord = (record) => Boolean(record && record.demo);

const buildSampleSale = ({ name, category, size = "OS", brand = "", costPrice, salePrice, shippingPrice = 0, platform, saleDate, customer = "" }) => {
  const fees = platform === "eBay AU" ? estimateEbayFee(salePrice) : Math.round(salePrice * 0.1 * 100) / 100;
  const paymentMethod = String(platform || "").toLowerCase().includes("ebay") ? "eBay Payout" : "Cash";
  return {
    id: genId(), name, category, size, brand,
    costPrice, salePrice, shippingPrice, platformFees: fees,
    profit: computeProfit({ salePrice, cost: costPrice, shipping: shippingPrice, fees }),
    platform, paymentMethod, saleDate, tags: SAMPLE_TAG, purchaseDate: "", preorderDate: "", customer, demo: true,
  };
};

const paymentMethodForPlatform = (platform = "", methods = []) => {
  const value = String(platform).toLowerCase();
  if (value.includes("ebay")) return "eBay Payout";
  if (value.includes("pushas")) return "Pushas Payout";
  return methods.includes("Cash") ? "Cash" : (methods[0] || "Other");
};

const recordPaymentMethod = (record) => record?.paymentMethod || "Other";
const saleProfit = (sale = {}) => computeProfit({
  salePrice: sale.salePrice,
  cost: sale.costPrice,
  shipping: sale.shippingPrice,
  fees: sale.platformFees,
});
const withComputedSaleProfit = (sale) => ({ ...sale, profit: saleProfit(sale) });

const buildSampleInventory = (over) => ({
  id: genId(), size: "OS", brand: "", preorderDate: "", listedPlatforms: [], customer: "",
  tags: SAMPLE_TAG, addedAt: Date.now(), demo: true, ...over,
});

const buildSampleData = () => ({
  inventory: [
    buildSampleInventory({ name: "Nike Dunk Low Panda", category: "Sneakers", size: "US 9", price: 130, ebayListedPrice: 210, brand: "Nike", listedPlatforms: ["eBay AU"], purchaseDate: daysAgo(38) }),
    buildSampleInventory({ name: "Jordan 4 Black Cat", category: "Sneakers", size: "US 10", price: 320, ebayListedPrice: 470, brand: "Jordan", listedPlatforms: ["eBay AU"], purchaseDate: daysAgo(96) }),
    buildSampleInventory({ name: "Supreme Box Logo Hoodie", category: "Apparel", size: "L", price: 240, brand: "Supreme", listedPlatforms: ["Facebook Marketplace"], purchaseDate: daysAgo(21) }),
    buildSampleInventory({ name: "Pokemon 151 Booster Box", category: "TCG", size: "OS", price: 180, brand: "Pokemon", purchaseDate: daysAgo(9), preorderDate: daysAgo(-7) }),
    buildSampleInventory({ name: "Louis Vuitton Card Holder", category: "Accessories", size: "OS", price: 350, brand: "Louis Vuitton", listedPlatforms: ["eBay AU"], purchaseDate: daysAgo(63) }),
  ],
  sales: [
    buildSampleSale({ name: "Nike Dunk Low UNC", category: "Sneakers", size: "US 9", brand: "Nike", costPrice: 120, salePrice: 210, shippingPrice: 12, platform: "eBay AU", saleDate: daysAgo(4), customer: "Jordan M" }),
    buildSampleSale({ name: "Yeezy Slide Onyx", category: "Sneakers", size: "US 10", brand: "adidas", costPrice: 70, salePrice: 130, shippingPrice: 10, platform: "StockX", saleDate: daysAgo(11) }),
    buildSampleSale({ name: "CS2 Knife Skin", category: "Collectables", size: "OS", costPrice: 40, salePrice: 95, shippingPrice: 0, platform: "CSFloat", saleDate: daysAgo(17), customer: "Alex T" }),
    buildSampleSale({ name: "Vintage Nike Tee", category: "Apparel", size: "M", brand: "Nike", costPrice: 25, salePrice: 60, shippingPrice: 9, platform: "Depop", saleDate: daysAgo(24) }),
  ],
  expenses: [
    { id: genId(), name: "Shipping supplies", amount: 45, purchaseDate: daysAgo(14), tags: SAMPLE_TAG, expCategory: "Shipping & Fulfillment", paymentMethod: "Card", demo: true },
    { id: genId(), name: "Cook group membership", amount: 30, purchaseDate: daysAgo(7), tags: SAMPLE_TAG, expCategory: "Cook Groups & Retail Memberships", paymentMethod: "Card", demo: true },
  ],
});

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
  const [reportPaymentMode, setReportPaymentMode] = useState("all");
  const [reportPaymentMethods, setReportPaymentMethods] = useState([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [failedSaves, setFailedSaves] = useState(() => new Map());
  const [retryingSaves, setRetryingSaves] = useState(false);

  // Modals
  const [addInvOpen, setAddInvOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(null);
  const [addExpOpen, setAddExpOpen] = useState(false);
  const [editInvOpen, setEditInvOpen] = useState(null);
  const [editSaleOpen, setEditSaleOpen] = useState(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkSellOpen, setBulkSellOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [dangerAction, setDangerAction] = useState(null); // { title, intro, counts, keyword, confirmLabel, snapshot, snapshotReason, run }
  const [dangerBusy, setDangerBusy] = useState(false);
  const [selectedInv, setSelectedInv] = useState(new Set());
  const [ebayExportStatus, setEbayExportStatus] = useState("");
  const [showUnsavedAdd, setShowUnsavedAdd] = useState(false);
  const [addDirty, setAddDirty] = useState(false);
  const [invQueue, setInvQueue] = useState([]);
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
  const [rowMenuOpen, setRowMenuOpen] = useState(null);
  const [bulkEditSaleOpen, setBulkEditSaleOpen] = useState(false);
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [ebayImports, setEbayImports] = useState([]);
  const [ebayBusy, setEbayBusy] = useState(false);
  const [ebayStatus, setEbayStatus] = useState("");
  const [ebayQueueOpen, setEbayQueueOpen] = useState(false);
  const [ebayReviewOpen, setEbayReviewOpen] = useState(null);
  const [ebayReviewWarnings, setEbayReviewWarnings] = useState({});
  const [gmailImports, setGmailImports] = useState([]);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailStatus, setGmailStatus] = useState("");
  const [gmailQueueOpen, setGmailQueueOpen] = useState(false);
  const [gmailReviewOpen, setGmailReviewOpen] = useState(null);
  const [buyerNotifyStatus, setBuyerNotifyStatus] = useState("");

  // Filters
  const [invSearch, setInvSearch] = useState(""); const [invCat, setInvCat] = useState("All"); const [invPreorderView, setInvPreorderView] = useState("available"); const [invStatus, setInvStatus] = useState("All"); const [invSort, setInvSort] = useState("name_asc"); const [invCollapse, setInvCollapse] = useState(true);
  const [saleSearch, setSaleSearch] = useState(""); const [saleCat, setSaleCat] = useState("All"); const [salePlat, setSalePlat] = useState("All"); const [salePayment, setSalePayment] = useState("All"); const [saleSort, setSaleSort] = useState("date_desc");
  const [customerSearch, setCustomerSearch] = useState(""); const [customerPlatform, setCustomerPlatform] = useState("All"); const [customerSort, setCustomerSort] = useState("profit_desc"); const [activeCustomerKey, setActiveCustomerKey] = useState(null);
  const [expSearch, setExpSearch] = useState(""); const [expFrom, setExpFrom] = useState(""); const [expTo, setExpTo] = useState(""); const [expCatFilter, setExpCatFilter] = useState("All"); const [expPayment, setExpPayment] = useState("All"); const [expSort, setExpSort] = useState("date_desc");
  const [subSearch, setSubSearch] = useState(""); const [subCatFilter, setSubCatFilter] = useState("All"); const [subSort, setSubSort] = useState("nextDue_asc");
  const [backupStatus, setBackupStatus] = useState("");
  const [backups, setBackups] = useState([]);
  const autoBackupAttemptRef = useRef("");
  const [dashboardCustomizeOpen, setDashboardCustomizeOpen] = useState(false);
  const [navDragId, setNavDragId] = useState(null);
  const [mobileNavMoreOpen, setMobileNavMoreOpen] = useState(false);
  const [firstRunDismissed, setFirstRunDismissed] = useState(() => {
    try { return window.localStorage.getItem(FIRST_RUN_DISMISS_KEY) === "1"; } catch { return false; }
  });
  const dismissFirstRun = () => {
    try { window.localStorage.setItem(FIRST_RUN_DISMISS_KEY, "1"); } catch { /* private-mode storage is optional */ }
    setFirstRunDismissed(true);
  };
  useEffect(() => {
    const closeRowMenu = (event) => {
      if (!event.target.closest(".archive-row-action-wrap")) setRowMenuOpen(null);
    };
    const closeRowMenuOnEscape = (event) => {
      if (event.key === "Escape") setRowMenuOpen(null);
    };
    document.addEventListener("pointerdown", closeRowMenu);
    document.addEventListener("keydown", closeRowMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeRowMenu);
      document.removeEventListener("keydown", closeRowMenuOnEscape);
    };
  }, []);
  const CATS = settings.categories; const PLATS = settings.platforms; const CUSTS = settings.customers; const PAYMETHODS = settings.paymentMethods;
  const listingPlatforms = useMemo(() => PLATS.filter((p) => !["StockX", "GOAT", "CSFloat", "Bonusbank"].includes(p)), [PLATS]);

  const emptyInv = { name: "", category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||""), price: "", ebayListedPrice: "", quantity: "1", purchaseDate: today(), preorderDate: "", brand: "", listedPlatforms: [], tags: "", customer: "" };
  const [invForm, setInvForm] = useState(emptyInv);
  const emptyExp = { name: "", amount: "", purchaseDate: today(), tags: "", expCategory: EXP_CATEGORIES[0], paymentMethod: PAYMETHODS.includes("Card") ? "Card" : paymentMethodForPlatform("", PAYMETHODS) };
  const [expForm, setExpForm] = useState(emptyExp);
  const dashboardCardDefaults = {
    actionStrip: true,
    preorderAlerts: true,
    netProfitGraph: true,
    salesIncome: true,
    netProfit: true,
    grossProfit: true,
    inventorySpend: true,
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
    ["inventorySpend", "Inventory spend"],
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

  const trackSaveResult = useCallback((key, result, data, setter, label) => {
    setFailedSaves((prev) => {
      const next = new Map(prev);
      if (result?.ok === false) {
        next.set(key, { data, setter, label: label || saveLabelFor(key), error: result.error || "Save failed" });
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);
  const showSaveResult = useCallback((result) => {
    if (result?.ok === false) {
      setSaveStatus("error");
      return false;
    }
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(""), 1500);
    return true;
  }, []);
  const persist = useCallback(async (key, data, setter, label) => {
    setSaveStatus("saving");
    const result = await save(key, data);
    setter(data);
    trackSaveResult(key, result, data, setter, label);
    showSaveResult(result);
    return result;
  }, [showSaveResult, trackSaveResult]);
  const persistInv = useCallback(async (d) => persist("arch-inv2", d, setInventory), [persist]);
  const persistSales = useCallback(async (d) => persist("arch-sales2", d, setSales), [persist]);
  const persistExp = useCallback(async (d) => persist("arch-exp2", d, setExpenses), [persist]);
  const persistSubs = useCallback(async (d) => persist("arch-subs", d, setSubs), [persist]);
  const persistSettings = useCallback(async (d) => {
    setSaveStatus("saving");
    const result = await save("arch-settings", d);
    setSettings(d);
    trackSaveResult("arch-settings", result, d, setSettings);
    showSaveResult(result);
    return result;
  }, [showSaveResult, trackSaveResult]);
  const retryFailedSaves = useCallback(async () => {
    const entries = [...failedSaves.entries()];
    if (!entries.length) return;
    setRetryingSaves(true);
    try {
      for (const [key, failure] of entries) {
        await persist(key, failure.data, failure.setter, failure.label);
      }
    } finally {
      setRetryingSaves(false);
    }
  }, [failedSaves, persist]);
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
      setSaveStatus("saving");
      const result = await save("arch-notes", next);
      trackSaveResult("arch-notes", result, next, setNotes);
      showSaveResult(result);
    } else {
      noteSaveTimer.current = setTimeout(async () => {
        setSaveStatus("saving");
        const result = await save("arch-notes", next);
        trackSaveResult("arch-notes", result, next, setNotes);
        showSaveResult(result);
      }, 800);
    }
  }, [showSaveResult, trackSaveResult]);

  const updateNote = useCallback((id, changes) => {
    const current = notes.find((n) => n.id === id);
    const lockedFields = ["title", "content", "fontSize"];
    if (current?.locked && lockedFields.some((field) => Object.prototype.hasOwnProperty.call(changes, field))) return;
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
      locked: false,
      order: Math.min(0, ...notes.map((n) => n.order ?? 0)) - 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [newNote, ...notes];
    setNotes(next);
    setActiveNoteId(newNote.id);
    setSaveStatus("saving");
    const result = await save("arch-notes", next);
    trackSaveResult("arch-notes", result, next, setNotes);
    showSaveResult(result);
    return newNote.id;
  }, [notes, showSaveResult, trackSaveResult]);

  const deleteNote = useCallback(async (id) => {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (activeNoteId === id) {
      const fallback = next.length ? next[0].id : null;
      setActiveNoteId(fallback);
    }
    setSaveStatus("saving");
    const result = await save("arch-notes", next);
    trackSaveResult("arch-notes", result, next, setNotes);
    showSaveResult(result);
  }, [notes, activeNoteId, showSaveResult, trackSaveResult]);

  const togglePinNote = useCallback((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    updateNote(id, { pinned: !note.pinned });
  }, [notes, updateNote]);

  const toggleLockNote = useCallback((id) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const next = notes.map((n) => n.id === id ? { ...n, locked: !note.locked, updatedAt: Date.now() } : n);
    persistNotes(next, true);
  }, [notes, persistNotes]);

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
    setSaveStatus("saving");
    const result = await save("arch-templates", next);
    trackSaveResult("arch-templates", result, next, setUserTemplates);
    showSaveResult(result);
  }, [showSaveResult, trackSaveResult]);

  // Export a single note as a .txt file (HTML stripped to plain text)
  const exportNoteTxt = useCallback((note) => {
    if (!note) return;
    // Convert <br>, <div>, <p>, <li> to line breaks then strip remaining tags
    const tmp = document.createElement("div");
    tmp.innerHTML = sanitizeHtml(note.content || "");
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

  const openAddInventory = () => {
    setInvQueue([]);
    setInvForm({ ...emptyInv, category: CATS[0] || "Other", size: getDefaultSize(CATS[0] || ""), listedPlatforms: [] });
    setAddDirty(false);
    setAddInvOpen(true);
  };
  const closeAddInventory = () => {
    setAddInvOpen(false);
    setAddDirty(false);
    setInvQueue([]);
    setInvForm(emptyInv);
  };
  const updateInvForm = (u) => { setInvForm({ ...invForm, ...u }); setAddDirty(true); };
  const guardedCloseAdd = () => { if (addDirty || invQueue.length) setShowUnsavedAdd(true); else closeAddInventory(); };
  const nextSizeFor = (category, size) => {
    const sizes = getSizes(category);
    const index = sizes.indexOf(size);
    return index >= 0 && index < sizes.length - 1 ? sizes[index + 1] : size;
  };
  const inventoryItemsFromDraft = (draft) => {
    const price = parseFloat(draft.price);
    if (!String(draft.name || "").trim() || Number.isNaN(price)) return [];
    const qty = Math.max(1, parseInt(draft.quantity, 10) || 1);
    return Array.from({ length: qty }, () => ({
      id: genId(),
      name: String(draft.name || "").trim(),
      category: draft.category,
      size: draft.size,
      price,
      ebayListedPrice: draft.ebayListedPrice ? parseFloat(draft.ebayListedPrice) : undefined,
      purchaseDate: draft.purchaseDate,
      preorderDate: draft.preorderDate,
      brand: draft.brand,
      listedPlatforms: listedPlatformsFor(draft),
      tags: draft.tags,
      customer: draft.customer,
      addedAt: Date.now(),
    }));
  };
  const queueInventoryDraft = () => {
    const items = inventoryItemsFromDraft(invForm);
    if (!items.length) return;
    setInvQueue((prev) => [...prev, ...items]);
    setInvForm((prev) => ({ ...prev, size: nextSizeFor(prev.category, prev.size), quantity: "1" }));
    setAddDirty(true);
  };
  const removeQueuedInventory = (id) => {
    setInvQueue((prev) => prev.filter((item) => item.id !== id));
    setAddDirty(true);
  };
  const clearInventoryDraft = () => {
    setInvForm({ ...emptyInv, category: invForm.category || CATS[0] || "Other", size: getDefaultSize(invForm.category || CATS[0] || ""), purchaseDate: invForm.purchaseDate || today(), listedPlatforms: [] });
    setAddDirty(true);
  };

  const addInventory = async () => {
    const items = invQueue.length ? invQueue : inventoryItemsFromDraft(invForm);
    if (!items.length) return;
    await persistInv([...items, ...inventory]);
    closeAddInventory();
  };

  const duplicateItem = async (item) => { await persistInv([{ ...item, id: genId(), addedAt: Date.now() }, ...inventory]); };

  // ─── Sample / demo data ───
  const hasSampleData = inventory.some(isDemoRecord) || sales.some(isDemoRecord) || expenses.some(isDemoRecord) || subs.some(isDemoRecord);
  const isFirstRun = !loading && !firstRunDismissed && !hasSampleData
    && inventory.length === 0 && sales.length === 0 && expenses.length === 0 && subs.length === 0;
  const loadSampleData = async () => {
    if (hasSampleData) return;
    const sample = buildSampleData();
    await persistInv([...sample.inventory, ...inventory]);
    await persistSales([...sample.sales, ...sales]);
    await persistExp([...sample.expenses, ...expenses]);
    setPage("dashboard");
  };
  const removeSampleData = async () => {
    if (inventory.some(isDemoRecord)) await persistInv(inventory.filter((r) => !isDemoRecord(r)));
    if (sales.some(isDemoRecord)) await persistSales(sales.filter((r) => !isDemoRecord(r)));
    if (expenses.some(isDemoRecord)) await persistExp(expenses.filter((r) => !isDemoRecord(r)));
    if (subs.some(isDemoRecord)) await persistSubs(subs.filter((r) => !isDemoRecord(r)));
  };

  const handleSell = async (item, sf) => {
    const sp = parseFloat(sf.salePrice)||0, ship = parseFloat(sf.shippingPrice)||0, fees = parseFloat(sf.platformFees)||0;
    const sale = { id: genId(), name: item.name, category: item.category, size: item.size||"OS", brand: item.brand||"", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }), platform: sf.platform, paymentMethod: sf.paymentMethod || paymentMethodForPlatform(sf.platform, PAYMETHODS), saleDate: sf.saleDate, tags: sf.tags, purchaseDate: item.purchaseDate, preorderDate: item.preorderDate||"", customer: sf.customer||"" };
    const salesResult = await persistSales([sale, ...sales]);
    if (salesResult?.ok === false) return;
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
      newSales.push({ id: genId(), name: item.name, category: item.category, size: item.size||"OS", brand: item.brand||"", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }), platform: shared.platform, paymentMethod: shared.paymentMethod || paymentMethodForPlatform(shared.platform, PAYMETHODS), saleDate: shared.saleDate, tags: "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate||"", customer: shared.customer||"" });
      soldIds.add(item.id);
    }
    const salesResult = await persistSales([...newSales, ...sales]);
    if (salesResult?.ok === false) return;
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
      const rawSalePrice = String(r.salePrice ?? "").trim();
      const sp = parseFloat(rawSalePrice), ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
      if (!rawSalePrice || !Number.isFinite(sp) || sp < 0) continue;
      newSales.push({ id: genId(), name: item.name, category: item.category, size: item.size||"OS", brand: item.brand||"", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }), platform: shared.platform, paymentMethod: shared.paymentMethod || paymentMethodForPlatform(shared.platform, PAYMETHODS), saleDate: shared.saleDate, tags: "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate||"", customer: shared.customer||"" });
      soldIds.add(item.id);
    }
    if (!newSales.length) return;
    const salesResult = await persistSales([...newSales, ...sales]);
    if (salesResult?.ok === false) return;
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
      setEbayReviewWarnings((prev) => ({ ...prev, [draft.id]: "Not enough matching inventory - edit the item name or record manually." }));
      return;
    }
    setEbayReviewWarnings((prev) => {
      if (!prev[draft.id]) return prev;
      const next = { ...prev };
      delete next[draft.id];
      return next;
    });
    setEbayReviewOpen({ draft, items: matches });
  };

  const recordEbaySale = async (draft, review = null) => {
    const reviewItems = review?.items || [];
    const matches = reviewItems.length ? reviewItems : findEbayMatches(draft).map((m) => m.item).slice(0, Math.max(1, Number(draft.quantity || 1)));
    if (!matches.length) return;
    const shared = review?.shared || { platform: "eBay AU", paymentMethod: "eBay Payout", saleDate: draft.sale_date || today(), customer: draft.buyer_username || "" };
    const rows = review?.rows || matches.map((item) => {
      const qty = Math.max(1, Number(draft.quantity || 1));
      const feeTotal = Number(draft.platform_fees || 0) > 0 ? Number(draft.platform_fees || 0) : estimateEbayFee(Number(draft.sale_price || 0));
      return { id: item.id, salePrice: Number(draft.sale_price || 0) / qty, shippingPrice: Number(draft.shipping_price || 0) / qty, platformFees: feeTotal / qty };
    });
    const newSales = matches.map((item) => {
      const r = rows.find((x) => x.id === item.id) || {};
      const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
      return { id: genId(), name: item.name, category: item.category, size: item.size || "OS", brand: item.brand || "", costPrice: item.price, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }), platform: shared.platform || "eBay AU", paymentMethod: shared.paymentMethod || "eBay Payout", saleDate: shared.saleDate || today(), tags: `eBay ${draft.order_id}`, purchaseDate: item.purchaseDate, preorderDate: item.preorderDate || "", customer: shared.customer || "" };
    });
    const soldIds = new Set(matches.map((i) => i.id));
    const salesResult = await persistSales([...newSales, ...sales]);
    if (salesResult?.ok === false) return;
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
    else if (confirmDel.type === "sale") await persistSales(
      confirmDel.saleKey
        ? keyedSales.filter((s) => s._saleKey !== confirmDel.saleKey).map(stripSaleKey)
        : sales.filter((s) => s.id !== confirmDel.id)
    );
    else if (confirmDel.type === "exp") await persistExp(expenses.filter((e) => e.id !== confirmDel.id));
    else if (confirmDel.type === "multi") { await persistInv(inventory.filter((i) => !selectedInv.has(i.id))); setSelectedInv(new Set()); }
    else if (confirmDel.type === "multi-exp") { await persistExp(expenses.filter((e) => !selectedExp.has(e.id))); setSelectedExp(new Set()); }
    else if (confirmDel.type === "multi-sale") { await persistSales(keyedSales.filter((s) => !selectedSales.has(s._saleKey)).map(stripSaleKey)); setSelectedSales(new Set()); }
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
    const chargeDate = sub.nextDue || today();
    const subCurrency = String(sub.currency || "AUD").toUpperCase();
    const originalCharge = subCurrency !== "AUD" ? `${formatMoney(sub.amount, subCurrency)} @ ${Number(fxRates[subCurrency] || sub.fxRateToAud || 1).toFixed(4)}` : "";
    const newExp = { id: genId(), name: sub.name, amount: subAmountAud(sub, fxRates), purchaseDate: chargeDate, tags: [subCategory(sub), sub.tags || "", originalCharge].filter(Boolean).join(" · "), expCategory: "Software & Subs", paymentMethod: PAYMETHODS.includes("Card") ? "Card" : paymentMethodForPlatform("", PAYMETHODS) };
    const expResult = await persistExp([newExp, ...expenses]);
    if (expResult?.ok === false) return;
    await persistSubs(subs.map((s) => s.id === sub.id ? { ...s, fxRateToAud: subCurrency !== "AUD" ? (fxRates[subCurrency] || s.fxRateToAud || 1) : 1, nextDue: advanceDate(chargeDate, s.frequency, s.customDays), lastLogged: chargeDate } : s));
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
        newExpenses.push({ id: genId(), name: sub.name, amount: subAmountAud(sub, fxRates), purchaseDate: cur, tags: [subCategory(sub), sub.tags || "", originalCharge].filter(Boolean).join(" · "), expCategory: "Software & Subs", paymentMethod: PAYMETHODS.includes("Card") ? "Card" : paymentMethodForPlatform("", PAYMETHODS) });
        lastLogged = cur;
        const next = advanceDate(cur, sub.frequency, sub.customDays);
        if (next <= cur) break; // safety: never loop on a date that does not advance
        cur = next;
      }
      updatedSubs = updatedSubs.map((s) => s.id === sub.id ? { ...s, fxRateToAud: subCurrency !== "AUD" ? (fxRates[subCurrency] || s.fxRateToAud || 1) : 1, nextDue: cur, lastLogged } : s);
    }
    const expResult = await persistExp([...newExpenses, ...expenses]);
    if (expResult?.ok === false) return;
    await persistSubs(updatedSubs);
  };

  const toggleSubActive = async (sub) => {
    await persistSubs(subs.map((s) => s.id === sub.id ? { ...s, active: !s.active } : s));
  };

  const handleBulkEdit = async (updates) => {
    const ids = selectedInv;
    const {
      addListedPlatform,
      clearListingPlatforms,
      nameSet,
      titleFind,
      titleReplace = "",
      titlePrefix = "",
      titleSuffix = "",
      setTags,
      addTags,
      clearTags,
      ...rest
    } = updates;
    await persistInv(inventory.map((i) => {
      if (!ids.has(i.id)) return i;
      const next = { ...i, ...rest };
      if (nameSet) {
        next.name = nameSet;
      } else if (titleFind || titlePrefix || titleSuffix) {
        let name = String(next.name || "");
        if (titleFind) name = name.split(titleFind).join(titleReplace);
        next.name = `${titlePrefix}${name}${titleSuffix}`;
      }
      if (clearTags) next.tags = "";
      if (setTags !== undefined) next.tags = setTags;
      if (addTags) next.tags = [next.tags, addTags].filter(Boolean).join(", ");
      if (clearListingPlatforms) next.listedPlatforms = [];
      if (addListedPlatform) next.listedPlatforms = [...new Set([...listedPlatformsFor(next), addListedPlatform])];
      return next;
    }));
    setBulkEditOpen(false); setSelectedInv(new Set());
  };

  const copyTextToClipboard = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!copied) throw new Error("Clipboard copy failed");
  };

  const ebayPartnerListPrice = (item) => {
    const price = Number(item.ebayListedPrice);
    return Number.isFinite(price) && price > 0 ? currency(price) : "TBC";
  };

  const buildEbayPartnerExport = (items) => [
    `eBay listing batch (${items.length} item${items.length === 1 ? "" : "s"})`,
    ...items.map((item, index) => [
      `${index + 1}. ${item.name || "Untitled item"}`,
      `Size: ${item.size || "OS"}`,
      `List price: ${ebayPartnerListPrice(item)}`,
    ].join("\n")),
  ].join("\n\n");

  const handleEbayPartnerExport = async () => {
    const items = inventory.filter((item) => selectedInv.has(item.id));
    if (!items.length) return;
    const text = buildEbayPartnerExport(items);
    try {
      await copyTextToClipboard(text);
    } catch {
      setEbayExportStatus("Clipboard blocked. Please try again from the Inventory page.");
      setTimeout(() => setEbayExportStatus(""), 4000);
      return;
    }
    const ebayPlatform = listingPlatforms.find((platform) => String(platform).toLowerCase().includes("ebay")) || "eBay AU";
    const ids = new Set(items.map((item) => item.id));
    await persistInv(inventory.map((item) => {
      if (!ids.has(item.id)) return item;
      return { ...item, listedPlatforms: [...new Set([...listedPlatformsFor(item), ebayPlatform])] };
    }));
    setSelectedInv(new Set());
    setEbayExportStatus(`Copied ${items.length} item${items.length === 1 ? "" : "s"} and marked eBay listed.`);
    setTimeout(() => setEbayExportStatus(""), 4000);
  };

  // ─── Export ───
  const buyerContactFor = (customer) => customer.profile?.facebookName
    || customer.profile?.discordHandle
    || customer.profile?.phone
    || customer.profile?.email
    || customer.name;

  const buildBuyerNotifyExport = (items) => {
    const byCustomer = new Map();
    items.forEach((item) => {
      matchedBuyerRequestsForItem(item, customerRows).forEach(({ customer, request }) => {
        const entry = byCustomer.get(customer.key) || { customer, rows: [] };
        entry.rows.push({ item, request });
        byCustomer.set(customer.key, entry);
      });
    });
    return [...byCustomer.values()].map(({ customer, rows }) => {
      const matchedItems = rows.map(({ item, request }) => {
        const price = Number(item.price) > 0 ? ` - ${currency(item.price)}` : "";
        return `- ${item.name || "Untitled item"} (${item.size || "OS"})${price} [${request.label}]`;
      }).join("\n");
      const firstItem = rows[0]?.item || {};
      return [
        `${customer.name} - ${buyerContactFor(customer)}`,
        matchedItems,
        "",
        `Hey ${customer.name || "there"}, I just got ${firstItem.name || "something you asked about"} in. You asked me to let you know when this kind of stock came through. Want me to hold one for you?`,
      ].join("\n");
    }).join("\n\n---\n\n");
  };

  const handleBuyerNotifyExport = async () => {
    const items = inventory.filter((item) => selectedInv.has(item.id));
    if (!items.length) return;
    const matches = items.flatMap((item) => matchedBuyerRequestsForItem(item, customerRows).map((match) => ({ ...match, item })));
    const customerCount = new Set(matches.map((match) => match.customer.key)).size;
    if (!matches.length) {
      setBuyerNotifyStatus("No saved buyer requests matched the selected inventory.");
      setTimeout(() => setBuyerNotifyStatus(""), 4000);
      return;
    }
    try {
      await copyTextToClipboard(buildBuyerNotifyExport(items));
    } catch {
      setBuyerNotifyStatus("Clipboard blocked. Try again from the Inventory page.");
      setTimeout(() => setBuyerNotifyStatus(""), 4000);
      return;
    }
    const now = new Date().toISOString();
    const notifiedByCustomer = matches.reduce((map, match) => {
      if (!map.has(match.customer.key)) map.set(match.customer.key, new Set());
      map.get(match.customer.key).add(match.request.id);
      return map;
    }, new Map());
    const nextProfiles = { ...(settings.customerProfiles || {}) };
    notifiedByCustomer.forEach((requestIds, key) => {
      const profile = nextProfiles[key] || {};
      nextProfiles[key] = {
        ...profile,
        notifyRequests: normalizeBuyerRequests(profile).map((request) => requestIds.has(request.id)
          ? { ...request, lastNotifiedAt: now, updatedAt: now }
          : request),
        lastContactedAt: now,
        outreachStatus: "contacted",
        updatedAt: Date.now(),
      };
    });
    await persistSettings({ ...settings, customerProfiles: nextProfiles });
    setBuyerNotifyStatus(`Copied messages for ${customerCount} buyer${customerCount === 1 ? "" : "s"}.`);
    setTimeout(() => setBuyerNotifyStatus(""), 4000);
  };

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
    setSaveStatus("saving");
    const backupResult = await save("arch-backups", nextBackups);
    trackSaveResult("arch-backups", backupResult, nextBackups, setBackups);
    showSaveResult(backupResult);
    if (backupResult?.ok === false) {
      setBackupStatus("Backup failed. Retry from the save warning.");
      setTimeout(() => setBackupStatus(""), 5000);
      return false;
    }
    setBackups(nextBackups);
    await persistSettings({ ...settings, backup: { ...backupSettings, lastRunAt: snapshot.createdAt } });
    setBackupStatus(`${reason === "auto" ? "Weekly" : "Supabase"} backup saved: ${snapshot.counts.inventory} items, ${snapshot.counts.sales} sales, ${snapshot.counts.expenses} expenses.`);
    setTimeout(() => setBackupStatus(""), 5000);
    return true;
  }, [inventory, sales, expenses, subs, notes, settings, userTemplates, backups, backupSettings, persistSettings, showSaveResult, trackSaveResult]);

  const updateBackupSettings = async (updates) => {
    await persistSettings({ ...settings, backup: { ...backupSettings, ...updates } });
  };
  // Worker: applies a snapshot to local data. Confirmation is handled by the
  // Danger Zone dialog before this runs.
  const applySupabaseBackup = async (snapshot) => {
    const data = snapshot?.data || {};
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

  const restoreSupabaseBackup = (snapshot) => {
    if (!snapshot) return;
    const c = snapshot.counts || {};
    setDangerAction({
      title: "Restore snapshot",
      intro: `Restoring the snapshot from ${new Date(snapshot.createdAt).toLocaleString()} replaces all current local data with the records below.`,
      counts: [
        { label: "Inventory", value: `${c.inventory || 0} (now ${inventory.length})` },
        { label: "Sales", value: `${c.sales || 0} (now ${sales.length})` },
        { label: "Expenses", value: `${c.expenses || 0} (now ${expenses.length})` },
        { label: "Subscriptions", value: `${c.subs || 0} (now ${subs.length})` },
        { label: "Notes", value: `${c.notes || 0} (now ${notes.length})` },
      ],
      keyword: "RESTORE",
      confirmLabel: "Restore",
      snapshot: true,
      snapshotReason: "pre-restore",
      run: () => applySupabaseBackup(snapshot),
    });
  };

  const requestReplaceImport = () => {
    setDangerAction({
      title: "Replace all data",
      intro: "Replace import overwrites every current record with the contents of the file you choose next. There is no merge.",
      counts: [
        { label: "Inventory", value: inventory.length },
        { label: "Sales", value: sales.length },
        { label: "Expenses", value: expenses.length },
        { label: "Subscriptions", value: subs.length },
        { label: "Notes", value: notes.length },
      ],
      keyword: "REPLACE",
      confirmLabel: "Choose file & replace",
      snapshot: true,
      snapshotReason: "pre-replace",
      run: () => { importBackup("replace"); },
    });
  };

  const requestClearAll = () => {
    setDangerAction({
      title: "Clear all data",
      intro: "This permanently removes inventory, sales, and expenses from this account.",
      counts: [
        { label: "Inventory", value: inventory.length },
        { label: "Sales", value: sales.length },
        { label: "Expenses", value: expenses.length },
      ],
      keyword: "DELETE",
      confirmLabel: "Clear all data",
      snapshot: true,
      snapshotReason: "pre-clear",
      run: async () => { await persistInv([]); await persistSales([]); await persistExp([]); },
    });
  };

  const confirmDangerAction = async () => {
    if (!dangerAction) return;
    const action = dangerAction;
    setDangerBusy(true);
    try {
      if (action.snapshot && supabase) {
        const backedUp = await createSupabaseBackup(action.snapshotReason || "pre-action");
        if (!backedUp) return;
      }
      await action.run();
    } finally {
      setDangerBusy(false);
      setDangerAction(null);
    }
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
  const csvCell = (value) => {
    const raw = String(value ?? "");
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const exportCSV = () => {
    const headers = ["Name","Category","Size","Brand","Cost Price","Sale Price","Shipping","Fees","Profit","Platform","Payment Method","Sale Date","Purchase Date","Customer","Tags"];
    const rows = sales.map((s) => [s.name,s.category,s.size||"OS",s.brand||"",s.costPrice,s.salePrice,s.shippingPrice,s.platformFees,saleProfit(s),s.platform,recordPaymentMethod(s),s.saleDate,s.purchaseDate||"",s.customer||"",s.tags||""].map(csvCell).join(","));
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
    let fi = inventory.filter((i) => (i.purchaseDate || "") >= cutFrom && (i.purchaseDate || "") <= cutTo);
    if (dashCat !== "All") fs = fs.filter((s) => s.category === dashCat);
    if (dashPlat !== "All") fs = fs.filter((s) => s.platform === dashPlat);
    if (dashCat !== "All") fi = fi.filter((i) => i.category === dashCat);
    if (dashPlat !== "All") fi = fi.filter((i) => listedPlatformsFor(i).includes(dashPlat));
    const salesIncome = fs.reduce((a, s) => a + (Number(s.salePrice) || 0), 0), grossProfit = fs.reduce((a, s) => a + saleProfit(s), 0);
    const totalExpenses = fe.reduce((a, e) => a + e.amount, 0), netProfit = grossProfit - totalExpenses;
    const inventorySpend = fi.reduce((a, i) => a + (Number(i.price) || 0), 0);
    const invValue = inventory.reduce((a, i) => a + i.price, 0), cnt = fs.length, aov = cnt > 0 ? salesIncome / cnt : 0;
    const sellThrough = (inventory.length + cnt) > 0 ? cnt / (inventory.length + cnt) : 0;
    const totalFees = fs.reduce((a, s) => a + (s.platformFees||0), 0);
    const grossMargin = salesIncome > 0 ? grossProfit / salesIncome : 0;
    const netMargin = salesIncome > 0 ? netProfit / salesIncome : 0;
    const pbd = {};
    fs.forEach((s) => { pbd[s.saleDate] = (pbd[s.saleDate] || 0) + saleProfit(s); });
    fe.forEach((e) => { pbd[e.purchaseDate] = (pbd[e.purchaseDate] || 0) - (Number(e.amount) || 0); });
    const dates = activePeriod.periodDays > 730 ? Object.keys(pbd).sort() : [];
    if (!dates.length && activePeriod.periodDays <= 730) {
      for (let d = cutFrom; d <= cutTo; d = addDaysToKey(d, 1)) dates.push(d);
    }
    let cum = 0; const spark = dates.map((d) => { cum += pbd[d] || 0; return cum; });
    const ri = [...inventory].sort((a, b) => (b.addedAt||0) - (a.addedAt||0)).slice(0, 7);
    const rs = [...fs].sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")).slice(0, 7).map(withComputedSaleProfit);
    return { salesIncome, grossProfit, totalExpenses, netProfit, inventorySpend, invValue, cnt, aov, sellThrough, totalFees, grossMargin, netMargin, spark, ri, rs };
  }, [inventory, sales, expenses, activePeriod, dashCat, dashPlat]);

  const periodComparison = useMemo(() => {
    const { currentStart, currentEnd, previousStart, previousEnd } = activePeriod;
    const matchesFilters = (s) => (dashCat === "All" || s.category === dashCat) && (dashPlat === "All" || s.platform === dashPlat);
    const currentSales = sales.filter((s) => s.saleDate >= currentStart && s.saleDate <= currentEnd && matchesFilters(s));
    const previousSales = sales.filter((s) => s.saleDate >= previousStart && s.saleDate <= previousEnd && matchesFilters(s));
    const currentSalesProfit = currentSales.reduce((a, s) => a + saleProfit(s), 0);
    const currentExpenses = expenses.filter((e) => e.purchaseDate >= currentStart && e.purchaseDate <= currentEnd).reduce((a, e) => a + (e.amount || 0), 0);
    const previousSalesProfit = previousSales.reduce((a, s) => a + saleProfit(s), 0);
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
        row.profit += saleProfit(s);
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
      prev.profit += saleProfit(s);
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
    const selectedPaymentSet = new Set(reportPaymentMethods);
    const paymentFilterActive = reportPaymentMode !== "all" && selectedPaymentSet.size > 0;
    if (paymentFilterActive) {
      const matchesPayment = (record) => selectedPaymentSet.has(recordPaymentMethod(record));
      fs = fs.filter((s) => reportPaymentMode === "include" ? matchesPayment(s) : !matchesPayment(s));
      fe = fe.filter((e) => reportPaymentMode === "include" ? matchesPayment(e) : !matchesPayment(e));
    }
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
      paymentRows: group(fs, recordPaymentMethod, (s) => Number(s.salePrice) || 0),
      categoryRows: group(fs, (s) => s.category, saleProfit),
      expenseRows: group(fe, (e) => e.expCategory, (e) => Number(e.amount) || 0),
      expensePaymentRows: group(fe, recordPaymentMethod, (e) => Number(e.amount) || 0),
    };
  }, [sales, expenses, range, customFrom, customTo, dashCat, dashPlat, reportPaymentMode, reportPaymentMethods]);

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
      ...reportStats.paymentRows.map((r) => ["Payment method revenue", r.name, r.count, r.amount]),
      ...reportStats.categoryRows.map((r) => ["Category profit", r.name, r.count, r.amount]),
      ...reportStats.expenseRows.map((r) => ["Expense category", r.name, r.count, r.amount]),
      ...reportStats.expensePaymentRows.map((r) => ["Expense payment method", r.name, r.count, r.amount]),
    ];
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `archivedash-profit-report-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleReportPaymentMethod = (method) => {
    setReportPaymentMethods((prev) => prev.includes(method) ? prev.filter((item) => item !== method) : [...prev, method]);
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

  // ─── Filtered Inventory ───
  const filteredInv = useMemo(() => {
    let f = inventory;
    if (invSearch) {
      const q = invSearch.toLowerCase();
      f = f.filter((i) => [i.name, i.brand, i.tags, ...listedPlatformsFor(i)].some((v) => String(v || "").toLowerCase().includes(q)));
    }
    if (invCat !== "All") f = f.filter((i) => i.category === invCat);
    if (invPreorderView === "available") f = f.filter((i) => !i.preorderDate);
    if (invPreorderView === "preorders") f = f.filter((i) => Boolean(i.preorderDate));
    if (invStatus !== "All") {
      f = f.filter((i) => {
        const listed = listedPlatformsFor(i);
        if (invStatus === "Listed") return listed.length > 0;
        if (invStatus === "Unlisted") return listed.length === 0;
        if (invStatus === "Facebook") return listed.some((p) => String(p).toLowerCase().includes("facebook"));
        if (invStatus === "eBay") return listed.some((p) => String(p).toLowerCase().includes("ebay"));
        return true;
      });
    }
    const sorted = [...f];
    switch (invSort) {
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
      case "name_desc": sorted.sort((a, b) => b.name.localeCompare(a.name) || compareInventorySize(a, b)); break;
      case "price_desc": sorted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
      case "price_asc": sorted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
      case "date_desc": sorted.sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"") || a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
      case "date_asc": sorted.sort((a, b) => (a.purchaseDate||"").localeCompare(b.purchaseDate||"") || a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
      case "preorder_asc": sorted.sort((a, b) => (a.preorderDate || "9999-12-31").localeCompare(b.preorderDate || "9999-12-31") || a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
      case "preorder_desc": sorted.sort((a, b) => (b.preorderDate || "").localeCompare(a.preorderDate || "") || a.name.localeCompare(b.name) || compareInventorySize(a, b)); break;
    }
    return sorted;
  }, [inventory, invSearch, invCat, invPreorderView, invStatus, invSort]);

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
      const sortedItems = [...items].sort(compareInventorySize);
      if (sortedItems.length > 1) {
        const totalValue = sortedItems.reduce((a, x) => a + x.price, 0);
        const preorderDates = sortedItems.map((x) => x.preorderDate).filter(Boolean).sort();
        result.push({ ...sortedItems[0], preorderDate: preorderDates[0] || sortedItems[0].preorderDate || "", _group: true, _items: sortedItems, _count: sortedItems.length, _totalValue: totalValue });
      } else result.push({ ...sortedItems[0], _group: false });
    });
    return result;
  }, [filteredInv, invCollapse]);

  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const toggleGroup = (key) => setExpandedGroups((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const stripSaleKey = (sale) => {
    const { _saleKey, ...clean } = sale;
    return clean;
  };

  const keyedSales = useMemo(() => {
    const seen = new Map();
    return sales.map((sale) => {
      const fingerprint = [
        sale.id || "",
        sale.name || "",
        sale.saleDate || "",
        sale.salePrice ?? "",
        sale.costPrice ?? "",
        sale.platform || "",
        sale.customer || "",
        sale.profit ?? "",
      ].join("::");
      const occurrence = seen.get(fingerprint) || 0;
      seen.set(fingerprint, occurrence + 1);
      return { ...sale, _saleKey: `${fingerprint}::${occurrence}` };
    });
  }, [sales]);

  useEffect(() => {
    const validKeys = new Set(keyedSales.map((sale) => sale._saleKey));
    setSelectedSales((prev) => {
      const next = new Set([...prev].filter((key) => validKeys.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [keyedSales]);

  const filteredSales = useMemo(() => {
    let f = keyedSales;
    const q = saleSearch.trim().toLowerCase();
    if (q) {
      f = f.filter((s) => String(s.name || "").toLowerCase().includes(q));
    }
    if (saleCat !== "All") f = f.filter((s) => s.category === saleCat);
    if (salePlat !== "All") f = f.filter((s) => s.platform === salePlat);
    if (salePayment !== "All") f = f.filter((s) => recordPaymentMethod(s) === salePayment);
    const sorted = f.map(withComputedSaleProfit);
    switch (saleSort) {
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "date_desc": sorted.sort((a, b) => (b.saleDate||"").localeCompare(a.saleDate||"")); break;
      case "date_asc": sorted.sort((a, b) => (a.saleDate||"").localeCompare(b.saleDate||"")); break;
      case "sale_desc": sorted.sort((a, b) => b.salePrice - a.salePrice); break;
      case "sale_asc": sorted.sort((a, b) => a.salePrice - b.salePrice); break;
      case "profit_desc": sorted.sort((a, b) => b.profit - a.profit); break;
      case "profit_asc": sorted.sort((a, b) => a.profit - b.profit); break;
    }
    return sorted;
  }, [keyedSales, saleSearch, saleCat, salePlat, salePayment, saleSort]);

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
          orderKeys: new Set(),
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
      const computedProfit = saleProfit(sale);
      row.sales.push({ ...sale, profit: computedProfit });
      row.orderKeys.add(orderKeyForSale(sale));
      row.revenue += Number(sale.salePrice) || 0;
      row.profit += computedProfit;
      if (sale.platform) row.platforms.add(sale.platform);
      row.platformGroups.add(platformGroup(sale.platform));
      if (sale.category) row.categories.add(sale.category);
      if (sale.brand) row.brands.add(sale.brand);
      if (sale.saleDate && sale.saleDate > row.lastPurchase) row.lastPurchase = sale.saleDate;
    });
    let result = [...rows.values()].map((row) => {
      const orderCount = row.orderKeys.size;
      const interests = mergeCustomerInterests(row.sales, row.profile);
      return {
        ...row,
        orderCount,
        averageOrder: orderCount ? row.revenue / orderCount : 0,
        platformsList: [...row.platforms],
        platformGroupsList: [...row.platformGroups],
        categoriesList: [...row.categories],
        brandsList: interests.brands,
        productTypesList: interests.productTypes,
        notifyRequests: normalizeBuyerRequests(row.profile),
        defaultPlatform: row.profile.defaultPlatform || [...row.platformGroups][0] || "Other",
      };
    }).filter((row) => !hiddenCustomerKeys.includes(row.key));
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
        ...row.brandsList,
        ...row.productTypesList,
        ...(row.notifyRequests || []).flatMap((request) => [request.label, request.keywords, request.category, request.brand, request.notes, request.channel]),
      ].some((v) => String(v || "").toLowerCase().includes(q)));
    }
    if (customerPlatform !== "All") {
      result = result.filter((row) => row.platformGroupsList.includes(customerPlatform) || row.defaultPlatform === customerPlatform);
    }
    switch (customerSort) {
      case "name_asc": result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": result.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "last_desc": result.sort((a, b) => (b.lastPurchase || "").localeCompare(a.lastPurchase || "")); break;
      case "last_asc": result.sort((a, b) => (a.lastPurchase || "").localeCompare(b.lastPurchase || "")); break;
      case "orders_desc": result.sort((a, b) => b.orderCount - a.orderCount); break;
      case "orders_asc": result.sort((a, b) => a.orderCount - b.orderCount); break;
      case "revenue_desc": result.sort((a, b) => b.revenue - a.revenue); break;
      case "revenue_asc": result.sort((a, b) => a.revenue - b.revenue); break;
      case "profit_asc": result.sort((a, b) => a.profit - b.profit); break;
      case "profit_desc":
      default: result.sort((a, b) => b.profit - a.profit); break;
    }
    return result;
  }, [sales, CUSTS, customerProfiles, hiddenCustomerKeys, customerSearch, customerPlatform, customerSort]);

  const buyerMatchesByInventoryId = useMemo(() => {
    const next = new Map();
    inventory.forEach((item) => {
      const matches = matchedBuyerRequestsForItem(item, customerRows);
      if (matches.length) next.set(item.id, matches);
    });
    return next;
  }, [inventory, customerRows]);

  const filteredExp = useMemo(() => {
    let f = expenses;
    if (expSearch) f = f.filter((e) => e.name.toLowerCase().includes(expSearch.toLowerCase()));
    if (expCatFilter !== "All") f = f.filter((e) => (e.expCategory || "Other") === expCatFilter);
    if (expPayment !== "All") f = f.filter((e) => recordPaymentMethod(e) === expPayment);
    if (expFrom) f = f.filter((e) => e.purchaseDate >= expFrom);
    if (expTo) f = f.filter((e) => e.purchaseDate <= expTo);
    const sorted = [...f];
    switch (expSort) {
      case "date_desc": sorted.sort((a, b) => (b.purchaseDate||"").localeCompare(a.purchaseDate||"")); break;
      case "date_asc": sorted.sort((a, b) => (a.purchaseDate||"").localeCompare(b.purchaseDate||"")); break;
      case "name_asc": sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name_desc": sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
      case "amount_desc": sorted.sort((a, b) => b.amount - a.amount); break;
      case "amount_asc": sorted.sort((a, b) => a.amount - b.amount); break;
    }
    return sorted;
  }, [expenses, expSearch, expCatFilter, expPayment, expFrom, expTo, expSort]);

  const selectedValue = useMemo(() => inventory.filter((i) => selectedInv.has(i.id)).reduce((a, i) => a + i.price, 0), [inventory, selectedInv]);
  const selectedBuyerNotifyCount = useMemo(() => {
    const keys = new Set();
    inventory.forEach((item) => {
      if (!selectedInv.has(item.id)) return;
      (buyerMatchesByInventoryId.get(item.id) || []).forEach(({ customer }) => keys.add(customer.key));
    });
    return keys.size;
  }, [inventory, selectedInv, buyerMatchesByInventoryId]);
  const preorderInvCount = useMemo(() => inventory.filter((i) => i.preorderDate).length, [inventory]);
  const availableInvCount = useMemo(() => inventory.filter((i) => !i.preorderDate).length, [inventory]);
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

  const selectedSalesProfit = useMemo(() => keyedSales.filter((s) => selectedSales.has(s._saleKey)).reduce((a, s) => a + saleProfit(s), 0), [keyedSales, selectedSales]);
  const selectedSalesRevenue = useMemo(() => keyedSales.filter((s) => selectedSales.has(s._saleKey)).reduce((a, s) => a + s.salePrice, 0), [keyedSales, selectedSales]);
  const toggleSelSale = (key) => setSelectedSales((p) => { const n = new Set(p); n.has(key)?n.delete(key):n.add(key); return n; });
  const toggleAllSales = () => { if (filteredSales.length > 0 && filteredSales.every((s) => selectedSales.has(s._saleKey))) setSelectedSales(new Set()); else setSelectedSales(new Set(filteredSales.map((s) => s._saleKey))); };
  const handleBulkEditSale = async (updates) => {
    const ids = selectedSales;
    await persistSales(keyedSales.map((s) => stripSaleKey(ids.has(s._saleKey) ? { ...s, ...updates } : s)));
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

  if (loading) return <div style={{ background: "#0b0f19", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b97ad" }}>Loading...</div>;

  const invQueueTotal = invQueue.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const invQueueProductCount = new Set(invQueue.map((item) => item.name).filter(Boolean)).size;

  const navItems = [
    { id: "dashboard", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" },
    { id: "inventory", icon: "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12" },
    { id: "sales", icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01" },
    { id: "pricing", icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z M7 7h.01" },
    { id: "customers", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" },
    { id: "expenses", icon: "M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" },
    { id: "reports", icon: "M3 3v18h18 M7 15l3-3 3 2 4-6 M7 19h10" },
    { id: "notepad", icon: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" },
    { id: "calculator", icon: "M4 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2z M8 6h8 M16 14v4 M16 10h0.01 M12 10h0.01 M8 10h0.01 M12 14h0.01 M8 14h0.01 M12 18h0.01 M8 18h0.01" },
    { id: "settings", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z M12 8a4 4 0 100 8 4 4 0 000-8z" },
  ];

  const notepadIcon = "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8";
  const defaultUtilityIds = DEFAULT_NAV_UTILITY_IDS;
  const navRank = new Map((Array.isArray(settings.navOrder) ? settings.navOrder : []).map((id, index) => [id, index]));
  const orderedNavItems = [...navItems].sort((a, b) => (navRank.has(a.id) ? navRank.get(a.id) : navItems.findIndex((n) => n.id === a.id) + 1000) - (navRank.has(b.id) ? navRank.get(b.id) : navItems.findIndex((n) => n.id === b.id) + 1000));
  const utilityIds = Array.isArray(settings.navUtilityIds) ? settings.navUtilityIds : defaultUtilityIds;
  const utilityIdSet = new Set(utilityIds);
  const hiddenNavIds = Array.isArray(settings.hiddenNavIds) ? settings.hiddenNavIds : [];
  const hiddenNavIdSet = new Set(hiddenNavIds.filter((id) => id !== "settings"));
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
  const navLabels = {
    dashboard: "Dashboard",
    inventory: "Inventory",
    sales: "Sales",
    pricing: "Market Review",
    customers: "Customers",
    expenses: "Subscriptions",
    reports: "Reports",
    notepad: "Notepad",
    calculator: "Calculator",
    settings: "Settings",
  };
  const visibleNavItems = orderedNavItems.filter((n) => !hiddenNavIdSet.has(n.id));
  const mainNavItems = visibleNavItems.filter((n) => !utilityIdSet.has(n.id));
  const utilityNavItems = visibleNavItems.filter((n) => utilityIdSet.has(n.id));
  const navSettingsItems = orderedNavItems.map((n) => ({ id: n.id, label: navLabels[n.id] || n.id }));
  const mobilePrimaryNavIds = ["dashboard", "inventory", "sales", "customers", "reports"];
  const mobilePrimaryNavItems = visibleNavItems.filter((n) => mobilePrimaryNavIds.includes(n.id));
  const mobileMoreNavItems = visibleNavItems.filter((n) => !mobilePrimaryNavIds.includes(n.id));
  const activeNavId = page === "subs" ? "expenses" : ["health", "backup"].includes(page) ? "settings" : page;
  const mobileMoreActive = mobileMoreNavItems.some((n) => n.id === activeNavId);
  // Alert severity per nav item: 3 = critical (red), 2 = warning (amber), 1 = info (blue), 0 = none.
  const navAlertSeverity = (id) => {
    if (id === "settings" && (health.issues > 0 || health.warnings > 0 || health.actions > 0)) {
      return health.issues > 0 ? 3 : health.warnings > 0 ? 2 : 1;
    }
    if (id === "expenses" && subStats.overdue.length > 0) return 3;
    if (id === "dashboard" && upcomingPreorders.length > 0) return 1;
    return 0;
  };
  const severityColor = (s) => (s >= 3 ? "#ef4444" : s === 2 ? "#f59e0b" : s === 1 ? "#60a5fa" : null);
  // Roll hidden (More-menu) nav alerts onto the More button using the highest severity.
  const mobileMoreSeverity = mobileMoreNavItems.reduce((max, n) => Math.max(max, navAlertSeverity(n.id)), 0);
  const mobileMoreAlertColor = severityColor(mobileMoreSeverity);
  const renderNavIcon = (n) => {
    return (
      <svg width={isMobile ? 17 : 18} height={isMobile ? 17 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={n.icon} /></svg>
    );
  };
  const renderNavButton = (n, zone) => (
    <button key={n.id} className={isMobile ? "ad-nav-button" : "ad-nav-button ad-nav-tip"} data-tip={isMobile ? undefined : navLabels[n.id] || n.id} aria-label={navLabels[n.id] || n.id} draggable={!isMobile} onDragStart={(e) => { setNavDragId(n.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", n.id); }} onDragOver={(e) => { if (!isMobile) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={(e) => { e.preventDefault(); const fromId = e.dataTransfer.getData("text/plain") || navDragId; moveNavItem(fromId, n.id, zone); setNavDragId(null); }} onDragEnd={() => setNavDragId(null)} onClick={() => { setPage(n.id === "expenses" ? "subs" : n.id); setMobileNavMoreOpen(false); }} title={`${navLabels[n.id] || n.id}${isMobile ? "" : " - drag to reorder"}`} style={{ width: isMobile ? 42 : 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: navDragId === n.id ? "grabbing" : "pointer", background: activeNavId===n.id?"#1e293b":"transparent", color: activeNavId===n.id?"#60a5fa":"#8b97ad", position: "relative", flexShrink: 0, opacity: navDragId === n.id ? 0.45 : 1 }}>
      {renderNavIcon(n)}
      {severityColor(navAlertSeverity(n.id)) && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: severityColor(navAlertSeverity(n.id)) }} />}
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
    return platforms.map((p) => <PlatformBadge key={p} platform={p} compact style={{ marginLeft: 5 }} />);
  };

  const rowClick = (e, toggleFn, id) => { if (e.target.closest("button") || e.target.tagName === "INPUT") return; toggleFn(id); };

  const pagePad = isMobile ? "14px 12px" : "20px 24px";
  const inventoryGridColumns = "48px minmax(220px, 1.45fr) minmax(90px, 0.6fr) minmax(100px, 0.7fr) 64px 92px 104px 44px 112px";
  const salesGridColumns = "48px minmax(240px, 1.45fr) minmax(95px, 0.62fr) 70px 112px 96px 96px 96px 104px";
  const expenseGridColumns = "48px minmax(220px, 1.35fr) minmax(130px, 0.75fr) minmax(130px, 0.75fr) 100px 112px 104px";
  const rowBg = (_index, selected = false) => selected ? "#1e293b" : "#121a2b";
  const groupAccent = { boxShadow: "inset 3px 0 0 #2563eb66" };
  const childAccent = { boxShadow: "inset 3px 0 0 #232c3c" };
  const selectedAccent = (selected, accent = null) => selected
    ? { boxShadow: accent ? `inset 2px 0 0 #2563eb, ${accent.boxShadow}` : "inset 2px 0 0 #2563eb" }
    : (accent || {});
  const rowActionButton = { padding: "4px 7px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" };
  const moreActionButton = { ...rowActionButton, width: 28, padding: "4px 0", color: "#aebbd0", fontSize: 14, lineHeight: 1 };
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
    return sizes.sort((a, b) => compareSizeValues(a, b, items[0]?.category || "")).join(", ");
  };

  // ─── Inventory row (mobile + desktop) ───
  const sampleTag = (record) => isDemoRecord(record) ? (
    <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: "#241a08", border: "1px solid #92400e66", color: "#fbbf24", fontSize: 11, fontWeight: 800, letterSpacing: 0.3, verticalAlign: "middle", whiteSpace: "nowrap" }}>SAMPLE</span>
  ) : null;

  const invRow = (item, isGroupChild, index = 0) => {
    const buyerMatchCount = buyerMatchesByInventoryId.get(item.id)?.length || 0;
    if (isMobile) {
      return (
        <div key={item.id} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ padding: isGroupChild ? "10px 12px 10px 28px" : "10px 12px", borderBottom: "1px solid #232c3c22", background: rowBg(index, selectedInv.has(item.id)), cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", ...(isGroupChild ? childAccent : {}) }}>
          <div style={{ width: 44, height: 44, margin: "-9px 0 -9px -10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={{ ...cb, width: 20, height: 20 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{item.name}{renderPreBadge(item)}{sampleTag(item)}{buyerMatchCount > 0 && <span style={badge("#17331f","#86efac")}>{buyerMatchCount} buyer{buyerMatchCount === 1 ? "" : "s"}</span>}</span>
              <span style={{ color: "#f3f6fb", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(item.price)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#7c8aa0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.category} · {item.size||"OS"}{item.brand?` · ${item.brand}`:""} · {item.purchaseDate}
                </div>
                {sortedListedPlatformsFor(item).length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>{renderListingBadges(item)}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                <button onClick={() => setSellOpen(item)} style={{ ...ghostBtn, minHeight: 38, padding: "9px 14px", borderRadius: 6, fontSize: 12, color: "#93c5fd", fontWeight: 700 }}>Sell</button>
                <button onClick={() => setEditInvOpen(item)} style={{ minHeight: 38, padding: "9px 14px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Edit</button>
                <button aria-label={`Delete ${item.name}`} title="Delete" onClick={() => setConfirmDel({ type: "inv", id: item.id, name: item.name })} style={{ minHeight: 38, padding: "9px 14px", background: "#232c3c", color: "#f87171", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={item.id} className="archive-data-row" data-selected={selectedInv.has(item.id)} onClick={(e) => rowClick(e, toggleSel, item.id)} style={{ display: "grid", gridTemplateColumns: inventoryGridColumns, gap: 8, padding: isGroupChild ? "8px 16px 8px 46px" : "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #232c3c", background: rowBg(index, selectedInv.has(item.id)), cursor: "pointer", ...selectedAccent(selectedInv.has(item.id), isGroupChild ? childAccent : null), zIndex: rowMenuOpen === `inv:${item.id}` ? 4 : undefined }}>
        <input type="checkbox" checked={selectedInv.has(item.id)} onChange={() => toggleSel(item.id)} style={cb} />
        <div style={{ overflow: "hidden" }}><div style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}{renderPreBadge(item)}{sampleTag(item)}{buyerMatchCount > 0 && <span style={badge("#17331f","#86efac")}>{buyerMatchCount} buyer{buyerMatchCount === 1 ? "" : "s"}</span>}</div>{item.brand && <div style={{ fontSize: 11, color: "#7c8aa0" }}>{item.brand}</div>}</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-start" }}>{renderListingBadges(item)}</div>
        <span style={{ color: "#9ca3af", fontSize: 12, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.category}</span>
        <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 500, textAlign: "left" }}>{item.size||"OS"}</span>
        <span style={{ color: "#f3f6fb", fontWeight: 500, textAlign: "right" }}>{currency(item.price)}</span>
        <span style={{ color: "#7c8aa0", fontSize: 11, textAlign: "center" }}>{item.purchaseDate}</span>
        <span style={{ color: "#7c8aa0", fontSize: 11, textAlign: "right" }}>1</span>
        <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
          <button onClick={() => setSellOpen(item)} style={{ ...rowActionButton, color: "#93c5fd", fontWeight: 700 }}>Sell</button>
          <div className="archive-row-actions">
            <button onClick={() => setEditInvOpen(item)} style={rowActionButton}>Edit</button>
            <div className="archive-row-action-wrap">
              <button aria-label={`More actions for ${item.name}`} aria-expanded={rowMenuOpen === `inv:${item.id}`} onClick={() => setRowMenuOpen((open) => open === `inv:${item.id}` ? null : `inv:${item.id}`)} style={moreActionButton}>...</button>
              {rowMenuOpen === `inv:${item.id}` && <div className="archive-row-menu">
                <button onClick={() => { duplicateItem(item); setRowMenuOpen(null); }} style={{ ...rowActionButton, color: "#c4b5fd" }}>Duplicate</button>
                <button onClick={() => { setConfirmDel({ type: "inv", id: item.id, name: item.name }); setRowMenuOpen(null); }} style={{ ...rowActionButton, color: "#f87171" }}>Delete</button>
              </div>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Group row (mobile + desktop) ───
  const groupRow = (item, isExpanded, key, index = 0) => {
    const groupChecked = item._items?.length > 0 && item._items.every((i) => selectedInv.has(i.id));
    const groupSelectionCount = item._items?.filter((i) => selectedInv.has(i.id)).length || 0;
    const groupIndeterminate = groupSelectionCount > 0 && !groupChecked;
    if (isMobile) {
      return (
        <div onClick={() => toggleGroup(key)} style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: rowBg(index, false), borderBottom: "1px solid #232c3c22", ...groupAccent }}>
          <div onClick={(e) => { e.stopPropagation(); toggleGroupSelection(item._items || []); }} style={{ width: 44, height: 44, margin: "-9px 0 -9px -10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><input ref={(node) => { if (node) node.indeterminate = groupIndeterminate; }} type="checkbox" checked={groupChecked} onChange={(e) => { e.stopPropagation(); toggleGroupSelection(item._items || []); }} onClick={(e) => e.stopPropagation()} style={{ ...cb, width: 20, height: 20 }} /></div>
          <span style={{ color: "#7c8aa0", fontSize: 12, width: 12 }}>{isExpanded ? "▾" : "▸"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13 }}>{item.name}{renderPreBadge(item)}</span>
              <span style={{ color: "#f3f6fb", fontWeight: 600, fontSize: 13 }}>{currency(item._totalValue)}</span>
            </div>
            <div style={{ fontSize: 11, color: "#7c8aa0", marginTop: 3 }}>{item.category} · {groupSizeLabel(item._items || [])}{item.brand?` · ${item.brand}`:""} · {item._count} units</div>
          </div>
        </div>
      );
    }
    return (
      <div className="archive-data-row" data-selected={groupChecked} onClick={() => toggleGroup(key)} style={{ display: "grid", gridTemplateColumns: inventoryGridColumns, gap: 8, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #232c3c", cursor: "pointer", background: rowBg(index, groupChecked), ...selectedAccent(groupChecked, groupAccent) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <input ref={(node) => { if (node) node.indeterminate = groupIndeterminate; }} type="checkbox" checked={groupChecked} onChange={(e) => { e.stopPropagation(); toggleGroupSelection(item._items || []); }} onClick={(e) => e.stopPropagation()} style={cb} />
          <span style={{ color: "#7c8aa0", fontSize: 11 }}>{isExpanded ? "▾" : "▸"}</span>
        </div>
        <div><span style={{ color: "#e5e7eb" }}>{item.name}{renderPreBadge(item)}</span>{item.brand&&<div style={{ fontSize: 11, color: "#7c8aa0" }}>{item.brand}</div>}</div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "flex-start" }}>{renderListingBadges(item)}</div>
        <span style={{ color: "#9ca3af", fontSize: 12, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.category}</span>
        <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 500, textAlign: "left", whiteSpace: "nowrap" }}>{groupSizeLabel(item._items || [])}</span>
        <span style={{ color: "#f3f6fb", fontWeight: 500, textAlign: "right" }}>{currency(item._totalValue)}</span>
        <span style={{ color: "#7c8aa0", fontSize: 11, textAlign: "center" }}>{groupDateLabel(item._items || [])}</span>
        <span style={{ color: "#7c8aa0", fontSize: 11, textAlign: "right" }}>{item._count}</span>
        <span aria-hidden="true" />
      </div>
    );
  };

  // ─── Sales row (mobile + desktop) ───
  const saleRow = (s, index = 0) => {
    const saleKey = s._saleKey || s.id;
    const saleSelected = selectedSales.has(saleKey);
    const saleBackground = saleSelected ? "#24324a" : rowBg(index, false);
    if (isMobile) {
      return (
        <div key={saleKey} onClick={(e) => rowClick(e, toggleSelSale, saleKey)} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c22", background: saleBackground, cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", ...selectedAccent(saleSelected) }}>
          <div style={{ width: 44, height: 44, margin: "-9px 0 -9px -10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><input type="checkbox" checked={saleSelected} onChange={() => toggleSelSale(saleKey)} style={{ ...cb, width: 20, height: 20 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.name}{sampleTag(s)}</span>
              <span style={{ color: "#f3f6fb", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(s.salePrice)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#7c8aa0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                <PlatformBadge platform={s.platform} compact style={{ marginRight: 5 }} /> {recordPaymentMethod(s)} · {s.category} · {s.saleDate}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                <span style={{ color: s.profit>=0?"#34d399":"#f87171", fontWeight: 600, fontSize: 12, marginRight: 2 }}>{currency(s.profit)}</span>
                <button onClick={() => setEditSaleOpen(s)} style={{ minHeight: 38, padding: "9px 14px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Edit</button>
                <button aria-label={`Delete ${s.name}`} title="Delete" onClick={() => setConfirmDel({ type: "sale", id: s.id, saleKey, name: s.name })} style={{ minHeight: 38, padding: "9px 14px", background: "#232c3c", color: "#f87171", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={saleKey} className="archive-data-row" data-selected={saleSelected} onClick={(e) => rowClick(e, toggleSelSale, saleKey)} style={{ display: "grid", gridTemplateColumns: salesGridColumns, gap: 8, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #232c3c", background: saleBackground, cursor: "pointer", ...selectedAccent(saleSelected), zIndex: rowMenuOpen === `sale:${saleKey}` ? 4 : undefined }}>
        <input type="checkbox" checked={saleSelected} onChange={() => toggleSelSale(saleKey)} style={cb} />
        <div><span style={{ color: "#e5e7eb" }}>{s.name}{sampleTag(s)}</span><div style={{ fontSize: 11, color: "#8b97ad" }}>{s.category} · {recordPaymentMethod(s)}{s.brand?` · ${s.brand}`:""}{s.customer?` · ${s.customer}`:""}{s.purchaseDate?` · bought ${s.purchaseDate}`:""}</div></div>
        <span style={{ color: "#9ca3af", fontSize: 12, textAlign: "left" }}><PlatformBadge platform={s.platform} /></span>
        <span style={{ color: "#60a5fa", fontSize: 12, textAlign: "left" }}>{s.size||"OS"}</span>
        <span style={{ color: "#7c8aa0", fontSize: 11, textAlign: "center" }}>{s.saleDate}</span>
        <span style={{ color: "#7c8aa0", fontSize: 12, textAlign: "right" }}>{currency(s.costPrice)}</span>
        <span style={{ color: "#f3f6fb", fontWeight: 500, fontSize: 12, textAlign: "right" }}>{currency(s.salePrice)}</span>
        <span style={{ color: s.profit>=0?"#34d399":"#f87171", fontWeight: 600, fontSize: 12, textAlign: "right" }}>{currency(s.profit)}</span>
        <div className="archive-row-actions">
          <button onClick={() => setEditSaleOpen(s)} style={rowActionButton}>Edit</button>
          <div className="archive-row-action-wrap">
            <button aria-label={`More actions for ${s.name}`} aria-expanded={rowMenuOpen === `sale:${saleKey}`} onClick={() => setRowMenuOpen((open) => open === `sale:${saleKey}` ? null : `sale:${saleKey}`)} style={moreActionButton}>...</button>
            {rowMenuOpen === `sale:${saleKey}` && <div className="archive-row-menu">
              <button onClick={() => { setConfirmDel({ type: "sale", id: s.id, saleKey, name: s.name }); setRowMenuOpen(null); }} style={{ ...rowActionButton, color: "#f87171" }}>Delete</button>
            </div>}
          </div>
        </div>
      </div>
    );
  };

  // ─── Expense row (mobile + desktop) ───
  const expRow = (e, index = 0) => {
    if (isMobile) {
      return (
        <div key={e.id} onClick={(ev) => rowClick(ev, toggleSelExp, e.id)} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c22", background: rowBg(index, selectedExp.has(e.id)), cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 44, height: 44, margin: "-9px 0 -9px -10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><input type="checkbox" checked={selectedExp.has(e.id)} onChange={() => toggleSelExp(e.id)} style={{ ...cb, width: 20, height: 20 }} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3, alignItems: "baseline" }}>
              <span style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{e.name}</span>
              <span style={{ color: "#f3f6fb", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{currency(e.amount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#7c8aa0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{e.expCategory || "Other"} · {recordPaymentMethod(e)} · {e.purchaseDate}</div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => setEditExpOpen(e)} style={{ minHeight: 38, padding: "9px 14px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Edit</button>
                <button aria-label={`Delete ${e.name}`} title="Delete" onClick={() => setConfirmDel({ type: "exp", id: e.id, name: e.name })} style={{ minHeight: 38, padding: "9px 14px", background: "#232c3c", color: "#f87171", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div key={e.id} className="archive-data-row" data-selected={selectedExp.has(e.id)} onClick={(ev) => rowClick(ev, toggleSelExp, e.id)} style={{ display: "grid", gridTemplateColumns: expenseGridColumns, gap: 8, padding: "11px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #232c3c", background: rowBg(index, selectedExp.has(e.id)), cursor: "pointer", ...selectedAccent(selectedExp.has(e.id)), zIndex: rowMenuOpen === `exp:${e.id}` ? 4 : undefined }}>
        <input type="checkbox" checked={selectedExp.has(e.id)} onChange={() => toggleSelExp(e.id)} style={cb} />
        <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>{e.tags&&<div style={{ fontSize: 11, color: "#8b97ad", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.tags}</div>}</div>
        <span style={{ color: "#9ca3af", fontSize: 11 }}>{e.expCategory || "Other"}</span>
        <span style={{ color: "#9ca3af", fontSize: 11 }}>{recordPaymentMethod(e)}</span>
        <span style={{ color: "#f3f6fb", fontWeight: 500, textAlign: "right" }}>{currency(e.amount)}</span>
        <span style={{ color: "#7c8aa0", fontSize: 12, textAlign: "center" }}>{e.purchaseDate}</span>
        <div className="archive-row-actions">
          <button onClick={() => setEditExpOpen(e)} style={rowActionButton}>Edit</button>
          <div className="archive-row-action-wrap">
            <button aria-label={`More actions for ${e.name}`} aria-expanded={rowMenuOpen === `exp:${e.id}`} onClick={() => setRowMenuOpen((open) => open === `exp:${e.id}` ? null : `exp:${e.id}`)} style={moreActionButton}>...</button>
            {rowMenuOpen === `exp:${e.id}` && <div className="archive-row-menu">
              <button onClick={() => { setConfirmDel({ type: "exp", id: e.id, name: e.name }); setRowMenuOpen(null); }} style={{ ...rowActionButton, color: "#f87171" }}>Delete</button>
            </div>}
          </div>
        </div>
      </div>
    );
  };

  const ebayQueuePanel = () => (
    <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: "#f3f6fb", fontWeight: 700 }}>eBay awaiting postage</div>
          <div style={{ fontSize: 12, color: "#7c8aa0" }}>Review synced eBay orders before they become sales.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={async () => { setEbayQueueOpen(true); await syncEbayOrders(); }} disabled={ebayBusy} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sync eBay</button>
          <button onClick={loadEbayImports} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Refresh queue</button>
          <button onClick={() => setEbayQueueOpen(false)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Hide</button>
        </div>
      </div>
      {ebayStatus && <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 10 }}>{ebayStatus}</div>}
      {ebayImports.length === 0 ? (
        <div style={{ fontSize: 12, color: "#8b97ad", padding: "10px 0" }}>No eBay sale drafts loaded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflow: "auto" }}>
          {ebayImports.map((draft) => {
            const matches = findEbayMatches(draft);
            const best = matches[0];
            const qty = Math.max(1, Number(draft.quantity || 1));
            const canRecord = !!best && matches.length >= qty;
            const reviewWarning = ebayReviewWarnings[draft.id] || (!canRecord ? "Not enough matching inventory - edit the item name or record manually." : "");
            return (
              <div key={draft.id} style={{ border: "1px solid #232c3c", borderRadius: 8, padding: "9px 10px", background: "#0d1117" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.item_title}</div>
                    <div style={{ color: "#7c8aa0", fontSize: 11 }}>{draft.sale_date || "No date"} · qty {draft.quantity || 1} · {draft.buyer_username || "Unknown buyer"}{draft.order_id ? ` · ${draft.order_id}` : ""}</div>
                  </div>
                  <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 700 }}>{currency(draft.sale_price)}</div>
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
                {reviewWarning && <div role="status" style={{ marginTop: 8, padding: "7px 9px", borderRadius: 6, background: "#241a08", border: "1px solid #92400e66", color: "#fbbf24", fontSize: 11, lineHeight: 1.4 }}>{reviewWarning}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const gmailQueuePanel = () => (
    <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, color: "#f3f6fb", fontWeight: 700 }}>Gmail inventory drafts</div>
          <div style={{ fontSize: 12, color: "#7c8aa0" }}>Review purchase confirmations before they become inventory.</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={async () => { setGmailQueueOpen(true); await syncGmailInventory(); }} disabled={gmailBusy} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sync Gmail</button>
          <button onClick={loadGmailImports} disabled={gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Refresh queue</button>
          <button onClick={() => setGmailQueueOpen(false)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Hide</button>
        </div>
      </div>
      {gmailStatus && <div style={{ fontSize: 12, color: "#93c5fd", marginBottom: 10 }}>{gmailStatus}</div>}
      {gmailImports.length === 0 ? (
        <div style={{ fontSize: 12, color: "#8b97ad", padding: "10px 0" }}>No Gmail inventory drafts loaded.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflow: "auto" }}>
          {gmailImports.map((draft) => (
            <div key={draft.id} style={{ border: "1px solid #232c3c", borderRadius: 8, padding: "9px 10px", background: "#0d1117" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.item_title}</div>
                  <div style={{ color: "#7c8aa0", fontSize: 11 }}>{draft.email_date || "No date"} · qty {draft.quantity || 1} · {draft.vendor || draft.sender || "Unknown source"}</div>
                </div>
                <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 700 }}>{currency(draft.total_cost || draft.unit_cost)}</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #232c3c", fontSize: 11, color: "#7c8aa0", background: "#0d1117" }}>
      <div onClick={toggleFn} style={{ width: 44, height: 44, margin: "-8px 0 -8px -12px", display: "flex", alignItems: "center", justifyContent: "center" }}><input type="checkbox" checked={allSelected} onChange={toggleFn} onClick={(e) => e.stopPropagation()} style={{ ...cb, width: 20, height: 20 }} /></div>
      <span>Select all ({count})</span>
    </div>
  );
  const failedSaveLabels = [...new Set([...failedSaves.values()].map((failure) => failure.label || "Data"))];
  const saveBannerText = failedSaveLabels.length === 1 ? `${failedSaveLabels[0]} did not save.` : `${failedSaveLabels.length} areas did not save.`;
  const visibleSaveStatus = failedSaves.size ? "error" : saveStatus;

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", background: "#0b0f19", color: "#e5e7eb", fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <style>{`.np-edit ul,.np-edit ol{padding-left:24px;margin:6px 0}.np-edit li{margin:3px 0}.np-edit input[type="checkbox"]{margin-right:6px;cursor:pointer;accent-color:#2563eb;vertical-align:middle}.np-edit label{display:inline-flex;align-items:flex-start;gap:6px;cursor:default}.np-edit label input[type="checkbox"]:checked + *,.np-edit input[type="checkbox"]:checked ~ *{opacity:0.55}`}</style>
      {/* SIDEBAR */}
      <div style={isMobile ? { position: "fixed", left: 0, right: 0, bottom: 0, height: 58, background: "#0b0f19", borderTop: "1px solid #232c3c", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-around", padding: "6px 8px", gap: 1, zIndex: 140, boxSizing: "border-box" } : { width: 54, height: "100vh", position: "sticky", top: 0, zIndex: 120, overflow: "visible", background: "#0b0f19", borderRight: "1px solid #232c3c", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 2, flexShrink: 0, boxSizing: "border-box" }}>
        {!isMobile && <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 15, fontWeight: 800, color: "#fff" }}>A</div>}
        {(isMobile ? mobilePrimaryNavItems : mainNavItems).map((n) => renderNavButton(n, "main"))}
        {isMobile && mobileMoreNavItems.length > 0 && (
          <>
            <button
              onClick={() => setMobileNavMoreOpen((v) => !v)}
              title="More"
              aria-label={mobileMoreAlertColor ? "More (alerts need attention)" : "More"}
              style={{ width: 42, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", background: mobileMoreActive || mobileNavMoreOpen ? "#1e293b" : "transparent", color: mobileMoreActive || mobileNavMoreOpen ? "#60a5fa" : "#8b97ad", position: "relative", flexShrink: 0 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12h.01 M19 12h.01 M5 12h.01" /></svg>
              {mobileMoreAlertColor && !mobileNavMoreOpen && <span style={{ position: "absolute", top: 4, right: 4, width: 7, height: 7, borderRadius: "50%", background: mobileMoreAlertColor }} />}
            </button>
            {mobileNavMoreOpen && (
              <div style={{ position: "fixed", left: 10, right: 10, bottom: 66, zIndex: 160, background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 8, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, boxShadow: "0 -12px 28px rgba(0,0,0,0.36)" }}>
                {mobileMoreNavItems.map((n) => (
                  <button key={n.id} onClick={() => { setPage(n.id === "expenses" ? "subs" : n.id); setMobileNavMoreOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, padding: "9px 10px", borderRadius: 8, border: "1px solid #232c3c", background: activeNavId === n.id ? "#1e293b" : "#0d1117", color: activeNavId === n.id ? "#93c5fd" : "#d1d5db", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={n.icon} /></svg>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{navLabels[n.id] || n.id}</span>
                    {severityColor(navAlertSeverity(n.id)) && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: severityColor(navAlertSeverity(n.id)), flexShrink: 0 }} />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        {!isMobile && <div onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); moveNavItem(e.dataTransfer.getData("text/plain") || navDragId, null, "utility"); setNavDragId(null); }} title="Drop here to move below the separator" style={{ width: 24, height: 1, background: navDragId ? "#60a5fa" : "#232c3c", margin: "9px 0 7px", opacity: navDragId ? 1 : 0.9 }} />}
        {!isMobile && utilityNavItems.map((n) => renderNavButton(n, "utility"))}
      </div>

      <div style={{ flex: 1, overflow: "auto", minWidth: 0, paddingBottom: isMobile ? 66 : 0 }}>
        <TopBar saveStatus={visibleSaveStatus} isMobile={isMobile} />
        {failedSaves.size > 0 && (
          <div style={{ position: "sticky", top: 32, zIndex: 89, background: "#3b1f1f", borderBottom: "1px solid #7f1d1d", padding: isMobile ? "9px 12px" : "9px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#fca5a5", fontSize: 12, fontWeight: 800 }}>{saveBannerText}</div>
              <div style={{ color: "#fecaca", fontSize: 11, marginTop: 2 }}>Your changes are still in this tab. Retry before closing or refreshing.</div>
            </div>
            <button onClick={retryFailedSaves} disabled={retryingSaves} style={{ ...primaryBtn, background: retryingSaves ? "#56627a" : "#dc2626", padding: "7px 12px", fontSize: 12, opacity: retryingSaves ? 0.75 : 1 }}>
              {retryingSaves ? "Retrying..." : "Retry all"}
            </button>
          </div>
        )}

        {/* SAMPLE DATA BANNER */}
        {hasSampleData && (
          <div style={{ margin: pagePad, marginBottom: 0, background: "#241a08", border: "1px solid #92400e66", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700 }}>Sample data is loaded. These records are tagged SAMPLE and are not real sales.</span>
            <button onClick={removeSampleData} style={{ ...ghostBtn, padding: "6px 12px", fontSize: 12, color: "#fca5a5" }}>Remove sample data</button>
          </div>
        )}

        {/* FIRST-RUN / EMPTY INSTALL */}
        {page === "dashboard" && isFirstRun && (
          <div style={{ padding: pagePad, paddingBottom: 0 }}>
            <EmptyState
              title="Welcome to ArchiveDash"
              hint="Start tracking your reseller P&L right away, or explore the dashboard with sample inventory, sales, and expenses you can remove anytime."
              actions={[
                { label: "Explore with sample data", primary: true, onClick: loadSampleData },
                { label: "Start clean", onClick: dismissFirstRun },
              ]}
            />
          </div>
        )}

        {/* DASHBOARD */}
        {page === "dashboard" && <DashboardHomePage ctx={{ pagePad, isMobile, inventory, stats, velocityStats, inventoryProductCount, dashboardCustomizeOpen, setDashboardCustomizeOpen, range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, dashCat, setDashCat, dashPlat, CATS, PLATS, dashboardCards, dashboardCardLabels, setDashboardCard, settings, persistSettings, upcomingPreorderGroups, upcomingPreorders, setPage, setInvPreorderView, setInvStatus, setInvSort, agingStats, subStats, fxRates, logAllOverdue, periodComparison, periodTrend, renderPreBadge }} />}
        {/* INVENTORY */}
        {page === "inventory" && <InventoryPage ctx={{ pagePad, inventory, selectedInv, setBulkSellOpen, setBulkEditOpen, setConfirmDel, CATS, listingPlatforms, openAddInventory, gmailQueueOpen, gmailQueuePanel, invSearch, setInvSearch, invCat, setInvCat, invPreorderView, setInvPreorderView, invStatus, setInvStatus, invSort, setInvSort, invCollapse, setInvCollapse, filteredInv, selectedValue, preorderInvCount, availableInvCount, listedInvCount, facebookListedInvCount, ebayExportStatus, handleEbayPartnerExport, buyerNotifyStatus, handleBuyerNotifyExport, selectedBuyerNotifyCount, isMobile, toggleAll, mobileSelectAll, groupedInv, invRow, expandedGroups, groupRow }} />}

        {/* SALES */}
        {page === "sales" && <SalesPage ctx={{ pagePad, sales, stats, saleProfit, selectedSales, setAddSaleOpen, setBulkEditSaleOpen, setConfirmDel, ebayQueueOpen, ebayQueuePanel, saleSearch, setSaleSearch, saleCat, setSaleCat, CATS, salePlat, setSalePlat, PLATS, salePayment, setSalePayment, PAYMETHODS, saleSort, setSaleSort, filteredSales, selectedSalesRevenue, selectedSalesProfit, isMobile, toggleAllSales, mobileSelectAll, saleRow }} />}

        {/* PRICING */}
        {page === "pricing" && <PricingPage ctx={{ pagePad, inventory, isMobile, connectEbay }} />}

        {/* CUSTOMERS */}
        {page === "customers" && <CustomersPage ctx={{ pagePad, isMobile, customerRows, customerSearch, setCustomerSearch, customerPlatform, setCustomerPlatform, customerSort, setCustomerSort, activeCustomerKey, setActiveCustomerKey, updateCustomerProfile, addCustomer, removeCustomer, setAddSaleOpen, settings, persistSettings }} />}

        {/* REPORTS */}
        {page === "reports" && <ReportsPage ctx={{ pagePad, isMobile, range, setRange, customFrom, setCustomFrom, customTo, setCustomTo, dashCat, setDashCat, dashPlat, setDashPlat, reportPaymentMode, setReportPaymentMode, reportPaymentMethods, setReportPaymentMethods, toggleReportPaymentMethod, CATS, PLATS, PAYMETHODS, reportStats, velocityStats, agingStats, exportReportCSV }} />}

        {/* ══ EXPENSES ══ */}
        {page === "expenses" && (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Expenses</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>This month: {expenseMonthSummary.count} expenses - {currency(expenseMonthSummary.amount)}{subStats.overdue.length ? ` - ${subStats.overdue.length} overdue subscription${subStats.overdue.length === 1 ? "" : "s"}` : ""}</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedExp.size > 0 && <><button onClick={() => setBulkEditExpOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedExp.size}</button><button onClick={deleteSelectedExp} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedExp.size}</button></>}
              <button onClick={() => { setExpForm(emptyExp); setAddExpOpen(true); }} style={primaryBtn}>+ Add expense</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("subs")} style={ghostBtn}>Subscriptions{subStats.overdue.length > 0 ? ` (${subStats.overdue.length})` : ""}</button>
            <button onClick={() => setPage("expenses")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>Expenses</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search..." value={expSearch} onChange={(e) => setExpSearch(e.target.value)} style={{ ...inp, maxWidth: 180 }} />
            <select value={expCatFilter} onChange={(e) => setExpCatFilter(e.target.value)} style={{ ...sel, maxWidth: 200 }}><option value="All">All Categories</option>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={expPayment} onChange={(e) => setExpPayment(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All Payments</option>{PAYMETHODS.map((p) => <option key={p}>{p}</option>)}</select>
            {isMobile && <select aria-label="Sort expenses" value={expSort} onChange={(e) => setExpSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option><option value="amount_desc">Price ↓</option><option value="amount_asc">Price ↑</option></select>}
            <span style={{ fontSize: 12, color: "#7c8aa0" }}>From</span><input type="date" value={expFrom} onChange={(e) => setExpFrom(e.target.value)} style={{ ...inp, maxWidth: 140 }} />
            <span style={{ fontSize: 12, color: "#7c8aa0" }}>To</span><input type="date" value={expTo} onChange={(e) => setExpTo(e.target.value)} style={{ ...inp, maxWidth: 140 }} />
            {(expSearch||expFrom||expTo||expCatFilter!=="All"||expPayment!=="All"||expSort!=="date_desc")&&<button onClick={() => { setExpSearch(""); setExpFrom(""); setExpTo(""); setExpCatFilter("All"); setExpPayment("All"); setExpSort("date_desc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b97ad" }}>{filteredExp.length}{selectedExp.size>0&&` · ${selectedExp.size} selected · ${currency(selectedExpValue)}`} · {currency(filteredExp.reduce((a, e) => a + e.amount, 0))}</span>
          </div>
          <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", overflow: "hidden" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: expenseGridColumns, gap: 8, padding: "10px 16px", fontSize: 11, color: "#8b97ad", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #232c3c", fontWeight: 600, alignItems: "center", background: "#121a2b" }}>
                <input type="checkbox" checked={selectedExp.size===filteredExp.length&&filteredExp.length>0} onChange={toggleAllExp} style={cb} />
                <span>Name</span><span>Category</span><span>Payment</span><span style={{ textAlign: "right" }}>Price</span><span style={{ textAlign: "center" }}>Date</span><span style={{ textAlign: "center" }}>Actions</span>
              </div>
            )}
            {mobileSelectAll(selectedExp.size===filteredExp.length&&filteredExp.length>0, toggleAllExp, filteredExp.length)}
            {filteredExp.length === 0 && (expenses.length > 0 ? <div style={{ padding: 36, textAlign: "center", color: "#8b97ad", fontSize: 13 }}>No expenses match these filters.<button onClick={() => { setExpSearch(""); setExpFrom(""); setExpTo(""); setExpCatFilter("All"); setExpPayment("All"); setExpSort("date_desc"); }} style={{ ...ghostBtn, display: "block", margin: "10px auto 0", padding: "5px 12px", fontSize: 11 }}>Clear filters</button></div> : <div style={{ padding: 36, textAlign: "center", color: "#8b97ad", fontSize: 13 }}>No expenses yet</div>)}
            {filteredExp.map((e, idx) => expRow(e, idx))}
          </div>
        </div>)}

        {/* ══ SUBSCRIPTIONS ══ */}
        {page === "subs" && <SubscriptionsPage ctx={{ pagePad, isMobile, subStats, subsCount: subs.length, sortedSubs, subSearch, setSubSearch, subCatFilter, setSubCatFilter, subSort, setSubSort, setPage, setSubModalOpen, logSub, logAllOverdue, toggleSubActive, setConfirmDel, fxRates }} />}

        {/* ══ NOTEPAD (full page) ══ */}
        {page === "notepad" && <NotepadPage ctx={{ pagePad, isMobile, notes, activeNote, activeNoteId, setActiveNoteId, noteSearch, setNoteSearch, sortedNotes, createNote, updateNote, moveNote, toggleLockNote, togglePinNote, setConfirmDel, userTemplates, setTplManagerOpen, exportNoteTxt }} />}

        {/* ══ CALCULATOR ══ */}
        {page === "calculator" && <Calculator isMobile={isMobile} />}

        {/* ?? HEALTH ?? */}
        {page === "health" && (<div style={{ padding: pagePad, maxWidth: 1120 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Settings</h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("settings")} style={ghostBtn}>General</button>
            <button onClick={() => setPage("health")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>System Health</button>
            <button onClick={() => setPage("backup")} style={ghostBtn}>Backup & Restore</button>
          </div>
          <HealthPage ctx={{ pagePad: 0, isMobile, health, loadEbayImports, loadGmailImports, supabase, ebayBusy, gmailBusy, ebayStatus, gmailStatus, ebayImports, gmailImports, setPage, setEbayQueueOpen, setGmailQueueOpen, syncEbayOrders, syncGmailInventory, inventory, sales }} />
        </div>)}

        {/* ══ BACKUP ══ */}
        {page === "backup" && (<div style={{ padding: pagePad, maxWidth: 1120 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Settings</h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button onClick={() => setPage("settings")} style={ghostBtn}>General</button>
            <button onClick={() => setPage("health")} style={ghostBtn}>System Health</button>
            <button onClick={() => setPage("backup")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>Backup & Restore</button>
          </div>
          <BackupPage ctx={{ isMobile, backupStatus, backupSettings, updateBackupSettings, backups, createSupabaseBackup, supabase, inventory, sales, expenses, subs, notes, exportJSON, exportCSV, importBackup, restoreSupabaseBackup, requestReplaceImport, requestClearAll }} />
        </div>)}

        {/* SETTINGS */}
        {page === "settings" && <SettingsPage ctx={{ pagePad, CATS, PLATS, PAYMETHODS, CUSTS, settings, persistSettings, setPage, navSettingsItems, supabase, connectEbay, ebayBusy, ebayStatus, ebayImports, setEbayQueueOpen, loadEbayImports, syncEbayOrders, connectGmail, gmailBusy, gmailStatus, gmailImports, setGmailQueueOpen, loadGmailImports, syncGmailInventory, onLogout, userEmail }} />}
      </div>

      {/* ══ NOTEPAD PANEL ══ */}
      {/* ══ FLOATING NOTEPAD BUTTON — visible on all pages except notepad and when slide-out is open ══ */}
      {!isMobile && page !== "notepad" && !notepadOpen && selectedInv.size === 0 && selectedSales.size === 0 && selectedExp.size === 0 && (
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
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: isMobile ? "100%" : 360, background: "#121a2b", borderLeft: "1px solid #232c3c", zIndex: 150, display: "flex", flexDirection: "column", boxShadow: "-4px 0 20px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #232c3c", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", flexShrink: 0 }}>Notes</span>
            <div style={{ display: "flex", gap: 4, flex: 1, justifyContent: "flex-end" }}>
              <button onClick={() => createNote()} title="New note" style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }}>+</button>
              <button onClick={() => { setPage("notepad"); setNotepadOpen(false); }} title="Open full notepad" style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }}>↗</button>
              <button onClick={() => setNotepadOpen(false)} style={{ background: "none", border: "none", color: "#7c8aa0", fontSize: 16, cursor: "pointer", padding: "0 4px" }}>✕</button>
            </div>
          </div>
          {notes.length > 0 ? (
            <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid #232c3c" }}>
              <select value={activeNoteId || ""} onChange={(e) => setActiveNoteId(e.target.value)} style={{ ...sel, padding: "6px 8px", fontSize: 12 }}>
                {sortedNotes.map((n) => <option key={n.id} value={n.id}>{n.pinned ? "★ " : ""}{n.title || "Untitled"}</option>)}
              </select>
            </div>
          ) : null}
          {activeNote ? (
            <NotepadEditor note={activeNote} onUpdate={(changes) => updateNote(activeNote.id, changes)} showTemplates={!isMobile} isMobile={isMobile} templates={userTemplates || []} compact />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "#8b97ad", textAlign: "center" }}>No notes yet.</div>
              <button onClick={() => createNote()} style={primaryBtn}>+ New note</button>
            </div>
          )}
        </div>
      )}

      {/* ══ MODALS ══ */}
      <Modal open={addInvOpen} onClose={closeAddInventory} guardedClose={guardedCloseAdd} title="Add inventory">
        <Field label="Product name" req><input value={invForm.name} onChange={(e) => updateInvForm({ name: e.target.value })} style={inp} placeholder="e.g. Nike Dunk Low Panda" /></Field>
        <Row cols={3}><Field label="Category" req><select value={invForm.category} onChange={(e) => updateInvForm({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Size"><select value={invForm.size} onChange={(e) => updateInvForm({ size: e.target.value })} style={sel}>{getSizes(invForm.category).map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Cost (AU$)" req><input type="number" step="0.01" value={invForm.price} onChange={(e) => updateInvForm({ price: e.target.value })} style={inp} placeholder="0.00" /></Field></Row>
        <Row><Field label="Brand"><input value={invForm.brand} onChange={(e) => updateInvForm({ brand: e.target.value })} style={inp} placeholder="e.g. Nike" /></Field><Field label="Purchase date"><input type="date" value={invForm.purchaseDate} onChange={(e) => updateInvForm({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
        <Row><Field label="Quantity"><input type="number" min="1" value={invForm.quantity} onChange={(e) => updateInvForm({ quantity: e.target.value })} style={inp} /></Field><Field label="Preorder date"><input type="date" value={invForm.preorderDate} onChange={(e) => updateInvForm({ preorderDate: e.target.value })} style={inp} /></Field></Row>
        <Field label="Listed on"><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{listingPlatforms.map((p) => <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}><input type="checkbox" checked={listedPlatformsFor(invForm).includes(p)} onChange={(e) => { const next = new Set(listedPlatformsFor(invForm)); e.target.checked ? next.add(p) : next.delete(p); updateInvForm({ listedPlatforms: [...next] }); }} style={cb} /> {platformShortName(p)}</label>)}</div></Field>
        {listedPlatformsFor(invForm).some((p) => String(p).toLowerCase().includes("ebay")) && <Field label="eBay listed price (AU$)"><input type="number" step="0.01" value={invForm.ebayListedPrice || ""} onChange={(e) => updateInvForm({ ebayListedPrice: e.target.value })} style={inp} placeholder="Current eBay listing price" /></Field>}
        <Field label="Tags"><input value={invForm.tags} onChange={(e) => updateInvForm({ tags: e.target.value })} style={inp} /></Field>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
          <button onClick={clearInventoryDraft} style={{ ...ghostBtn, color: "#9ca3af", ...(isMobile ? { width: "100%" } : {}) }}>Clear form</button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", flexDirection: isMobile ? "column" : "row", width: isMobile ? "100%" : "auto" }}>
            <button onClick={queueInventoryDraft} style={{ ...ghostBtn, color: "#93c5fd", ...(isMobile ? { width: "100%" } : {}) }}>Queue {parseInt(invForm.quantity, 10)>1?`${invForm.quantity} items`:"item"}</button>
            <button onClick={guardedCloseAdd} style={{ ...ghostBtn, ...(isMobile ? { width: "100%" } : {}) }}>Cancel</button>
            <button onClick={addInventory} style={{ ...primaryBtn, ...(isMobile ? { width: "100%" } : {}) }}>{invQueue.length ? `Add ${invQueue.length} queued` : `Add ${parseInt(invForm.quantity, 10)>1?`${invForm.quantity} items`:"item"}`}</button>
          </div>
        </div>
        {invQueue.length > 0 && (
          <div style={{ marginTop: 14, border: "1px solid #232c3c", borderRadius: 12, overflow: "hidden", background: "#0d1117" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 11px", borderBottom: "1px solid #232c3c" }}>
              <div>
                <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800 }}>Submission queue</div>
                <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 2 }}>{invQueueProductCount} product{invQueueProductCount === 1 ? "" : "s"} - {invQueue.length} unit{invQueue.length === 1 ? "" : "s"} - {currency(invQueueTotal)}</div>
              </div>
              <button onClick={() => { setInvQueue([]); setAddDirty(true); }} style={{ ...ghostBtn, padding: "5px 8px", fontSize: 11, color: "#f87171" }}>Clear queue</button>
            </div>
            <div style={{ maxHeight: 154, overflowY: "auto" }}>
              {invQueue.map((item) => (
                <ResponsiveGrid key={item.id} columns="minmax(0,1fr) 76px 78px 54px" mobileColumns="minmax(0, 1fr) auto" gap={8} style={{ alignItems: "center", padding: "8px 11px", borderTop: "1px solid #232c3c22", fontSize: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#e5e7eb", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.category}{item.brand ? ` - ${item.brand}` : ""}{listedPlatformsFor(item).length ? ` - ${listedPlatformsFor(item).map(platformShortName).join(", ")}` : ""}</div>
                  </div>
                  <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700 }}>{item.size || "OS"}</span>
                  <span style={{ color: "#f3f6fb", fontSize: 12, fontWeight: 700 }}>{currency(item.price)}</span>
                  <button onClick={() => removeQueuedInventory(item.id)} style={{ ...ghostBtn, padding: "4px 7px", fontSize: 11, color: "#f87171" }}>Remove</button>
                </ResponsiveGrid>
              ))}
            </div>
          </div>
        )}
      </Modal>
      <UnsavedDialog open={showUnsavedAdd} onDiscard={() => { closeAddInventory(); setShowUnsavedAdd(false); }} onCancel={() => setShowUnsavedAdd(false)} />

      <Modal open={addExpOpen} onClose={() => setAddExpOpen(false)} title="Create expense">
        <Field label="Name" req><input value={expForm.name} onChange={(e) => setExpForm({ ...expForm, name: e.target.value })} style={inp} placeholder="e.g. eBay Sub" /></Field>
        <Row><Field label="Price (AU$)" req><input type="number" step="0.01" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} style={inp} /></Field><Field label="Date"><input type="date" value={expForm.purchaseDate} onChange={(e) => setExpForm({ ...expForm, purchaseDate: e.target.value })} style={inp} /></Field></Row>
        <Row><Field label="Category"><select value={expForm.expCategory} onChange={(e) => setExpForm({ ...expForm, expCategory: e.target.value })} style={sel}>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Payment method"><select value={expForm.paymentMethod} onChange={(e) => setExpForm({ ...expForm, paymentMethod: e.target.value })} style={sel}>{PAYMETHODS.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
        <Field label="Tags"><input value={expForm.tags} onChange={(e) => setExpForm({ ...expForm, tags: e.target.value })} style={inp} /></Field>
        <ModalActions marginTop={6}><button onClick={() => setAddExpOpen(false)} style={ghostBtn}>Cancel</button><button onClick={async () => { if (!expForm.name||!expForm.amount) return; await persistExp([{ id: genId(), name: expForm.name, amount: parseFloat(expForm.amount), purchaseDate: expForm.purchaseDate, tags: expForm.tags, expCategory: expForm.expCategory, paymentMethod: expForm.paymentMethod || "Other" }, ...expenses]); setExpForm(emptyExp); setAddExpOpen(false); }} style={primaryBtn}>Create</button></ModalActions>
      </Modal>

      {sellOpen && <SellModal item={sellOpen} onSell={(sf) => handleSell(sellOpen, sf)} onClose={() => setSellOpen(null)} platforms={PLATS} customers={CUSTS} paymentMethods={PAYMETHODS} />}
      {addSaleOpen && <ManualSaleModal inventory={inventory} onSell={handleManualSell} onClose={() => setAddSaleOpen(false)} platforms={PLATS} customers={CUSTS} paymentMethods={PAYMETHODS} />}
      {ebayReviewOpen && <EbaySaleReviewModal draft={ebayReviewOpen.draft} items={ebayReviewOpen.items} onRecord={recordEbaySale} onClose={() => setEbayReviewOpen(null)} paymentMethods={PAYMETHODS} />}
      {gmailReviewOpen && <GmailInventoryReviewModal draft={gmailReviewOpen} categories={CATS} onAdd={recordGmailInventory} onClose={() => setGmailReviewOpen(null)} />}
      {editInvOpen && <EditInvModal item={editInvOpen} onSave={async (ef) => { await persistInv(inventory.map((i) => i.id===editInvOpen.id?{...i,...ef}:i)); setEditInvOpen(null); }} onClose={() => setEditInvOpen(null)} categories={CATS} customers={CUSTS} platforms={listingPlatforms} />}
      {editSaleOpen && <EditSaleModal sale={editSaleOpen} onSave={async (u) => { await persistSales(keyedSales.map((s) => stripSaleKey(s._saleKey===editSaleOpen._saleKey ? u : s))); if (u.customer) addCustomer(u.customer); setEditSaleOpen(null); }} onClose={() => setEditSaleOpen(null)} platforms={PLATS} customers={CUSTS} paymentMethods={PAYMETHODS} />}
      {editExpOpen && <EditExpModal expense={editExpOpen} onSave={async (u) => { await persistExp(expenses.map((e) => e.id===editExpOpen.id?u:e)); setEditExpOpen(null); }} onClose={() => setEditExpOpen(null)} paymentMethods={PAYMETHODS} />}
      {bulkEditOpen && <BulkEditModal items={inventory.filter((i) => selectedInv.has(i.id))} onSave={handleBulkEdit} onClose={() => setBulkEditOpen(false)} categories={CATS} platforms={listingPlatforms} />}
      {subModalOpen && <SubModal sub={subModalOpen === "new" ? null : subModalOpen} onSave={saveSub} onClose={() => setSubModalOpen(null)} />}
      {tplManagerOpen && userTemplates && <TemplateManagerModal templates={userTemplates} onSave={async (next) => { await persistTemplates(next); setTplManagerOpen(false); }} onClose={() => setTplManagerOpen(false)} />}
      {bulkSellOpen && <BulkSellModal items={inventory.filter((i) => selectedInv.has(i.id))} onSell={handleBulkSell} onClose={() => setBulkSellOpen(false)} platforms={PLATS} customers={CUSTS} paymentMethods={PAYMETHODS} />}
      {bulkEditExpOpen && <BulkEditExpModal items={expenses.filter((e) => selectedExp.has(e.id))} onSave={handleBulkEditExp} onClose={() => setBulkEditExpOpen(false)} paymentMethods={PAYMETHODS} />}
      {bulkEditSaleOpen && <BulkEditSaleModal items={keyedSales.filter((s) => selectedSales.has(s._saleKey))} onSave={handleBulkEditSale} onClose={() => setBulkEditSaleOpen(false)} platforms={PLATS} paymentMethods={PAYMETHODS} />}
      <ConfirmDialog open={!!confirmDel} msg={confirmDel?.type==="multi"||confirmDel?.type==="multi-exp"||confirmDel?.type==="multi-sale"?`Delete ${confirmDel.name}?`:`Delete "${confirmDel?.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDel(null)} />
      <DangerConfirmDialog
        open={!!dangerAction}
        title={dangerAction?.title}
        intro={dangerAction?.intro}
        counts={dangerAction?.counts}
        keyword={dangerAction?.keyword}
        confirmLabel={dangerAction?.confirmLabel}
        snapshotNote={dangerAction?.snapshot && supabase ? "A Supabase snapshot will be saved before this runs." : ""}
        busy={dangerBusy}
        onConfirm={confirmDangerAction}
        onCancel={() => { if (!dangerBusy) setDangerAction(null); }}
      />
    </div>
  );
}
