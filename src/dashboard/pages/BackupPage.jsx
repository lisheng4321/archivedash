import { ghostBtn, primaryBtn, inp, cb } from "../shared.jsx";
import { DEFAULT_BACKUP_SETTINGS } from "../settings.js";

export default function BackupPage({ ctx }) {
  const {
    isMobile,
    backupStatus,
    backupSettings,
    updateBackupSettings,
    backups,
    createSupabaseBackup,
    supabase,
    inventory,
    sales,
    expenses,
    subs,
    notes,
    exportJSON,
    exportCSV,
    importBackup,
    restoreSupabaseBackup,
    requestReplaceImport,
    requestClearAll,
  } = ctx;

  return (<>
          <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#f3f6fb" }}>Backup & Restore</h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "#56627a" }}>Export or import your data.</p>
          {backupStatus&&<div style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#93c5fd" }}>{backupStatus}</div>}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.1fr) minmax(320px, 0.9fr)", gap: 14, alignItems: "start" }}>
          <div>
          <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 4 }}>Weekly Supabase backup</div>
                <p style={{ fontSize: 12, color: "#7c8aa0", margin: 0 }}>Saves a full snapshot when ArchiveDash opens after 7 days.</p>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>
                <input type="checkbox" checked={backupSettings.autoWeekly} onChange={(e) => updateBackupSettings({ autoWeekly: e.target.checked })} style={cb} />
                Enabled
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#7c8aa0" }}>Destination<br /><span style={{ color: "#e5e7eb", fontWeight: 600 }}>Supabase</span></div>
              <div style={{ fontSize: 12, color: "#7c8aa0" }}>Last backup<br /><span style={{ color: "#e5e7eb", fontWeight: 600 }}>{backupSettings.lastRunAt ? new Date(backupSettings.lastRunAt).toLocaleString() : "Never"}</span></div>
              <label style={{ fontSize: 12, color: "#7c8aa0" }}>Keep snapshots
                <input type="number" min="1" max="52" value={backupSettings.retention} onChange={(e) => updateBackupSettings({ retention: Math.max(1, Math.min(52, Number(e.target.value) || DEFAULT_BACKUP_SETTINGS.retention)) })} style={{ ...inp, marginTop: 5, maxWidth: 90 }} />
              </label>
              <div style={{ fontSize: 12, color: "#7c8aa0" }}>Saved snapshots<br /><span style={{ color: "#e5e7eb", fontWeight: 600 }}>{backups.length}</span></div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => createSupabaseBackup("manual")} disabled={!supabase} style={primaryBtn}>Run backup now</button>
              {!supabase && <span style={{ fontSize: 12, color: "#f59e0b", alignSelf: "center" }}>Supabase is not configured.</span>}
            </div>
          </div>
          <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 4 }}>Export</div>
            <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 12px" }}>{inventory.length} items · {sales.length} sales · {expenses.length} expenses · {subs.length} subs · {notes.length} notes</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={exportJSON} style={primaryBtn}>Download JSON</button><button onClick={exportCSV} style={ghostBtn}>Export Sales CSV</button></div>
          </div>
          <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 4 }}>Import</div>
            <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 12px" }}>Merge adds new records without touching existing data. Replace import lives in the Danger Zone below.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button onClick={() => importBackup("merge")} style={primaryBtn}>Merge import (safe)</button></div>
          </div>
          </div>
          <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb" }}>Snapshot history</div>
              <span style={{ fontSize: 11, color: "#56627a" }}>{backups.length} saved</span>
            </div>
            {backups.length === 0 ? (
              <div style={{ color: "#374151", fontSize: 13, textAlign: "center", padding: "26px 10px", background: "#0d1117", borderRadius: 10 }}>No Supabase snapshots yet.</div>
            ) : backups.slice(0, 8).map((snapshot) => (
              <div key={snapshot.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid #232c3c22" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 700 }}>{new Date(snapshot.createdAt).toLocaleString()}</div>
                  <div style={{ color: "#7c8aa0", fontSize: 11 }}>{snapshot.counts?.inventory || 0} items - {snapshot.counts?.sales || 0} sales - {snapshot.counts?.notes || 0} notes</div>
                </div>
                <button onClick={() => restoreSupabaseBackup(snapshot)} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Restore</button>
              </div>
            ))}
          </div>
          </div>
          <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #ef444433", padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f87171", marginBottom: 4 }}>Danger Zone</div>
            <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 12px" }}>These actions overwrite or erase your data. Each asks for a typed confirmation{supabase ? " and saves a Supabase snapshot first" : ""}.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={requestReplaceImport} style={{ ...ghostBtn, color: "#f59e0b", border: "1px solid #f59e0b44" }}>Replace import</button>
              <button onClick={requestClearAll} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Clear all data</button>
            </div>
          </div>
  </>);
}
