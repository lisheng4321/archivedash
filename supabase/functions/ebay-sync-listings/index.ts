import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Missing eBay credentials");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("scope", [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  ].join(" "));

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Refresh failed: ${JSON.stringify(data)}`);
  return data;
}

const normalize = (value: unknown) => String(value || "")
  .toLowerCase()
  .replace(/[\u2010-\u2015]/g, "-")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const decodeXml = (value: string) => value
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'");

const firstText = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
};

const firstBlock = (xml: string, tag: string) => {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1] : "";
};

const allBlocks = (xml: string, tag: string) => {
  const blocks = [];
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) blocks.push(match[1]);
  return blocks;
};

const firstAttribute = (xml: string, tag: string, attr: string) => {
  const match = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"[^>]*>`, "i"));
  return match ? decodeXml(match[1]) : "";
};

const listingFromTradingItem = (itemXml: string) => {
  const sellingStatus = firstBlock(itemXml, "SellingStatus");
  const currentPriceBlock = itemXml.match(/<CurrentPrice[^>]*>[\s\S]*?<\/CurrentPrice>/i)?.[0] || "";
  const listingDetails = firstBlock(itemXml, "ListingDetails");
  const listingStatus = firstText(sellingStatus || itemXml, "ListingStatus") || firstText(itemXml, "SellingState");
  const title = firstText(itemXml, "Title") || firstText(itemXml, "SKU") || "Untitled eBay listing";

  return {
    id: firstText(itemXml, "ItemID") || firstText(itemXml, "SKU") || crypto.randomUUID(),
    offerId: null,
    sku: firstText(itemXml, "SKU") || null,
    listingId: firstText(itemXml, "ItemID") || null,
    title,
    titleKey: normalize(title),
    price: money(firstText(itemXml, "CurrentPrice")),
    currency: firstAttribute(currentPriceBlock, "CurrentPrice", "currencyID") || "AUD",
    availableQuantity: Math.max(0, Number(firstText(itemXml, "Quantity")) - Number(firstText(sellingStatus || itemXml, "QuantitySold"))),
    soldQuantity: Number(firstText(sellingStatus || itemXml, "QuantitySold") || 0),
    listingStatus,
    marketplaceId: "EBAY_AU",
    format: firstText(itemXml, "ListingType") || null,
    itemWebUrl: firstText(listingDetails || itemXml, "ViewItemURL") || null,
    rawSource: "trading",
  };
};

const listingFromOffer = (offer: Record<string, unknown>) => {
  const pricingSummary = offer.pricingSummary as { price?: { value?: string; currency?: string } } | undefined;
  const listing = offer.listing as { listingId?: string; listingStatus?: string; soldQuantity?: number } | undefined;
  return {
    id: String(offer.offerId || listing?.listingId || offer.sku || crypto.randomUUID()),
    offerId: offer.offerId || null,
    sku: offer.sku || null,
    listingId: listing?.listingId || null,
    title: String(offer.title || offer.listingDescription || offer.sku || "Untitled eBay listing"),
    titleKey: normalize(offer.title || offer.listingDescription || offer.sku),
    price: money(pricingSummary?.price?.value),
    currency: pricingSummary?.price?.currency || "AUD",
    availableQuantity: Number(offer.availableQuantity || 0),
    soldQuantity: Number(listing?.soldQuantity || 0),
    listingStatus: listing?.listingStatus || offer.status || null,
    marketplaceId: offer.marketplaceId || null,
    format: offer.format || null,
    raw: offer,
    rawSource: "inventory",
  };
};

async function fetchTradingActiveListings(accessToken: string) {
  const listings = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 10) {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <Version>1209</Version>
  <DetailLevel>ReturnAll</DetailLevel>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>200</EntriesPerPage>
      <PageNumber>${page}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`;

    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        "Accept-Language": "en-AU",
        "Content-Language": "en-AU",
        "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
        "X-EBAY-API-SITEID": "15",
        "X-EBAY-API-COMPATIBILITY-LEVEL": "1209",
        "X-EBAY-API-IAF-TOKEN": accessToken,
      },
      body,
    });
    const xml = await res.text();
    if (!res.ok) throw new Error(`Trading API HTTP ${res.status}: ${xml.slice(0, 1000)}`);

    const ack = firstText(xml, "Ack");
    if (!["Success", "Warning"].includes(ack)) {
      const shortError = allBlocks(xml, "LongMessage").map((node) => decodeXml(node.replace(/<[^>]+>/g, "").trim())).filter(Boolean).join(" | ");
      throw new Error(shortError || xml.slice(0, 1000));
    }

    const activeList = firstBlock(xml, "ActiveList");
    const pagination = firstBlock(activeList || xml, "PaginationResult");
    totalPages = Math.max(1, Number(firstText(pagination || xml, "TotalNumberOfPages") || 1));
    const items = activeList ? allBlocks(activeList, "Item") : [];
    listings.push(...items.map(listingFromTradingItem).filter((listing) => listing.price > 0));
    page += 1;
  }

  return listings;
}

async function fetchInventoryApiListings(accessToken: string) {
  const listings = [];
  let offset = 0;
  const itemLimit = 100;
  for (let page = 0; page < 10; page += 1) {
    const itemsUrl = new URL("https://api.ebay.com/sell/inventory/v1/inventory_item");
    itemsUrl.searchParams.set("limit", String(itemLimit));
    itemsUrl.searchParams.set("offset", String(offset));
    const itemsRes = await fetch(itemsUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Accept-Language": "en-AU", "Content-Language": "en-AU" },
    });
    const itemsData = await itemsRes.json();
    if (!itemsRes.ok) throw new Error(`Inventory items failed: ${JSON.stringify(itemsData)}`);
    const inventoryItems = Array.isArray(itemsData.inventoryItems) ? itemsData.inventoryItems : [];
    for (const inv of inventoryItems) {
      const sku = inv.sku;
      if (!sku) continue;
      const offersUrl = new URL("https://api.ebay.com/sell/inventory/v1/offer");
      offersUrl.searchParams.set("sku", String(sku));
      offersUrl.searchParams.set("marketplace_id", "EBAY_AU");
      const offersRes = await fetch(offersUrl, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Accept-Language": "en-AU", "Content-Language": "en-AU" },
      });
      const offersData = await offersRes.json();
      if (!offersRes.ok) continue;
      const offers = Array.isArray(offersData.offers) ? offersData.offers : [];
      listings.push(...offers.map(listingFromOffer).filter((listing) => (
        listing.price > 0 && (listing.listingStatus === "ACTIVE" || listing.listingStatus === "PUBLISHED" || listing.raw?.status === "PUBLISHED")
      )));
    }
    if (inventoryItems.length < itemLimit) break;
    offset += itemLimit;
  }
  return listings;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json({ error: "Missing Supabase service secrets." }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing authorization." }, 401);

  const supabase = createClient(supabaseUrl, serviceRole);
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Could not identify signed-in user." }, 401);

  const { data: tokenRow, error: tokenError } = await supabase
    .from("ebay_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (tokenError || !tokenRow) return json({ error: "eBay is not connected yet." }, 400);

  let accessToken = tokenRow.access_token;
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt < Date.now() + 2 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    accessToken = refreshed.access_token;
    await supabase.from("ebay_tokens").update({
      access_token: refreshed.access_token,
      token_type: refreshed.token_type,
      scope: refreshed.scope || tokenRow.scope,
      expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : tokenRow.expires_at,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
  }

  let listings = [];
  let source = "trading";
  let tradingError = "";
  try {
    listings = await fetchTradingActiveListings(accessToken);
  } catch (error) {
    tradingError = String(error);
    console.error("Trading active listings failed", error);
  }

  if (!listings.length) {
    try {
      listings = await fetchInventoryApiListings(accessToken);
      source = "inventory";
    } catch (error) {
      console.error("Inventory active listings failed", error);
      return json({
        error: "Could not fetch active eBay listings.",
        details: {
          tradingError,
          inventoryError: String(error),
        },
      }, 502);
    }
  }

  return json({
    ok: true,
    marketplaceId: "EBAY_AU",
    source,
    syncedAt: new Date().toISOString(),
    listings,
  });
});
