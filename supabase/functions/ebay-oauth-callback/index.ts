import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const html = (body: string, status = 200) => new Response(body, {
  status,
  headers: { "Content-Type": "text/html; charset=utf-8" },
});

const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url } });

Deno.serve(async (req) => {
  if (req.method !== "GET") return html("GET required.", 405);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error") || url.searchParams.get("error_description");

  const appUrl = Deno.env.get("ARCHIVEDASH_APP_URL") || "https://archivedash.vercel.app";
  if (error) return redirect(`${appUrl}?ebay=declined`);
  if (!code || !state) return html("Missing eBay OAuth code/state.", 400);

  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");
  const runame = Deno.env.get("EBAY_RUNAME");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!clientId || !clientSecret || !runame || !supabaseUrl || !serviceRole) {
    return html("ArchiveDash eBay secrets are not configured in Supabase.", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const { data: stateRow, error: stateError } = await supabase
    .from("ebay_oauth_states")
    .select("state,user_id,expires_at")
    .eq("state", state)
    .single();

  if (stateError || !stateRow || new Date(stateRow.expires_at).getTime() < Date.now()) {
    return html("This eBay connection link expired. Please return to ArchiveDash and try again.", 400);
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", runame);

  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`),
    },
    body: tokenBody,
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("eBay token exchange failed", { status: tokenRes.status });
    return html("eBay token exchange failed. Check your Client ID, Client Secret, RuName, and redirect settings.", 500);
  }

  const now = Date.now();
  const expiresAt = tokenJson.expires_in ? new Date(now + tokenJson.expires_in * 1000).toISOString() : null;
  const refreshExpiresAt = tokenJson.refresh_token_expires_in ? new Date(now + tokenJson.refresh_token_expires_in * 1000).toISOString() : null;

  const { error: upsertError } = await supabase.from("ebay_tokens").upsert({
    user_id: stateRow.user_id,
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    token_type: tokenJson.token_type,
    scope: tokenJson.scope,
    expires_at: expiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  await supabase.from("ebay_oauth_states").delete().eq("state", state);

  if (upsertError) {
    console.error("Token store failed", { message: upsertError.message });
    return html("ArchiveDash could not save the eBay connection.", 500);
  }

  return redirect(`${appUrl}?ebay=connected`);
});
