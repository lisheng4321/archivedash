const DAY_MS = 24 * 60 * 60 * 1000;

export const PRICING_PROFILES = [];

const GENERIC_EXCLUDE_TERMS = [
  "acrylic",
  "empty",
  "box only",
  "case only",
  "damaged",
  "custom",
  "replica",
  "proxy",
  "bundle",
  "lot",
  "combo",
];

const listedPlatformsFor = (item = {}) => Array.isArray(item.listedPlatforms) ? item.listedPlatforms.filter(Boolean) : [];

export const SAMPLE_COMPS = [];

const normalize = (value) => String(value || "")
  .toLowerCase()
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const slug = (value) => normalize(value).replace(/\s+/g, "-").slice(0, 80) || "item";

const titleWords = (value) => normalize(value).split(" ").filter((word) => word.length > 1);

const uniqueBy = (items, getKey) => {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    if (!item) return;
    const key = getKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
};

const hasEbayListing = (item = {}) => listedPlatformsFor(item).some((platform) => String(platform).toLowerCase().includes("ebay"));

export const ebayListedPriceFor = (item = {}) => {
  const candidates = [
    item.ebayListedPrice,
    item.ebayListingPrice,
    item.listedPrice,
    item.listingPrice,
    item.platformPrices?.ebay,
    item.platformPrices?.["eBay AU"],
  ];
  const value = candidates.map(Number).find((price) => Number.isFinite(price) && price > 0);
  return value || 0;
};

const likelyEnglishOnePiece = (text) => {
  const n = normalize(text);
  return n.includes("one piece") && /\bop\s*0?\d{1,2}\b/.test(n) && (n.includes("english") || n.includes(" eng ") || !n.includes("japanese"));
};

export const matchEbayListingToItem = (item = {}, listings = []) => {
  const itemTitle = normalize(item.name);
  if (!itemTitle || !Array.isArray(listings)) return null;
  const explicit = listings.find((listing) => (
    item.ebayListingId && listing.listingId && String(item.ebayListingId) === String(listing.listingId)
  ) || (
    item.ebayOfferId && listing.offerId && String(item.ebayOfferId) === String(listing.offerId)
  ) || (
    item.ebaySku && listing.sku && String(item.ebaySku).toLowerCase() === String(listing.sku).toLowerCase()
  ));
  if (explicit) return { ...explicit, matchScore: 100 };
  const itemWords = titleWords(item.name).filter((word) => word.length > 2);
  let best = null;
  listings.forEach((listing) => {
    const listingTitle = normalize(listing.title);
    if (!listingTitle) return;
    let score = 0;
    if (listingTitle === itemTitle) score = 100;
    else if (listingTitle.includes(itemTitle) || itemTitle.includes(listingTitle)) score = 85;
    else if (itemWords.length) {
      const hits = itemWords.filter((word) => listingTitle.includes(word)).length;
      score = Math.round((hits / itemWords.length) * 70);
    }
    if (item.size && item.size !== "OS" && listingTitle.includes(normalize(item.size))) score += 8;
    if (item.brand && listingTitle.includes(normalize(item.brand))) score += 8;
    if (score >= 45 && (!best || score > best.score)) best = { listing, score };
  });
  return best ? { ...best.listing, matchScore: best.score } : null;
};

export const inventoryWithEbayListingPrices = (inventory = [], listings = []) => inventory.map((item) => {
  if (!hasEbayListing(item)) return item;
  const listing = matchEbayListingToItem(item, listings);
  if (!listing?.price) return item;
  return {
    ...item,
    ebayListedPrice: listing.price,
    ebayListingId: listing.listingId || item.ebayListingId,
    ebayOfferId: listing.offerId || item.ebayOfferId,
    ebaySku: listing.sku || item.ebaySku,
    ebayListingTitle: listing.title || item.ebayListingTitle,
    ebayListingMatchScore: listing.matchScore,
  };
});

export const buildInventoryPricingProfiles = (inventory = []) => {
  const candidates = uniqueBy(
    inventory
      .filter((item) => item?.name)
      .map((item) => {
        const name = String(item.name || "").trim();
        const words = titleWords(name);
        const isOnePieceEnglish = likelyEnglishOnePiece(name);
        const ebayListed = hasEbayListing(item);
        return {
          id: `inventory-${slug(name)}`,
          name,
          query: name,
          market: item.category || "Inventory",
          strategy: "Top true AU active comps",
          demoCurrentPrice: ebayListed ? ebayListedPriceFor(item) : 0,
          currentPriceSource: ebayListed ? "ebayListedPrice" : "notListed",
          floorBuffer: 5,
          source: "inventory",
          required: words.slice(0, 8),
          excludeTerms: isOnePieceEnglish ? [
            ...GENERIC_EXCLUDE_TERMS,
            "japanese",
            "jpn",
            "jap",
            "jp ",
            "asia japanese",
          ] : GENERIC_EXCLUDE_TERMS,
        };
      }),
    (profile) => profile.id,
  );

  return candidates.length ? candidates : PRICING_PROFILES;
};

export const buildPricingProfiles = (inventory = []) => {
  return buildInventoryPricingProfiles(inventory);
};

const setCode = (text) => {
  const match = normalize(text).match(/\bop\s*0?(\d{1,2})\b/);
  return match ? Number(match[1]) : null;
};

const daysBetween = (a, b) => Math.round((new Date(a + "T00:00:00") - new Date(b + "T00:00:00")) / DAY_MS);

export const compTotal = (comp) => (Number(comp.couponPrice ?? comp.price) || 0) + (Number(comp.shipping) || 0);

const median = (values) => {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const hasTerm = (normalizedTitle, term) => {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  return new RegExp(`(^| )${normalizedTerm.replace(/\s+/g, " ")}( |$)`).test(normalizedTitle);
};

export const profileMatchesItem = (profile, item) => {
  if (!profile) return false;
  const text = normalize([item?.name, item?.brand, item?.tags].join(" "));
  if (profile.inventoryId) return String(item?.id || "") === String(profile.inventoryId);
  if (profile.source === "custom") return profile.inventoryName ? normalize(item?.name) === normalize(profile.inventoryName) : false;
  if (profile.source === "inventory") return profile.id === `inventory-${slug(item?.name)}`;
  return text.includes(normalize(profile.name));
};

const ruleReasonsFor = (profile, comp, currentDate) => {
  const title = normalize(comp.title);
  const reasons = [];
  const code = setCode(comp.title);
  const profileText = normalize(profile.name);
  const profileCode = setCode(profile.name);
  const required = Array.isArray(profile.required) ? profile.required : [];
  const requiredWords = required.map(normalize).filter((word) => word.length > 2);
  const titleWordSet = new Set(titleWords(comp.title));

  if (profileCode && code && code !== profileCode) reasons.push(`different set: OP-${String(code).padStart(2, "0")}`);
  if (profileCode && !code && !title.includes(`op ${profileCode}`) && !title.includes(`op${profileCode}`)) reasons.push(`missing OP-${String(profileCode).padStart(2, "0")}`);
  if (profileText.includes("booster box") && !(title.includes("booster box") || title.includes("booster display") || title.includes("display box"))) reasons.push("not clearly a booster box");
  if (!profileCode && requiredWords.length >= 3) {
    const important = requiredWords.filter((word) => !["the", "and", "with", "for", "new", "sealed", "presale", "preorder"].includes(word));
    const matches = important.filter((word) => titleWordSet.has(word) || title.includes(word));
    if (important.length >= 4 && matches.length < Math.ceil(important.length * 0.55)) reasons.push("weak title match");
  }
  if (profile.excludeTerms.some((term) => hasTerm(title, term))) {
    const term = profile.excludeTerms.find((candidate) => hasTerm(title, candidate));
    reasons.push(term.includes("jap") || term.includes("jpn") ? "Japanese version" : `excluded term: ${term}`);
  }
  if (/\b([2-9]|1[0-9])\s*x\b|\b[2-9]x\b|\bcase\b|\bcarton\b|\bbundle\b|\blot\b|\bcombo\b/.test(title)) reasons.push("multi-quantity or bundle");
  if (comp.type === "sold" && comp.soldDate) {
    const age = daysBetween(currentDate, comp.soldDate);
    if (age > 45) reasons.push("older than 45 days");
  }
  return reasons;
};

const applyOutliers = (rows) => {
  const included = rows.filter((row) => row.included);
  const totals = included.map((row) => row.total);
  const midpoint = median(totals);
  if (!midpoint || included.length < 4) return rows;
  return rows.map((row) => {
    if (!row.included) return row;
    if (row.total > midpoint * 1.75 || row.total < midpoint * 0.55) {
      return { ...row, included: false, reasons: [...row.reasons, "price outlier"] };
    }
    return row;
  });
};

export const evaluateComps = (profile, comps, currentDate) => {
  const rows = comps
    .filter((comp) => comp.profileId === profile.id)
    .map((comp) => {
      let reasons = ruleReasonsFor(profile, comp, currentDate);
      if (comp.manualIncluded) reasons = [];
      if (comp.manualExcluded) reasons = ["hidden by you"];
      if (comp.ownSellerExcluded || comp.isOwnListing) reasons = ["your eBay listing"];
      return {
        ...comp,
        total: compTotal(comp),
        included: reasons.length === 0,
        reasons,
      };
    });

  return ["active", "sold"].flatMap((type) => (
    ["au", "global"].flatMap((scope) => applyOutliers(rows.filter((row) => row.type === type && row.scope === scope)))
  ));
};

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export const buildPricingReviews = ({ inventory = [], comps = SAMPLE_COMPS, profiles = PRICING_PROFILES, currentDate }) => {
  const reviewDate = currentDate || new Date().toISOString().slice(0, 10);

  return profiles.filter(Boolean).map((profile) => {
    const relatedInventory = inventory.filter((item) => profileMatchesItem(profile, item));
    const rows = evaluateComps(profile, comps, reviewDate);
    const included = rows.filter((row) => row.included);
    const excluded = rows.filter((row) => !row.included);
    const auActive = included.filter((row) => row.scope === "au" && row.type === "active").sort((a, b) => a.total - b.total);
    const auSold = included.filter((row) => row.scope === "au" && row.type === "sold").sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
    const globalSold = included.filter((row) => row.scope === "global" && row.type === "sold").sort((a, b) => (b.soldDate || "").localeCompare(a.soldDate || ""));
    const currentPrice = Number(profile.demoCurrentPrice) || 0;
    const activeTotals = auActive.map((row) => row.total);
    const soldTotals = auSold.map((row) => row.total);
    const floor = activeTotals[0] ?? null;
    const topSix = activeTotals.slice(0, 6);
    const topSixAverage = average(topSix);
    const rank = activeTotals.length && currentPrice > 0 ? activeTotals.filter((value) => value < currentPrice - 0.01).length + 1 : null;
    const recentSold14 = auSold.filter((row) => row.soldDate && daysBetween(reviewDate, row.soldDate) <= 14).length;
    const highVelocity = profile.targetMode === "top6" || recentSold14 >= 4;
    const useFloor = profile.targetMode === "floor";
    const notListed = profile.currentPriceSource === "notListed";
    const missingEbayPrice = profile.currentPriceSource === "ebayListedPrice" && currentPrice <= 0;
    const listingTarget = floor === null
      ? 0
      : highVelocity && !useFloor && topSixAverage
        ? Number(Math.max(floor + profile.floorBuffer, Math.round(topSixAverage) - 0.05).toFixed(2))
        : Number(floor.toFixed(2));
    const target = missingEbayPrice || floor === null
      ? currentPrice
      : notListed
        ? listingTarget
      : highVelocity && !useFloor && topSixAverage
        ? Math.min(currentPrice, Math.max(floor + profile.floorBuffer, Math.round(topSixAverage) - 0.05))
        : Math.min(currentPrice, floor);
    const suggestedPrice = notListed ? target : Math.abs(target - currentPrice) < 1 ? currentPrice : Number(target.toFixed(2));
    const action = missingEbayPrice ? "missing_price" : floor === null ? "manual" : notListed ? "list" : Math.abs(suggestedPrice - currentPrice) < 1 ? "hold" : suggestedPrice < currentPrice ? "lower" : "raise";
    const status = action === "hold" ? "Competitive" : action === "list" ? "Ready to list" : action === "missing_price" ? "Needs eBay price" : action === "manual" ? "Needs tuning" : "Review price";
    const reason = action === "missing_price"
      ? "This item is marked as listed on eBay, but no current eBay listed price is saved yet."
      : action === "list"
        ? `This is not currently listed on eBay. Suggested listing price is based on the AU active comp floor.`
      : action === "hold"
        ? `Current eBay price ranks #${rank} against AU active comps${soldTotals.length ? " and recent AU sold comps support the range" : ""}.`
      : action === "lower"
          ? `Lowering would move the listing closer to the AU active floor.`
          : "Not enough comparable active results to price confidently.";

    const matchedEbayListing = profile.manualEbayListing || relatedInventory.find((item) => item.ebayListingTitle || item.ebayListingId) || null;
    const matchScore = Number(matchedEbayListing?.ebayListingMatchScore || 0);
    const confidence = floor === null || missingEbayPrice || (matchScore > 0 && matchScore < 60)
      ? "Low"
      : auActive.length >= 6 && excluded.length <= included.length
        ? "High"
        : auActive.length >= 3
          ? "Medium"
          : "Low";

    return {
      profile,
      relatedInventory,
      currentPrice,
      currentPriceSource: profile.currentPriceSource || "demo",
      matchedEbayListing,
      confidence,
      suggestedPrice,
      action,
      status,
      reason,
      rank,
      floor,
      topSixAverage,
      activeCount: auActive.length,
      excludedCount: excluded.length,
      recentSold14,
      auSoldMedian: median(soldTotals),
      auSoldRange: soldTotals.length ? [Math.min(...soldTotals), Math.max(...soldTotals)] : null,
      globalSoldMedian: median(globalSold.map((row) => row.total)),
      included,
      excluded,
      groups: {
        auActive,
        auSold,
        globalSold,
      },
    };
  });
};
