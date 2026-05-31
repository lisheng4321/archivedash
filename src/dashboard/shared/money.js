import { EBAY_AU_FEE_RATE, EBAY_AU_FIXED_ORDER_FEE } from "./constants.js";
import { monthlyEquiv } from "./dates.js";

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const formatMoney = (v, code = "AUD") => {
  const n = Number(v);
  const c = String(code || "AUD").toUpperCase();
  if (isNaN(n)) return c === "AUD" ? "AU$0" : `${c} 0`;
  if (c === "AUD") return (n < 0 ? "-AU$" : "AU$") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${c} ${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const currency = (v) => formatMoney(v, "AUD");
const toCents = (value) => Math.round((Number(value) || 0) * 100);
const fromCents = (cents) => cents / 100;
const computeProfit = ({ salePrice, cost, shipping = 0, fees = 0 }) =>
  fromCents(toCents(salePrice) - toCents(cost) - toCents(shipping) - toCents(fees));
const estimateEbayFee = (salePrice) => {
  const sale = Number(salePrice) || 0;
  return sale > 0 ? fromCents(toCents(sale * EBAY_AU_FEE_RATE) + toCents(EBAY_AU_FIXED_ORDER_FEE)) : 0;
};

const subFxRate = (sub, liveRates = {}) => {
  const code = String(sub?.currency || "AUD").toUpperCase();
  if (code === "AUD") return 1;
  return Number(liveRates[code]) || Number(sub?.fxRateToAud) || 1;
};
const subAmountAud = (sub, liveRates = {}) => fromCents(toCents((parseFloat(sub?.amount) || 0) * subFxRate(sub, liveRates)));
const subMonthlyAud = (sub, liveRates = {}) => monthlyEquiv(subAmountAud(sub, liveRates), sub?.frequency, sub?.customDays);

export {
  genId,
  formatMoney,
  currency,
  toCents,
  fromCents,
  computeProfit,
  estimateEbayFee,
  subFxRate,
  subAmountAud,
  subMonthlyAud,
};
