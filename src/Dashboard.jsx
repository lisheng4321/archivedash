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
import { compareInventorySize, customerKey, listedPlatformsFor, orderKeyForSale, platformShortName, sortedListedPlatformsFor } from "./dashboard/inventory.js";
import { DEFAULT_BACKUP_SETTINGS, DEFAULT_NAV_UTILITY_IDS, defaultSettings, normalizeSettings, saveLabelFor } from "./dashboard/settings.js";
import { subCategory } from "./dashboard/subscriptions.js";

import { DEF_CATEGORIES, DEF_PLATFORMS, DEF_SIZE_MAP, getDefaultSize, getSizes, EXP_CATEGORIES, SUB_CATEGORIES, VERSION, PREORDER_THRESHOLD, FREQ_OPTIONS, FREQ_LABEL, FONT_SIZES, TEMPLATES, renderTemplate, sanitizeHtml, stripHtml, businessDaysUntil, advanceDate, monthlyEquiv, frequencyLabel, formatMoney, subAmountAud, subMonthlyAud, preorderBadge, genId, currency, computeProfit, estimateEbayFee, sydneyDate, today, daysAgo, getFilterDate, useIsMobile, inp, sel, primaryBtn, ghostBtn, cb, badge, ConfirmDialog, DangerConfirmDialog, UnsavedDialog, Modal, Field, Row, ModalActions, ResponsiveGrid, KPI, TopBar, EmptyState } from "./dashboard/shared.jsx";

import { EditInvModal, EditSaleModal, SellModal, BulkEditModal, EditExpModal, BulkEditExpModal, BulkEditSaleModal, BulkSellModal, ManualSaleModal, EbaySaleReviewModal, GmailInventoryReviewModal, NotepadEditor, SubModal, TemplateManagerModal } from "./dashboard/modals.jsx";

// â•â•â• SAMPLE / DEMO DATA â•â•â•
// First-run "Explore with sample data" seeds these records. Every demo record is
// tagged with `demo: true` so it can be removed as a set, and carries a "sample"
// tag so it stays visible and exports/imports like normal data. Loading or
// clearing sample data reuses the existing persistence keys; nothing is renamed.
const SAMPLE_TAG = "sample";
const FIRST_RUN_DISMISS_KEY = "archivedash-firstrun-dismissed-v1";
const isDemoRecord = (record) => Boolean(record && record.demo);

const buildSampleSale = ({ name, category, size = "OS", brand = "", costPrice, salePrice, shippingPrice = 0, platform, saleDate, customer = "" }) => {
  const fees = platform === "eBay AU" ? estimateEbayFee(salePrice) : Math.round(salePrice * 0.1 * 100) / 100;
  return {
    id: genId(), name, category, size, brand,
    costPrice, salePrice, shippingPrice, platformFees: fees,
    profit: computeProfit({ salePrice, cost: costPrice, shipping: shippingPrice, fees }),
    platform, saleDate, tags: SAMPLE_TAG, purchaseDate: "", preorderDate: "", customer, demo: true,
  };
};

const buildSampleInventory = (over) => ({
  id: genId(), size: "OS", brand: "", preorderDate: "", listedPlatforms: [], customer: "",
  tags: SAMPLE_TAG, addedAt: Date.now(), demo: true, ...over,
});

const buildSampleData = () => ({
  inventory: [
    buildSampleInventory({ name: "Nike Dunk Low Panda", category: "Sneakers", size: "US 9", price: 130, ebayListedPrice: 210, brand: "Nike", listedPlatforms: ["eBay AU"], purchaseDate: daysAgo(38) }),
    buildSampleInventory({ name: "Jordan 4 Black Cat", category: "Sneakers", size: "US 10", price: 320, ebayListedPrice: 470, brand: "Jordan", listedPlatforms: ["eBay AU"], purchaseDate: daysAgo(96) }),
    buildSampleInventory({ name: "Supreme Box Logo Hoodie", category: "Apparel", size: "L", price: 240, brand: "Supreme", listedPlatforms: ["Facebook Marketplace"], purchaseDate: daysAgo(21) }),
    buildSampleInventory({ name: "Pokemon 151 Booster Box", category: "Collectables", size: "OS", price: 180, brand: "Pokemon", purchaseDate: daysAgo(9), preorderDate: daysAgo(-7) }),
    buildSampleInventory({ name: "Louis Vuitton Card Holder", category: "Accessories", size: "OS", price: 350, brand: "Louis Vuitton", listedPlatforms: ["eBay AU"], purchaseDate: daysAgo(63) }),
  ],
  sales: [
    buildSampleSale({ name: "Nike Dunk Low UNC", category: "Sneakers", size: "US 9", brand: "Nike", costPrice: 120, salePrice: 210, shippingPrice: 12, platform: "eBay AU", saleDate: daysAgo(4), customer: "Jordan M" }),
    buildSampleSale({ name: "Yeezy Slide Onyx", category: "Sneakers", size: "US 10", brand: "adidas", costPrice: 70, salePrice: 130, shippingPrice: 10, platform: "StockX", saleDate: daysAgo(11) }),
    buildSampleSale({ name: "CS2 Knife Skin", category: "Collectables", size: "OS", costPrice: 40, salePrice: 95, shippingPrice: 0, platform: "CSFloat", saleDate: daysAgo(17), customer: "Alex T" }),
    buildSampleSale({ name: "Vintage Nike Tee", category: "Apparel", size: "M", brand: "Nike", costPrice: 25, salePrice: 60, shippingPrice: 9, platform: "Depop", saleDate: daysAgo(24) }),
  ],
  expenses: [
    { id: genId(), name: "Shipping supplies", amount: 45, purchaseDate: daysAgo(14), tags: SAMPLE_TAG, expCategory: "Shipping & Fulfillment", demo: true },
    { id: genId(), name: "Cook group membership", amount: 30, purchaseDate: daysAgo(7), tags: SAMPLE_TAG, expCategory: "Cook Groups & Retail Memberships", demo: true },
  ],
});

// â•â•â• MAIN APP â•â•â•
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
  const [firstRunDismissed, setFirstRunDismissed] = useState(() => {
    try { return window.localStorage.getItem(FIRST_RUN_DISMISS_KEY) === "1"; } catch { return false; }
  });
  const dismissFirstRun = () => {
    try { window.localStorage.setItem(FIRST_RUN_DISMISS_KEY, "1"); } catch { /* private-mode storage is optional */ }
    setFirstRunDismissed(true);
  };
  const CATS = settings.categories; const PLATS = settings.platforms; const CUSTS = settings.customers;
  const listingPlatforms = useMemo(() => PLATS.filter((p) => !["StockX", "GOAT", "CSFloat", "Bonusbank"].includes(p)), [PLATS]);

  const emptyInv = { name: "", category: CATS[0]||"Other", size: getDefaultSize(CATS[0]||""), price: "", ebayListedPrice: "", quantity: "1", purchaseDate: today(), preorderDate: "", brand: "", listedPlatforms: [], tags: "", customer: "" };
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

      // Migrate old single-notepad â†’ first note in multi-note model
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
        setActiveNoteId(sorted[ão7îÚ$z{-®éÜj×DV&’ÂV&”'W7’ÂV&•7FGW2ÂV&”–×÷'G2Â6WDV&•VWVT÷VâÂÆöDV&”–×÷'G2Â7–æ4V&”÷&FW'2Â6öææV7DvÖ–ÂÂvÖ–Ä'W7’ÂvÖ–Å7FGW2ÂvÖ–Ä–×÷'G2Â6WDvÖ–ÅVWVT÷VâÂÆöDvÖ–Ä–×÷'G2Â7–æ4vÖ–Ä–çfVçF÷'’ÂöäÆöv÷WBÂW6W$VÖ–Â×ÒóçÐ¢ÂöF—cà ¢²ò¢)Y)YäõDUBäTÂ)Y)Y¢÷Ð¢²ò¢)Y)YdÄôD”äräõDUB%UEDôâ(	Bf—6–&ÆRöâÆÂvW2W†6WBæ÷FWBæBv†Vâ6Æ–FRÖ÷WB—2÷Vâ)Y)Y¢÷Ð¢²—4Öö&–ÆRbbvRÓÒ&æ÷FWB"bbæ÷FWD÷Vâbb6VÆV7FVD–çbç6—¦RÓÓÒbb6VÆV7FVE6ÆW2ç6—¦RÓÓÒbb6VÆV7FVDW‡ç6—¦RÓÓÒbb€¢Æ'WGFöà¢öä6Æ–6³×²‚’Óâ6WDæ÷FWD÷Vâ‡G'VR—Ð¢F—FÆSÒ%V–6²æ÷FW2 ¢7G–ÆS×·²÷6—F–öã¢&f—†VB"Â&÷GFöÓ¢—4Öö&–ÆRòsB¢‚Â&–v‡C¢‚Âv–GFƒ¢CbÂ†V–v‡C¢CbÂ&÷&FW%&F—W3¢#SR"Â&6¶w&÷VæC¢"3#Sc6V""Â6öÆ÷#¢"6ffb"Â&÷&FW#¢&æöæR"Â7W'6÷#¢'ö–çFW""Â&÷…6†F÷s¢#g‚g‚&v&ƒ3rÃ“’Ã#3RÃãCR’"ÂF—7Æ“¢&fÆW‚"ÂÆ–vä—FV×3¢&6VçFW""Â§W7F–g”6öçFVçC¢&6VçFW""Â¤–æFWƒ¢ƒÂG&ç6—F–öã¢'G&ç6f÷&ÒS×2"×Ð¢öäÖ÷W6TVçFW#×²†R’ÓâRæ7W'&VçEF&vWBç7G–ÆRçG&ç6f÷&ÒÒ'66ÆRƒãR’'Ð¢öäÖ÷W6TÆVfS×²†R’ÓâRæ7W'&VçEF&vWBç7G–ÆRçG&ç6f÷&ÒÒ'66ÆRƒ’'Ð¢à¢Ç7frv–GFƒÒ##"†V–v‡CÒ##"f–Wt&÷ƒÒ##B#B"f–ÆÃÒ&æöæR"7G&ö¶SÒ&7W'&VçD6öÆ÷""7G&ö¶Uv–GFƒÒ#""7G&ö¶TÆ–æV6Ò'&÷VæB"7G&ö¶TÆ–æV¦ö–ãÒ'&÷VæB#à¢ÇF‚CÒ$ÓB$ƒf""Ó"'cf"""&ƒ&"""Ó%c‡¢"óà¢ÇF‚CÒ$ÓB'cfƒb"óà¢ÇF‚CÒ$Ób4ƒ‚"óà¢ÇF‚CÒ$Óbtƒ‚"óà¢Â÷7fsà¢Âö'WGFöãà¢—Ð ¢¶æ÷FWD÷Vâbb€¢ÆF—b7G–ÆS×·²÷6—F–öã¢&f—†VB"Â&–v‡C¢ÂF÷¢Â&÷GFöÓ¢Âv–GFƒ¢—4Öö&–ÆRò#R"¢3cÂ&6¶w&÷VæC¢"3#&""Â&÷&FW$ÆVgC¢#‚6öÆ–B3#3&362"Â¤–æFWƒ¢SÂF—7Æ“¢&fÆW‚"ÂfÆW„F—&V7F–öã¢&6öÇVÖâ"Â&÷…6†F÷s¢"ÓG‚#‚&v&ƒÃÃÃãB’"×Óà¢ÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Â§W7F–g”6öçFVçC¢'76RÖ&WGvVVâ"ÂÆ–vä—FV×3¢&6VçFW""ÂFF–æs¢#‚G‚"Â&÷&FW$&÷GFöÓ¢#‚6öÆ–B3#3&362"Âv¢b×Óà¢Ç7â7G–ÆS×·²föçE6—¦S¢BÂföçEvV–v‡C¢cÂ6öÆ÷#¢"6c6cff""ÂfÆW…6‡&–æ³¢×Óäæ÷FW3Â÷7ãà¢ÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Âv¢BÂfÆWƒ¢Â§W7F–g”6öçFVçC¢&fÆW‚ÖVæB"×Óà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ7&VFTæ÷FR‚—ÒF—FÆSÒ$æWræ÷FR"7G–ÆS×·²ââæv†÷7D'FâÂFF–æs¢#W‚‚"ÂföçE6—¦S¢"×Óâ³Âö'WGFöãà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ²6WEvR‚&æ÷FWB"“²6WDæ÷FWD÷Vâ†fÇ6R“²×ÒF—FÆSÒ$÷VâgVÆÂæ÷FWB"7G–ÆS×·²ââæv†÷7D'FâÂFF–æs¢#W‚‚"ÂföçE6—¦S¢"×Óî(isÂö'WGFöãà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ6WDæ÷FWD÷Vâ†fÇ6R—Ò7G–ÆS×·²&6¶w&÷VæC¢&æöæR"Â&÷&FW#¢&æöæR"Â6öÆ÷#¢"3v3†"ÂföçE6—¦S¢bÂ7W'6÷#¢'ö–çFW""ÂFF–æs¢#G‚"×Óî)ÉSÂö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢¶æ÷FW2æÆVæwF‚âò€¢ÆF—b7G–ÆS×·²FF–æs¢#‡‚G‚g‚"Â&÷&FW$&÷GFöÓ¢#‚6öÆ–B3#3&362"×Óà¢Ç6VÆV7BfÇVS×¶7F—fTæ÷FT–BÇÂ"'Òöä6†ævS×²†R’Óâ6WD7F—fTæ÷FT–B†RçF&vWBçfÇVR—Ò7G–ÆS×·²ââç6VÂÂFF–æs¢#g‚‡‚"ÂföçE6—¦S¢"×Óà¢·6÷'FVDæ÷FW2æÖ‚†â’ÓâÆ÷F–öâ¶W“×¶âæ–GÒfÇVS×¶âæ–GÓç¶âç–ææVBò.)ˆR"¢"'×¶âçF—FÆRÇÂ%VçF—FÆVB'ÓÂö÷F–öãâ—Ð¢Â÷6VÆV7Cà¢ÂöF—cà¢’¢çVÆÇÐ¢¶7F—fTæ÷FRò€¢Äæ÷FWDVF—F÷"æ÷FS×¶7F—fTæ÷FWÒöåWFFS×²†6†ævW2’ÓâWFFTæ÷FR†7F—fTæ÷FRæ–BÂ6†ævW2—Ò6†÷uFV×ÆFW3×²—4Öö&–ÆWÒ—4Öö&–ÆS×¶—4Öö&–ÆWÒFV×ÆFW3×·W6W%FV×ÆFW2ÇÂµ×Ò6ö×7Bóà¢’¢€¢ÆF—b7G–ÆS×·²fÆWƒ¢ÂF—7Æ“¢&fÆW‚"ÂÆ–vä—FV×3¢&6VçFW""Â§W7F–g”6öçFVçC¢&6VçFW""ÂfÆW„F—&V7F–öã¢&6öÇVÖâ"Âv¢ÂFF–æs¢#×Óà¢ÆF—b7G–ÆS×·²föçE6—¦S¢"Â6öÆ÷#¢"3†#“vB"ÂFW‡DÆ–vã¢&6VçFW""×Óäæòæ÷FW2–WBãÂöF—cà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ7&VFTæ÷FR‚—Ò7G–ÆS×·&–Ö'”'FçÓâ²æWræ÷FSÂö'WGFöãà¢ÂöF—cà¢—Ð¢ÂöF—cà¢—Ð ¢²ò¢)Y)YÔôDÅ2)Y)Y¢÷Ð¢ÄÖöFÂ÷Vã×¶FD–çd÷VçÒöä6Æ÷6S×¶6Æ÷6TFD–çfVçF÷'—ÒwV&FVD6Æ÷6S×¶wV&FVD6Æ÷6TFGÒF—FÆSÒ$FB–çfVçF÷'’#à¢Äf–VÆBÆ&VÃÒ%&öGV7BæÖR"&WãÆ–çWBfÇVS×¶–çdf÷&ÒææÖWÒöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²æÖS¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒÆ6V†öÆFW#Ò&Rærâæ–¶RGVæ²Æ÷ræF"óãÂôf–VÆCà¢Å&÷r6öÇ3×³7ÓãÄf–VÆBÆ&VÃÒ$6FVv÷'’"&WãÇ6VÆV7BfÇVS×¶–çdf÷&Òæ6FVv÷'—Òöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²6FVv÷'“¢RçF&vWBçfÇVRÂ6—¦S¢vWDFVfVÇE6—¦R†RçF&vWBçfÇVR’Ò—Ò7G–ÆS×·6VÇÓç´4E2æÖ‚†2’ÓâÆ÷F–öâ¶W“×¶7Óç¶7ÓÂö÷F–öãâ—ÓÂ÷6VÆV7CãÂôf–VÆCãÄf–VÆBÆ&VÃÒ%6—¦R#ãÇ6VÆV7BfÇVS×¶–çdf÷&Òç6—¦WÒöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²6—¦S¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×·6VÇÓç¶vWE6—¦W2†–çdf÷&Òæ6FVv÷'’’æÖ‚‡2’ÓâÆ÷F–öâ¶W“×·7Óç·7ÓÂö÷F–öãâ—ÓÂ÷6VÆV7CãÂôf–VÆCãÄf–VÆBÆ&VÃÒ$6÷7B„RB’"&WãÆ–çWBG—SÒ&çVÖ&W""7FWÒ#ã"fÇVS×¶–çdf÷&Òç&–6WÒöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²&–6S¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒÆ6V†öÆFW#Ò#ã"óãÂôf–VÆCãÂõ&÷sà¢Å&÷sãÄf–VÆBÆ&VÃÒ$'&æB#ãÆ–çWBfÇVS×¶–çdf÷&Òæ'&æGÒöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²'&æC¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒÆ6V†öÆFW#Ò&Rærâæ–¶R"óãÂôf–VÆCãÄf–VÆBÆ&VÃÒ%W&6†6RFFR#ãÆ–çWBG—SÒ&FFR"fÇVS×¶–çdf÷&ÒçW&6†6TFFWÒöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²W&6†6TFFS¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCãÂõ&÷sà¢Å&÷sãÄf–VÆBÆ&VÃÒ%VçF—G’#ãÆ–çWBG—SÒ&çVÖ&W""Ö–ãÒ#"fÇVS×¶–çdf÷&ÒçVçF—G—Òöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²VçF—G“¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCãÄf–VÆBÆ&VÃÒ%&V÷&FW"FFR#ãÆ–çWBG—SÒ&FFR"fÇVS×¶–çdf÷&Òç&V÷&FW$FFWÒöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²&V÷&FW$FFS¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCãÂõ&÷sà¢Äf–VÆBÆ&VÃÒ$Æ—7FVBöâ#ãÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Âv¢ÂfÆW…w&¢'w&"×Óç¶Æ—7F–æuÆFf÷&×2æÖ‚‡’ÓâÆÆ&VÂ¶W“×·Ò7G–ÆS×·²F—7Æ“¢&fÆW‚"ÂÆ–vä—FV×3¢&6VçFW""Âv¢bÂföçE6—¦S¢"Â6öÆ÷#¢"3–66b"Â7W'6÷#¢'ö–çFW""×ÓãÆ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×¶Æ—7FVEÆFf÷&×4f÷"†–çdf÷&Ò’æ–æ6ÇVFW2‡—Òöä6†ævS×²†R’Óâ²6öç7BæW‡BÒæWr6WB†Æ—7FVEÆFf÷&×4f÷"†–çdf÷&Ò’“²RçF&vWBæ6†V6¶VBòæW‡BæFB‡’¢æW‡BæFVÆWFR‡“²WFFT–çdf÷&Ò‡²Æ—7FVEÆFf÷&×3¢²ââææW‡EÒÒ“²×Ò7G–ÆS×¶6'Òóâ·ÆFf÷&Õ6†÷'DæÖR‡—ÓÂöÆ&VÃâ—ÓÂöF—cãÂôf–VÆCà¢¶Æ—7FVEÆFf÷&×4f÷"†–çdf÷&Ò’ç6öÖR‚‡’Óâ7G&–ær‡’çFôÆ÷vW$66R‚’æ–æ6ÇVFW2‚&V&’"’’bbÄf–VÆBÆ&VÃÒ&T&’Æ—7FVB&–6R„RB’#ãÆ–çWBG—SÒ&çVÖ&W""7FWÒ#ã"fÇVS×¶–çdf÷&ÒæV&”Æ—7FVE&–6RÇÂ"'Òöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²V&”Æ—7FVE&–6S¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒÆ6V†öÆFW#Ò$7W'&VçBT&’Æ—7F–ær&–6R"óãÂôf–VÆCçÐ¢Äf–VÆBÆ&VÃÒ%Fw2#ãÆ–çWBfÇVS×¶–çdf÷&ÒçFw7Òöä6†ævS×²†R’ÓâWFFT–çdf÷&Ò‡²Fw3¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCà¢ÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Â§W7F–g”6öçFVçC¢'76RÖ&WGvVVâ"Âv¢‚ÂÖ&v–åF÷¢bÂfÆW…w&¢'w&"ÂfÆW„F—&V7F–öã¢—4Öö&–ÆRò&6öÇVÖâ"¢'&÷r"×Óà¢Æ'WGFöâöä6Æ–6³×¶6ÆV$–çfVçF÷'”G&gGÒ7G–ÆS×·²ââæv†÷7D'FâÂ6öÆ÷#¢"3–66b"Ââââ†—4Öö&–ÆRò²v–GFƒ¢#R"Ò¢·Ò’×Óä6ÆV"f÷&ÓÂö'WGFöãà¢ÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Âv¢‚ÂfÆW…w&¢'w&"Â§W7F–g”6öçFVçC¢&fÆW‚ÖVæB"ÂfÆW„F—&V7F–öã¢—4Öö&–ÆRò&6öÇVÖâ"¢'&÷r"Âv–GFƒ¢—4Öö&–ÆRò#R"¢&WFò"×Óà¢Æ'WGFöâöä6Æ–6³×·VWVT–çfVçF÷'”G&gGÒ7G–ÆS×·²ââæv†÷7D'FâÂ6öÆ÷#¢"3“63VfB"Ââââ†—4Öö&–ÆRò²v–GFƒ¢#R"Ò¢·Ò’×ÓåVWVR·'6T–çB†–çdf÷&ÒçVçF—G’Â“ãöG¶–çdf÷&ÒçVçF—G—Ò—FV×6¢&—FVÒ'ÓÂö'WGFöãà¢Æ'WGFöâöä6Æ–6³×¶wV&FVD6Æ÷6TFGÒ7G–ÆS×·²ââæv†÷7D'FâÂâââ†—4Öö&–ÆRò²v–GFƒ¢#R"Ò¢·Ò’×Óä6æ6VÃÂö'WGFöãà¢Æ'WGFöâöä6Æ–6³×¶FD–çfVçF÷'—Ò7G–ÆS×·²ââç&–Ö'”'FâÂâââ†—4Öö&–ÆRò²v–GFƒ¢#R"Ò¢·Ò’×Óç¶–çeVWVRæÆVæwF‚òFBG¶–çeVWVRæÆVæwF‡ÒVWVVF¢FBG·'6T–çB†–çdf÷&ÒçVçF—G’Â“ãöG¶–çdf÷&ÒçVçF—G—Ò—FV×6¢&—FVÒ'ÖÓÂö'WGFöãà¢ÂöF—cà¢ÂöF—cà¢¶–çeVWVRæÆVæwF‚âbb€¢ÆF—b7G–ÆS×·²Ö&v–åF÷¢BÂ&÷&FW#¢#‚6öÆ–B3#3&362"Â&÷&FW%&F—W3¢"Â÷fW&fÆ÷s¢&†–FFVâ"Â&6¶w&÷VæC¢"3Cr"×Óà¢ÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Â§W7F–g”6öçFVçC¢'76RÖ&WGvVVâ"Âv¢ÂÆ–vä—FV×3¢&6VçFW""ÂFF–æs¢#—‚‚"Â&÷&FW$&÷GFöÓ¢#‚6öÆ–B3#3&362"×Óà¢ÆF—cà¢ÆF—b7G–ÆS×·²6öÆ÷#¢"6c6cff""ÂföçE6—¦S¢2ÂföçEvV–v‡C¢ƒ×Óå7V&Ö—76–öâVWVSÂöF—cà¢ÆF—b7G–ÆS×·²6öÆ÷#¢"3v3†"ÂföçE6—¦S¢ÂÖ&v–åF÷¢"×Óç¶–çeVWVU&öGV7D6÷VçGÒ&öGV7G¶–çeVWVU&öGV7D6÷VçBÓÓÒò""¢'2'ÒÒ¶–çeVWVRæÆVæwF‡ÒVæ—G¶–çeVWVRæÆVæwF‚ÓÓÒò""¢'2'ÒÒ¶7W'&Væ7’†–çeVWVUF÷FÂ—ÓÂöF—cà¢ÂöF—cà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ²6WD–çeVWVR…µÒ“²6WDFDF—'G’‡G'VR“²×Ò7G–ÆS×·²ââæv†÷7D'FâÂFF–æs¢#W‚‡‚"ÂföçE6—¦S¢Â6öÆ÷#¢"6cƒss"×Óä6ÆV"VWVSÂö'WGFöãà¢ÂöF—cà¢ÆF—b7G–ÆS×·²Ö„†V–v‡C¢SBÂ÷fW&fÆ÷u“¢&WFò"×Óà¢¶–çeVWVRæÖ‚†—FVÒ’Óâ€¢Å&W7öç6—fTw&–B¶W“×¶—FVÒæ–GÒ6öÇVÖç3Ò&Ö–æÖ‚ƒÃg"’sg‚s‡‚SG‚"Öö&–ÆT6öÇVÖç3Ò&Ö–æÖ‚ƒÂg"’WFò"v×³‡Ò7G–ÆS×·²Æ–vä—FV×3¢&6VçFW""ÂFF–æs¢#‡‚‚"Â&÷&FW%F÷¢#‚6öÆ–B3#3&363#""ÂföçE6—¦S¢"×Óà¢ÆF—b7G–ÆS×·²Ö–åv–GFƒ¢×Óà¢ÆF—b7G–ÆS×·²6öÆ÷#¢"6SVSvV""ÂföçEvV–v‡C¢sÂ÷fW&fÆ÷s¢&†–FFVâ"ÂFW‡D÷fW&fÆ÷s¢&VÆÆ—6—2"Âv†—FU76S¢&æ÷w&"×Óç¶—FVÒææÖWÓÂöF—cà¢ÆF—b7G–ÆS×·²6öÆ÷#¢"3v3†"ÂföçE6—¦S¢ÂÖ&v–åF÷¢"Â÷fW&fÆ÷s¢&†–FFVâ"ÂFW‡D÷fW&fÆ÷s¢&VÆÆ—6—2"Âv†—FU76S¢&æ÷w&"×Óç¶—FVÒæ6FVv÷'—×¶—FVÒæ'&æBòÒG¶—FVÒæ'&æGÖ¢"'×¶Æ—7FVEÆFf÷&×4f÷"†—FVÒ’æÆVæwF‚òÒG¶Æ—7FVEÆFf÷&×4f÷"†—FVÒ’æÖ‡ÆFf÷&Õ6†÷'DæÖR’æ¦ö–â‚"Â"—Ö¢"'ÓÂöF—cà¢ÂöF—cà¢Ç7â7G–ÆS×·²6öÆ÷#¢"3cVf"ÂföçE6—¦S¢"ÂföçEvV–v‡C¢s×Óç¶—FVÒç6—¦RÇÂ$õ2'ÓÂ÷7ãà¢Ç7â7G–ÆS×·²6öÆ÷#¢"6c6cff""ÂföçE6—¦S¢"ÂföçEvV–v‡C¢s×Óç¶7W'&Væ7’†—FVÒç&–6R—ÓÂ÷7ãà¢Æ'WGFöâöä6Æ–6³×²‚’Óâ&VÖ÷fUVWVVD–çfVçF÷'’†—FVÒæ–B—Ò7G–ÆS×·²ââæv†÷7D'FâÂFF–æs¢#G‚w‚"ÂföçE6—¦S¢Â6öÆ÷#¢"6cƒss"×Óå&VÖ÷fSÂö'WGFöãà¢Âõ&W7öç6—fTw&–Cà¢’—Ð¢ÂöF—cà¢ÂöF—cà¢—Ð¢ÂôÖöFÃà¢ÅVç6fVDF–Æör÷Vã×·6†÷uVç6fVDFGÒöäF—66&C×²‚’Óâ²6Æ÷6TFD–çfVçF÷'’‚“²6WE6†÷uVç6fVDFB†fÇ6R“²×Òöä6æ6VÃ×²‚’Óâ6WE6†÷uVç6fVDFB†fÇ6R—Òóà ¢ÄÖöFÂ÷Vã×¶FDW‡÷VçÒöä6Æ÷6S×²‚’Óâ6WDFDW‡÷Vâ†fÇ6R—ÒF—FÆSÒ$7&VFRW‡Vç6R#à¢Äf–VÆBÆ&VÃÒ$æÖR"&WãÆ–çWBfÇVS×¶W‡f÷&ÒææÖWÒöä6†ævS×²†R’Óâ6WDW‡f÷&Ò‡²ââæW‡f÷&ÒÂæÖS¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒÆ6V†öÆFW#Ò&RærâT&’7V""óãÂôf–VÆCà¢Å&÷sãÄf–VÆBÆ&VÃÒ%&–6R„RB’"&WãÆ–çWBG—SÒ&çVÖ&W""7FWÒ#ã"fÇVS×¶W‡f÷&ÒæÖ÷VçGÒöä6†ævS×²†R’Óâ6WDW‡f÷&Ò‡²ââæW‡f÷&ÒÂÖ÷VçC¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCãÄf–VÆBÆ&VÃÒ$FFR#ãÆ–çWBG—SÒ&FFR"fÇVS×¶W‡f÷&ÒçW&6†6TFFWÒöä6†ævS×²†R’Óâ6WDW‡f÷&Ò‡²ââæW‡f÷&ÒÂW&6†6TFFS¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCãÂõ&÷sà¢Å&÷sãÄf–VÆBÆ&VÃÒ$6FVv÷'’#ãÇ6VÆV7BfÇVS×¶W‡f÷&ÒæW‡6FVv÷'—Òöä6†ævS×²†R’Óâ6WDW‡f÷&Ò‡²ââæW‡f÷&ÒÂW‡6FVv÷'“¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×·6VÇÓç´U…ô4DTtõ$”U2æÖ‚†2’ÓâÆ÷F–öâ¶W“×¶7Óç¶7ÓÂö÷F–öãâ—ÓÂ÷6VÆV7CãÂôf–VÆCãÄf–VÆBÆ&VÃÒ%Fw2#ãÆ–çWBfÇVS×¶W‡f÷&ÒçFw7Òöä6†ævS×²†R’Óâ6WDW‡f÷&Ò‡²ââæW‡f÷&ÒÂFw3¢RçF&vWBçfÇVRÒ—Ò7G–ÆS×¶–çÒóãÂôf–VÆCãÂõ&÷sà¢ÄÖöFÄ7F–öç2Ö&v–åF÷×³gÓãÆ'WGFöâöä6Æ–6³×²‚’Óâ6WDFDW‡÷Vâ†fÇ6R—Ò7G–ÆS×¶v†÷7D'FçÓä6æ6VÃÂö'WGFöããÆ'WGFöâöä6Æ–6³×¶7–æ2‚’Óâ²–b‚W‡f÷&ÒææÖWÇÂW‡f÷&ÒæÖ÷VçB’&WGW&ã²v—BW'6—7DW‡…·²–C¢vVä–B‚’ÂæÖS¢W‡f÷&ÒææÖRÂÖ÷VçC¢'6TfÆöB†W‡f÷&ÒæÖ÷VçB’ÂW&6†6TFFS¢W‡f÷&ÒçW&6†6TFFRÂFw3¢W‡f÷&ÒçFw2ÂW‡6FVv÷'“¢W‡f÷&ÒæW‡6FVv÷'’ÒÂââæW‡Vç6W5Ò“²6WDW‡f÷&Ò†V×G”W‡“²6WDFDW‡÷Vâ†fÇ6R“²×Ò7G–ÆS×·&–Ö'”'FçÓä7&VFSÂö'WGFöããÂôÖöFÄ7F–öç3à¢ÂôÖöFÃà ¢·6VÆÄ÷VâbbÅ6VÆÄÖöFÂ—FVÓ×·6VÆÄ÷VçÒöå6VÆÃ×²‡6b’Óâ†æFÆU6VÆÂ‡6VÆÄ÷VâÂ6b—Òöä6Æ÷6S×²‚’Óâ6WE6VÆÄ÷Vâ†çVÆÂ—ÒÆFf÷&×3×µÄE7Ò7W7FöÖW'3×´5U5E7ÒóçÐ¢¶FE6ÆT÷VâbbÄÖçVÅ6ÆTÖöFÂ–çfVçF÷'“×¶–çfVçF÷'—Òöå6VÆÃ×¶†æFÆTÖçVÅ6VÆÇÒöä6Æ÷6S×²‚’Óâ6WDFE6ÆT÷Vâ†fÇ6R—ÒÆFf÷&×3×µÄE7Ò7W7FöÖW'3×´5U5E7ÒóçÐ¢¶V&•&Wf–Wt÷VâbbÄV&•6ÆU&Wf–WtÖöFÂG&gC×¶V&•&Wf–Wt÷VâæG&gGÒ—FV×3×¶V&•&Wf–Wt÷Vâæ—FV×7Òöå&V6÷&C×·&V6÷&DV&•6ÆWÒöä6Æ÷6S×²‚’Óâ6WDV&•&Wf–Wt÷Vâ†çVÆÂ—ÒóçÐ¢¶vÖ–Å&Wf–Wt÷VâbbÄvÖ–Ä–çfVçF÷'•&Wf–WtÖöFÂG&gC×¶vÖ–Å&Wf–Wt÷VçÒ6FVv÷&–W3×´4E7ÒöäFC×·&V6÷&DvÖ–Ä–çfVçF÷'—Òöä6Æ÷6S×²‚’Óâ6WDvÖ–Å&Wf–Wt÷Vâ†çVÆÂ—ÒóçÐ¢¶VF—D–çd÷VâbbÄVF—D–çdÖöFÂ—FVÓ×¶VF—D–çd÷VçÒöå6fS×¶7–æ2†Vb’Óâ²v—BW'6—7D–çb†–çfVçF÷'’æÖ‚†’’Óâ’æ–CÓÓÖVF—D–çd÷Vâæ–C÷²ââæ’ÂââæVgÓ¦’’“²6WDVF—D–çd÷Vâ†çVÆÂ“²×Òöä6Æ÷6S×²‚’Óâ6WDVF—D–çd÷Vâ†çVÆÂ—Ò6FVv÷&–W3×´4E7Ò7W7FöÖW'3×´5U5E7ÒÆFf÷&×3×¶Æ—7F–æuÆFf÷&×7ÒóçÐ¢¶VF—E6ÆT÷VâbbÄVF—E6ÆTÖöFÂ6ÆS×¶VF—E6ÆT÷VçÒöå6fS×¶7–æ2‡R’Óâ²v—BW'6—7E6ÆW2‡6ÆW2æÖ‚‡2’Óâ2æ–CÓÓÖVF—E6ÆT÷Vâæ–C÷S§2’“²–b‡Ræ7W7FöÖW"’FD7W7FöÖW"‡Ræ7W7FöÖW"“²6WDVF—E6ÆT÷Vâ†çVÆÂ“²×Òöä6Æ÷6S×²‚’Óâ6WDVF—E6ÆT÷Vâ†çVÆÂ—ÒÆFf÷&×3×µÄE7Ò7W7FöÖW'3×´5U5E7ÒóçÐ¢¶VF—DW‡÷VâbbÄVF—DW‡ÖöFÂW‡Vç6S×¶VF—DW‡÷VçÒöå6fS×¶7–æ2‡R’Óâ²v—BW'6—7DW‡†W‡Vç6W2æÖ‚†R’ÓâRæ–CÓÓÖVF—DW‡÷Vâæ–C÷S¦R’“²6WDVF—DW‡÷Vâ†çVÆÂ“²×Òöä6Æ÷6S×²‚’Óâ6WDVF—DW‡÷Vâ†çVÆÂ—ÒóçÐ¢¶'VÆ´VF—D÷VâbbÄ'VÆ´VF—DÖöFÂ—FV×3×¶–çfVçF÷'’æf–ÇFW"‚†’’Óâ6VÆV7FVD–çbæ†2†’æ–B’—Òöå6fS×¶†æFÆT'VÆ´VF—GÒöä6Æ÷6S×²‚’Óâ6WD'VÆ´VF—D÷Vâ†fÇ6R—Ò6FVv÷&–W3×´4E7ÒÆFf÷&×3×¶Æ—7F–æuÆFf÷&×7ÒóçÐ¢·7V$ÖöFÄ÷VâbbÅ7V$ÖöFÂ7V#×·7V$ÖöFÄ÷VâÓÓÒ&æWr"òçVÆÂ¢7V$ÖöFÄ÷VçÒöå6fS×·6fU7V'Òöä6Æ÷6S×²‚’Óâ6WE7V$ÖöFÄ÷Vâ†çVÆÂ—ÒóçÐ¢·GÄÖævW$÷VâbbW6W%FV×ÆFW2bbÅFV×ÆFTÖævW$ÖöFÂFV×ÆFW3×·W6W%FV×ÆFW7Òöå6fS×¶7–æ2†æW‡B’Óâ²v—BW'6—7EFV×ÆFW2†æW‡B“²6WEGÄÖævW$÷Vâ†fÇ6R“²×Òöä6Æ÷6S×²‚’Óâ6WEGÄÖævW$÷Vâ†fÇ6R—ÒóçÐ¢¶'VÆµ6VÆÄ÷VâbbÄ'VÆµ6VÆÄÖöFÂ—FV×3×¶–çfVçF÷'’æf–ÇFW"‚†’’Óâ6VÆV7FVD–çbæ†2†’æ–B’—Òöå6VÆÃ×¶†æFÆT'VÆµ6VÆÇÒöä6Æ÷6S×²‚’Óâ6WD'VÆµ6VÆÄ÷Vâ†fÇ6R—ÒÆFf÷&×3×µÄE7Ò7W7FöÖW'3×´5U5E7ÒóçÐ¢¶'VÆ´VF—DW‡÷VâbbÄ'VÆ´VF—DW‡ÖöFÂ—FV×3×¶W‡Vç6W2æf–ÇFW"‚†R’Óâ6VÆV7FVDW‡æ†2†Ræ–B’—Òöå6fS×¶†æFÆT'VÆ´VF—DW‡Òöä6Æ÷6S×²‚’Óâ6WD'VÆ´VF—DW‡÷Vâ†fÇ6R—ÒóçÐ¢¶'VÆ´VF—E6ÆT÷VâbbÄ'VÆ´VF—E6ÆTÖöFÂ—FV×3×·6ÆW2æf–ÇFW"‚‡2’Óâ6VÆV7FVE6ÆW2æ†2‡2æ–B’—Òöå6fS×¶†æFÆT'VÆ´VF—E6ÆWÒöä6Æ÷6S×²‚’Óâ6WD'VÆ´VF—E6ÆT÷Vâ†fÇ6R—ÒÆFf÷&×3×µÄE7ÒóçÐ¢Ä6öæf—&ÔF–Æör÷Vã×²6öæf—&ÔFVÇÒ×6s×¶6öæf—&ÔFVÃòçG—SÓÓÒ&×VÇF’'ÇÆ6öæf—&ÔFVÃòçG—SÓÓÒ&×VÇF’ÖW‡'ÇÆ6öæf—&ÔFVÃòçG—SÓÓÒ&×VÇF’×6ÆR#öFVÆWFRG¶6öæf—&ÔFVÂææÖWÓö¦FVÆWFR"G¶6öæf—&ÔFVÃòææÖWÒ#öÒöä6öæf—&Ó×¶†æFÆTFVÆWFWÒöä6æ6VÃ×²‚’Óâ6WD6öæf—&ÔFVÂ†çVÆÂ—Òóà¢ÄFævW$6öæf—&ÔF–Æöp¢÷Vã×²FævW$7F–öçÐ¢F—FÆS×¶FævW$7F–öãòçF—FÆWÐ¢–çG&ó×¶FævW$7F–öãòæ–çG&÷Ð¢6÷VçG3×¶FævW$7F–öãòæ6÷VçG7Ð¢¶W—v÷&C×¶FævW$7F–öãòæ¶W—v÷&GÐ¢6öæf—&ÔÆ&VÃ×¶FævW$7F–öãòæ6öæf—&ÔÆ&VÇÐ¢6æ6†÷Dæ÷FS×¶FævW$7F–öãòç6æ6†÷Bbb7W&6Rò$7W&6R6æ6†÷Bv–ÆÂ&R6fVB&Vf÷&RF†—2'Vç2â"¢"'Ð¢'W7“×¶FævW$'W7—Ð¢öä6öæf—&Ó×¶6öæf—&ÔFævW$7F–öçÐ¢öä6æ6VÃ×²‚’Óâ²–b‚FævW$'W7’’6WDFævW$7F–öâ†çVÆÂ“²×Ð¢óà¢ÂöF—cà¢“°§Ð