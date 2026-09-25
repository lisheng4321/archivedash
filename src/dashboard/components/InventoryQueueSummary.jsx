import { useMemo } from "react";
import { groupInventoryQueue } from "../inventoryQueue.js";
import { currency, ghostBtn } from "../shared.jsx";

export default function InventoryQueueSummary({ items, onRemove, onClear, isMobile, disabled = false }) {
  const groups = useMemo(() => groupInventoryQueue(items), [items]);
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return <aside aria-label="Inventory submission queue" style={{ position: isMobile ? "static" : "sticky", top: 56, alignSelf: "start", background: "#0d1117", border: "1px solid #232c3c", borderRadius: 10, overflow: "hidden" }}>
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #232c3c" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong style={{ color: "#f3f6fb", fontSize: 13 }}>Batch summary</strong>
        {items.length > 0 && <button disabled={disabled} onClick={onClear} style={{ ...ghostBtn, background: "transparent", fontSize: 11, padding: "4px 6px", color: "#8b97ad" }}>Clear queue</button>}
      </div>
      <div aria-live="polite" style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, fontSize: 12 }}>
        <span style={{ color: "#8b97ad" }}>{groups.length} product {groups.length === 1 ? "row" : "rows"} · {items.length} units</span>
        <strong style={{ color: "#f3f6fb", fontVariantNumeric: "tabular-nums" }}>{currency(total)}</strong>
      </div>
    </div>
    {groups.length === 0 ? <p style={{ padding: "10px 16px", fontSize: 12, color: "#8b97ad", lineHeight: 1.6 }}>Queue each product and its quantity. Your batch will appear here before you save it to inventory.</p> : <>
      <div style={{ maxHeight: isMobile ? 280 : "calc(90vh - 280px)", overflowY: "auto" }}>
        {groups.map(({ key, item, ids, total: rowTotal }) => <div key={key} style={{ padding: "12px 16px", borderBottom: "1px solid #232c3c66" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
            <strong style={{ color: "#e5e7eb", fontSize: 12, flex: 1, lineHeight: 1.5, overflowWrap: "anywhere" }}>{item.name}</strong>
            <span style={{ color: "#93c5fd", fontSize: 12, whiteSpace: "nowrap" }}>× {ids.length}</span>
          </div>
          <div style={{ color: "#7c8aa0", fontSize: 11, marginTop: 3 }}>{[item.purchaseSource, item.size || "OS", item.category].filter(Boolean).join(" · ")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11 }}>
            <span style={{ color: "#8b97ad", flex: 1 }}>{currency(item.price)} / unit</span>
            <strong style={{ color: "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{currency(rowTotal)}</strong>
            <button disabled={disabled} aria-label={`Remove all ${ids.length} queued units of ${item.name}`} title="Remove this product row" onClick={() => onRemove(ids)} style={{ ...ghostBtn, background: "transparent", color: "#8b97ad", fontSize: 15, padding: "3px 6px" }}>×</button>
          </div>
        </div>)}
      </div>
      <p style={{ color: "#7c8aa0", fontSize: 11, lineHeight: 1.5, padding: "0 16px" }}>Only queued items are saved. Queue the current product before saving the batch.</p>
    </>}
  </aside>;
}
