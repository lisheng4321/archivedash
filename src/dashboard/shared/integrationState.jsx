// Connection-state helpers for the eBay and Gmail integrations.
//
// There is no persisted "connected" flag or last-synced timestamp yet, so the
// pill state is inferred from the latest free-text status string plus the busy
// flag and Supabase config. The status string already carries the most recent
// "last synced / last checked" detail, so callers render it as the detail line.
//
// A dedicated "Stale" tone is defined for when a real last-synced timestamp
// becomes available; it is intentionally not inferred from the current signals.

export const INTEGRATION_TONES = {
  connected: { label: "Connected", color: "#86efac", bg: "#0d1f17", border: "#16653466", dot: "#34d399" },
  working: { label: "Working", color: "#93c5fd", bg: "#0f1a2e", border: "#2563eb55", dot: "#60a5fa" },
  action: { label: "Action needed", color: "#fca5a5", bg: "#1f1215", border: "#7f1d1d66", dot: "#ef4444" },
  setup: { label: "Setup needed", color: "#fbbf24", bg: "#241a08", border: "#92400e66", dot: "#f59e0b" },
  stale: { label: "Stale", color: "#fbbf24", bg: "#241a08", border: "#92400e66", dot: "#f59e0b" },
  disconnected: { label: "Not connected", color: "#9aa6bd", bg: "#161d2b", border: "#2a3650", dot: "#56627a" },
};

// Returns one of the INTEGRATION_TONES entries. Disconnected (neutral grey) is
// kept visually distinct from action-needed (red) so a never-connected state
// does not read as a failure.
export function integrationTone({ status = "", busy = false, configured = true }) {
  if (!configured) return INTEGRATION_TONES.setup;
  if (busy) return INTEGRATION_TONES.working;
  const s = (status || "").trim();
  if (!s) return INTEGRATION_TONES.disconnected;
  if (/^could not|^supabase is not configured/i.test(s)) return INTEGRATION_TONES.action;
  if (/reconnect/i.test(s)) return INTEGRATION_TONES.action;
  if (/cancell?ed/i.test(s)) return INTEGRATION_TONES.disconnected;
  if (/connected\b|^synced\b|^scanned\b/i.test(s)) return INTEGRATION_TONES.connected;
  return INTEGRATION_TONES.disconnected;
}

export function IntegrationPill({ status, busy, configured }) {
  const tone = integrationTone({ status, busy, configured });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone.dot, flexShrink: 0 }} />
      {tone.label}
    </span>
  );
}
