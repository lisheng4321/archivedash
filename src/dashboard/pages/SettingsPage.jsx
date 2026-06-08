import { useState } from "react";
import { ghostBtn, inp, primaryBtn } from "../shared.jsx";
import { IntegrationPill, integrationTone } from "../shared/integrationState.jsx";

const removeButton = {
  background: "none",
  border: "none",
  color: "#f87171",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: "6px 8px",
  marginLeft: 2,
  minWidth: 32,
  minHeight: 32,
  borderRadius: 6,
};
const confirmRemoveButton = {
  background: "#ef4444",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  padding: "6px 10px",
  marginLeft: 4,
  minHeight: 32,
  borderRadius: 6,
};
const keepButton = {
  background: "#232c3c",
  border: "1px solid #38415a",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: 12,
  padding: "6px 10px",
  marginLeft: 4,
  minHeight: 32,
  borderRadius: 6,
};

function ChipList({ items, onRemove, emptyLabel }) {
  const [pending, setPending] = useState(null);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {items.map((item) => {
        const confirming = pending === item;
        return (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 4, background: confirming ? "#2a1a1d" : "#232c3c", border: confirming ? "1px solid #ef444455" : "1px solid transparent", borderRadius: 6, padding: "4px 8px 4px 10px", fontSize: 13, color: "#e5e7eb" }}>
            {item}
            {confirming ? (
              <>
                <span style={{ fontSize: 11, color: "#fca5a5", marginLeft: 4 }}>Remove?</span>
                <button onClick={() => { onRemove(item); setPending(null); }} style={confirmRemoveButton} aria-label={`Confirm remove ${item}`}>Remove</button>
                <button onClick={() => setPending(null)} style={keepButton} aria-label={`Keep ${item}`}>Keep</button>
              </>
            ) : (
              <button onClick={() => setPending(item)} style={removeButton} aria-label={`Remove ${item}`} title={`Remove ${item}`}>x</button>
            )}
          </div>
        );
      })}
      {items.length === 0 && emptyLabel && <span style={{ fontSize: 12, color: "#56627a" }}>{emptyLabel}</span>}
    </div>
  );
}

function AddRow({ value, onChange, onAdd, placeholder }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inp, maxWidth: 200 }} placeholder={placeholder} />
      <button onClick={onAdd} style={primaryBtn}>Add</button>
    </div>
  );
}

export default function SettingsPage({ ctx }) {
  const {
    CATS,
    CUSTS,
    PLATS,
    connectEbay,
    connectGmail,
    ebayBusy,
    ebayImports,
    ebayStatus,
    gmailBusy,
    gmailImports,
    gmailStatus,
    loadEbayImports,
    loadGmailImports,
    onLogout,
    pagePad,
    persistSettings,
    setEbayQueueOpen,
    setGmailQueueOpen,
    setPage,
    settings,
    supabase,
    syncEbayOrders,
    syncGmailInventory,
    userEmail,
  } = ctx;
  const configured = !!supabase;
  const [newCat, setNewCat] = useState("");
  const [newPlat, setNewPlat] = useState("");
  const [newCust, setNewCust] = useState("");
  const [customersOpen, setCustomersOpen] = useState(false);

  const addCategory = async () => {
    if (newCat && !CATS.includes(newCat)) {
      await persistSettings({ ...settings, categories: [...CATS, newCat] });
      setNewCat("");
    }
  };
  const addPlatform = async () => {
    if (newPlat && !PLATS.includes(newPlat)) {
      await persistSettings({ ...settings, platforms: [...PLATS, newPlat] });
      setNewPlat("");
    }
  };
  const addCustomer = async () => {
    if (newCust && !CUSTS.includes(newCust)) {
      await persistSettings({ ...settings, customers: [...CUSTS, newCust] });
      setNewCust("");
    }
  };

  return (
    <div style={{ padding: pagePad, maxWidth: 1120 }}>
      <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Settings</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setPage("settings")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>General</button>
        <button onClick={() => setPage("health")} style={ghostBtn}>System Health</button>
        <button onClick={() => setPage("backup")} style={ghostBtn}>Backup & Restore</button>
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb" }}>eBay Connection</span>
              <IntegrationPill status={ebayStatus} busy={ebayBusy} configured={configured} />
            </div>
            <p style={{ fontSize: 12, color: "#7c8aa0", margin: 0 }}>Connect to set up the link; sync to pull recent orders. Orders power Sales; active listings power Market Review.</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={connectEbay} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Connect eBay</button>
            <button onClick={syncEbayOrders} disabled={!configured || ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Sync now</button>
            <button onClick={() => { setPage("sales"); setEbayQueueOpen(true); loadEbayImports(); }} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Open sales queue</button>
          </div>
        </div>
        {ebayStatus && <div style={{ fontSize: 12, color: integrationTone({ status: ebayStatus, busy: ebayBusy, configured }).color }}>{ebayStatus}</div>}
        <div style={{ fontSize: 12, color: "#56627a" }}>{ebayImports.length} awaiting-postage draft{ebayImports.length === 1 ? "" : "s"} currently loaded.</div>
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb" }}>Gmail Inventory Import</span>
              <IntegrationPill status={gmailStatus} busy={gmailBusy} configured={configured} />
            </div>
            <p style={{ fontSize: 12, color: "#7c8aa0", margin: 0 }}>Connect to set up the link; sync to scan recent receipts. Review purchase confirmations from Inventory before adding stock.</p>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={connectGmail} disabled={gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Connect Gmail</button>
            <button onClick={syncGmailInventory} disabled={!configured || gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Sync now</button>
            <button onClick={() => { setPage("inventory"); setGmailQueueOpen(true); loadGmailImports(); }} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Open inventory queue</button>
          </div>
        </div>
        {gmailStatus && <div style={{ fontSize: 12, color: integrationTone({ status: gmailStatus, busy: gmailBusy, configured }).color }}>{gmailStatus}</div>}
        <div style={{ fontSize: 12, color: "#56627a" }}>{gmailImports.length} inventory draft{gmailImports.length === 1 ? "" : "s"} currently loaded.</div>
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Categories</div>
        <ChipList items={CATS} onRemove={(cat) => persistSettings({ ...settings, categories: CATS.filter((item) => item !== cat) })} />
        <AddRow value={newCat} onChange={setNewCat} onAdd={addCategory} placeholder="New category" />
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Platforms</div>
        <ChipList items={PLATS} onRemove={(platform) => persistSettings({ ...settings, platforms: PLATS.filter((item) => item !== platform) })} />
        <AddRow value={newPlat} onChange={setNewPlat} onAdd={addPlatform} placeholder="New platform" />
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Customer Database</div>
        <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 10px" }}>{CUSTS.length} saved customers. Full profiles live on the Customers page.</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: customersOpen ? 12 : 0 }}>
          <button onClick={() => setPage("customers")} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Manage customers</button>
          <button onClick={() => setCustomersOpen((value) => !value)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>{customersOpen ? "Hide quick add" : "Quick add"}</button>
        </div>
        {customersOpen && (<>
          <ChipList items={CUSTS} onRemove={(customer) => persistSettings({ ...settings, customers: CUSTS.filter((item) => item !== customer) })} emptyLabel="No customers yet" />
          <AddRow value={newCust} onChange={setNewCust} onAdd={addCustomer} placeholder="Customer name" />
        </>)}
      </div>
      {onLogout && <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginTop: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Account</div>
        <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 12px" }}>Signed in as {userEmail}</p>
        <button onClick={onLogout} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444" }}>Log out</button>
      </div>}
    </div>
  );
}
