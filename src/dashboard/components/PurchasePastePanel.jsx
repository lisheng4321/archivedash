import { useMemo, useState } from "react";
import { parsePurchasePaste } from "../purchasePaste.js";
import { currency, inp, ghostBtn } from "../shared.jsx";

export default function PurchasePastePanel({ defaults, categories, onQueue, disabled = false, onDirtyChange }) {
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const { rows, errors } = useMemo(() => parsePurchasePaste(text, defaults, categories), [text, defaults, categories]);
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  const total = rows.reduce((sum, row) => sum + row.quantity * row.price, 0);
  return <details style={{ marginBottom: 16, border: "1px solid #334155", borderRadius: 8, padding: 12 }}>
    <summary style={{ cursor: "pointer", color: "#93c5fd", fontSize: 13, fontWeight: 600 }}>Paste a purchase summary</summary>
    <p style={{ fontSize: 12, color: "#9aa6bb", lineHeight: 1.5 }}>Paste a table from ChatGPT, a spreadsheet, or CSV. Required columns: Product, Quantity, Landed cost per unit. Optional: Retailer, Purchased by, Category, Brand, Size, Purchase date, Status, Release date, Tags.</p>
    <p style={{ fontSize: 11, color: "#9aa6bb", lineHeight: 1.5 }}>Missing details use the form below: {defaults.purchaseSource || "no retailer"} · {defaults.category} · {defaults.purchaseDate} · {String(defaults.availability).replace("in_transit", "In transit")}. Check these before queuing.</p>
    <textarea aria-label="Purchase summary table" disabled={disabled} value={text} onChange={(event) => { setText(event.target.value); onDirtyChange(Boolean(event.target.value.trim())); setNotice(""); }} style={{ ...inp, minHeight: 130, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} placeholder={"Product\tQuantity\tLanded cost per unit\nPokemon Booster Bundle\t20\t25.00\nCoin set\t5\t70.00"} />
    {errors.length > 0 && <div role="alert" style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>{errors.map((error, index) => <div key={index} style={{ marginBottom: 4 }}>{error}</div>)}</div>}
    {rows.length > 0 && !errors.length && <>
      <div style={{ overflowX: "auto", marginTop: 10, maxHeight: 260 }}><table style={{ width: "100%", borderCollapse: "collapse", color: "#cbd5e1", fontSize: 11 }}>
        <thead><tr>{["Product", "Qty", "Per unit", "Total"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: 6 }}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}><td style={{ padding: 6, borderTop: "1px solid #232c3c" }}>{row.name}<div style={{ color: "#7c8aa0", marginTop: 3 }}>{[row.purchaseSource, row.category, row.size, row.purchasedBy, row.purchaseDate, row.availability?.replace("in_transit", "In transit"), row.releaseExpectedDate].filter(Boolean).join(" · ")}</div></td><td>{row.quantity}</td><td style={{ whiteSpace: "nowrap" }}>{currency(row.price)}</td><td style={{ whiteSpace: "nowrap" }}>{currency(row.price * row.quantity)}</td></tr>)}</tbody>
      </table></div>
      <p style={{ fontSize: 12, color: "#e5e7eb" }}>{rows.length} products · {units} units · {currency(total)} landed cost</p>
    </>}
    <button disabled={disabled || !rows.length || errors.length > 0} style={{ ...ghostBtn, marginTop: 8, color: "#93c5fd", opacity: !rows.length || errors.length ? 0.5 : 1 }} onClick={() => {
      if (!rows.length || errors.length || disabled) return;
      onQueue(rows); setText(""); onDirtyChange(false); setNotice(`${units} units added to the queue. Review the batch, then save.`);
    }}>Queue pasted products</button>
    {notice && <p role="status" style={{ color: "#86efac", fontSize: 12 }}>{notice}</p>}
  </details>;
}
