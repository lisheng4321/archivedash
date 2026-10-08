import { ghostBtn } from "../shared.jsx";

export default function FinancialCompleteness({ summary, onOpen, scope, showStock = true }) {
  const count = summary.incomplete.length;
  return <section aria-label="Financial completeness" style={{ border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 12 }}>
    <div style={{ color: count ? "#fbbf24" : "#86efac", marginBottom: 6 }}><strong>Financial completeness</strong> · {scope}</div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {[["cost", "Unknown sale cost", summary.cost], ["fees", "Unconfirmed fees", summary.fees], ["postage", "Unconfirmed postage", summary.postage], ...(showStock ? [["stock", "Unknown stock cost (all stock)", summary.stock]] : [])].map(([issue, label, records]) => <button key={issue} disabled={!records.length} onClick={() => onOpen(issue, records)} style={{ ...ghostBtn, padding: "5px 8px", fontSize: 12, opacity: records.length ? 1 : 0.6 }}>{label} · {records.length}</button>)}
    </div>
    <p style={{ color: "#9aa6bb", margin: "8px 0 0", lineHeight: 1.45 }}>{count ? `${count} of ${summary.salesCount} sale records need review. Profit uses recorded amounts and may change when missing costs or estimates are corrected.` : "Sale costs, fees and postage are recorded for this scope."} Realized profit is revenue minus recorded item costs, selling costs and operating expenses. Legacy zero fees/postage need confirmation; enter 0 to confirm no charge.</p>
  </section>;
}
