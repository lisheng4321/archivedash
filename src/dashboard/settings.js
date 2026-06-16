import { DEF_CATEGORIES, DEF_PAYMENT_METHODS, DEF_PLATFORMS } from "./shared.jsx";

const DEFAULT_NAV_UTILITY_IDS = ["settings"];
const DEFAULT_BACKUP_SETTINGS = { autoWeekly: false, destination: "supabase", retention: 12, lastRunAt: "" };
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

const defaultSettings = () => ({
  categories: DEF_CATEGORIES,
  platforms: DEF_PLATFORMS,
  paymentMethods: DEF_PAYMENT_METHODS,
  customers: [],
  customerProfiles: {},
  hiddenCustomerKeys: [],
  dashboardCards: {},
  navOrder: [],
  navUtilityIds: DEFAULT_NAV_UTILITY_IDS,
  backup: DEFAULT_BACKUP_SETTINGS,
});

const normalizeSettings = (settings = {}) => ({
  categories: settings.categories || DEF_CATEGORIES,
  platforms: settings.platforms || DEF_PLATFORMS,
  paymentMethods: settings.paymentMethods || DEF_PAYMENT_METHODS,
  customers: settings.customers || [],
  customerProfiles: settings.customerProfiles || {},
  hiddenCustomerKeys: Array.isArray(settings.hiddenCustomerKeys) ? settings.hiddenCustomerKeys : [],
  dashboardCards: settings.dashboardCards || {},
  navOrder: Array.isArray(settings.navOrder) ? settings.navOrder : [],
  navUtilityIds: Array.isArray(settings.navUtilityIds) ? settings.navUtilityIds : DEFAULT_NAV_UTILITY_IDS,
  backup: { ...DEFAULT_BACKUP_SETTINGS, ...(settings.backup || {}) },
});

export {
  DEFAULT_NAV_UTILITY_IDS,
  DEFAULT_BACKUP_SETTINGS,
  saveLabelFor,
  defaultSettings,
  normalizeSettings,
};
