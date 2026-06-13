import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../supabase.js";
import { buildPricingProfiles, buildPricingReviews, inventoryWithEbayListingPrices, reviewEvidenceSource } from "../../pricing/pricingEngine.js";
import { currency, computeProfit, EmptyState, estimateEbayFee, ghostBtn, KPI, primaryBtn, today } from "../shared.jsx";

const panel = { background: "#121a2b", border: "1px solid #232c3c", borderRadius: 8 };
const muted = { color: "#7c8aa0" };
const smallCaps = { color: "#8b97ad", fontSize: 11, textTransform: "uppercase", fontWeight: 800, letterSpacing: 0.5 };
const inputStyle = { width: "100%", background: "#0d1117", border: "1px solid #232c3c", borderRadius: 8, color: "#e5e7eb", padding: "8px 10px", fontSize: 12, boxSizing: "border-box" };
const tweakStorageKey = "archivedash-pricing-tweaks-v1";
const customCardsStorageKey = "archivedash-pricing-custom-cards-v1";
const syncMetaStorageKey = "archivedash-pricing-sync-meta-v1";
const activeListingsStorageKey = "archivedash-pricing-active-listings-v1";
const liveCompsStorageKey = "archivedash-pricing-live-comps-v1";
const uiStateStorageKey = "archivedash-pricing-ui-state-v1";
const defaultExclude = "acrylic, empty, box only, case only, damaged, custom, replica, proxy, bundle, lot, combo";
const ownEbaySeller = "thearchive777";

const splitTerms = (value) => String(value || "")
  .split(",")
  .map((term) => term.trim())
  .filter(Boolean);

const joinTerms = (terms) => Array.isArray(terms) ? terms.join(", ") : "";

const loadTweaks = () => {
  try {
    return JSON.parse(window.localStorage.getItem(tweakStorageKey) || "{}");
  } catch {
    return {};
  }
};

const saveTweaks = (next) => {
  try {
    window.localStorage.setItem(tweakStorageKey, JSON.stringify(next));
  } catch {
    // Local review tweaks are optional; ignore private-mode storage failures.
  }
};

const loadCustomCards = () => {
  try {
    const cards = JSON.parse(window.localStorage.getItem(customCardsStorageKey) || "[]");
    return Array.isArray(cards) ? cards.filter((card) => card?.name) : [];
  } catch {
    return [];
  }
};

const saveCustomCards = (next) => {
  try {
    window.localStorage.setItem(customCardsStorageKey, JSON.stringify(next));
  } catch {
    // Custom market cards are local-only review helpers.
  }
};

const loadSyncMeta = () => {
  try {
    return JSON.parse(window.localStorage.getItem(syncMetaStorageKey) || "{}");
  } catch {
    return {};
  }
};

const saveSyncMeta = (next) => {
  try {
    window.localStorage.setItem(syncMetaStorageKey, JSON.stringify(next));
  } catch {
    // Sync metadata only helps the review UI explain freshness.
  }
};

const loadActiveListings = () => {
  try {
    const rows = JSON.parse(window.localStorage.getItem(activeListingsStorageKey) || "[]");
    return Array.isArray(rows) ? rows.filter((listing) => listing?.title && Number(listing?.price) > 0) : [];
  } catch {
    return [];
  }
};

const saveActiveListings = (next) => {
  try {
    window.localStorage.setItem(activeListingsStorageKey, JSON.stringify(next || []));
  } catch {
    // Cached active listings only support local manual matching.
  }
};

const loadLiveComps = () => {
  try {
    const rows = JSON.parse(window.localStorage.getItem(liveCompsStorageKey) || "[]");
    return Array.isArray(rows) ? rows.filter((comp) => comp?.profileId && comp?.title) : [];
  } catch {
    return [];
  }
};

const saveLiveComps = (next) => {
  try {
    window.localStorage.setItem(liveCompsStorageKey, JSON.stringify(next || []));
  } catch {
    // Cached comps keep Market Review usable after navigation.
  }
};

const loadUiState = () => {
  try {
    return JSON.parse(window.localStorage.getItem(uiStateStorageKey) || "{}");
  } catch {
    return {};
  }
};

const saveUiState = (next) => {
  try {
    window.localStorage.setItem(uiStateStorageKey, JSON.stringify(next || {}));
  } catch {
    // UI position is nice-to-have only.
  }
};

const formatDateTime = (value) => {
  if (!value) return "";
  let date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (match) {
      let hour = Number(match[4]);
      const period = match[7]?.toLowerCase();
      if (period === "pm" && hour < 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), hour, Number(match[5]), Number(match[6] || 0));
    }
  }
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const slugish = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 72) || "card";

const pricingProfileIdForName = (value) => `inventory-${String(value || "")
  .toLowerCase()
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .replace(/\s+/g, "-")
  .slice(0, 80) || "item"}`;

const wordsFor = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .split(/\s+/)
  .filter((word) => word.length > 2)
  .slice(0, 8);

const isOwnSeller = (seller) => String(seller || "").trim().toLowerCase() === ownEbaySeller;

const listingKey = (listing) => String(listing?.listingId || listing?.offerId || listing?.sku || listing?.id || "");

const listingPrice = (listing) => {
  const total = Number(listing?.total);
  if (Number.isFinite(total) && total > 0) return total;
  const price = Number(listing?.price);
  if (Number.isFinite(price) && price > 0) return price;
  return 0;
};

const listingLabel = (listing) => {
  const title = String(listing?.title || "Untitled listing");
  const price = listingPrice(listing) > 0 ? ` - ${currency(listingPrice(listing))}` : "";
  const sku = listing?.sku ? ` - SKU ${listing.sku}` : "";
  const mine = listing.isOwnListing || isOwnSeller(listing.seller) ? " - your listing" : "";
  return `${title}${price}${sku}${mine}`;
};

const uniqueListings = (rows) => {
  const seen = new Set();
  return rows.filter((listing) => {
    const key = listingKey(listing);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cardToProfile = (card) => ({
  id: card.id,
  name: card.name,
  query: card.query || card.name,
  market: card.market || "Custom",
  strategy: "Top true AU active comps",
  demoCurrentPrice: Number(card.currentPrice) || 0,
  currentPriceSource: Number(card.currentPrice) > 0 ? "manualOverride" : "notListed",
  floorBuffer: 5,
  source: "custom",
  inventoryId: card.inventoryId || null,
  inventoryName: card.inventoryName || "",
  required: splitTerms(card.required).length ? splitTerms(card.required) : wordsFor(card.name),
  excludeTerms: splitTerms(card.exclude || defaultExclude),
});

const withTweaks = (profiles, tweaks, listings = []) => profiles
  .filter(Boolean)
  .map((profile) => {
    const tweak = tweaks[profile.id] || {};
    if (tweak.hidden) return null;
    const priceOverride = Number(tweak.priceOverride);
    const manualListing = tweak.manualListingKey
      ? listings.find((listing) => listingKey(listing) === tweak.manualListingKey)
      : null;
    const manualListingPrice = listingPrice(manualListing);
    const matchedProfile = manualListing && Number.isFinite(manualListingPrice) && manualListingPrice > 0
      ? {
        ...profile,
        demoCurrentPrice: manualListingPrice,
        currentPriceSource: "manualListing",
        manualEbayListing: {
          ebayListingId: manualListing.listingId || manualListing.id || "",
          ebayOfferId: manualListing.offerId || "",
          ebaySku: manualListing.sku || "",
          ebayListingTitle: manualListing.title || "",
          ebayListingMatchScore: 100,
          price: manualListingPrice,
        },
      }
      : profile;
    return {
      ...matchedProfile,
      query: tweak.query?.trim() || matchedProfile.query,
      required: tweak.required !== undefined ? splitTerms(tweak.required) : matchedProfile.required,
      excludeTerms: tweak.exclude !== undefined ? splitTerms(tweak.exclude) : matchedProfile.excludeTerms,
      targetMode: tweak.targetMode || matchedProfile.targetMode,
      demoCurrentPrice: Number.isFinite(priceOverride) && priceOverride > 0 ? priceOverride : matchedProfile.demoCurrentPrice,
      currentPriceSource: Number.isFinite(priceOverride) && priceOverride > 0 ? "manualOverride" : matchedProfile.currentPriceSource,
    };
  })
  .filter(Boolean);

const buildSyncProfiles = (baseProfiles, currentTweaks, listings, maxProfiles = 50) => (
  withTweaks(baseProfiles, currentTweaks, listings)
    .slice(0, maxProfiles)
    .map((profile) => ({ id: profile.id, query: profile.query }))
);

const statusStyle = (status) => {
  if (status === "Competitive") return { bg: "#123326", fg: "#86efac" };
  if (status === "Ready to list") return { bg: "#172554", fg: "#93c5fd" };
  if (status === "Review price") return { bg: "#3b2f1f", fg: "#fbbf24" };
  if (status === "Needs eBay price") return { bg: "#3b1f2b", fg: "#f9a8d4" };
  if (status === "Needs tuning") return { bg: "#2f243d", fg: "#c4b5fd" };
  return { bg: "#1e3a5f", fg: "#93c5fd" };
};

const reviewOrder = (review) => {
  const priorities = {
    missing_price: 0,
    lower: 1,
    raise: 2,
    list: 3,
    manual: 0.5,
    hold: 5,
  };
  return priorities[review.action] ?? 9;
};

const filterMatches = (review, filter) => {
  if (filter === "all") return true;
  if (filter === "price") return ["lower", "raise"].includes(review.action);
  return review.action === filter;
};

const sortedReviews = (reviews, sort) => {
  const rows = [...reviews];
  if (sort === "name") return rows.sort((a, b) => a.profile.name.localeCompare(b.profile.name));
  if (sort === "comps") return rows.sort((a, b) => b.activeCount - a.activeCount || reviewOrder(a) - reviewOrder(b));
  if (sort === "suggestion") return rows.sort((a, b) => Math.abs((b.currentPrice || 0) - (b.suggestedPrice || 0)) - Math.abs((a.currentPrice || 0) - (a.suggestedPrice || 0)));
  return rows.sort((a, b) => reviewOrder(a) - reviewOrder(b) || b.activeCount - a.activeCount || a.profile.name.localeCompare(b.profile.name));
};

const badge = (label, tone) => (
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 86, minHeight: 24, padding: "2px 7px", borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: 11, fontWeight: 800, lineHeight: 1.05, textAlign: "center", boxSizing: "border-box" }}>
    {label}
  </span>
);

const evidenceTone = {
  live: { label: "Live", bg: "#0e2a3b", fg: "#67e8f9" },
  stale: { label: "Stale", bg: "#3b2f1f", fg: "#fbbf24" },
  sample: { label: "Sample", bg: "#2f243d", fg: "#c4b5fd" },
  manual: { label: "Manual", bg: "#1e293b", fg: "#93c5fd" },
};

const evidenceHint = {
  live: "Recommendation is based on freshly synced live eBay comps.",
  stale: "Recommendation is based on cached comps. Sync live eBay comps to confirm.",
  sample: "Recommendation is based on sample data, not live market comps.",
  manual: "Recommendation is based on a manual price, not live comps.",
};

const evidencePill = (source) => {
  const tone = evidenceTone[source];
  if (!tone) return null;
  return (
    <span title={evidenceHint[source]} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: 11, fontWeight: 800, lineHeight: 1.05, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.fg }} />
      {tone.label}
    </span>
  );
};

const evidenceQualifier = (source) => {
  if (source === "stale") return "Based on cached comps - sync live eBay comps to confirm this recommendation.";
  if (source === "sample") return "Based on sample data, not live market comps.";
  if (source === "manual") return "Based on a manual price. No live comps support this recommendation yet.";
  return "No live comps yet - sync eBay comps for a confident recommendation.";
};

const suggestionText = (review) => {
  if (review.action === "hold") return "Hold";
  if (review.action === "missing_price") return "Add price";
  if (review.action === "manual") return "Needs comps";
  return currency(review.suggestedPrice);
};

const listingText = (review) => {
  if (review.currentPriceSource === "notListed") return "Not listed";
  return review.currentPrice ? currency(review.currentPrice) : "Missing";
};

const rankText = (review) => (review.rank ? `#${review.rank}` : "n/a");

const averageCost = (items = []) => {
  const costs = items.map((item) => Number(item?.price)).filter((value) => Number.isFinite(value) && value > 0);
  return costs.length ? costs.reduce((sum, value) => sum + value, 0) / costs.length : 0;
};

const estimateProfit = (price, cost) => {
  const salePrice = Number(price) || 0;
  const unitCost = Number(cost) || 0;
  const fees = estimateEbayFee(salePrice);
  const profit = computeProfit({ salePrice, cost: unitCost, fees });
  return {
    salePrice,
    fees,
    profit,
    margin: salePrice > 0 ? (profit / salePrice) * 100 : 0,
  };
};

const uniquePricePoints = (points) => {
  const seen = new Set();
  return points
    .filter((point) => Number(point?.price) > 0)
    .filter((point) => {
      const key = Number(point.price).toFixed(2);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
};

const compSubtitle = (comp) => {
  const bits = [];
  if (comp.soldDate) bits.push(comp.soldDate);
  if (comp.seller) bits.push(comp.seller);
  if (comp.watchers) bits.push(`${comp.watchers} watchers`);
  if (comp.soldCount) bits.push(`${comp.soldCount} sold`);
  return bits.join(" - ");
};

function CompTable({ title, rows, empty, isMobile, onHide }) {
  return (
    <div style={{ ...panel, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", borderBottom: "1px solid #232c3c", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800 }}>{title}</div>
        <span style={{ color: "#8b97ad", fontSize: 11 }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 18, textAlign: "center", color: "#374151", fontSize: 12 }}>{empty}</div>
      ) : (
        <div>
          {!isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: onHide ? "1fr 86px 78px 58px" : "1fr 86px 78px", gap: 10, padding: "8px 14px", borderBottom: "1px solid #232c3c11", ...smallCaps }}>
              <span>Comp</span>
              <span style={{ textAlign: "right" }}>Total</span>
      ó®µ¶‰žËkºwµçmÍå¹MÑ…ÑÕÍôð½ÍÁ…¸ùô(€€€€€€€€€í±…ÍÑMå¹Ð€˜˜€ (€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”õíì‘¥ÍÁ±…äè€‰¥¹±¥¹”µ™±•àˆ°…±¥¹%Ñ•µÌè€‰•¹Ñ•Èˆ°…Àè€Ø°Á…‘‘¥¹œè€ˆÑÁà€áÁàˆ°‰½É‘•ÉI…‘¥ÕÌè€äää°‰…­É½Õ¹è€ˆŒÁÄÄÄÜˆ°‰½É‘•Èè€ˆÅÁàÍ½±¥€ŒÈÌÉŒÍŒˆ°½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€àÀÀõôø(€€€€€€€€€€€€€1…ÍÐÍå¹•í™½Éµ…Ñ…Ñ•Q¥µ”¡±…ÍÑMå¹Ð¥ô(€€€€€€€€€€€€ð½ÍÁ…¸ø(€€€€€€€€€€¥ô(€€€€€€€€€íÍå¹MÑ…ÑÕÌ¹¥¹±Õ‘•Ì ‰I•½¹¹•Ðˆ¤€˜˜½¹¹•Ñ‰…ä€˜˜€ (€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õí½¹¹•Ñ‰…åôÍÑå±”õíì€¸¸¹¡½ÍÑ	Ñ¸°Á…‘‘¥¹œè€ˆÕÁà€åÁàˆ°™½¹ÑM¥é”è€ÄÄ°½±½Èè€ˆŒäÍŒÕ™ˆõôùI•½¹¹•Ð•	…äð½‰ÕÑÑ½¸ø(€€€€€€€€€€¥ô(€€€€€€€€ð½‘¥Øø(€€€€€€¥ô((€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè¥Í5½‰¥±”€ü€‰É•Á•…Ð È°€Å™È¤ˆ€è€‰É•Á•…Ð Ð°€Å™È¤ˆ°…Àè€ÄÀ°µ…É¥¹	½ÑÑ½´è€ÄÐõôø(€€€€€€€€ñ-A$±…‰•°ô‰AÉ½‘ÕÑÌˆÙ…±Õ”õíÉ•Ù¥•Ý½Õ¹Ñô€¼ø(€€€€€€€€ñ-A$±…‰•°ô‰9••É•Ù¥•ÜˆÙ…±Õ”õíÉ•Ù¥•Ý9••‘•‘ô…•¹ÐõíÉ•Ù¥•Ý9••‘•€ü€ˆ™‰‰˜ÈÐˆ€è€ˆŒÌÑÌää‰ô€¼ø(€€€€€€€€ñ-A$±…‰•°ô‰%¹±Õ‘•½µÁÌˆÙ…±Õ”õí¥¹±Õ‘•‘½Õ¹Ñô€¼ø(€€€€€€€€ñ-A$±…‰•°ô‰I•©•Ñ•½µÁÌˆÙ…±Õ”õí•á±Õ‘•‘½Õ¹Ñô…•¹Ðõí•á±Õ‘•‘½Õ¹Ð€ü€ˆ˜àÜÄÜÄˆ€èÕ¹‘•™¥¹•‘ô€¼ø(€€€€€€ð½‘¥Øø((€€€€€í…‘‘…É‘M•Ñ¥½¹ô((€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè¥Í5½‰¥±”€ü€ˆÅ™Èˆ€è€ˆÌÈÁÁàµ¥¹µ…à À°€Å™È¤ˆ°…Àè€ÄÐ°…±¥¹%Ñ•µÌè€‰ÍÑ…ÉÐˆõôø(€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°™±•á¥É•Ñ¥½¸è€‰½±Õµ¸ˆ°…Àè€ÄÀ°Á½Í¥Ñ¥½¸è¥Í5½‰¥±”€ü€‰ÍÑ…Ñ¥Œˆ€è€‰ÍÑ¥­äˆ°Ñ½Àè€ÄÈ°µ…á!•¥¡Ðè¥Í5½‰¥±”€ü€‰¹½¹”ˆ€è€‰…±Œ ÄÀÁÙ €´€ÄäÁÁà¤ˆ°µ¥¹!•¥¡Ðè€Àõôø(€€€€€€€€€€ñ‘¥ØÍÑå±”õíì€¸¸¹Á…¹•°°Á…‘‘¥¹œè€ÄÀ°‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè€ˆÅ™Èˆ°…Àè€à°™±•áM¡É¥¹¬è€Àõôø(€€€€€€€€€€€€ñ¥¹ÁÕÐÙ…±Õ”õí…É‘M•…É¡ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ…É‘M•…É ¡”¹Ñ…É•Ð¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‰M•…É ÁÉ½‘ÕÑÌˆÍÑå±”õí¥¹ÁÕÑMÑå±•ô€¼ø(€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè€ˆÅ™È€Å™Èˆ°…Àè€àõôø(€€€€€€€€€€€€€€ñÍ•±•ÐÙ…±Õ”õí…É‘¥±Ñ•Éô½¹¡…¹”õì¡”¤€ôøÍ•Ñ…É‘¥±Ñ•È¡”¹Ñ…É•Ð¹Ù…±Õ”¥ôÍÑå±”õí¥¹ÁÕÑMÑå±•ôø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰…±°ˆù±°ÍÑ…ÑÕÍ•Ìð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰µ¥ÍÍ¥¹}ÁÉ¥”ˆù9••‘Ì•	…äÁÉ¥”ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰ÁÉ¥”ˆùI•Ù¥•ÜÁÉ¥”ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰±¥ÍÐˆùI•…‘äÑ¼±¥ÍÐð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰µ…¹Õ…°ˆù9••‘Ì½µÁÌð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰¡½±ˆù½µÁ•Ñ¥Ñ¥Ù”ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€€€€€ñÍ•±•ÐÙ…±Õ”õí…É‘M½ÉÑô½¹¡…¹”õì¡”¤€ôøÍ•Ñ…É‘M½ÉÐ¡”¹Ñ…É•Ð¹Ù…±Õ”¥ôÍÑå±”õí¥¹ÁÕÑMÑå±•ôø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰É•½µµ•¹‘•ˆùI•½µµ•¹‘•ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰¹…µ”ˆù9…µ”µhð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰½µÁÌˆù5½ÍÐ½µÁÌð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰ÍÕ•ÍÑ¥½¸ˆù	¥•ÍÐ¡…¹”ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆŒáˆäÝ…ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀõôùíÙ¥Í¥‰±•I•Ù¥•ÝÌ¹±•¹Ñ¡ôÍ¡½Ý¸ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°™±•á¥É•Ñ¥½¸è€‰½±Õµ¸ˆ°…Àè€ÄÀ°½Ù•É™±½Ýdè¥Í5½‰¥±”€ü€‰Ù¥Í¥‰±”ˆ€è€‰…ÕÑ¼ˆ°Á…‘‘¥¹I¥¡Ðè¥Í5½‰¥±”€ü€À€è€Ì°µ¥¹!•¥¡Ðè€Àõôø(€€€€€€€€€íÙ¥Í¥‰±•I•Ù¥•ÝÌ¹µ…À ¡É•Ù¥•Ü¤€ôøì(€€€€€€€€€€€½¹ÍÐÉ•Ù¥•ÝQ½¹”€ôÍÑ…ÑÕÍMÑå±”¡É•Ù¥•Ü¹ÍÑ…ÑÕÌ¤ì(€€€€€€€€€€€½¹ÍÐÉ•Ù¥•ÝÙ¥‘•¹”€ôÉ•Ù¥•ÝÙ¥‘•¹•M½ÕÉ”¡É•Ù¥•Ü°ì±…ÍÑMå¹Ð°ÕÉÉ•¹Ñ…Ñ”èÉ•Ù¥•Ý…Ñ”ô¤ì(€€€€€€€€€€€½¹ÍÐÉ•Ù¥•Ý1¥Ù”€ôÉ•Ù¥•ÝÙ¥‘•¹”€ôôô€‰±¥Ù”ˆì(€€€€€€€€€€€½¹ÍÐ¥ÍM•±•Ñ•€ôÍ•±•Ñ•¹ÁÉ½™¥±”¹¥€ôôôÉ•Ù¥•Ü¹ÁÉ½™¥±”¹¥ì(€€€€€€€€€€€É•ÑÕÉ¸€ (€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸­•äõíÉ•Ù¥•Ü¹ÁÉ½™¥±”¹¥‘ô½¹±¥¬õì ¤€ôøÍ•ÑM•±•Ñ•‘%¡É•Ù¥•Ü¹ÁÉ½™¥±”¹¥¥ôÍÑå±”õíì€¸¸¹Á…¹•°°Á…‘‘¥¹œè€ÄÐ°µ¥¹!•¥¡Ðè€äà°Ñ•áÑ±¥¸è€‰±•™Ðˆ°ÕÉÍ½Èè€‰Á½¥¹Ñ•Èˆ°‰…­É½Õ¹è¥ÍM•±•Ñ•€ü€ˆŒÄÈÅ„É„ˆ€è€ˆŒÄÈÅ„Éˆˆ°‰½É‘•É½±½Èè¥ÍM•±•Ñ•€ü€ˆŒÈÔØÍ•ˆØØˆ€è€ˆŒÈÌÉŒÍŒˆ°™½¹Ñ…µ¥±äè€‰¥¹¡•É¥Ðˆõôø(€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè€‰µ¥¹µ…à À°€Å™È¤€äÁÁàˆ°…Àè€à°…±¥¹%Ñ•µÌè€‰ÍÑ…ÉÐˆ°µ…É¥¹	½ÑÑ½´è€àõôø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆ˜Í˜Ù™ˆˆ°™½¹ÑM¥é”è€ÄÌ°™½¹Ñ]•¥¡Ðè€àÀÀ°µ¥¹!•¥¡Ðè€ÌÐ°±¥¹•!•¥¡Ðè€Ä¸ÈÔ°½Ù•É™±½Üè€‰¡¥‘‘•¸ˆ°½Ù•É™±½Ý]É…Àè€‰…¹åÝ¡•É”ˆ°Ý½É‘	É•…¬è€‰‰É•…¬µÝ½Éˆ°‘¥ÍÁ±…äè€ˆµÝ•‰­¥Ðµ‰½àˆ°]•‰­¥Ñ1¥¹•±…µÀè€È°]•‰­¥Ñ	½á=É¥•¹Ðè€‰Ù•ÉÑ¥…°ˆõôùíÉ•Ù¥•Ü¹ÁÉ½™¥±”¹¹…µ•ôð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°™±•á¥É•Ñ¥½¸è€‰½±Õµ¸ˆ°…±¥¹%Ñ•µÌè€‰™±•àµ•¹ˆ°…Àè€Ðõôø(€€€€€€€€€€€€€€€€€€€í‰…‘”¡É•Ù¥•Ü¹ÍÑ…ÑÕÌ°É•Ù¥•ÝQ½¹”¥ô(€€€€€€€€€€€€€€€€€€€í•Ù¥‘•¹•A¥±°¡É•Ù¥•ÝÙ¥‘•¹”¥ô(€€€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè€‰µ¥¹µ…à À°€Å™È¤€ÔÁÁàµ¥¹µ…à À°€Å™È¤ˆ°…Àè€à°™½¹ÑM¥é”è€ÄÄ°…±¥¹%Ñ•µÌè€‰ÍÑ…ÉÐˆõôø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíìµ¥¹]¥‘Ñ è€Àõôøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùíÉ•Ù¥•Ü¹ÕÉÉ•¹ÑAÉ¥•M½ÕÉ”€ôôô€‰µ…¹Õ…±1¥ÍÑ¥¹œˆ€ü€‰5…¹Õ…°µ…Ñ ˆ€èÉ•Ù¥•Ü¹ÕÉÉ•¹ÑAÉ¥•M½ÕÉ”€ôôô€‰•‰…å1¥ÍÑ•‘AÉ¥”ˆ€ü€‰•	…äÁÉ¥”ˆ€èÉ•Ù¥•Ü¹ÕÉÉ•¹ÑAÉ¥•M½ÕÉ”€ôôô€‰µ…¹Õ…±=Ù•ÉÉ¥‘”ˆ€ü€‰=Ù•ÉÉ¥‘”ˆ€è€‰1¥ÍÑ¥¹œ‰ôð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½Èè€ˆ”Õ”Ý•ˆˆ°™½¹Ñ]•¥¡Ðè€àÀÀ°½Ù•É™±½Ý]É…Àè€‰…¹åÝ¡•É”ˆõôùí±¥ÍÑ¥¹Q•áÐ¡É•Ù¥•Ü¥ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíìµ¥¹]¥‘Ñ è€Àõôøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùI…¹¬ð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½ÈèÉ•Ù¥•Ü¹É…¹¬€ü€ˆ”Õ”Ý•ˆˆ€è€ˆŒÝŒá…„Àˆ°™½¹Ñ]•¥¡Ðè€àÀÀ°½Ù•É™±½Ý]É…Àè€‰…¹åÝ¡•É”ˆõôùíÉ…¹­Q•áÐ¡É•Ù¥•Ü¥ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíìµ¥¹]¥‘Ñ è€Àõôøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùMÕ•ÍÐð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½ÈèÉ•Ù¥•Ü¹…Ñ¥½¸€ôôô€‰¡½±ˆ€ü€ˆŒÌÑÌääˆ€è€ˆ™‰‰˜ÈÐˆ°™½¹Ñ]•¥¡Ðè€àÀÀ°½Ù•É™±½Ý]É…Àè€‰…¹åÝ¡•É”ˆ°½Á…¥ÑäèÉ•Ù¥•Ý1¥Ù”€ü€Ä€è€À¸ÔÔõôùíÍÕ•ÍÑ¥½¹Q•áÐ¡É•Ù¥•Ü¥ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€¤ì(€€€€€€€€€ô¥ô(€€€€€€€€€íÙ¥Í¥‰±•I•Ù¥•ÝÌ¹±•¹Ñ €ôôô€À€˜˜€ñ‘¥ØÍÑå±”õíì€¸¸¹Á…¹•°°Á…‘‘¥¹œè€ÄØ°½±½Èè€ˆŒáˆäÝ…ˆ°™½¹ÑM¥é”è€ÄÈ°Ñ•áÑ±¥¸è€‰•¹Ñ•Èˆõôù9¼ÁÉ½‘ÕÑÌµ…Ñ Ñ¡•Í”™¥±Ñ•ÉÌ¸ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøìÍ•Ñ…É‘M•…É  ˆˆ¤ìÍ•Ñ…É‘¥±Ñ•È ‰…±°ˆ¤ìÍ•Ñ…É‘M½ÉÐ ‰É•½µµ•¹‘•ˆ¤ìõôÍÑå±”õíì€¸¸¹¡½ÍÑ	Ñ¸°‘¥ÍÁ±…äè€‰‰±½¬ˆ°µ…É¥¸è€ˆÄÁÁà…ÕÑ¼€Àˆ°Á…‘‘¥¹œè€ˆÕÁà€ÄÉÁàˆ°™½¹ÑM¥é”è€ÄÄõôù±•…È™¥±Ñ•ÉÌð½‰ÕÑÑ½¸øð½‘¥Øùô(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€ð½‘¥Øø((€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°™±•á¥É•Ñ¥½¸è€‰½±Õµ¸ˆ°…Àè€ÄÐ°µ¥¹]¥‘Ñ è€Àõôø(€€€€€€€€€€ñ‘¥ØÍÑå±”õíì€¸¸¹Á…¹•°°Á…‘‘¥¹œè€ÄØõôø(€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°©ÕÍÑ¥™å½¹Ñ•¹Ðè€‰ÍÁ…”µ‰•ÑÝ••¸ˆ°…Àè€ÄÀ°™±•á]É…Àè€‰ÝÉ…Àˆ°µ…É¥¹	½ÑÑ½´è€ÄÐõôø(€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°…±¥¹%Ñ•µÌè€‰•¹Ñ•Èˆ°…Àè€à°™±•á]É…Àè€‰ÝÉ…Àˆ°µ…É¥¹	½ÑÑ½´è€Ôõôø(€€€€€€€€€€€€€€€€€€ñ ÌÍÑå±”õíìµ…É¥¸è€À°½±½Èè€ˆ˜Í˜Ù™ˆˆ°™½¹ÑM¥é”è€ÄØ°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÍ•±•Ñ•¹ÁÉ½™¥±”¹¹…µ•ôð½ Ìø(€€€€€€€€€€€€€€€€€í‰…‘”¡Í•±•Ñ•¹ÍÑ…ÑÕÌ°Ñ½¹”¥ô(€€€€€€€€€€€€€€€€€í‰…‘”¡€‘íÍ•±•Ñ•¹½¹™¥‘•¹•ô½¹™¥‘•¹•€°Í•±•Ñ•¹½¹™¥‘•¹”€ôôô€‰!¥ ˆ€üì‰œè€ˆŒÄÈÌÌÈØˆ°™œè€ˆŒàÙ•™…Œˆô€èÍ•±•Ñ•¹½¹™¥‘•¹”€ôôô€‰5•‘¥Õ´ˆ€üì‰œè€ˆŒÍˆÉ˜Å˜ˆ°™œè€ˆ™‰‰˜ÈÐˆô€èì‰œè€ˆŒÍˆÅ˜Éˆˆ°™œè€ˆ˜å„áÐˆô¥ô(€€€€€€€€€€€€€€€€€í•Ù¥‘•¹•A¥±°¡Í•±•Ñ•‘Ù¥‘•¹”¥ô(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆŒÝŒá…„Àˆ°™½¹ÑM¥é”è€ÄÈõôùíÍ•±•Ñ•¹ÁÉ½™¥±”¹ÍÑÉ…Ñ•åôð½‘¥Øø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè¥Í5½‰¥±”€ü€‰É•Á•…Ð È°€Å™È¤ˆ€è€‰É•Á•…Ð Ð°€Å™È¤ˆ°…Àè€ÄÀ°µ…É¥¹	½ÑÑ½´è€ÄÐõôø(€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùíÁÉ¥•1…‰•±ôð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½Èè€ˆ˜Í˜Ù™ˆˆ°™½¹ÑM¥é”è€Äà°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÍ•±•Ñ•‘AÉ¥•ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùT…Ñ¥Ù”™±½½Èð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½Èè€ˆ˜Í˜Ù™ˆˆ°™½¹ÑM¥é”è€Äà°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÍ•±•Ñ•¹™±½½È€üÕÉÉ•¹ä¡Í•±•Ñ•¹™±½½È¤€è€‰¸½„‰ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùI…¹¬ð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½Èè€ˆ˜Í˜Ù™ˆˆ°™½¹ÑM¥é”è€Äà°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÉ…¹­Q•áÐ¡Í•±•Ñ•¥ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥Øøñ‘¥ØÍÑå±”õíÍµ…±±…ÁÍôùMÕ•ÍÑ•ð½‘¥Øøñ‘¥ØÍÑå±”õíì½±½ÈèÍ•±•Ñ•¹…Ñ¥½¸€ôôô€‰¡½±ˆ€ü€ˆŒÌÑÌääˆ€è€ˆ™‰‰˜ÈÐˆ°™½¹ÑM¥é”è€Äà°™½¹Ñ]•¥¡Ðè€àÀÀ°½Á…¥ÑäèÍ•±•Ñ•‘1¥Ù”€ü€Ä€è€À¸ÔÔõôùíÍÕ•ÍÑ¥½¹Q•áÐ¡Í•±•Ñ•¥ôð½‘¥Øøð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÌ°±¥¹•!•¥¡Ðè€Ä¸ÔõôùíÍ•±•Ñ•¹É•…Í½¹ôð½‘¥Øø(€€€€€€€€€€€ì…Í•±•Ñ•‘1¥Ù”€˜˜€ (€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíìµ…É¥¹Q½Àè€à°½±½Èè€ˆŒÝŒá…„Àˆ°™½¹ÑM¥é”è€ÄÈ°±¥¹•!•¥¡Ðè€Ä¸ÐÔõôùí•Ù¥‘•¹•EÕ…±¥™¥•È¡Í•±•Ñ•‘Ù¥‘•¹”¥ôð½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€€íÍ•±•Ñ•¹µ…Ñ¡•‘‰…å1¥ÍÑ¥¹œ€˜˜€ (€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíìµ…É¥¹Q½Àè€à°½±½Èè€ˆŒäÍŒÕ™ˆ°™½¹ÑM¥é”è€ÄÈ°±¥¹•!•¥¡Ðè€Ä¸ÐÔõôø(€€€€€€€€€€€€€€€5…Ñ¡••	…ä±¥ÍÑ¥¹œèíÍ•±•Ñ•¹µ…Ñ¡•‘‰…å1¥ÍÑ¥¹œ¹•‰…å1¥ÍÑ¥¹Q¥Ñ±”ñðÍ•±•Ñ•¹µ…Ñ¡•‘‰…å1¥ÍÑ¥¹œ¹¹…µ”ñð€‰U¹Ñ¥Ñ±•±¥ÍÑ¥¹œ‰ô(€€€€€€€€€€€€€€€íÍ•±•Ñ•¹µ…Ñ¡•‘‰…å1¥ÍÑ¥¹œ¹•‰…å1¥ÍÑ¥¹5…Ñ¡M½É”€ü€€ ‘íÍ•±•Ñ•¹µ…Ñ¡•‘‰…å1¥ÍÑ¥¹œ¹•‰…å1¥ÍÑ¥¹5…Ñ¡M½É•ô”Ñ¥Ñ±”µ…Ñ ¥€€è€ˆ‰ô(€€€€€€€€€€€€€€€íÍ•±•Ñ•¹ÕÉÉ•¹ÑAÉ¥•M½ÕÉ”€ôôô€‰µ…¹Õ…±1¥ÍÑ¥¹œˆ€ü€ˆ€´µ…¹Õ…°µ…Ñ ˆ€è€ˆ‰ô(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€¥ô(€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°…Àè€Ø°™±•á]É…Àè€‰ÝÉ…Àˆ°µ…É¥¹Q½Àè€ÄÈõôø(€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”õíìÁ…‘‘¥¹œè€ˆÑÁà€áÁàˆ°‰½É‘•ÉI…‘¥ÕÌè€Ø°‰…­É½Õ¹è€ˆŒÁÄÄÄÜˆ°½±½Èè€ˆŒäÍŒÕ™ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÍ•±•Ñ•¹…Ñ¥Ù•½Õ¹ÑôT…Ñ¥Ù”½µÁÌð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”õíìÁ…‘‘¥¹œè€ˆÑÁà€áÁàˆ°‰½É‘•ÉI…‘¥ÕÌè€Ø°‰…­É½Õ¹è€ˆŒÁÄÄÄÜˆ°½±½Èè€ˆÅÕ‘ˆˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÍ•±•Ñ•¹É•±…Ñ•‘%¹Ù•¹Ñ½Éä¹±•¹Ñ¡ô¥¹Ù•¹Ñ½Éäµ…Ñ¡•Ìð½ÍÁ…¸ø(€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”õíìÁ…‘‘¥¹œè€ˆÑÁà€áÁàˆ°‰½É‘•ÉI…‘¥ÕÌè€Ø°‰…­É½Õ¹è€ˆŒÁÄÄÄÜˆ°½±½Èè€ˆ™„Õ„Ôˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€àÀÀõôùíÍ•±•Ñ•¹•á±Õ‘•‘½Õ¹ÑôÉ•©•Ñ•ð½ÍÁ…¸ø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€ð½‘¥Øø((€€€€€€€€€€ñAÉ½™¥ÑA…¹•°É•Ù¥•ÜõíÍ•±•Ñ•‘ô¥Í5½‰¥±”õí¥Í5½‰¥±•ô€¼ø((€€€€€€€€€íÍ¡½ÝQÕ¹¥¹œ€˜˜€ (€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì€¸¸¹Á…¹•°°Á…‘‘¥¹œè€ÄÐõôø(€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°©ÕÍÑ¥™å½¹Ñ•¹Ðè€‰ÍÁ…”µ‰•ÑÝ••¸ˆ°…Àè€ÄÀ°…±¥¹%Ñ•µÌè€‰•¹Ñ•Èˆ°µ…É¥¹	½ÑÑ½´è€ÄÈõôø(€€€€€€€€€€€€€€€€ñ‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆ˜Í˜Ù™ˆˆ°™½¹ÑM¥é”è€ÄÌ°™½¹Ñ]•¥¡Ðè€àÀÀõôùI•Ù¥•ÜÑÕ¹¥¹œð½‘¥Øø(€€€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆŒÝŒá…„Àˆ°™½¹ÑM¥é”è€ÄÄ°µ…É¥¹Q½Àè€Èõôù1½…°µ½¹±ä½¹ÑÉ½±Ì™½ÈÑ¡¥ÌÁÉ½‘ÕÐ¸ð½‘¥Øø(€€€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õíÉ•Í•ÑM•±•Ñ•‘QÝ•…­ÍôÍÑå±”õíì€¸¸¹¡½ÍÑ	Ñ¸°Á…‘‘¥¹œè€ˆÙÁà€åÁàˆ°™½¹ÑM¥é”è€ÄÄõôùI•Í•Ðð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè¥Í5½‰¥±”€ü€ˆÅ™Èˆ€è€ˆÄ¸Ñ™È€Å™È€Å™Èˆ°…Àè€ÄÀõôø(€€€€€€€€€€€€€€€€ñ±…‰•°ÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀõôø(€€€€€€€€€€€€€€€€€M•…É ÅÕ•Éä(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÙ…±Õ”õíÍ•±•Ñ•‘QÝ•…¬¹ÅÕ•Éä€üüÍ•±•Ñ•¹ÁÉ½™¥±”¹ÅÕ•Éåô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ìÅÕ•Éäè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÍÑå±”õíì€¸¸¹¥¹ÁÕÑMÑå±”°µ…É¥¹Q½Àè€Ôõô€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€ñ±…‰•°ÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀõôø(€€€€€€€€€€€€€€€€€AÉ¥”½Ù•ÉÉ¥‘”(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÑåÁ”ô‰¹Õµ‰•ÈˆÍÑ•ÀôˆÀ¸ÀÄˆÙ…±Õ”õíÍ•±•Ñ•‘QÝ•…¬¹ÁÉ¥•=Ù•ÉÉ¥‘”€üü€ˆ‰ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ìÁÉ¥•=Ù•ÉÉ¥‘”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÍÑå±”õíì€¸¸¹¥¹ÁÕÑMÑå±”°µ…É¥¹Q½Àè€ÔõôÁ±…•¡½±‘•Èô‰Tˆ€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€ñ±…‰•°ÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀõôø(€€€€€€€€€€€€€€€€€AÉ¥¥¹œµ½‘”(€€€€€€€€€€€€€€€€€€ñÍ•±•ÐÙ…±Õ”õíÍ•±•Ñ•‘QÝ•…¬¹Ñ…É•Ñ5½‘”ñð€‰™±½½È‰ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ìÑ…É•Ñ5½‘”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÍÑå±”õíì€¸¸¹¥¹ÁÕÑMÑå±”°µ…É¥¹Q½Àè€Ôõôø(€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰™±½½Èˆù1½Ý•ÍÐ…Ñ¥Ù”½µÀð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ô‰Ñ½ÀØˆùQ½À€Ø…Ñ¥Ù”½µÁÌð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ±…‰•°ÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀ°‘¥ÍÁ±…äè€‰‰±½¬ˆ°µ…É¥¹Q½Àè€ÄÀõôø(€€€€€€€€€€€€€€€5…Ñ¡••	…ä±¥ÍÑ¥¹œ(€€€€€€€€€€€€€€€€ñÍ•±•Ð(€€€€€€€€€€€€€€€€€Ù…±Õ”õíÍ•±•Ñ•‘5…¹Õ…±1¥ÍÑ¥¹-•åô(€€€€€€€€€€€€€€€€€½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ìµ…¹Õ…±1¥ÍÑ¥¹-•äè”¹Ñ…É•Ð¹Ù…±Õ”ô¥ô(€€€€€€€€€€€€€€€€€ÍÑå±”õíì€¸¸¹¥¹ÁÕÑMÑå±”°µ…É¥¹Q½Àè€Ôõô(€€€€€€€€€€€€€€€€ø(€€€€€€€€€€€€€€€€€€ñ½ÁÑ¥½¸Ù…±Õ”ôˆˆùÕÑ¼µ…Ñ €¼¹½Ð±¥ÍÑ•ð½½ÁÑ¥½¸ø(€€€€€€€€€€€€€€€€€íµ…Ñ¡1¥ÍÑ¥¹Ì¹µ…À ¡±¥ÍÑ¥¹œ¤€ôøì(€€€€€€€€€€€€€€€€€€€½¹ÍÐ­•ä€ô±¥ÍÑ¥¹-•ä¡±¥ÍÑ¥¹œ¤ì(€€€€€€€€€€€€€€€€€€€¥˜€ …­•ä¤É•ÑÕÉ¸¹Õ±°ì(€€€€€€€€€€€€€€€€€€€É•ÑÕÉ¸€ñ½ÁÑ¥½¸­•äõí­•åôÙ…±Õ”õí­•åôùí±¥ÍÑ¥¹1…‰•°¡±¥ÍÑ¥¹œ¥ôð½½ÁÑ¥½¸øì(€€€€€€€€€€€€€€€€€ô¥ô(€€€€€€€€€€€€€€€€ð½Í•±•Ðø(€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€íµ…Ñ¡1¥ÍÑ¥¹Ì¹±•¹Ñ €ôôô€À€˜˜€ (€€€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì½±½Èè€ˆŒÝŒá…„Àˆ°™½¹ÑM¥é”è€ÄÄ°µ…É¥¹Q½Àè€ØõôùMå¹Œ•	…ä½µÁÌ™¥ÉÍÐÑ¼±½……Ñ¥Ù”±¥ÍÑ¥¹Ì™½Èµ…¹Õ…°µ…Ñ¡¥¹œ¸1¥ÍÑ¥¹Ì™É½´í½Ý¹‰…åM•±±•Éô…É”…±Í¼ÑÉ•…Ñ•…Ìå½ÕÉÌ¸ð½‘¥Øø(€€€€€€€€€€€€€€¥ô(€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹Ìè¥Í5½‰¥±”€ü€ˆÅ™Èˆ€è€ˆÅ™È€Å™Èˆ°…Àè€ÄÀ°µ…É¥¹Q½Àè€ÄÀõôø(€€€€€€€€€€€€€€€€ñ±…‰•°ÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀõôø(€€€€€€€€€€€€€€€€€5ÕÍÐ¥¹±Õ‘”(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÙ…±Õ”õíÍ•±•Ñ•‘QÝ•…¬¹É•ÅÕ¥É•€üü©½¥¹Q•ÉµÌ¡Í•±•Ñ•¹ÁÉ½™¥±”¹É•ÅÕ¥É•¥ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ìÉ•ÅÕ¥É•è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÍÑå±”õíì€¸¸¹¥¹ÁÕÑMÑå±”°µ…É¥¹Q½Àè€ÔõôÁ±…•¡½±‘•Èô‰¹¥­”°µ¥¹°Í±¥‘•Ìˆ€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€€€ñ±…‰•°ÍÑå±”õíì½±½Èè€ˆŒå„Í…˜ˆ°™½¹ÑM¥é”è€ÄÄ°™½¹Ñ]•¥¡Ðè€ÜÀÀõôø(€€€€€€€€€€€€€€€€€á±Õ‘”(€€€€€€€€€€€€€€€€€€ñ¥¹ÁÕÐÙ…±Õ”õíÍ•±•Ñ•‘QÝ•…¬¹•á±Õ‘”€üü©½¥¹Q•ÉµÌ¡Í•±•Ñ•¹ÁÉ½™¥±”¹•á±Õ‘•Q•ÉµÌ¥ô½¹¡…¹”õì¡”¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ì•á±Õ‘”è”¹Ñ…É•Ð¹Ù…±Õ”ô¥ôÍÑå±”õíì€¸¸¹¥¹ÁÕÑMÑå±”°µ…É¥¹Q½Àè€ÔõôÁ±…•¡½±‘•Èô‰ÕÍ•°‘…µ…•°‰Õ¹‘±”ˆ€¼ø(€€€€€€€€€€€€€€€€ð½±…‰•°ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰™±•àˆ°…Àè€à°™±•á]É…Àè€‰ÝÉ…Àˆ°µ…É¥¹Q½Àè€ÄÈõôø(€€€€€€€€€€€€€€€€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÕÁ‘…Ñ•QÝ•…¬¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥°ì¡¥‘‘•¸èÑÉÕ”ô¥ôÍÑå±”õíì€¸¸¹¡½ÍÑ	Ñ¸°Á…‘‘¥¹œè€ˆÙÁà€åÁàˆ°™½¹ÑM¥é”è€ÄÄ°½±½Èè€ˆ™„Õ„ÔˆõôùíÍ•±•Ñ•¹ÁÉ½™¥±”¹Í½ÕÉ”€ôôô€‰ÕÍÑ½´ˆ€ü€‰!¥‘”ÕÍÑ½´…Éˆ€è€‰!¥‘”¥¹Ù•¹Ñ½Éä…É‰ôð½‰ÕÑÑ½¸ø(€€€€€€€€€€€€€€€íÍ•±•Ñ•¹ÁÉ½™¥±”¹Í½ÕÉ”€ôôô€‰ÕÍÑ½´ˆ€˜˜€ñ‰ÕÑÑ½¸½¹±¥¬õì ¤€ôøÉ•µ½Ù•ÕÍÑ½µ…É¡Í•±•Ñ•¹ÁÉ½™¥±”¹¥¥ôÍÑå±”õíì€¸¸¹¡½ÍÑ	Ñ¸°Á…‘‘¥¹œè€ˆÙÁà€åÁàˆ°™½¹ÑM¥é”è€ÄÄ°½±½Èè€ˆ™„Õ„ÔˆõôùI•µ½Ù”ÕÍÑ½´…Éð½‰ÕÑÑ½¸ùô(€€€€€€€€€€€€€€€€ñÍÁ…¸ÍÑå±”õíì½±½Èè€ˆŒáˆäÝ…ˆ°™½¹ÑM¥é”è€ÄÄ°…±¥¹M•±˜è€‰•¹Ñ•ÈˆõôùIÕ¸Íå¹Œ……¥¸…™Ñ•È¡…¹¥¹œÑ¡”ÅÕ•Éä¸ð½ÍÁ…¸ø(€€€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€€¥ô((€€€€€€€€€€ñ‘¥ØÍÑå±”õíì‘¥ÍÁ±…äè€‰É¥ˆ°É¥‘Q•µÁ±…Ñ•½±Õµ¹ÌèÍ•±•Ñ•¹É½ÕÁÌ¹…ÕM½±¹±•¹Ñ €˜˜€…¥Í5½‰¥±”€ü€ˆÅ™È€Å™Èˆ€è€ˆÅ™Èˆ°…Àè€ÄÐõôø(€€€€€€€€€€€€ñ½µÁQ…‰±”Ñ¥Ñ±”ô‰T…Ñ¥Ù”½µÁÌˆÉ½ÝÌõíÍ•±•Ñ•¹É½ÕÁÌ¹…ÕÑ¥Ù•ô•µÁÑäô‰9¼…Ñ¥Ù”T½µÁÌ¥¹±Õ‘•¸ˆ¥Í5½‰¥±”õí¥Í5½‰¥±•ô½¹!¥‘”õì¡½µÀ¤€ôøÕÁ‘…Ñ•½µÁQÝ•…¬¡½µÀ°€‰¡¥‘”ˆ¥ô€¼ø(€€€€€€€€€€€íÍ•±•Ñ•¹É½ÕÁÌ¹…ÕM½±¹±•¹Ñ €ø€À€˜˜€ñ½µÁQ…‰±”Ñ¥Ñ±”ô‰TÍ½±½µÁÌˆÉ½ÝÌõíÍ•±•Ñ•¹É½ÕÁÌ¹…ÕM½±‘ô•µÁÑäô‰9¼Í½±T½µÁÌ¥¹±Õ‘•¸ˆ¥Í5½‰¥±”õí¥Í5½‰¥±•ô€¼ùô(€€€€€€€€€€ð½‘¥Øø(€€€€€€€€€íÍ•±•Ñ•¹É½ÕÁÌ¹±½‰…±M½±¹±•¹Ñ €ø€À€˜˜€ñ½µÁQ…‰±”Ñ¥Ñ±”ô‰±½‰…°Í½±½µÁÌˆÉ½ÝÌõíÍ•±•Ñ•¹É½ÕÁÌ¹±½‰…±M½±‘ô•µÁÑäô‰9¼±½‰…°Í½±½µÁÌ¥¹±Õ‘•¸ˆ¥Í5½‰¥±”õí¥Í5½‰¥±•ô€¼ùô(€€€€€€€€€€ñá±Õ‘•‘Q…‰±”É½ÝÌõíÍ•±•Ñ•¹•á±Õ‘•‘ô¥Í5½‰¥±”õí¥Í5½‰¥±•ô½¹%¹±Õ‘”õì¡½µÀ¤€ôøÕÁ‘…Ñ•½µÁQÝ•…¬¡½µÀ°½µÀ¹µ…¹Õ…±á±Õ‘•€ü¹Õ±°€è€‰¥¹±Õ‘”ˆ¥ô€¼ø(€€€€€€€€ð½‘¥Øø(€€€€€€ð½‘¥Øø(€€€€ð½‘¥Øø(€€¤ì)ô