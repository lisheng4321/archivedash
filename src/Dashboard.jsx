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
import { compareInventorySize, compareSizeValues, customerKey, listedPlatformsFor, orderKeyForSale, platformShortName, sortedListedPlatformsFor } from "./dashboard/inventory.js";
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
  useEffect(() => {
    const closeRowMenu = (event) => {
      if (!event.target.closest(".ad-row-action-wrap")) setRowMenuOpen(null);
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

      setInventory(i); setSales(s); setExpenses(n¶ãŸ-¢G§²ÚîÆ­yÒ&6†V6¶&÷‚"6†V6¶VC×¶–çd6öÆÆ6WÒöä6†ævS×²†R’Óâ6WD–çd6öÆÆ6R†RçF&vWBæ6†V6¶VB—Ò7G–ÆS×¶6'Òóäw&÷WÂöÆ&VÃàĞ¢²†–çe6V&6‚ÇÂ–çd6BÓÒ$ÆÂ"ÇÂ–çe7FGW2ÓÒ$ÆÂ"ÇÂ–çe6÷'BÓÒ&æÖUö62"’bbÆ'WGFöâöä6Æ–6³×¶6ÆV$f–ÇFW'7Ò7G–ÆS×·²ââæv†÷7D'FâÂFF–æs¢#W‚‚"ÂföçE6—¦S¢×Óä6ÆV#Âö'WGFöãçĞ¢Ç7â7G–ÆS×·²Ö&v–äÆVgC¢&WFò"ÂföçE6—¦S¢"Â6öÆ÷#¢"3†#“vB"×Óç¶f–ÇFW&VD–çbæÆVæwF‡Ò—FV×7·6VÆV7FVD–çbç6—¦RâbbÒG·6VÆV7FVD–çbç6—¦WÒ6VÆV7FVBÒG¶7W'&Væ7’‡6VÆV7FVEfÇVR—ÖÓÂ÷7ãàĞ¢ÂöF—càĞ Ğ¢¶–çfVçF÷'’æÆVæwF‚ÓÓÒò€Ğ¢ÄV×G•7FFPĞ¢F—FÆSÒ$æò–çfVçF÷'’–WB Ğ¢†–çCÒ$FB–÷W"f—'7B—FVÒ'’†æBÂ÷"–×÷'B&V6V—G2g&öÒvÖ–ÂFò'V–ÆB–çfVçF÷'’WFöÖF–6ÆÇ’â Ğ¢7F–öç3×µ°Ğ¢²Æ&VÃ¢"²FB–çfVçF÷'’"Â&–Ö'“¢G'VRÂöä6Æ–6³¢÷VäFD–çfVçF÷'’ÒÀĞ¢²Æ&VÃ¢vÖ–Ä'W7’ò%7–æ6–ærvÖ–Î(
b"¢$–×÷'B&V6V—G2g&öÒvÖ–Â"ÂF—6&ÆVC¢vÖ–Ä'W7’Âöä6Æ–6³¢7–æ2‚’Óâ²6WDvÖ–ÅVWVT÷Vâ‡G'VR“²v—B7–æ4vÖ–Ä–çfVçF÷'’‚“²ÒÒÀĞ¢×ĞĞ¢óàĞ¢’¢€Ğ¢ÆF—b7G–ÆS×·²&6¶w&÷VæC¢"3#&""Â&÷&FW%&F—W3¢"Â&÷&FW#¢#‚6öÆ–B3#3&362"Â÷fW&fÆ÷s¢&†–FFVâ"×ÓàĞ¢²—4Öö&–ÆRbb€Ğ¢ÆF—b7G–ÆS×·²F—7Æ“¢&w&–B"Âw&–EFV×ÆFT6öÇVÖç3¢#C‡‚Ö–æÖ‚ƒ3‚Âã†g"’G‚Ö–æÖ‚ƒ#‚ÂãcVg"’s'‚G‚G‚C‡‚3'‚"Âv¢‚ÂFF–æs¢#‚g‚"ÂföçE6—¦S¢Â6öÆ÷#¢"3†#“vB"ÂFW‡EG&ç6f÷&Ó¢'WW&66R"ÂÆWGFW%76–æs¢ãRÂ&÷&FW$&÷GFöÓ¢#‚6öÆ–B3#3&362"ÂföçEvV–v‡C¢cÂÆ–vä—FV×3¢&6VçFW""Â&6¶w&÷VæC¢"3#&""×Óà¢Æ–çWBG—SÒ&6†V6¶&÷‚"6†V6¶VC×·6VÆV7FVD–çbç6—¦RÓÓÒf–ÇFW&VD–çbæÆVæwF‚bbf–ÇFW&VD–çbæÆVæwF‚âÒöä6†ævS×·FövvÆTÆÇÒ7G–ÆS×¶6'ÒóàĞ¢Ç7â7G–ÆS×·F&ÆT†VB‚—ÓäæÖSÂ÷7ããÇ7â7G–ÆS×·F&ÆT†VB‚—ÓäÆ—7FVCÂ÷7ããÇ7â7G–ÆS×·F&ÆT†VB‚—Óä6FVv÷'“Â÷7ããÇ7â7G–ÆS×·F&ÆT†VB‚—Óå6—¦SÂ÷7ããÇ7â7G–ÆS×·F&ÆT†VB‚'&–v‡B"—Óå&–6SÂ÷7ããÇ7â7G–ÆS×·²ââçF&ÆT†VB‚’ÂFF–ætÆVgC¢"×ÓäFFSÂ÷7ããÇ7â7G–ÆS×·F&ÆT†VB‚'&–v‡B"—ÓåG“Â÷7ããÇ7â7G–ÆS×·F&ÆT†VB‚&6VçFW""—Óä7F–öç3Â÷7ãà¢ÂöF—càĞ¢—ĞĞ¢¶Öö&–ÆU6VÆV7DÆÂ‡6VÆV7FVD–çbç6—¦RÓÓÒf–ÇFW&VD–çbæÆVæwF‚bbf–ÇFW&VD–çbæÆVæwF‚âÂFövvÆTÆÂÂf–ÇFW&VD–çbæÆVæwF‚—ĞĞ¢¶w&÷WVD–çbæÆVæwF‚ÓÓÒbbÆF—b7G–ÆS×·²FF–æs¢3bÂFW‡DÆ–vã¢&6VçFW""Â6öÆ÷#¢"3†#“vB"ÂföçE6—¦S¢2×Óäæò—FV×2ÖF6‚F†W6Rf–ÇFW'2ãÆ'WGFöâöä6Æ–6³×¶6ÆV$f–ÇFW'7Ò7G–ÆS×·²ââæv†÷7D'FâÂF—7Æ“¢&&Æö6²"ÂÖ&v–ã¢#‚WFò"ÂFF–æs¢#W‚'‚"ÂföçE6—¦S¢×Óä6ÆV"f–ÇFW'3Âö'WGFöããÂöF—cçĞ¢¶w&÷WVD–çbæÖ‚†—FVÒÂ–G‚’Óâ°Ğ¢–b‚—FVÒåöw&÷W’&WGW&â–çe&÷r†—FVÒÂfÇ6RÂ–G‚“°Ğ¢6öç7B¶W’Ò—FVÒææÖS°Ğ¢6öç7B—4W‡æFVBÒW‡æFVDw&÷W2æ†2†¶W’“°Ğ¢&WGW&â€Ğ¢ÆF—b¶W“×¶¶W—ÓàĞ¢¶w&÷W&÷r†—FVÒÂ—4W‡æFVBÂ¶W’Â–G‚—ĞĞ¢¶—4W‡æFVBbb—FVÒåö—FV×2æÖ‚‡7V"Â6†–ÆD–G‚’Óâ–çe&÷r‡7V"ÂG'VRÂ–G‚²6†–ÆD–G‚²’—ĞĞ¢ÂöF—càĞ¢“°Ğ¢Ò—ĞĞ¢ÂöF—càĞ¢—ĞĞ Ğ¢·6VÆV7FVD–çbç6—¦Râbb€Ğ¢ÆF—b7G–ÆS×·²÷6—F–öã¢&f—†VB"Â&–v‡C¢—4Öö&–ÆRò"¢#BÂ&÷GFöÓ¢—4Öö&–ÆRòs‚¢#BÂ¤–æFWƒ¢“RÂ&6¶w&÷VæC¢"3#&""Â&÷&FW#¢#‚6öÆ–B3#Sc6V#cb"Â&÷…6†F÷s¢#‡‚C‚&v&ƒÃÃÃãCR’"Â&÷&FW%&F—W3¢"ÂFF–æs¢ÂF—7Æ“¢&fÆW‚"ÂÆ–vä—FV×3¢&6VçFW""Âv¢ÂfÆW…w&¢'w&"ÂÖ…v–GFƒ¢—4Öö&–ÆRò&6Æ2ƒgrÒ#G‚’"¢S#×ÓàĞ¢ÆF—b7G–ÆS×·²Ö–åv–GFƒ¢—4Öö&–ÆRò#R"¢S×ÓàĞ¢ÆF—b7G–ÆS×·²6öÆ÷#¢"6c6cff""ÂföçE6—¦S¢2ÂföçEvV–v‡C¢ƒ×Óç·6VÆV7FVD–çbç6—¦WÒ6VÆV7FVCÂöF—càĞ¢ÆF—b7G–ÆS×·²6öÆ÷#¢"3v3†"ÂföçE6—¦S¢ÂÖ&v–åF÷¢"×Óç·6VÆV7FVE&öGV7G7Ò&öGV7G2Ò¶7W'&Væ7’‡6VÆV7FVEfÇVR—×·6VÆV7FVD6FVv÷&–W2æÆVæwF‚òÒG·6VÆV7FVD6FVv÷&–W2ç6Æ–6RƒÂ"’æ¦ö–â‚"Â"—ÒG·6VÆV7FVD6FVv÷&–W2æÆVæwF‚â"ò²G·6VÆV7FVD6FVv÷&–W2æÆVæwF‚Ò'Ö¢"'Ö¢"'ÓÂöF—càĞ¢ÂöF—càĞ¢ÆF—b7G–ÆS×·²F—7Æ“¢&fÆW‚"Âv¢bÂfÆW…w&¢'w&"×ÓàĞ¢Æ'WGFöâöä6Æ–6³×²‚’Óâ6WD'VÆ´VF—D÷Vâ‡G'VR—Ò7G–ÆS×·²ââç&–Ö'”'FâÂföçE6—¦S¢"ÂFF–æs¢#w‚'‚"×ÓäVF—CÂö'WGFöãàĞ¢Æ'WGFöâöä6Æ–6³×²‚’Óâ6WD'VÆµ6VÆÄ÷Vâ‡G'VR—Ò7G–ÆS×·²ââæv†÷7D'FâÂ6öÆ÷#¢"3“63VfB"ÂföçE6—¦S¢"ÂFF–æs¢#w‚'‚"×Óå6VÆÃÂö'WGFöãàĞ¢Æ'WGFöâöä6Æ–6³×²‚’Óâ6WD6öæf—&ÔFVÂ‡²G—S¢&×VÇF’"ÂæÖS¢G·6VÆV7FVD–çbç6—¦WÒ—FV×6Ò—Ò7G–ÆS×·²ââæv†÷7D'FâÂ6öÆ÷#¢"6cƒss"ÂföçE6—¦S¢"ÂFF–æs¢#w‚'‚"×ÓäFVÆWFSÂö'WGFöãàĞ¢ÂöF—càĞ¢ÂöF—càĞ¢—ĞĞ¢ÂöF—càĞ¢“°Ğ§ĞĞ 