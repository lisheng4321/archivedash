import { ghostBtn, primaryBtn } from "../shared.jsx";
import { IntegrationPill } from "../shared/integrationState.jsx";

export default function HealthPage({ ctx }) {
  const {
    pagePad,
    isMobile,
    health,
    loadEbayImports,
    loadGmailImports,
    supabase,
    ebayBusy,
    gmailBusy,
    ebayStatus,
    gmailStatus,
    ebayImports,
    gmailImports,
    setPage,
    setEbayQueueOpen,
    setGmailQueueOpen,
    syncEbayOrders,
    syncGmailInventory,
    inventory,
    sales,
  } = ctx;
  const configured = !!supabase;

  return (<div style={{ padding: pagePad, maxWidth: 980 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>System Health</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#56627a" }}>
                {health.issues} issue{health.issues === 1 ? "" : "s"} · {health.warnings} warning{health.warnings === 1 ? "" : "s"} · {health.actions} queue action{health.actions === 1 ? "" : "s"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={loadEbayImports} disabled={!supabase || ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Refresh eBay</button>
              <button onClick={loadGmailImports} disabled={!supabase || gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Refresh Gmail</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
            {health.checks.map((check) => {
              const colors = check.state === "ok" ? { dot: "#34d399", bg: "#0d1f17", border: "#16653466", text: "#86efac", label: "OK" }
                : check.state === "issue" ? { dot: "#ef4444", bg: "#1f1215", border: "#7f1d1d66", text: "#fca5a5", label: "Fix" }
                : check.state === "action" ? { dot: "#60a5fa", bg: "#0f1a2e", border: "#2563eb55", text: "#93c5fd", label: "Review" }
                : { dot: "#f59e0b", bg: "#241a08", border: "#92400e66", text: "#fbbf24", label: "Check" };
              return (
                <div key={check.key} style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: colors.dot, flexShrink: 0 }} />
                      <span style={{ color: "#f3f6fb", fontWeight: 700, fontSize: 14 }}>{check.label}</span>
                    </div>
                    <span style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{colors.label}</span>
                  </div>
                  <div style={{ color: "#7c8aa0", fontSize: 12, lineHeight: 1.45 }}>{check.detail}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", gap: 12 }}>
            <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 18 }}>
              <div style={{ fontSize: 14, color: "#f3f6fb", fontWeight: 700, marginBottom: 10 }}>Queues</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div style={{ background: "#0d1117", border: "1px solid #232c3c", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: "#7c8aa0" }}>eBay awaiting postage</div>
                    <IntegrationPill status={ebayStatus} busy={ebayBusy} configured={configured} />
                  </div>
                  <div style={{ fontSize: 24, color: ebayImports.length ? "#60a5fa" : "#f3f6fb", fontWeight: 800, marginBottom: ebayStatus ? 6 : 10 }}>{ebayImports.length}</div>
                  {ebayStatus && <div style={{ fontSize: 11, color: "#7c8aa0", lineHeight: 1.4, marginBottom: 10 }}>{ebayStatus}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { setPage("sales"); setEbayQueueOpen(true); }} style={{ ...primaryBtn, padding: "6px 10px", fontSize: 12 }}>Open Sales</button>
                    <button onClick={syncEbayOrders} disabled={!supabase || ebayBusy} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Sync now</button>
                  </div>
                </div>
                <div style={{ background: "#0d1117", border: "1px solid #232c3c", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ fontSize: 12, color: "#7c8aa0" }}>Gmail inventory drafts</div>
                    <IntegrationPill status={gmailStatus} busy={gmailBusy} configured={configured} />
                  </div>
                  <div style={{ fontSize: 24, color: gmailImports.length ? "#60a5fa" : "#f3f6fb", fontWeight: 800, marginBottom: gmailStatus ? 6 : 10 }}>{gmailImports.length}</div>
                  {gmailStatus && <div style={{ fontSize: 11, color: "#7c8aa0", lineHeight: 1.4, marginBottom: 10 }}>{gmailStatus}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => { setPage("inventory"); setGmailQueueOpen(true); }} style={{ ...primaryBtn, padding: "6px 10px", fontSize: 12 }}>Open Inventory</button>
                    <button onClick={syncGmailInventory} disabled={!supabase || gmailBusy} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Sync now</button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 18 }}>
              <div style={{ fontSize: 14, color: "#f3f6fb", fontWeight: 700, marginBottom: 10 }}>Data Quality</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}><span style={{ color: "#7c8aa0" }}>Inventory items</span><span style={{ color: "#e5e7eb", fontWeight: 700 }}>{inventory.length}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}><span style={{ color: "#7c8aa0" }}>Recorded sales</span><span style={{ color: "#e5e7eb", fontWeight: 700 }}>{sales.length}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}><span style={{ color: "#7c8aa0" }}>Released preorder flags</span><span style={{ color: health.releasedPreorders ? "#60a5fa" : "#34d399", fontWeight: 700 }}>{health.releasedPreorders}</span></div>
              </div>
              <button onClick={() => setPage("settings")} style={{ ...ghostBtn, width: "100%", marginTop: 14, padding: "8px 10px", fontSize: 12 }}>Open Settings</button>
            </div>
          </div>
        </div>
  );
}
