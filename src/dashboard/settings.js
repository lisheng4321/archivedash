import { DEF_CATEGORIES, DEF_PAYMENT_METHODS, DEF_PLATFORMS } from "./shared.jsx";

const DEFAULT_NAV_UTILITY_IDS = ["settings"];
const DEFAULT_BACKUP_SETTINGS = { autoWeekly: false, destination: "supabase", retention: 12, lastRunAt: "" };
const PLATFORM_SETTINGS_VERSION = 1;
const SETTINGS_SCHEMA_VERSION = 3;
const RESELLER_DASHBOARD_CARDS = {
  actionStrip: true,
  preorderAlerts: true,
  netProfitGraph: true,
  salesIncome: true,
  netProfit: false,
  grossProfit: true,
  inventorySpend: true,
  inventoryValue: false,
  salesCount: false,
  avgOrderValue: false,
  netMargin: true,
  grossMargin: true,
  profitRoi: true,
  costBreakdown: true,
  totalExpenses: false,
  platformFees: false,
  monthlySubs: false,
  aging: true,
  velocity: true,
  recentSales: false,
  recentInventory: false,
};
const SAVE_LABELS = {
  "arch-inv2": "Inventory",
  "arch-sales2": "Sales",
  "arch-exp2": "Expenses",
  "arch-subs": "Subscriptions",
  "arch-settings": "Settings",
  "arch-notes": "Notes",
  "arch-templates": "Templates",
  "arch-backups": "Backups",
};

const saveLabelFor = (key) => SAVE_LABELS[key] || key;

const migratePlatforms = (settings) => {
  const platforms = settings.platforms || DEF_PLATFORMS;
  if (settings.schemaVersion >= PLATFORM_SETTINGS_VERSION || platforms.some((platform) => String(platform).toLowerCase() === "whatnot")) return platforms;
  const ebayIndex = platforms.findIndex((platform) => String(platform).toLowerCase().includes("ebay"));
  return ebayIndex < 0
    ? [...platforms, "Whatnot"]
    : [...platforms.slice(0, ebayIndex + 1), "Whatnot", ...platforms.slice(ebayIndex + 1)];
};

const migrateDashboardCards = (settings) => settings.schemaVersion >= SETTINGS_SCHEMA_VERSION
  ? (settings.dashboardCards || {})
  : { ...(settings.dashboardCards || {}), ...RESELLER_DASHBOARD_CARDS };

const defaultSettings = () => ({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  categories: DEF_CATEGORIES,
  platforms: DEF_PLATFORMS,
  paymentMethods: DEF_PAYMENT_METHODS,
  customers: [],
  customerProfiles: {},
  hiddenCustomerKeys: [],
  marketingAudiences: [],
  marketingCampaigns: [],
  dashboardCards: RESELLER_DASHBOARD_CARDS,
  navOrder: [],
  navUtilityIds: DEFAULT_NAV_UTILITY_IDS,
  hiddenNavIds: [],
  backup: DEFAULT_BACKUP_SETTINGS,
});

const normalizeSettings = (settings = {}) => ({
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  categories: settings.categories || DEF_CATEGORIES,
  platforms: migratePlatforms(settings),
  paymentMethods: settings.paymentMethods || DEF_PAYMENT_METHODS,
  customers: settings.customers || [],
  customerProfiles: settings.customerProfiles || {},
  hiddenCustomerKeys: Array.isArray(settings.hiddenCustomerKeys) ? settings.hiddenCustomerKeys : [],
  marketingAudiences: Array.isArray(settings.marketingAudiences) ? settings.marketingAudiences : [],
  marketingCampaigns: Array.isArray(settings.marketingCampaigns) ? settings.marketingCampaigns : [],
  dashboardCards: migrateDashboardCards(settings),
  navOrder: Array.isArray(settings.navOrder) ? settings.navOrder : [],
  navUtilityIds: Array.isArray(settings.navUtilityIds) ? settings.navUtilityIds : DEFAULT_NAV_UTILITY_IDS,
  hiddenNavIds: Array.isArray(settings.hiddenNavIds) ? settings.hiddenNavIds : [],
  backup: { ...DEFAULT_BACKUP_SETTINGS, ...(settings.backup || {}) },
});

export {
  DEFAULT_NAV_UTILITY_IDS,
  DEFAULT_BACKUP_SETTINGS,
  RESELLER_DASHBOARD_CARDS,
  saveLabelFor,
  defaultSettings,
  normalizeSettings,
};
