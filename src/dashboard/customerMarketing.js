const uniqueSorted = (values = []) => [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b));

const splitInterestValues = (value) => {
  if (Array.isArray(value)) return uniqueSorted(value);
  return uniqueSorted(String(value || "").split(","));
};

const normalizeSearchText = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const requestTerms = (request = {}) => splitInterestValues(request.keywords || request.label)
  .map(normalizeSearchText)
  .filter(Boolean);

const itemSearchText = (item = {}) => normalizeSearchText([
  item.name,
  item.category,
  item.brand,
  item.tags,
  item.size,
].filter(Boolean).join(" "));

const normalizeBuyerRequests = (profile = {}) => {
  const requests = Array.isArray(profile.notifyRequests)
    ? profile.notifyRequests
    : Array.isArray(profile.wants)
      ? profile.wants
      : [];
  return requests.map((request, index) => {
    const label = String(request.label || request.name || request.keywords || "").trim();
    if (!label) return null;
    return {
      id: request.id || `request-${index}`,
      label,
      keywords: String(request.keywords || label).trim(),
      category: String(request.category || "Any").trim() || "Any",
      brand: String(request.brand || "").trim(),
      maxPrice: request.maxPrice || "",
      channel: request.channel || profile.defaultPlatform || "Facebook",
      active: request.active !== false,
      notes: request.notes || "",
      lastNotifiedAt: request.lastNotifiedAt || "",
      createdAt: request.createdAt || "",
      updatedAt: request.updatedAt || "",
    };
  }).filter(Boolean);
};

const buyerRequestMatchesItem = (request = {}, item = {}) => {
  if (request.active === false) return false;
  const category = String(request.category || "Any");
  if (category !== "Any" && item.category !== category) return false;
  const brand = normalizeSearchText(request.brand);
  const text = itemSearchText(item);
  if (brand && !text.includes(brand)) return false;
  const maxPrice = Number(request.maxPrice);
  if (Number.isFinite(maxPrice) && maxPrice > 0 && (Number(item.price) || 0) > maxPrice) return false;
  const terms = requestTerms(request);
  if (!terms.length) return false;
  const hitCount = terms.filter((term) => text.includes(term)).length;
  const requiredHits = terms.length === 1 ? 1 : Math.min(2, terms.length);
  return hitCount >= requiredHits;
};

const matchedBuyerRequestsForItem = (item = {}, customers = []) => customers.flatMap((customer) => (
  normalizeBuyerRequests(customer.profile).filter((request) => buyerRequestMatchesItem(request, item)).map((request) => ({
    customer,
    request,
  }))
));

const titleCase = (value) => String(value || "")
  .trim()
  .replace(/\s+/g, " ")
  .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

const normalizedBrand = (sale = {}) => {
  const source = `${sale.brand || ""} ${sale.name || ""}`.toLowerCase();
  if (/pok[eé]mon/.test(source)) return "Pokémon TCG";
  if (/\bone piece\b/.test(source)) return "One Piece TCG";
  if (/\bhot wheels\b/.test(source)) return "Hot Wheels";
  return titleCase(sale.brand);
};

const inferredProductType = (sale = {}) => {
  const category = String(sale.category || "").trim();
  const source = `${category} ${sale.brand || ""} ${sale.name || ""}`.toLowerCase();
  if (/sneaker|shoe|footwear/.test(source)) return "Sneakers";
  if (/apparel|clothing|shirt|hoodie|jacket|jersey|rugby top/.test(source)) return "Apparel";
  if (/pok[eé]mon|one piece|\btcg\b|trading card/.test(source)) {
    if (/single|individual card|graded card|\bpsa\b|\bcgc\b/.test(source)) return "TCG singles";
    if (/booster|elite trainer|\betb\b|display|sealed|collection|bundle|deck|tin|blister|case/.test(source)) return "TCG sealed";
    return "TCG";
  }
  if (/collectable|collectible/.test(source)) return "Collectibles";
  return category || "Other";
};

const inferredProductTypes = (sale = {}) => {
  const source = `${sale.category || ""} ${sale.brand || ""} ${sale.name || ""}`.toLowerCase();
  const types = [inferredProductType(sale)];
  if (/booster (?:box|display)|display box/.test(source)) types.push("Booster boxes");
  if (/elite trainer box|\betb\b/.test(source)) types.push("Elite trainer boxes");
  if (/booster pack|sleeved booster|blister/.test(source)) types.push("Booster packs");
  return uniqueSorted(types);
};

const interestsForSale = (sale = {}) => ({
  brands: uniqueSorted([normalizedBrand(sale)]),
  productTypes: inferredProductTypes(sale),
});

const mergeCustomerInterests = (sales = [], profile = {}) => {
  const inferred = sales.reduce((result, sale) => {
    const interests = interestsForSale(sale);
    result.brands.push(...interests.brands);
    result.productTypes.push(...interests.productTypes);
    return result;
  }, { brands: [], productTypes: [] });
  return {
    brands: uniqueSorted([...inferred.brands, ...splitInterestValues(profile.brands)]),
    productTypes: uniqueSorted([...inferred.productTypes, ...splitInterestValues(profile.productTypes)]),
  };
};

export { buyerRequestMatchesItem, matchedBuyerRequestsForItem, mergeCustomerInterests, normalizeBuyerRequests, splitInterestValues, uniqueSorted };
