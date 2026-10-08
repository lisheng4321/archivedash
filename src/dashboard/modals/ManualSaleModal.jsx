import { useMemo, useState } from "react";
import { manualSaleRows, saleProductGroups } from "../saleOrder.js";
import { toCents, fromCents } from "../shared/money.js";
import { inventoryStatusFor, isInventorySellable } from "../inventory.js";
import { currency, today, inp, sel, primaryBtn, ghostBtn, Modal, UnsavedDialog, Field, Row, ModalActions } from "../shared.jsx";

export default function ManualSaleModal({ inventory, onSell, onClose, platforms, customers, paymentMethods = [], pendingSave = false }) {
  const [queue, setQueue] = useState([]);
  const groups = useMemo(() => {
    const reserved = new Set(queue.flatMap((order) => order.items.map((item) => item.id)));
    return saleProductGroups(inventory.filter((item) => !reserved.has(item.id)));
  }, [inventory, queue]);
  const [selection, setSelection] = useState([]);
  const [prices, setPrices] = useState({});
  const [query, setQuery] = useState("");
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState("");
  const [buyerShipping, setBuyerShipping] = useState("");
  const [fees, setFees] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discard, setDiscard] = useState(false);
  const defaultPayment = (platform) => paymentMethods.find((method) => platform.toLowerCase().includes("ebay") ? /ebay/i.test(method) : /cash/i.test(method)) || paymentMethods[0] || "Other";
  const [shared, setShared] = useState({ platform: platforms[0] || "Other", paymentMethod: defaultPayment(platforms[0] || "Other"), saleDate: today(), fulfilmentDate: today(), customer: "" });
  const selected = selection.map((entry) => ({ ...groups.find((group) => group.key === entry.key), quantity: entry.quantity })).filter((group) => group.item);
  const items = selected.flatMap((group) => group.items.slice(0, group.quantity));
  const changeQuantity = (group, value) => {
    if (Number(value) > 0 && !group.items.every(isInventorySellable)) return;
    const quantity = Math.min(group.items.length, Math.max(0, Math.floor(Number(value) || 0)));
    setSelection((prev) => quantity === 0 ? prev.filter((entry) => entry.key !== group.key) : prev.some((entry) => entry.key === group.key) ? prev.map((entry) => entry.key === group.key ? { ...entry, quantity } : entry) : [...prev, { key: group.key, quantity }]);
  };
  const itemRevenue = fromCents(selected.reduce((sum, group) => sum + toCents(prices[group.key]) * group.quantity, 0));
  const revenue = fromCents(toCents(itemRevenue) + (items.length ? toCents(buyerShipping) : 0));
  const profit = revenue - items.reduce((sum, item) => sum + Number(item.price || 0), 0) - Number(shipping || 0) - Number(fees || 0);
  const validMoney = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
  const ready = items.length > 0 && items.every(isInventorySellable) && selected.length === selection.length && selected.every((group) => group.quantity <= group.items.length && String(prices[group.key] ?? "").trim() !== "" && validMoney(prices[group.key])) && validMoney(buyerShipping) && validMoney(shipping) && validMoney(fees) && shared.saleDate && shared.saleDate <= today() && shared.fulfilmentDate && shared.fulfilmentDate <= today();
  const close = () => { if (!busy) selection.length || queue.length ? setDiscard(true) : onClose(); };
  const currentOrder = () => {
    const rows = manualSaleRows(selected, prices, buyerShipping, shipping, fees);
    return { items, shared: { ...shared, postageConfirmed: String(shipping).trim() !== "", feesConfirmed: String(fees).trim() !== "" }, rows, revenue, profit, buyerShipping: fromCents(toCents(buyerShipping)) };
  };
  const queueSale = () => {
    if (!ready || busy) return;
    setQueue((prev) => [...prev, currentOrder()]);
    setSelection([]); setPrices({}); setQuery(""); setShipping(""); setBuyerShipping(""); setFees(""); setError("");
    setShared((prev) => ({ ...prev, customer: "" }));
    if (step === 2) setStep(1);
  };
  const canSave = selection.length ? ready : queue.length > 0;
  const saleCount = queue.length + (selection.length ? 1 : 0);
  const totalUnits = items.length + queue.reduce((sum, order) => sum + order.items.length, 0);
  const totalRevenue = revenue + queue.reduce((sum, order) => sum + order.revenue, 0);
  const totalProfit = profit + queue.reduce((sum, order) => sum + order.profit, 0);
  const save = async () => {
    if ((!canSave && !pendingSave) || busy) return;
    setBusy(true); setError("");
    try {
      const result = await onSell([...queue, ...(selection.length ? [currentOrder()] : [])]);
      if (result?.ok === false) setError(result.error || "Could not save these sales.");
    } catch (err) { setError(err.message || "Could not save these sales."); }
    finally { setBusy(false); }
  };
  const filtered = groups.filter((group) => (showUnavailable || group.items.every(isInventorySellable)) && [group.item.name, group.item.brand, group.item.category, group.item.size, group.item.purchaseSource, group.item.purchaseReference].some((value) => String(value || "").toLowerCase().includes(query.toLowerCase().trim())));
  const stockDetail = (group) => `${group.item.size || "OS"} · ${currency(group.item.price)} cost/unit · ${group.items.length} remaining · ${group.item.purchaseSource || "Unknown source"} · ${group.item.purchaseDate || "Undated lot"}${group.item.purchaseReference ? ` · ${group.item.purchaseReference}` : ""}`;
  const unavailableReason = (group) => group.item.stockIssue ? "Condition issue — resolve before selling" : `${inventoryStatusFor(group.item).replace("in_transit", "In transit")} — mark Available after arrival`;
  return <><Modal key={step} open onClose={close} guardedClose={close} dismissible={!busy} title={step === 0 ? "Add Sale" : `Bulk Sale · ${step === 1 ? "1. Select stock" : "2. Price and review"}`} maxWidth={900}>
    <fieldset disabled={busy || pendingSave} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <div role="group" aria-label="Sale entry mode" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {[{ label: "Quick sale", value: 0 }, { label: "Bulk sale", value: 1 }].map((mode) => <button key={mode.value} disabled={busy} aria-pressed={mode.value === 0 ? step === 0 : step !== 0} onClick={() => setStep(mode.value)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", background: (mode.value === 0 ? step === 0 : step !== 0) ? "#24324a" : "transparent", color: (mode.value === 0 ? step === 0 : step !== 0) ? "#f3f6fb" : "#8b97ad" }}>{mode.label}</button>)}
    </div>
    <p style={{ color: "#9aa6bb", fontSize: 12, marginTop: 0 }}>Each sale is for one buyer. Queue a sale to enter another buyer, then record them together.</p>
    {step !== 2 && <label style={{ display: "block", color: "#9aa6bb", fontSize: 12, marginBottom: 12 }}><input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} /> Show unavailable (reference only)</label>}
    {step === 0 && <>
      <Field label="Add an item"><input value={query} onChange={(event) => setQuery(event.target.value)} style={inp} placeholder="Search inventory to add one or a few items…" /></Field>
      {query.trim() && <div style={{ marginBottom: 16, border: "1px solid #232c3c", borderRadius: 8, overflow: "hidden" }}>
        {filtered.slice(0, 6).map((group) => <button key={group.key} disabled={!group.items.every(isInventorySellable)} onClick={() => { changeQuantity(group, (selection.find((entry) => entry.key === group.key)?.quantity || 0) + 1); setQuery(""); }} style={{ display: "block", textAlign: "left", width: "100%", border: 0, borderBottom: "1px solid #232c3c", padding: "10px 12px", background: "#0d1117", color: "#e5e7eb", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ display: "block", fontSize: 13 }}>{group.item.name}</span><span style={{ fontSize: 11, color: "#8b97ad" }}>{stockDetail(group)}{!group.items.every(isInventorySellable) && ` · ${unavailableReason(group)}`}</span>
        </button>)}
        {filtered.length === 0 && <p style={{ color: "#8b97ad", padding: "0 12px", fontSize: 12 }}>No matching stock.</p>}
        {filtered.length > 6 && <p style={{ color: "#8b97ad", padding: "0 12px", fontSize: 12 }}>Showing 6 of {filtered.length} matches. Refine your search or use Bulk sale.</p>}
      </div>}
    </>}
    {step === 1 ? <>
      <Field label="Search inventory"><input value={query} onChange={(event) => setQuery(event.target.value)} style={inp} placeholder="Name, brand, category or size" /></Field>
      {filtered.length === 0 && <p style={{ color: "#9aa6bb" }}>No matching stock.</p>}
      {filtered.map((group) => <div key={group.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 0", borderBottom: "1px solid #232c3c" }}>
        <div style={{ flex: 1, minWidth: 0, color: "#e5e7eb", fontSize: 13 }}><strong>{group.item.name}</strong><div style={{ color: "#9aa6bb", marginTop: 4, fontSize: 12 }}>{stockDetail(group)}{!group.items.every(isInventorySellable) && <div style={{ color: "#fbbf24" }}>{unavailableReason(group)}</div>}</div></div>
        <div style={{ width: 90 }}><Field label="Quantity"><input disabled={!group.items.every(isInventorySellable)} aria-label={`Quantity for ${group.item.name} ${group.item.size || "OS"} at ${group.item.price}`} type="number" min="0" max={group.items.length} step="1" value={selection.find((entry) => entry.key === group.key)?.quantity || 0} onChange={(event) => changeQuantity(group, event.target.value)} style={inp} /></Field></div>
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
      <Row><Field label="Sale date (buyer paid)" req><input type="date" max={today()} value={shared.saleDate} onChange={(event) => setShared({ ...shared, saleDate: event.target.value })} style={inp} /></Field><Field label="Fulfilled / shipped date" req><input type="date" max={today()} value={shared.fulfilmentDate} onChange={(event) => setShared({ ...shared, fulfilmentDate: event.target.value })} style={inp} /></Field></Row>
      <Field label="Customer"><input list="manual-order-customers" value={shared.customer} onChange={(event) => setShared({ ...shared, customer: event.target.value })} style={inp} placeholder="Optional buyer name" /><datalist id="manual-order-customers">{customers.map((customer) => <option key={customer} value={customer} />)}</datalist></Field>
      <div style={{ marginTop: 16 }}><Row cols={3}><Field label="Shipping paid by buyer"><input type="number" min="0" step="0.01" value={buyerShipping} onChange={(event) => setBuyerShipping(event.target.value)} style={inp} placeholder="0.00" /></Field><Field label="Postage cost (you paid)"><input type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} style={inp} placeholder="0.00" /></Field><Field label="Order fees"><input type="number" min="0" step="0.01" value={fees} onChange={(event) => setFees(event.target.value)} style={inp} placeholder="0.00" /></Field></Row></div>
      <p style={{ color: "#9aa6bb", fontSize: 12 }}>Enter whole-order amounts; they are split automatically across all units. Buyer shipping adds to revenue. Your postage cost and fees reduce profit. Enter 0 to confirm no charge; blank postage or fees stay unconfirmed for later review.</p>
      {items.length > 0 && <p aria-live="polite" style={{ color: "#e5e7eb", fontSize: 13 }}>Items {currency(itemRevenue)} + buyer shipping {currency(buyerShipping)} = <strong>{currency(revenue)} total received</strong></p>}
      <p style={{ color: "#9aa6bb", fontSize: 12 }}>Record once fulfilled. Sale date is when the buyer paid.</p>
    </>}
    {queue.length > 0 && <section aria-label="Sales queue" style={{ margin: "16px 0", padding: 14, border: "1px solid #334155", borderRadius: 8, background: "#0d1117" }}>
      <strong style={{ color: "#e5e7eb", fontSize: 13 }}>Queued sales · {queue.length}</strong>
      <p style={{ color: "#9aa6bb", fontSize: 12 }}>Not recorded yet. Each entry stays a separate sale with its own buyer and costs.</p>
      {queue.map((order, index) => <div key={index} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid #232c3c" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0, overflowWrap: "anywhere", color: "#e5e7eb", fontSize: 13 }}>
          <strong>{index + 1}. {order.shared.customer || "No buyer name"}</strong> · {order.items.length} units · {currency(order.revenue)}
          <div style={{ color: "#9aa6bb", marginTop: 4, fontSize: 12 }}>{[...new Set(order.items.map((item) => item.name))].join(", ")}</div>
          <div style={{ color: "#9aa6bb", marginTop: 4, fontSize: 12 }}>{order.shared.platform} · {order.shared.paymentMethod} · {order.shared.saleDate} · {currency(order.buyerShipping)} buyer shipping · {currency(order.rows.reduce((sum, row) => sum + row.shippingPrice, 0))} postage cost · {currency(order.rows.reduce((sum, row) => sum + row.platformFees, 0))} fees</div>
        </div>
        <button style={ghostBtn} aria-label={`Remove queued sale ${index + 1}`} onClick={() => setQueue((prev) => prev.filter((_, i) => i !== index))}>Remove</button>
      </div>)}
      <div style={{ color: "#e5e7eb", fontSize: 12, marginTop: 8 }}>{queue.reduce((sum, order) => sum + order.items.length, 0)} queued units · {currency(queue.reduce((sum, order) => sum + order.revenue, 0))} revenue · {currency(queue.reduce((sum, order) => sum + order.profit, 0))} profit</div>
    </section>}
    </fieldset>
    {error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
    {!pendingSave && selection.some((entry) => !groups.some((group) => group.key === entry.key)) && <p style={{ color: "#fbbf24", fontSize: 12 }}>Selected stock changed. Queued orders are kept. <button style={ghostBtn} onClick={() => { setSelection([]); setPrices({}); setStep(1); }}>Clear changed selection</button></p>}
    <ModalActions mobileStack={false} style={{ flexWrap: "wrap", alignItems: "center" }}>
      <div aria-live="polite" style={{ flex: "1 1 220px", color: "#e5e7eb", fontSize: 12 }}>{totalUnits} units{(step !== 1 || !selection.length) && <> · {currency(totalRevenue)} revenue · <span style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171" }}>{currency(totalProfit)} profit</span></>}</div>
      <button disabled={busy} onClick={step === 2 ? () => setStep(1) : close} style={ghostBtn}>{step === 2 ? "Back to stock" : "Cancel"}</button>
      {step !== 1 && <button disabled={busy || pendingSave || !ready} onClick={queueSale} style={{ ...ghostBtn, opacity: ready ? 1 : 0.5 }}>Queue sale</button>}
      <button disabled={busy || (!pendingSave && (step === 1 && selection.length ? !items.length : !canSave))} onClick={!pendingSave && step === 1 && selection.length ? () => setStep(2) : save} style={{ ...primaryBtn, opacity: pendingSave || (step === 1 && selection.length ? items.length : canSave) ? 1 : 0.5 }}>{busy ? "Saving…" : pendingSave ? "Retry saving order" : step === 1 && selection.length ? "Price and review" : queue.length ? `Record ${saleCount} ${saleCount === 1 ? "sale" : "sales"}` : step === 0 ? "Record sale" : "Record order"}</button>
    </ModalActions>
  </Modal><UnsavedDialog open={discard} onDiscard={onClose} onCancel={() => setDiscard(false)} /></>;
}
