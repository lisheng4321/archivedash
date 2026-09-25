import { useMemo, useState } from "react";
import { allocateOrderAmount, saleProductGroups } from "../saleOrder.js";
import { inventoryStatusFor } from "../inventory.js";
import { currency, today, inp, sel, primaryBtn, ghostBtn, Modal, UnsavedDialog, Field, Row, ModalActions } from "../shared.jsx";

export default function ManualSaleModal({ inventory, onSell, onClose, platforms, customers, paymentMethods = [] }) {
  const groups = useMemo(() => saleProductGroups(inventory), [inventory]);
  const [selection, setSelection] = useState([]);
  const [prices, setPrices] = useState({});
  const [query, setQuery] = useState("");
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState("");
  const [fees, setFees] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const defaultPayment = (platform) => paymentMethods.find((method) => platform.toLowerCase().includes("ebay") ? /ebay/i.test(method) : /cash/i.test(method)) || paymentMethods[0] || "Other";
  const [shared, setShared] = useState({ platform: platforms[0] || "Other", paymentMethod: defaultPayment(platforms[0] || "Other"), saleDate: today(), customer: "" });
  const selected = selection.map((entry) => ({ ...groups.find((group) => group.key === entry.key), quantity: entry.quantity })).filter((group) => group.item);
  const items = selected.flatMap((group) => group.items.slice(0, group.quantity));
  const changeQuantity = (group, value) => {
    const quantity = Math.min(group.items.length, Math.max(0, Math.floor(Number(value) || 0)));
    setSelection((prev) => quantity === 0 ? prev.filter((entry) => entry.key !== group.key) : prev.some((entry) => entry.key === group.key) ? prev.map((entry) => entry.key === group.key ? { ...entry, quantity } : entry) : [...prev, { key: group.key, quantity }]);
  };
  const revenue = selected.reduce((sum, group) => sum + Number(prices[group.key] || 0) * group.quantity, 0);
  const profit = revenue - items.reduce((sum, item) => sum + Number(item.price || 0), 0) - Number(shipping || 0) - Number(fees || 0);
  const validMoney = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
  const ready = items.length > 0 && selected.every((group) => String(prices[group.key] ?? "").trim() !== "" && validMoney(prices[group.key])) && validMoney(shipping) && validMoney(fees) && shared.saleDate && shared.saleDate <= today();
  const close = () => selection.length ? setDiscard(true) : onClose();
  const save = async () => {
    if (!ready || busy) return;
    setBusy(true); setError("");
    const shippingParts = allocateOrderAmount(shipping, items.length);
    const feeParts = allocateOrderAmount(fees, items.length);
    let index = 0;
    const rows = selected.flatMap((group) => group.items.slice(0, group.quantity).map((item) => {
      const i = index++;
      return { id: item.id, salePrice: prices[group.key], shippingPrice: shippingParts[i], platformFees: feeParts[i] };
    }));
    try {
      const result = await onSell(items, shared, rows);
      if (result?.ok === false) setError(result.error || "Could not save this order.");
    } catch (err) { setError(err.message || "Could not save this order."); }
    finally { setBusy(false); }
  };
  const filtered = groups.filter((group) => [group.item.name, group.item.brand, group.item.category, group.item.size].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase().trim())));
  return <><Modal key={step} open onClose={close} guardedClose={close} dismissible={!busy} title={step === 0 ? "Add Sale" : `Bulk Sale · ${step === 1 ? "1. Select stock" : "2. Price and review"}`} maxWidth={900}>
    <div role="group" aria-label="Sale entry mode" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {[{ label: "Quick sale", value: 0 }, { label: "Bulk sale", value: 1 }].map((mode) => <button key={mode.value} disabled={busy} aria-pressed={mode.value === 0 ? step === 0 : step !== 0} onClick={() => setStep(mode.value)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", background: (mode.value === 0 ? step === 0 : step !== 0) ? "#24324a" : "transparent", color: (mode.value === 0 ? step === 0 : step !== 0) ? "#f3f6fb" : "#8b97ad" }}>{mode.label}</button>)}
    </div>
    {step === 0 && <>
      <Field label="Add an item"><input value={query} onChange={(event) => setQuery(event.target.value)} style={inp} placeholder="Search inventory to add one or a few items…" /></Field>
      {query.trim() && <div style={{ marginBottom: 16, border: "1px solid #232c3c", borderRadius: 8, overflow: "hidden" }}>
        {filtered.slice(0, 6).map((group) => <button key={group.key} onClick={() => { changeQuantity(group, (selection.find((entry) => entry.key === group.key)?.quantity || 0) + 1); setQuery(""); }} style={{ display: "block", textAlign: "left", width: "100%", border: 0, borderBottom: "1px solid #232c3c", padding: "10px 12px", background: "#0d1117", color: "#e5e7eb", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ display: "block", fontSize: 13 }}>{group.item.name}</span><span style={{ fontSize: 11, color: "#8b97ad" }}>{group.item.size || "OS"} · {currency(group.item.price)} cost/unit · {group.items.length} in stock · {inventoryStatusFor(group.item).replace("in_transit", "In transit")}</span>
        </button>)}
        {filtered.length === 0 && <p style={{ color: "#8b97ad", padding: "0 12px", fontSize: 12 }}>No matching stock.</p>}
        {filtered.length > 6 && <p style={{ color: "#8b97ad", padding: "0 12px", fontSize: 12 }}>Showing 6 of {filtered.length} matches. Refine your search or use Bulk sale.</p>}
      </div>}
    </>}
    {step === 1 ? <>
      <Field label="Search inventory"><input value={query} onChange={(event) => setQuery(event.target.value)} style={inp} placeholder="Name, brand, category or size" /></Field>
      {filtered.length === 0 && <p style={{ color: "#9aa6bb" }}>No matching stock.</p>}
      {filtered.map((group) => <div key={group.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: "1px solid #232c3c" }}>
        <div style={{ flex: 1, minWidth: 0, color: "#e5e7eb", fontSize: 13 }}><strong>{group.item.name}</strong><div style={{ color: "#9aa6bb", marginTop: 4, fontSize: 12 }}>{group.item.size || "OS"} · {currency(group.item.price)} cost/unit · {inventoryStatusFor(group.item).replace("in_transit", "In transit")} · {group.items.length} units</div></div>
        <div style={{ width: 90 }}><Field label="Quantity"><input aria-label={`Quantity for ${group.item.name} ${group.item.size || "OS"} at ${group.item.price}`} type="number" min="0" max={group.items.length} step="1" value={selection.find((entry) => entry.key === group.key)?.quantity || 0} onChange={(event) => changeQuantity(group, event.target.value)} style={inp} /></Field></div>
      </div>)}
    </> : <>
      {selected.map((group) => <div key={group.key} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #232c3c" }}>
        <div style={{ flex: "1 1 200px", color: "#e5e7eb", fontSize: 13 }}><strong>{group.item.name}</strong><div style={{ color: "#9aa6bb", marginTop: 4 }}>{group.item.size || "OS"} · {group.quantity} units · {currency(group.item.price)} cost/unit</div></div>
        {step === 0 && <div style={{ width: 76 }}><Field label="Quantity"><input type="number" min="1" max={group.items.length} step="1" value={group.quantity} onChange={(event) => changeQuantity(group, event.target.value)} style={inp} /></Field></div>}
        <div style={{ width: 140 }}><Field label="Price per unit" req><input type="number" min="0" step="0.01" value={prices[group.key] ?? ""} onChange={(event) => setPrices({ ...prices, [group.key]: event.target.value })} style={inp} /></Field></div>
        <span style={{ color: "#e5e7eb", width: 100 }}>{currency(Number(prices[group.key] || 0) * group.quantity)}</span>
        <button style={ghostBtn} onClick={() => changeQuantity(group, 0)}>Remove</button>
      </div>)}
      <Row><Field label="Platform"><select style={sel} value={shared.platform} onChange={(event) => setShared({ ...shared, platform: event.target.value, paymentMethod: defaultPayment(event.target.value) })}>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select></Field><Field label="Payment method"><select style={sel} value={shared.paymentMethod} onChange={(event) => setShared({ ...shared, paymentMethod: event.target.value })}>{[...new Set([...paymentMethods, shared.paymentMethod])].map((method) => <option key={method}>{method}</option>)}</select></Field></Row>
      <Row><Field label="Sale date (buyer paid)" req><input type="date" max={today()} value={shared.saleDate} onChange={(event) => setShared({ ...shared, saleDate: event.target.value })} style={inp} /></Field></Row>
      <Field label="Customer"><input list="manual-order-customers" value={shared.customer} onChange={(event) => setShared({ ...shared, customer: event.target.value })} style={inp} placeholder="Optional buyer name" /><datalist id="manual-order-customers">{customers.map((customer) => <option key={customer} value={customer} />)}</datalist></Field>
      <div style={{ marginTop: 16 }}><Row><Field label="Order shipping cost"><input type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} style={inp} placeholder="0.00" /></Field><Field label="Order fees"><input type="number" min="0" step="0.01" value={fees} onChange={(event) => setFees(event.target.value)} style={inp} placeholder="0.00" /></Field></Row></div>
      <p style={{ color: "#9aa6bb", fontSize: 12 }}>Record once fulfilled. Sale date is when the buyer paid; shipping and fees apply to the whole order.</p>
    </>}
    {error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
    <ModalActions mobileStack={false} style={{ flexWrap: "wrap", alignItems: "center" }}>
      <div aria-live="polite" style={{ flex: "1 1 220px", color: "#e5e7eb", fontSize: 12 }}>{items.length} units{step !== 1 && <> · {currency(revenue)} revenue · <span style={{ color: profit >= 0 ? "#34d399" : "#f87171" }}>{currency(profit)} profit</span></>}</div>
      <button disabled={busy} onClick={step === 2 ? () => setStep(1) : close} style={ghostBtn}>{step === 2 ? "Back to stock" : "Cancel"}</button>
      <button disabled={busy || (step === 1 ? !items.length : !ready)} onClick={step === 1 ? () => setStep(2) : save} style={{ ...primaryBtn, opacity: (step === 1 ? items.length : ready) ? 1 : 0.5 }}>{busy ? "Saving…" : step === 1 ? "Price and review" : step === 0 ? "Record sale" : "Record order"}</button>
    </ModalActions>
  </Modal><UnsavedDialog open={discard} onDiscard={onClose} onCancel={() => setDiscard(false)} /></>;
}
