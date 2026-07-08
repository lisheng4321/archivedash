import { useState } from "react";
import { cb, ghostBtn, inp, primaryBtn } from "../shared.jsx";
import { INTEGRATION_TONES, IntegrationPill, integrationTone } from "../shared/integrationState.jsx";

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
const moveButton = {
  background: "#111827",
  border: "1px solid #334155",
  color: "#cbd5e1",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1,
  padding: "6px 7px",
  minWidth: 28,
  minHeight: 32,
  borderRadius: 6,
};
const disabledMoveButton = {
  ...moveButton,
  opacity: 0.35,
  cursor: "not-allowed",
};

function ChipList({ items, onRemove, onMove, emptyLabel }) {
  const [pending, setPending] = useState(null);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {items.map((item, index) => {
        const confirming = pending === item;
        const canMove = typeof onMove === "function" && !confirming;
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
              <>
                {onMove && <>
                  <button onClick={() => onMove(index, index - 1)} disabled={!canMove || index === 0} style={index === 0 ? disabledMoveButton : moveButton} aria-label={`Move ${item} earlier`} title={`Move ${item} earlier`}>{"<"}</button>
                  <button onClick={() => onMove(index, index + 1)} disabled={!canMove || index === items.length - 1} style={index === items.length - 1 ? disabledMoveButton : moveButton} aria-label={`Move ${item} later`} title={`Move ${item} later`}>{">"}</button>
                </>}
                <button onClick={() => setPending(item)} style={removeButton} aria-label={`Remove ${item}`} title={`Remove ${item}`}>x</button>
              </>
            )}
          </div>
        );
      })}
      {items.length === 0 && emptyLabel && <span style={{ fontSize: 12, color: "#8b97ad" }}>{emptyLabel}</span>}
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
    navSettingsItems = [],
    onLogout,
    pagePad,
    PAYMETHODS,
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
  const ebayTone = integrationTone({ status: ebayStatus, busy: ebayBusy, configured });
  const gmailTone = integrationTone({ status: gmailStatus, busy: gmailBusy, configured });
  const ebayConnected = ebayTone === INTEGRATION_TONES.connected;
  const gmailConnected = gmailTone === INTEGRATION_TONES.connected;
  const [newCat, setNewCat] = useState("");
  const [newPlat, setNewPlat] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [newCust, setNewCust] = useState("");
  const [customersOpen, setCustomersOpen] = useState(false);
  const hiddenNavIds = Array.isArray(settings.hiddenNavIds) ? settings.hiddenNavIds.filter((id) => id !== "settings") : [];
  const hiddenNavSet = new Set(hiddenNavIds);
  const toggleNavItem = async (id, visible) => {
    if (id === "settings") return;
    const next = new Set(hiddenNavIds);
    if (visible) next.delete(id);
    else next.add(id);
    await persistSettings({ ...settings, hiddenNavIds: [...next] });
  };
  const moveListItem = async (key, items, from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    await persistSettings({ ...settings, [key]: next });
  };

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
  const addPaymentMethod = async () => {
    if (newPaymentMethod && !PAYMETHODS.includes(newPaymentMethod)) {
      await persistSettings({ ...settings, paymentMethods: [...PAYMETHODS, newPaymentMethod] });
      setNewPaymentMethod("");
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
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 4 }}>Sidebar tools</div>
            <p style={{ fontSize: 12, color: "#7c8aa0", margin: 0 }}>Choose what appears in the sidebar. Hidden tools can be re-added anytime.</p>
          </div>
          {hiddenNavIds.length > 0 && <button onClick={() => persistSettings({ ...settings, hiddenNavIds: [] })} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Show all</button>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
          {navSettingsItems.map((item) => {
            const locked = item.id === "settings";
            const visible = locked || !hiddenNavSet.has(item.id);
            return (
              <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, background: "#0d1117", border: `1px solid ${visible ? "#232c3c" : "#334155"}`, borderRadius: 8, padding: "9px 10px", color: visible ? "#d6dbe4" : "#7c8aa0", fontSize: 12, cursor: locked ? "default" : "pointer" }}>
                <input type="checkbox" checked={visible} disabled={locked} onChange={(e) => toggleNavItem(item.id, e.target.checked)} style={cb} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{item.label}</span>
                {locked && <span style={{ marginLeft: "auto", color: "#7c8aa0", fontSize: 11 }}>Always on</span>}
              </label>
            );
          })}
        </div>
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
            <button onClick={connectEbay} disabled={ebayBusy} style={{ ...(ebayConnected ? ghostBtn : primaryBtn), fontSize: 12, padding: "7px 12px" }}>Connect eBay</button>
            <button onClick={syncEbayOrders} disabled={!configured || ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Sync now</button>
            <button onClick={() => { setPage("sales"); setEbayQueueOpen(true); loadEbayImports(); }} style={{ ...ghostBtn, color: "#93c5fd", fontWeight: 600, fontSize: 12, padding: "7px 12px" }}>Open sales queue</button>
          </div>
        </div>
        {ebayStatus && <div style={{ fontSize: 12, color: ebayTone.color }}>{ebayStatus}</div>}
        <div style={{ fontSize: 12, color: "#8b97ad" }}>{ebayImports.length} awaiting-postage draft{ebayImports.length === 1 ? "" : "s"} currently loaded.</div>
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
            <button onClick={connectGmail} disabled={gmailBusy} style={{ ...(gmailConnected ? ghostBtn : primaryBtn), fontSize: 12, padding: "7px 12px" }}>Connect Gmail</button>
            <button onClick={syncGmailInventory} disabled={!configured || gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Sync now</button>
            <button onClick={() => { setPage("inventory"); setGmailQueueOpen(true); loadGmailImports(); }} style={{ ...ghostBtn, color: "#93c5fd", fontWeight: 600, fontSize: 12, padding: "7px 12px" }}>Open inventory queue</button>
          </div>
        </div>
        {gmailStatus && <div style={{ fontSize: 12, color: gmailTone.color }}>{gmailStatus}</div>}
        <div style={{ fontSize: 12, color: "#8b97ad" }}>{gmailImports.length} inventory draft{gmailImports.length === 1 ? "" : "s"} currently loaded.</div>
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Categories</div>
        <ChipList items={CATS} onMove={(from, to) => moveListItem("categories", CATS, from, to)} onRemove={(cat) => persistSettings({ ...settings, categories: CATS.filter((item) => item !== cat) })} />
        <AddRow value={newCat} onChange={setNewCat} onAdd={addCategory} placeholder="New category" />
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Platforms</div>
        <ChipList items={PLATS} onMove={(from, to) => moveListItem("platforms", PLATS, from, to)} onRemove={(platform) => persistSettings({ ...settings, platforms: PLATS.filter((item) => item !== platform) })} />
        <AddRow value={newPlat} onChange={setNewPlat} onAdd={addPlatform} placeholder="New platform" />
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#f3f6fb", marginBottom: 10 }}>Payment Methods</div>
        <ChipList items={PAYMETHODS} onMove={(from, to) => moveListItem("paymentMethods", PAYMETHODS, from, to)} onRemove={(method) => persistSettings({ ...settings, paymentMethods: PAYMETHODS.filter((item) => item !== method) })} />
        <AddRow value={newPaymentMethod} onChange={setNewPaymentMethod} onAdd={addPaymentMethod} placeholder="New payment method" />
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
