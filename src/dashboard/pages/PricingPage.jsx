import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../supabase.js";
import { buildPricingProfiles, buildPricingReviews, inventoryWithEbayListingPrices } from "../../pricing/pricingEngine.js";
import { currency, computeProfit, estimateEbayFee, ghostBtn, KPI, primaryBtn, today } from "../shared.jsx";

const panel = { background: "#121a2b", border: "1px solid #232c3c", borderRadius: 8 };
const muted = { color: "#7c8aa0" };
const smallCaps = { color: "#56627a", fontSize: 10, textTransform: "uppercase", fontWeight: 800, letterSpacing: 0.5 };
const inputStyle = { width: "100%", background: "#0d1117", border: "1px solid #232c3c", borderRadius: 7, color: "#e5e7eb", padding: "8px 10px", fontSize: 12, boxSizing: "border-box" };
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
  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 86, minHeight: 24, padding: "2px 7px", borderRadius: 999, background: tone.bg, color: tone.fg, fontSize: 10, fontWeight: 800, lineHeight: 1.05, textAlign: "center", boxSizing: "border-box" }}>
    {label}
  </span>
);

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
        <span style={{ color: "#56627a", fontSize: 11 }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 18, textAlign: "center", color: "#374151", fontSize: 12 }}>{empty}</div>
      ) : (
        <div>
          {!isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: onHide ? "1fr 86px 78px 58px" : "1fr 86px 78px", gap: 10, padding: "8px 14px", borderBottom: "1px solid #232c3c11", ...smallCaps }}>
              <span>Comp</span>
              <span>Total</span>
              <span>Signal</span>
              {onHide && <span />}
            </div>
          )}
          {rows.map((comp) => (
            <div key={comp.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : onHide ? "1fr 86px 78px 58px" : "1fr 86px 78px", gap: isMobile ? 5 : 10, padding: "10px 14px", borderBottom: "1px solid #232c3c11", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e5e7eb", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{comp.title}</div>
                <div style={{ color: "#56627a", fontSize: 11, marginTop: 3 }}>{compSubtitle(comp)}</div>
              </div>
              <div style={{ color: "#f3f6fb", fontSize: 12, fontWeight: 800 }}>
                {currency(comp.total)}
                {comp.couponPrice !== undefined && <div style={{ color: "#60a5fa", fontSize: 10, fontWeight: 700 }}>coupon</div>}
              </div>
              <div style={{ color: "#9ca3af", fontSize: 11 }}>{comp.scope.toUpperCase()}</div>
              {onHide && <button onClick={() => onHide(comp)} style={{ ...ghostBtn, padding: "4px 7px", fontSize: 10 }}>Hide</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExcludedTable({ rows, isMobile, onInclude }) {
  return (
    <div style={{ ...panel, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", borderBottom: "1px solid #232c3c", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800 }}>Excluded comps</div>
        <span style={{ color: "#56627a", fontSize: 11 }}>{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 18, textAlign: "center", color: "#374151", fontSize: 12 }}>No rejected comps.</div>
      ) : (
        rows.map((comp) => (
          <div key={comp.id} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : onInclude ? "1fr 150px 86px 66px" : "1fr 150px 86px", gap: isMobile ? 5 : 10, padding: "10px 14px", borderBottom: "1px solid #232c3c11", alignItems: "center" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#9ca3af", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap" }}>{comp.title}</div>
              <div style={{ color: "#56627a", fontSize: 11, marginTop: 3 }}>{compSubtitle(comp)}</div>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {comp.reasons.map((reason) => (
                <span key={reason} style={{ padding: "2px 6px", borderRadius: 5, background: "#3b1f1f", color: "#fca5a5", fontSize: 10, fontWeight: 800 }}>{reason}</span>
              ))}
            </div>
            <div style={{ color: "#7c8aa0", fontSize: 12, fontWeight: 700 }}>{currency(comp.total)}</div>
            {onInclude && (comp.ownSellerExcluded || comp.isOwnListing
              ? <span style={{ color: "#93c5fd", fontSize: 10, fontWeight: 800 }}>Mine</span>
              : <button onClick={() => onInclude(comp)} style={{ ...ghostBtn, padding: "4px 7px", fontSize: 10, color: "#86efac" }}>Include</button>)}
          </div>
        ))
      )}
    </div>
  );
}

function ProfitPanel({ review, isMobile }) {
  const unitCost = averageCost(review.relatedInventory);
  const topSixPrice = review.topSixAverage
    ? Math.max(Number(review.floor || 0), Math.round(review.topSixAverage) - 0.05)
    : 0;
  const points = uniquePricePoints([
    { label: "Suggested", price: review.suggestedPrice },
    { label: "Current", price: review.currentPrice },
    { label: "AU floor", price: review.floor },
    { label: "Top comps", price: topSixPrice },
  ]).map((point) => ({ ...point, ...estimateProfit(point.price, unitCost) }));

  if (!unitCost || !points.length) return null;

  return (
    <div style={{ ...panel, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800 }}>Estimated profit</div>
          <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 2 }}>Per unit, after item cost and estimated eBay fees. Shipping and ads not included.</div>
        </div>
        <div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 800 }}>Cost {currency(unitCost)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: 8 }}>
        {points.map((point) => (
          <div key={point.label} style={{ background: "#0d1117", border: "1px solid #232c3c", borderRadius: 7, padding: 10, minWidth: 0 }}>
            <div style={{ color: "#7c8aa0", fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{point.label}</div>
            <div style={{ color: "#f3f6fb", fontSize: 14, fontWeight: 900, marginTop: 4 }}>{currency(point.salePrice)}</div>
            <div style={{ color: point.profit >= 0 ? "#34d399" : "#f87171", fontSize: 13, fontWeight: 900, marginTop: 6 }}>{currency(point.profit)}</div>
            <div style={{ color: "#56627a", fontSize: 11, marginTop: 2 }}>{point.margin.toFixed(1)}% margin</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PricingPage({ ctx }) {
  const { pagePad, inventory, isMobile, connectEbay } = ctx;
  const [initialUiState] = useState(loadUiState);
  const [selectedId, setSelectedId] = useState(initialUiState.selectedId || "");
  const [tweaks, setTweaks] = useState(loadTweaks);
  const [customCards, setCustomCards] = useState(loadCustomCards);
  const [showTuning, setShowTuning] = useState(Boolean(initialUiState.showTuning));
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardSource, setCardSource] = useState("manual");
  const [cardDraft, setCardDraft] = useState({ name: "", query: "", currentPrice: "", required: "", exclude: defaultExclude, inventoryId: "" });
  const [cardFilter, setCardFilter] = useState(initialUiState.cardFilter || "all");
  const [cardSort, setCardSort] = useState(initialUiState.cardSort || "recommended");
  const [cardSearch, setCardSearch] = useState(initialUiState.cardSearch || "");
  const [liveActiveComps, setLiveActiveComps] = useState(loadLiveComps);
  const [ebayListings, setEbayListings] = useState(loadActiveListings);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncMeta, setSyncMeta] = useState(loadSyncMeta);
  const [syncBusy, setSyncBusy] = useState(false);
  useEffect(() => {
    saveUiState({ selectedId, showTuning, cardFilter, cardSort, cardSearch });
  }, [selectedId, showTuning, cardFilter, cardSort, cardSearch]);
  const pricedInventory = useMemo(() => inventoryWithEbayListingPrices(inventory, ebayListings || []), [inventory, ebayListings]);
  const baseProfiles = useMemo(() => [...buildPricingProfiles(pricedInventory), ...customCards.map(cardToProfile)].filter(Boolean), [pricedInventory, customCards]);
  const matchListings = useMemo(() => uniqueListings([
    ...(ebayListings || []),
    ...(Array.isArray(liveActiveComps) ? liveActiveComps : [])
      .filter((comp) => isOwnSeller(comp.seller) && comp.type === "active")
      .map((comp) => ({
        id: comp.id,
        title: comp.title,
        price: comp.price,
        total: comp.total ?? (Number(comp.price || 0) + Number(comp.shipping || 0)),
        seller: comp.seller,
        itemWebUrl: comp.itemWebUrl,
        isOwnListing: true,
      })),
  ]), [ebayListings, liveActiveComps]);
  const profiles = useMemo(() => withTweaks(baseProfiles, tweaks, matchListings), [baseProfiles, tweaks, matchListings]);
  const pricingComps = useMemo(() => {
    if (!Array.isArray(liveActiveComps) || !liveActiveComps.length) return [];
    const liveGroups = new Set(liveActiveComps.map((comp) => `${comp.profileId}:${comp.scope}:${comp.type}`));
    const raw = liveActiveComps.filter((comp) => liveGroups.has(`${comp.profileId}:${comp.scope}:${comp.type}`));
    return raw.map((comp) => {
      const decision = tweaks[comp.profileId]?.comps?.[comp.id];
      const ownListing = isOwnSeller(comp.seller);
      if (!decision && !ownListing) return comp;
      return {
        ...comp,
        isOwnListing: ownListing,
        ownSellerExcluded: ownListing,
        manualIncluded: decision === "include",
        manualExcluded: decision === "hide" || ownListing,
      };
    });
  }, [liveActiveComps, tweaks]);
  const reviews = useMemo(() => sortedReviews(buildPricingReviews({ inventory: pricedInventory, comps: pricingComps, profiles, currentDate: today() }), "recommended"), [pricedInventory, pricingComps, profiles]);
  const visibleReviews = useMemo(() => {
    const q = cardSearch.trim().toLowerCase();
    return sortedReviews(reviews, cardSort).filter((review) => (
      filterMatches(review, cardFilter)
      && (!q || [review.profile.name, review.profile.query, review.profile.market].some((value) => String(value || "").toLowerCase().includes(q)))
    ));
  }, [reviews, cardFilter, cardSearch, cardSort]);
  const selected = reviews.find((review) => review.profile.id === selectedId) || reviews[0];
  const reviewCount = reviews.length;
  const reviewNeeded = reviews.filter((review) => review.action !== "hold").length;
  const includedCount = reviews.reduce((sum, review) => sum + review.included.length, 0);
  const excludedCount = reviews.reduce((sum, review) => sum + review.excluded.length, 0);
  const hiddenCount = baseProfiles.filter((profile) => tweaks[profile.id]?.hidden).length;
  const lastSyncAt = syncMeta.lastSyncAt || "";

  const markSyncComplete = (message) => {
    const nextMeta = { lastSyncAt: new Date().toISOString() };
    setSyncMeta(nextMeta);
    saveSyncMeta(nextMeta);
    setSyncStatus(message);
  };

  const updateTweak = (profileId, patch) => {
    setTweaks((prev) => {
      const next = {
        ...prev,
        [profileId]: {
          ...(prev[profileId] || {}),
          ...patch,
        },
      };
      saveTweaks(next);
      return next;
    });
  };

  const updateCompTweak = (comp, decision) => {
    setTweaks((prev) => {
      const profileTweak = prev[comp.profileId] || {};
      const compTweaks = { ...(profileTweak.comps || {}) };
      if (decision) compTweaks[comp.id] = decision;
      else delete compTweaks[comp.id];
      const next = {
        ...prev,
        [comp.profileId]: {
          ...profileTweak,
          comps: compTweaks,
        },
      };
      saveTweaks(next);
      return next;
    });
  };

  const resetSelectedTweaks = () => {
    if (!selected) return;
    setTweaks((prev) => {
      const next = { ...prev };
      delete next[selected.profile.id];
      saveTweaks(next);
      return next;
    });
  };

  const restoreHiddenProducts = () => {
    setTweaks((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([id, tweak]) => [id, { ...tweak, hidden: false }]));
      saveTweaks(next);
      return next;
    });
  };

  const applyInventoryCard = (id) => {
    const item = inventory.find((row) => row.id === id);
    setCardDraft({
      name: item?.name || "",
      query: item?.name || "",
      currentPrice: item?.ebayListedPrice || "",
      required: wordsFor(item?.name).join(", "),
      exclude: defaultExclude,
      inventoryId: id,
    });
  };

  const addCustomCard = () => {
    const name = cardDraft.name.trim();
    if (!name) return;
    const item = inventory.find((row) => row.id === cardDraft.inventoryId);
    const inventoryProfileId = item?.name ? pricingProfileIdForName(item.name) : "";
    if (cardSource === "inventory" && inventoryProfileId) {
      if (tweaks[inventoryProfileId]?.hidden) {
        setTweaks((prev) => {
          const next = {
            ...prev,
            [inventoryProfileId]: {
              ...(prev[inventoryProfileId] || {}),
              hidden: false,
            },
          };
          saveTweaks(next);
          return next;
        });
      }
      setSelectedId(inventoryProfileId);
      setShowAddCard(false);
      setCardDraft({ name: "", query: "", currentPrice: "", required: "", exclude: defaultExclude, inventoryId: "" });
      return;
    }
    const nextCard = {
      id: `custom-${Date.now()}-${slugish(name)}`,
      name,
      query: cardDraft.query.trim() || name,
      currentPrice: cardDraft.currentPrice,
      required: cardDraft.required,
      exclude: cardDraft.exclude || defaultExclude,
      market: item?.category || "Custom",
      inventoryId: item?.id || "",
      inventoryName: item?.name || "",
    };
    setCustomCards((prev) => {
      const next = [nextCard, ...prev];
      saveCustomCards(next);
      return next;
    });
    setSelectedId(nextCard.id);
    setShowAddCard(false);
    setCardDraft({ name: "", query: "", currentPrice: "", required: "", exclude: defaultExclude, inventoryId: "" });
  };

  const removeCustomCard = (id) => {
    setCustomCards((prev) => {
      const next = prev.filter((card) => card.id !== id);
      saveCustomCards(next);
      return next;
    });
    setSelectedId(reviews.find((review) => review.profile.id !== id)?.profile.id || "");
  };

  const syncLiveComps = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSyncStatus("Supabase is not configured, so live comps cannot be fetched.");
      return;
    }
    setSyncBusy(true);
    setSyncStatus("Fetching live AU active comps...");
    const latestTweaks = loadTweaks();
    setTweaks(latestTweaks);
    const syncProfiles = buildSyncProfiles(baseProfiles, latestTweaks, matchListings);
    const { data, error } = await supabase.functions.invoke("ebay-sync-pricing-comps", {
      body: { profiles: syncProfiles, postcode: "2073", limit: 30 },
    });
    setSyncBusy(false);
    if (error || !Array.isArray(data?.comps)) {
      setSyncStatus(error?.message || data?.error || "Could not fetch live eBay comps. Sample comps are still shown.");
      return;
    }
    setLiveActiveComps(data.comps);
    saveLiveComps(data.comps);
    const total = data.comps.length;
    const soldTotal = data.comps.filter((comp) => comp.type === "sold").length;
    const searchTotal = Array.isArray(data.searches) ? data.searches.reduce((sum, search) => sum + (Number(search.total) || 0), 0) : total;
    const skipped = Math.max(0, withTweaks(baseProfiles, latestTweaks, matchListings).length - syncProfiles.length);
    markSyncComplete(`Loaded ${total - soldTotal} active AU comp${total - soldTotal === 1 ? "" : "s"} for ${syncProfiles.length} product${syncProfiles.length === 1 ? "" : "s"} from ${searchTotal} eBay result${searchTotal === 1 ? "" : "s"}${skipped ? `; ${skipped} product${skipped === 1 ? "" : "s"} not synced yet` : ""}.`);
  };

  const syncEbayListingsAndComps = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setSyncStatus("Supabase is not configured, so live comps cannot be fetched.");
      return;
    }
    setSyncBusy(true);
    setSyncStatus("Fetching your active eBay listings...");
    let listingData = null;
    let listingError = null;
    try {
      const result = await supabase.functions.invoke("ebay-sync-listings", { body: {} });
      listingData = result.data;
      listingError = result.error;
      if (listingError?.context?.json) {
        listingData = await listingError.context.json().catch(() => listingData);
      }
    } catch (error) {
      listingError = error;
    }
    if (listingError || !Array.isArray(listingData?.listings)) {
      setSyncBusy(false);
      const detailText = listingData?.details
        ? ` ${typeof listingData.details === "string" ? listingData.details : JSON.stringify(listingData.details).slice(0, 700)}`
        : "";
      const msg = listingData?.reconnectRequired
        ? "Reconnect eBay from Settings so ArchiveDash can read active listing prices."
        : `${listingData?.error || listingError?.message || "Could not fetch your active eBay listings."}${detailText}`;
      console.error("eBay listing sync failed", { listingData, listingError });
      setSyncStatus(msg);
      return;
    }
    setEbayListings(listingData.listings);
    saveActiveListings(listingData.listings);

    const inventoryWithPrices = inventoryWithEbayListingPrices(inventory, listingData.listings);
    const latestTweaks = loadTweaks();
    const latestCustomCards = loadCustomCards();
    setTweaks(latestTweaks);
    setCustomCards(latestCustomCards);
    const nextBaseProfiles = [...buildPricingProfiles(inventoryWithPrices), ...latestCustomCards.map(cardToProfile)];
    const nextProfiles = withTweaks(nextBaseProfiles, latestTweaks, listingData.listings);
    const syncProfiles = buildSyncProfiles(nextBaseProfiles, latestTweaks, listingData.listings);
    setSyncStatus(`Matched ${listingData.listings.length} active eBay listing${listingData.listings.length === 1 ? "" : "s"}. Fetching market comps...`);
    const { data, error } = await supabase.functions.invoke("ebay-sync-pricing-comps", {
      body: { profiles: syncProfiles, postcode: "2073", limit: 30 },
    });
    setSyncBusy(false);
    if (error || !Array.isArray(data?.comps)) {
      setSyncStatus(error?.message || data?.error || "Fetched your listings, but could not fetch market comps.");
      return;
    }
    setLiveActiveComps(data.comps);
    saveLiveComps(data.comps);
    const matchedPrices = inventoryWithPrices.filter((item) => item.ebayListedPrice).length;
    const soldTotal = data.comps.filter((comp) => comp.type === "sold").length;
    const activeTotal = data.comps.length - soldTotal;
    const skipped = Math.max(0, nextProfiles.length - syncProfiles.length);
    markSyncComplete(`Loaded ${listingData.listings.length} active eBay listing${listingData.listings.length === 1 ? "" : "s"}, matched prices for ${matchedPrices} inventory item${matchedPrices === 1 ? "" : "s"}, and fetched ${activeTotal} active AU comp${activeTotal === 1 ? "" : "s"}${skipped ? `; ${skipped} product${skipped === 1 ? "" : "s"} not synced yet` : ""}.`);
  };

  if (!selected) {
    return <div style={{ padding: pagePad, color: "#7c8aa0" }}>No pricing profiles yet.</div>;
  }

  const tone = statusStyle(selected.status);
  const selectedTweak = tweaks[selected.profile.id] || {};
  const priceLabel = selected.currentPriceSource === "manualListing" ? "Manual match" : selected.currentPriceSource === "ebayListedPrice" ? "eBay listed" : selected.currentPriceSource === "manualOverride" ? "Override" : "Listing";
  const selectedPrice = selected.currentPriceSource === "notListed" ? "Not listed" : selected.currentPrice ? currency(selected.currentPrice) : "Missing";
  const selectedManualListingKey = selectedTweak.manualListingKey || "";

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Market Review</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#56627a" }}>Inventory-driven AU active comp matching</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={syncEbayListingsAndComps} disabled={syncBusy} style={{ ...ghostBtn, color: "#93c5fd" }}>{syncBusy ? "Syncing..." : "Sync eBay Comps"}</button>
          <button onClick={() => setShowAddCard((value) => !value)} style={ghostBtn}>{showAddCard ? "Close add" : "+ Add card"}</button>
          <button onClick={() => setShowTuning((value) => !value)} style={{ ...ghostBtn, color: showTuning ? "#93c5fd" : "#9ca3af" }}>{showTuning ? "Close tuning" : "Tune"}</button>
          {hiddenCount > 0 && <button onClick={restoreHiddenProducts} style={{ ...ghostBtn, color: "#86efac" }}>Restore hidden</button>}
        </div>
      </div>
      {(syncStatus || lastSyncAt) && (
        <div style={{ margin: "-6px 0 14px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {syncStatus && <span style={{ color: syncStatus.includes("Could not") || syncStatus.includes("Reconnect") ? "#fca5a5" : "#93c5fd", fontSize: 12 }}>{syncStatus}</span>}
          {lastSyncAt && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, background: "#0d1117", border: "1px solid #232c3c", color: "#9ca3af", fontSize: 11, fontWeight: 800 }}>
              Last synced {formatDateTime(lastSyncAt)}
            </span>
          )}
          {syncStatus.includes("Reconnect") && connectEbay && (
            <button onClick={connectEbay} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11, color: "#93c5fd" }}>Reconnect eBay</button>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <KPI label="Products" value={reviewCount} />
        <KPI label="Need review" value={reviewNeeded} accent={reviewNeeded ? "#fbbf24" : "#34d399"} />
        <KPI label="Included comps" value={includedCount} />
        <KPI label="Rejected comps" value={excludedCount} accent={excludedCount ? "#f87171" : undefined} />
      </div>

      {showAddCard && (
        <div style={{ ...panel, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ color: "#f3f6fb", fontSize: 14, fontWeight: 800 }}>Add market card</div>
              <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 2 }}>Create a manual card, or restore/select an inventory-backed card.</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setCardSource("manual")} style={{ ...ghostBtn, background: cardSource === "manual" ? "#1e293b" : undefined, color: cardSource === "manual" ? "#93c5fd" : undefined }}>Manual</button>
              <button onClick={() => setCardSource("inventory")} style={{ ...ghostBtn, background: cardSource === "inventory" ? "#1e293b" : undefined, color: cardSource === "inventory" ? "#93c5fd" : undefined }}>From inventory</button>
            </div>
          </div>
          {cardSource === "inventory" && (
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
              Inventory item
              <select value={cardDraft.inventoryId} onChange={(e) => applyInventoryCard(e.target.value)} style={{ ...inputStyle, marginTop: 5 }}>
                <option value="">Select item</option>
                {inventory.map((item) => {
                  const profileId = pricingProfileIdForName(item.name);
                  return <option key={item.id} value={item.id}>{item.name}{tweaks[profileId]?.hidden ? " (hidden)" : ""}</option>;
                })}
              </select>
            </label>
          )}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1.2fr 0.7fr", gap: 10, marginTop: cardSource === "inventory" ? 10 : 0 }}>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
              Card name
              <input value={cardDraft.name} onChange={(e) => setCardDraft((prev) => ({ ...prev, name: e.target.value }))} style={{ ...inputStyle, marginTop: 5 }} placeholder="Product name" />
            </label>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
              Search query
              <input value={cardDraft.query} onChange={(e) => setCardDraft((prev) => ({ ...prev, query: e.target.value }))} style={{ ...inputStyle, marginTop: 5 }} placeholder="eBay search terms" />
            </label>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
              Current price
              <input type="number" step="0.01" value={cardDraft.currentPrice} onChange={(e) => setCardDraft((prev) => ({ ...prev, currentPrice: e.target.value }))} style={{ ...inputStyle, marginTop: 5 }} placeholder="Optional" />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginTop: 10 }}>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
              Must include
              <input value={cardDraft.required} onChange={(e) => setCardDraft((prev) => ({ ...prev, required: e.target.value }))} style={{ ...inputStyle, marginTop: 5 }} placeholder="comma, separated, terms" />
            </label>
            <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
              Exclude
              <input value={cardDraft.exclude} onChange={(e) => setCardDraft((prev) => ({ ...prev, exclude: e.target.value }))} style={{ ...inputStyle, marginTop: 5 }} />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowAddCard(false)} style={ghostBtn}>Cancel</button>
            <button onClick={addCustomCard} style={primaryBtn}>{cardSource === "inventory" ? "Open card" : "Add card"}</button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "320px minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, position: isMobile ? "static" : "sticky", top: 12, maxHeight: isMobile ? "none" : "calc(100vh - 190px)", minHeight: 0 }}>
          <div style={{ ...panel, padding: 10, display: "grid", gridTemplateColumns: "1fr", gap: 8, flexShrink: 0 }}>
            <input value={cardSearch} onChange={(e) => setCardSearch(e.target.value)} placeholder="Search products" style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} style={inputStyle}>
                <option value="all">All statuses</option>
                <option value="missing_price">Needs eBay price</option>
                <option value="price">Review price</option>
                <option value="list">Ready to list</option>
                <option value="manual">Needs comps</option>
                <option value="hold">Competitive</option>
              </select>
              <select value={cardSort} onChange={(e) => setCardSort(e.target.value)} style={inputStyle}>
                <option value="recommended">Recommended</option>
                <option value="name">Name A-Z</option>
                <option value="comps">Most comps</option>
                <option value="suggestion">Biggest change</option>
              </select>
            </div>
            <div style={{ color: "#56627a", fontSize: 11, fontWeight: 700 }}>{visibleReviews.length} shown</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: isMobile ? "visible" : "auto", paddingRight: isMobile ? 0 : 3, minHeight: 0 }}>
          {visibleReviews.map((review) => {
            const reviewTone = statusStyle(review.status);
            const isSelected = selected.profile.id === review.profile.id;
            return (
              <button key={review.profile.id} onClick={() => setSelectedId(review.profile.id)} style={{ ...panel, padding: 14, minHeight: 98, textAlign: "left", cursor: "pointer", background: isSelected ? "#121a2a" : "#121a2b", borderColor: isSelected ? "#2563eb66" : "#232c3c", fontFamily: "inherit" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 90px", gap: 8, alignItems: "start", marginBottom: 8 }}>
                  <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800, minHeight: 34, lineHeight: 1.25, overflow: "hidden", overflowWrap: "anywhere", wordBreak: "break-word", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{review.profile.name}</div>
                  {badge(review.status, reviewTone)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 50px minmax(0, 1fr)", gap: 8, fontSize: 11, alignItems: "start" }}>
                  <div style={{ minWidth: 0 }}><div style={smallCaps}>{review.currentPriceSource === "manualListing" ? "Manual match" : review.currentPriceSource === "ebayListedPrice" ? "eBay price" : review.currentPriceSource === "manualOverride" ? "Override" : "Listing"}</div><div style={{ color: "#e5e7eb", fontWeight: 800, overflowWrap: "anywhere" }}>{listingText(review)}</div></div>
                  <div style={{ minWidth: 0 }}><div style={smallCaps}>Rank</div><div style={{ color: review.rank ? "#e5e7eb" : "#7c8aa0", fontWeight: 800, overflowWrap: "anywhere" }}>{rankText(review)}</div></div>
                  <div style={{ minWidth: 0 }}><div style={smallCaps}>Suggest</div><div style={{ color: review.action === "hold" ? "#34d399" : "#fbbf24", fontWeight: 800, overflowWrap: "anywhere" }}>{suggestionText(review)}</div></div>
                </div>
              </button>
            );
          })}
          {visibleReviews.length === 0 && <div style={{ ...panel, padding: 16, color: "#56627a", fontSize: 12, textAlign: "center" }}>No products match these filters.</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div style={{ ...panel, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                  <h3 style={{ margin: 0, color: "#f3f6fb", fontSize: 16, fontWeight: 800 }}>{selected.profile.name}</h3>
                  {badge(selected.status, tone)}
                  {badge(`${selected.confidence} confidence`, selected.confidence === "High" ? { bg: "#123326", fg: "#86efac" } : selected.confidence === "Medium" ? { bg: "#3b2f1f", fg: "#fbbf24" } : { bg: "#3b1f2b", fg: "#f9a8d4" })}
                </div>
                <div style={{ color: "#7c8aa0", fontSize: 12 }}>{selected.profile.strategy}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              <div><div style={smallCaps}>{priceLabel}</div><div style={{ color: "#f3f6fb", fontSize: 18, fontWeight: 800 }}>{selectedPrice}</div></div>
              <div><div style={smallCaps}>AU active floor</div><div style={{ color: "#f3f6fb", fontSize: 18, fontWeight: 800 }}>{selected.floor ? currency(selected.floor) : "n/a"}</div></div>
              <div><div style={smallCaps}>Rank</div><div style={{ color: "#f3f6fb", fontSize: 18, fontWeight: 800 }}>{rankText(selected)}</div></div>
              <div><div style={smallCaps}>Suggested</div><div style={{ color: selected.action === "hold" ? "#34d399" : "#fbbf24", fontSize: 18, fontWeight: 800 }}>{suggestionText(selected)}</div></div>
            </div>

            <div style={{ color: "#9ca3af", fontSize: 13, lineHeight: 1.5 }}>{selected.reason}</div>
            {selected.matchedEbayListing && (
              <div style={{ marginTop: 8, color: "#93c5fd", fontSize: 12, lineHeight: 1.45 }}>
                Matched eBay listing: {selected.matchedEbayListing.ebayListingTitle || selected.matchedEbayListing.name || "Untitled listing"}
                {selected.matchedEbayListing.ebayListingMatchScore ? ` (${selected.matchedEbayListing.ebayListingMatchScore}% title match)` : ""}
                {selected.currentPriceSource === "manualListing" ? " - manual match" : ""}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              <span style={{ padding: "4px 8px", borderRadius: 6, background: "#0d1117", color: "#93c5fd", fontSize: 11, fontWeight: 800 }}>{selected.activeCount} AU active comps</span>
              <span style={{ padding: "4px 8px", borderRadius: 6, background: "#0d1117", color: "#d1d5db", fontSize: 11, fontWeight: 800 }}>{selected.relatedInventory.length} inventory matches</span>
              <span style={{ padding: "4px 8px", borderRadius: 6, background: "#0d1117", color: "#fca5a5", fontSize: 11, fontWeight: 800 }}>{selected.excludedCount} rejected</span>
            </div>
          </div>

          <ProfitPanel review={selected} isMobile={isMobile} />

          {showTuning && (
            <div style={{ ...panel, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800 }}>Review tuning</div>
                  <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 2 }}>Local-only controls for this product.</div>
                </div>
                <button onClick={resetSelectedTweaks} style={{ ...ghostBtn, padding: "6px 9px", fontSize: 11 }}>Reset</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr 1fr", gap: 10 }}>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                  Search query
                  <input value={selectedTweak.query ?? selected.profile.query} onChange={(e) => updateTweak(selected.profile.id, { query: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} />
                </label>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                  Price override
                  <input type="number" step="0.01" value={selectedTweak.priceOverride ?? ""} onChange={(e) => updateTweak(selected.profile.id, { priceOverride: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} placeholder="AU$" />
                </label>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                  Pricing mode
                  <select value={selectedTweak.targetMode || "floor"} onChange={(e) => updateTweak(selected.profile.id, { targetMode: e.target.value })} style={{ ...inputStyle, marginTop: 5 }}>
                    <option value="floor">Lowest active comp</option>
                    <option value="top6">Top 6 active comps</option>
                  </select>
                </label>
              </div>
              <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, display: "block", marginTop: 10 }}>
                Matched eBay listing
                <select
                  value={selectedManualListingKey}
                  onChange={(e) => updateTweak(selected.profile.id, { manualListingKey: e.target.value })}
                  style={{ ...inputStyle, marginTop: 5 }}
                >
                  <option value="">Auto match / not listed</option>
                  {matchListings.map((listing) => {
                    const key = listingKey(listing);
                    if (!key) return null;
                    return <option key={key} value={key}>{listingLabel(listing)}</option>;
                  })}
                </select>
              </label>
              {matchListings.length === 0 && (
                <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 6 }}>Sync eBay comps first to load active listings for manual matching. Listings from {ownEbaySeller} are also treated as yours.</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginTop: 10 }}>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                  Must include
                  <input value={selectedTweak.required ?? joinTerms(selected.profile.required)} onChange={(e) => updateTweak(selected.profile.id, { required: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} placeholder="nike, mind, slides" />
                </label>
                <label style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700 }}>
                  Exclude
                  <input value={selectedTweak.exclude ?? joinTerms(selected.profile.excludeTerms)} onChange={(e) => updateTweak(selected.profile.id, { exclude: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} placeholder="used, damaged, bundle" />
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <button onClick={() => updateTweak(selected.profile.id, { hidden: true })} style={{ ...ghostBtn, padding: "6px 9px", fontSize: 11, color: "#fca5a5" }}>{selected.profile.source === "custom" ? "Hide custom card" : "Hide inventory card"}</button>
                {selected.profile.source === "custom" && <button onClick={() => removeCustomCard(selected.profile.id)} style={{ ...ghostBtn, padding: "6px 9px", fontSize: 11, color: "#fca5a5" }}>Remove custom card</button>}
                <span style={{ color: "#56627a", fontSize: 11, alignSelf: "center" }}>Run sync again after changing the query.</span>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: selected.groups.auSold.length && !isMobile ? "1fr 1fr" : "1fr", gap: 14 }}>
            <CompTable title="AU active comps" rows={selected.groups.auActive} empty="No active AU comps included." isMobile={isMobile} onHide={(comp) => updateCompTweak(comp, "hide")} />
            {selected.groups.auSold.length > 0 && <CompTable title="AU sold comps" rows={selected.groups.auSold} empty="No sold AU comps included." isMobile={isMobile} />}
          </div>
          {selected.groups.globalSold.length > 0 && <CompTable title="Global sold comps" rows={selected.groups.globalSold} empty="No global sold comps included." isMobile={isMobile} />}
          <ExcludedTable rows={selected.excluded} isMobile={isMobile} onInclude={(comp) => updateCompTweak(comp, comp.manualExcluded ? null : "include")} />
        </div>
      </div>
    </div>
  );
}
