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
  const n = Number(String(v || "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const decodeBase64Url = (data = "") => {
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
};

const stripHtml = (html: string) => html
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<\/(div|p|tr|li|h\d)>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

function collectText(part: any): string[] {
  const out: string[] = [];
  const mime = String(part?.mimeType || "");
  const data = part?.body?.data;
  if (data && (mime.includes("text/plain") || mime.includes("text/html"))) {
    const decoded = decodeBase64Url(data);
    out.push(mime.includes("text/html") ? stripHtml(decoded) : decoded);
  }
  for (const child of part?.parts || []) out.push(...collectText(child));
  return out;
}

const header = (msg: any, name: string) => {
  const h = (msg?.payload?.headers || []).find((x: any) => String(x.name || "").toLowerCase() === name.toLowerCase());
  return String(h?.value || "");
};

const cleanSubject = (subject: string) => subject
  .replace(/\[[^\]]+\]/g, " ")
  .replace(/^(re|fw|fwd):\s*/i, "")
  .replace(/\b(order|purchase|payment|receipt|invoice|confirmation|confirmed|thanks|thank you|your|from|has been|was)\b/gi, " ")
  .replace(/[#:]?\s*[A-Z0-9-]{6,}\b/g, " ")
  .replace(/\s{2,}/g, " ")
  .trim();

function parseDraft(msg: any) {
  const subject = header(msg, "Subject");
  const from = header(msg, "From");
  const dateHeader = header(msg, "Date");
  const text = [...collectText(msg.payload), msg.snippet || "", subject].join("\n").replace(/\r/g, "\n");
  const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const priceMatches = [...text.matchAll(/(?:AU\$|A\$|\$)\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/gi)].map((m) => money(m[1])).filter((n) => n > 0);
  const total = priceMatches.length ? Math.max(...priceMatches) : 0;
  const qtyMatch = text.match(/\b(?:qty|quantity)\D{0,12}([1-9][0-9]{0,2})\b/i);
  const quantity = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;
  const vendor = (from.match(/"?([^"<]+)"?\s*</)?.[1] || from.split("@")[0] || "").trim();
  const orderRef = text.match(/\b(?:order|invoice|receipt)\s*(?:number|no\.?|#|id)?\s*[:#]?\s*([A-Z0-9-]{5,})/i)?.[1] || null;
  const badLine = /\b(subtotal|total|shipping|delivery|tax|gst|discount|payment|visa|mastercard|paypal|paid|billing|address|order|receipt|invoice|unsubscribe|privacy|terms)\b/i;
  const candidate = lines.find((line) =>
    line.length >= 8 &&
    line.length <= 120 &&
    !badLine.test(line) &&
    !/^(hi|hello|dear|thanks|thank you)\b/i.test(line) &&
    !/^\$/.test(line)
  );
  const itemTitle = candidate || cleanSubject(subject) || "Imported Gmail item";
  const emailDate = dateHeader ? new Date(dateHeader) : new Date(Number(msg.internalDate || Date.now()));

  return {
    message_id: msg.id,
    thread_id: msg.threadId,
    subject,
    sender: from,
    email_date: Number.isNaN(emailDate.getTime()) ? null : emailDate.toISOString().slice(0, 10),
    item_title: itemTitle.slice(0, 180),
    vendor: vendor.slice(0, 120),
    quantity,
    unit_cost: quantity > 1 && total ? Number((total / quantity).toFixed(2)) : total,
    total_cost: total,
    order_reference: orderRef,
    raw: { snippet: msg.snippet, subject, from, lines: lines.slice(0, 80) },
    status: "draft",
    updated_at: new Date().toISOString(),
  };
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Missing Google credentials");

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (tokenError || !tokenRow) return json({ error: "Gmail is not connected yet." }, 400);

  let accessToken = tokenRow.access_token;
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0;
  if (!expiresAt || expiresAt < Date.now() + 2 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token);
    accessToken = refreshed.access_token;
    await supabase.from("gmail_tokens").update({
      access_token: refreshed.access_token,
      token_type: refreshed.token_type,
      expires_at: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString() : tokenRow.expires_at,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);
  }

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const days = Math.min(365, Math.max(1, Number(body.days || 90)));
  const maxResults = Math.min(50, Math.max(1, Number(body.maxResults || 20)));
  const query = String(body.query || `newer_than:${days}d (receipt OR invoice OR "order confirmation" OR "order confirmed" OR "thanks for your order" OR "your order")`);

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("maxResults", String(maxResults));
  listUrl.searchParams.set("q", query);

  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  const listJson = await listRes.json();
  if (!listRes.ok) return json({ error: "Could not search Gmail.", details: listJson }, 502);

  const messages = Array.isArray(listJson.messages) ? listJson.messages : [];
  const rows = [];
  for (const m of messages) {
    const getUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`);
    getUrl.searchParams.set("format", "full");
    const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!getRes.ok) continue;
    const msg = await getRes.json();
    const parsed = parseDraft(msg);
    if (!parsed.item_title || !parsed.total_cost) continue;
    rows.push({ user_id: user.id, ...parsed });
  }

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from("gmail_import_queue")
      .upsert(rows, { onConflict: "user_id,message_id", ignoreDuplicates: true });
    if (upsertError) return json({ error: "Could not save Gmail import queue.", details: upsertError }, 500);
  }

  const { count } = await supabase
    .from("gmail_import_queue")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "draft");

  return json({ ok: true, searched: messages.length, drafted: rows.length, queuedDrafts: count || 0, query });
});
