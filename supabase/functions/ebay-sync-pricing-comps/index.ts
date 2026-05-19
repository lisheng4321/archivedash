import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ARCHIVEDASH_APP_URL") || "https://archivedash.vercel.app",
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

async function getApplicationAccessToken(scope = "https://api.ebay.com/oauth/api_scope") {
  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Missing eBay client credentials.");

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", scope);

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`eBay app token failed with status ${res.status}`);
  return data.access_token as string;
}

const compFromSummary = (profileId: string, summary: Record<string, unknown>, index: number) => {
  const price = summary.price as { value?: string; currency?: string } | undefined;
  const shippingOptions = Array.isArray(summary.shippingOptions) ? summary.shippingOptions as Array<Record<string, unknown>> : [];
  const shipping = shippingOptions.reduce((lowest, option) => {
    const cost = option.shippingCost as { value?: string } | undefined;
    const amount = money(cost?.value);
    if (!amount && lowest === null) return 0;
    if (lowest === null) return amount;
    return Math.min(lowest, amount);
  }, null as number | null);
  const seller = summary.seller as { username?: string } | undefined;

  return {
    id: String(summary.itemId || `live-${profileId}-${index}`),
    profileId,
    scope: "au",
    type: "active",
    title: String(summary.title || "Untitled eBay item"),
    price: money(price?.value),
    shipping: shipping ?? 0,
    seller: seller?.username || null,
    itemWebUrl: summary.itemWebUrl || null,
    imageUrl: (summary.image as { imageUrl?: string } | undefined)?.imageUrl || null,
    itemLocation: summary.itemLocation || null,
    raw: summary,
  };
};

const compFromItemSale = (profileId: string, scope: "au" | "global", sale: Record<string, unknown>, index: number) => {
  const price = sale.lastSoldPrice as { value?: string; currency?: string } | undefined;
  const seller = sale.seller as { username?: string } | undefined;
  const soldDate = String(sale.lastSoldDate || "").slice(0, 10);

  return {
    id: String(sale.itemId || `sold-${scope}-${profileId}-${index}`),
    profileId,
    scope,
    type: "sold",
    soldDate: soldDate || null,
    title: String(sale.title || "Untitled sold eBay item"),
    price: money(price?.value),
    shipping: 0,
    seller: seller?.username || null,
    soldCount: Number(sale.totalSoldQuantity || 0) || null,
    itemWebUrl: sale.itemWebUrl || null,
    imageUrl: (sale.image as { imageUrl?: string } | undefined)?.imageUrl || null,
    itemLocation: sale.itemLocation || null,
    raw: sale,
  };
};

async function fetchActiveComps(profileId: string, query: string, limit: number, postcode: string, accessToken: string) {
  const searchUrl = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("limit", String(limit));
  searchUrl.searchParams.set("sort", "price");
  searchUrl.searchParams.set("filter", [
    "buyingOptions:{FIXED_PRICE}",
    "conditions:{NEW}",
    "itemLocationCountry:AU",
    "deliveryCountry:AU",
    `deliveryPostalCode:${postcode}`,
  ].join(","));

  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_AU",
      "X-EBAY-C-ENDUSERCTX": `contextualLocation=country%3DAU%2Czip%3D${encodeURIComponent(postcode)}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Browse API failed with status ${res.status}`);

  const summaries = Array.isArray(data.itemSummaries) ? data.itemSummaries : [];
  return {
    total: Number(data.total) || summaries.length,
    comps: summaries.map((summary: Record<string, unknown>, index: number) => compFromSummary(profileId, summary, index)),
  };
}

async function fetchSoldComps(profileId: string, query: string, limit: number, marketplaceId: string, scope: "au" | "global", accessToken: string) {
  const paths = [
    "https://api.ebay.com/buy/marketplace_insights/v1/item_sales/search",
    "https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search",
  ];
  let lastError: unknown = null;

  for (const path of paths) {
    const searchUrl = new URL(path);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("limit", String(limit));
    searchUrl.searchParams.set("sort", "-lastSoldDate");
    searchUrl.searchParams.set("filter", "conditions:{NEW}");

    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const sales = Array.isArray(data.itemSales) ? data.itemSales : [];
      return {
        total: Number(data.total) || sales.length,
        comps: sales.map((sale: Record<string, unknown>, index: number) => compFromItemSale(profileId, scope, sale, index)),
      };
    }
    lastError = new Error(`Marketplace Insights API failed with status ${res.status}`);
    if (res.status !== 404) break;
  }

  throw lastError;
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

  const body = await req.json().catch(() => ({}));
  const profiles = Array.isArray(body.profiles) ? body.profiles : [];
  const limit = Math.min(50, Math.max(5, Number(body.limit || 30)));
  const postcode = String(body.postcode || "2073").trim() || "2073";
  if (!profiles.length) return json({ error: "No pricing profiles supplied." }, 400);

  let accessToken = "";
  try {
    accessToken = await getApplicationAccessToken();
  } catch (error) {
    console.error("Could not get eBay application token", { message: String(error) });
    return json({ error: "Could not get eBay application token." }, 502);
  }

  let insightsAccessToken = "";
  let insightsError: unknown = null;
  try {
    insightsAccessToken = await getApplicationAccessToken("https://api.ebay.com/oauth/api_scope/commerce.marketplace.insights.readonly");
  } catch (error) {
    insightsError = String(error);
  }

  const searches = await Promise.all(profiles.map(async (profile: { id?: string; query?: string }) => {
    const profileId = String(profile.id || "");
    const query = String(profile.query || "").trim();
    if (!profileId || !query) return { profileId, query, comps: [], error: "Missing profile id or query." };

    let active = { total: 0, comps: [] as Array<Record<string, unknown>> };
    let activeError: unknown = null;
    try {
      active = await fetchActiveComps(profileId, query, limit, postcode, accessToken);
    } catch (error) {
      activeError = "Active comps unavailable.";
      console.error("eBay Browse search failed", { message: String(error) });
    }

    let auSold = { total: 0, comps: [] as Array<Record<string, unknown>> };
    let globalSold = { total: 0, comps: [] as Array<Record<string, unknown>> };
    let soldError: unknown = insightsError;
    if (insightsAccessToken) {
      try {
        const soldLimit = Math.min(25, limit);
        const results = await Promise.all([
          fetchSoldComps(profileId, query, soldLimit, "EBAY_AU", "au", insightsAccessToken),
          fetchSoldComps(profileId, query, soldLimit, "EBAY_US", "global", insightsAccessToken),
        ]);
        auSold = results[0];
        globalSold = results[1];
        soldError = null;
      } catch (error) {
        soldError = "Sold comps unavailable.";
        console.error("eBay Marketplace Insights search failed", { message: String(error) });
      }
    }

    return {
      profileId,
      query,
      total: active.total,
      soldTotal: auSold.total + globalSold.total,
      comps: [...active.comps, ...auSold.comps, ...globalSold.comps],
      activeError,
      soldError,
    };
  }));

  const soldErrors = searches
    .map((search) => search.soldError)
    .filter(Boolean);

  return json({
    ok: true,
    postcode,
    searchedAt: new Date().toISOString(),
    soldCompsStatus: soldErrors.length
      ? {
        ok: false,
        message: "Sold comps require eBay Marketplace Insights access. Active comps still loaded.",
        details: soldErrors[0],
      }
      : { ok: true },
    searches,
    comps: searches.flatMap((search) => search.comps || []),
  });
});
