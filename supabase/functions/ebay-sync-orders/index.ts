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

const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sydneyDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
};

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Missing eBay credentials");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("scope", "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly");

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const days = Math.min(90, Math.max(1, Number(body.days || 30)));
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const to = new Date().toISOString();
  const orderUrl = new URL("https://api.ebay.com/sell/fulfillment/v1/order");
  orderUrl.searchParams.set("limit", "50");
  orderUrl.searchParams.set("filter", `creationdate:[${from}..${to}],orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}`);

  const orderRes = await fetch(orderUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const ordersJson = await orderRes.json();
  if (!orderRes.ok) {
    console.error("eBay orders fetch failed", ordersJson);
    return json({ error: "Could not fetch eBay orders.", details: ordersJson }, 502);
  }

  const orders = Array.isArray(ordersJson.orders) ? ordersJson.orders : [];
  const rows = [];
  for (const order of orders) {
    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const shippingTotal = money(order?.pricingSummary?.deliveryCost?.value || order?.pricingSummary?.shippingCost?.value);
    const shippingShare = lineItems.length ? shippingTotal / lineItems.length : 0;
    const shipTo = order?.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo || {};
    const buyerContact = order?.buyer?.buyerRegistrationAddress || {};
    const contact = Object.keys(shipTo || {}).length ? shipTo : buyerContact;
    const address = contact?.contactAddress || buyerContact?.contactAddress || {};
    const phone = contact?.primaryPhone?.phoneNumber || buyerContact?.primaryPhone?.phoneNumber || null;
    const email = contact?.email || buyerContact?.email || order?.buyer?.email || null;
    const fullName = contact?.fullName || buyerContact?.fullName || null;
    for (const li of lineItems) {
      const lineId = String(li.lineItemId || li.legacyItemId || `${order.orderId}-${rows.length}`);
      rows.push({
        user_id: user.id,
        order_id: String(order.orderId),
        line_item_id: lineId,
        item_title: String(li.title || li.lineItemTitle || "Untitled eBay item"),
        sku: li.sku || li.legacyVariationId || null,
        quantity: Number(li.quantity || 1),
        sale_price: money(li?.lineItemCost?.value || li?.discountedLineItemCost?.value),
        shipping_price: shippingShare,
        platform_fees: 0,
        buyer_username: order?.buyer?.username || email || fullName || null,
        buyer_full_name: fullName,
        buyer_email: email,
        buyer_phone: phone,
        buyer_address_line1: address?.addressLine1 || null,
        buyer_address_line2: address?.addressLine2 || null,
        buyer_city: address?.city || null,
        buyer_state: address?.stateOrProvince || null,
        buyer_postcode: address?.postalCode || null,
        buyer_country: address?.countryCode || null,
        sale_date: order.creationDate ? sydneyDate(new Date(order.creationDate)) : null,
        raw: { order, lineItem: li },
        status: "draft",
        updated_at: new Date().toISOString(),
      });
    }
  }

  await supabase
    .from("ebay_import_queue")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "draft");

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from("ebay_import_queue")
      .upsert(rows, { onConflict: "user_id,order_id,line_item_id", ignoreDuplicates: true });
    if (upsertError) return json({ error: "Could not save eBay import queue.", details: upsertError }, 500);
  }

  const { count } = await supabase
    .from("ebay_import_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "draft");

  return json({ ok: true, orders: orders.length, lineItems: rows.length, queuedDrafts: count || 0 });
});
