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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

  if (!clientId || !supabaseUrl || !serviceRole) {
    return json({ error: "Missing Google or Supabase Edge Function secrets." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing authorization." }, 401);

  const supabase = createClient(supabaseUrl, serviceRole);
  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Could not identify signed-in user." }, 401);

  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await supabase.from("gmail_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error: stateError } = await supabase.from("gmail_oauth_states").insert({ state, user_id: user.id, expires_at: expiresAt });
  if (stateError) return json({ error: "Could not prepare Gmail connection." }, 500);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");

  return json({ url: url.toString() });
});
