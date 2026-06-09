import { FREQ_LABEL, PREORDER_THRESHOLD } from "./constants.js";

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

// Advance by whole months without day-of-month overflow (Jan 31 + 1mo = Feb 28, not Mar 3).
const addMonthsClamped = (d, months) => {
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
};

const advanceDate = (dateStr, freq, customDays) => {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return today();
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "fortnightly") d.setDate(d.getDate() + 14);
  else if (freq === "yearly") addMonthsClamped(d, 12);
  else if (freq === "custom") d.setDate(d.getDate() + frequencyDays(freq, customDays));
  // Unknown frequencies fall back to monthly (matches frequencyDays/monthlyEquiv)
  // so the returned date always moves forward.
  else addMonthsClamped(d, 1);
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
  return { bg: "#232c3c", fg: "#9ca3af", text: `${bdays}bd` };
};

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

export {
  businessDaysUntil,
  frequencyDays,
  frequencyLabel,
  advanceDate,
  monthlyEquiv,
  preorderBadge,
  sydneyDate,
  today,
  daysAgo,
  getFilterDate,
};
