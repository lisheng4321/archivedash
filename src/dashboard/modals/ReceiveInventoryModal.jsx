import { useState } from "react";
import { Modal, Field, Row, ModalActions, inp, primaryBtn, ghostBtn, today, currency } from "../shared.jsx";

export default function ReceiveInventoryModal({ items, onReceive, onClose }) {
  const [quantity, setQuantity] = useState(String(items.length));
  const [damaged, setDamaged] = useState("0");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const valid = Number.isInteger(Number(quantity)) && Number(quantity) > 0 && Number(quantity) <= items.length && Number.isInteger(Number(damaged)) && Number(damaged) >= 0 && Number(damaged) <= Number(quantity) && date && date <= today();
  const save = async () => {
    if (busy || !valid) return;
    setBusy(true); setError(""); setPending(true);
    try {
      const result = await onReceive(items.map((item) => item.id), Number(quantity), date, Number(damaged));
      if (!result?.ok || result.superseded) setError(result?.error || "Receipt could not be confirmed. Your quantities are kept for retry.");
      else onClose();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <Modal open title="Receive stock" onClose={onClose} dismissible={!busy}>
    <p style={{ color: "#9aa6bb", fontSize: 13 }}>{items.length} In transit units · {currency(items.reduce((sum, item) => sum + Number(item.price), 0))} cost basis</p>
    <fieldset disabled={busy || pending} style={{ padding: 0, margin: 0, border: 0, minWidth: 0 }}><Row><Field label="Units received"><input aria-label="Units received" type="number" min="1" max={items.length} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={inp} /></Field><Field label="Of these, damaged"><input aria-label="Damaged units" type="number" min="0" max={quantity} step="1" value={damaged} onChange={(e) => setDamaged(e.target.value)} style={inp} /></Field></Row><Field label="Received date"><input aria-label="Received date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} style={inp} /></Field></fieldset>
    <p aria-live="polite" style={{ color: "#cbd5e1", fontSize: 12 }}>{valid ? `${Number(quantity) - Number(damaged)} ready to sell · ${damaged} damaged (sale blocked) · ${items.length - Number(quantity)} remain In transit` : "Check the quantities and receipt date."}</p>
    <p style={{ color: "#9aa6bb", fontSize: 11 }}>Units retain their original cost and purchase details. Damaged units can be resolved in Edit inventory.</p>
    {error && <p role="alert" style={{ color: "#fca5a5", fontSize: 12 }}>{error}</p>}
    <ModalActions><button disabled={busy} onClick={onClose} style={ghostBtn}>Close</button><button disabled={busy || !valid} onClick={save} style={primaryBtn}>{busy ? "Saving…" : pending ? "Retry receipt" : "Confirm receipt"}</button></ModalActions>
  </Modal>;
}
