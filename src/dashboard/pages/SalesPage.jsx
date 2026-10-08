import PlatformBadge from "../components/PlatformBadge.jsx";
import { useState } from "react";
import { orderKeyForSale } from "../inventory.js";
import MobileDisclosure from "../components/MobileDisclosure.jsx";
import { scopeTotals } from "../scopeTotals.js";
import { daysAgo, today } from "../shared/dates.js";
import { cb, currency, EmptyState, ghostBtn, inp, primaryBtn, sel } from "../shared.jsx";

const tableHead = (align = "left") => ({ textAlign: align, minWidth: 0 });

export default function SalesPage({ ctx }) {
  const {
    pagePad,
    sales,
    saleProfit,
    selectedSales,
    setAddSaleOpen,
    setBulkEditSaleOpen,
    setConfirmDel,
    ebayQueueOpen,
    ebayQueuePanel,
    saleSearch,
    setSaleSearch,
    saleCat,
    setSaleCat,
    CATS,
    salePlat,
    setSalePlat,
    PLATS,
    salePayment,
    setSalePayment,
    PAYMETHODS,
    saleSort,
    setSaleSort,
    filteredSales,
    selectedSalesRevenue,
    selectedSalesProfit,
    isMobile,
    toggleAllSales,
    mobileSelectAll,
    saleRow
  } = ctx;
  const { saleFinancialFocus, setSaleFinancialFocus } = ctx;

  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const since30 = daysAgo(29);
  const recentSales = sales.filter((sale) => String(sale.saleDate || "") >= since30 && String(sale.saleDate || "") <= today());
  const recentRevenue = recentSales.reduce((a, s) => a + (Number(s.salePrice) || 0), 0);
  const recentProfit = recentSales.reduce((a, s) => a + saleProfit(s), 0);
  const latestSaleDate = [...sales].map((sale) => sale.saleDate).filter(Boolean).sort().pop();
  const clearFilters = () => { setSaleFinancialFocus(null); setSaleSearch(""); setSaleCat("All"); setSalePlat("All"); setSalePayment("All"); setSaleSort("date_desc"); };
  const visibleSales = filteredSales;
  const visible = scopeTotals(visibleSales, "costPrice");
  const hiddenSelectedCount = selectedSales.size - visibleSales.filter((sale) => selectedSales.has(sale._saleKey || sale.id)).length;
  const visibleRevenue = visibleSales.reduce((sum, sale) => sum + (Number(sale.salePrice) || 0), 0);
  const visibleProfit = visibleSales.reduce((sum, sale) => sum + saleProfit(sale), 0);
  const issueLabel = { cost: "Unknown sale cost", fees: "Unconfirmed fees", postage: "Unconfirmed postage" };
  const orderGroups = new Map();
  visibleSales.forEach((sale) => {
    const key = orderKeyForSale(sale);
    if (!orderGroups.has(key)) orderGroups.set(key, []);
    orderGroups.get(key).push(sale);
  });
  const allVisibleSalesSelected = visibleSales.length > 0 && visibleSales.every((sale) => selectedSales.has(sale._saleKey || sale.id));

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Sales</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>All time: {sales.length} sale records{latestSaleDate ? ` · latest ${latestSaleDate}` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedSales.size > 0 && <>
            <button onClick={() => setBulkEditSaleOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedSales.size}</button>
            <button onClick={() => setConfirmDel({ type: "multi-sale", name: `${selectedSales.size} sales` })} style={{ ...ghostBtn, color: "#f87171", border: "1px solid #ef444444", fontSize: 12, padding: "7px 12px" }}>Delete {selectedSales.size}</button>
          </>}
          <button onClick={() => setAddSaleOpen(true)} style={primaryBtn}>+ Add Sale</button>
        </div>
      </div>
      <MobileDisclosure isMobile={isMobile} label="30-day totals">
        <p style={{ color: "#8b97ad", fontSize: 12 }}>Last 30 days ({since30} to {today()}, all sales): {recentSales.length} records · {currency(recentRevenue)} revenue · {currency(recentProfit)} recorded profit</p>
      </MobileDisclosure>
      {saleFinancialFocus && <div role="status" style={{ fontSize: 12, color: "#fbbf24", marginBottom: 10 }}>{issueLabel[saleFinancialFocus.issue]} · opened from financial review. Corrected records leave this view. <button onClick={() => setSaleFinancialFocus(null)} style={{ ...ghostBtn, fontSize: 11, padding: "4px 8px" }}>Clear review filter</button></div>}

      {selectedSales.size > 0 && (
        <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: "10px 16px", marginBottom: 12, display: "flex", gap: 24, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#7c8aa0" }}>Selected across all filters: {selectedSales.size} records{hiddenSelectedCount ? ` · ${hiddenSelectedCount} outside this filter` : ""}</span>
          <span style={{ color: "#9aa6bb" }}>Known cost: {currency(ctx.selectedSalesCost)}{ctx.selectedSalesUnknownCost ? " · " + ctx.selectedSalesUnknownCost + " unknown cost" : ""}</span>
          <span style={{ color: "#f3f6fb" }}>Revenue: <strong>{currency(selectedSalesRevenue)}</strong></span>
          <span style={{ color: selectedSalesProfit >= 0 ? "#34d399" : "#f87171" }}>Recorded profit: <strong>{currency(selectedSalesProfit)}</strong></span>
        </div>
      )}

      {ebayQueueOpen && ebayQueuePanel()}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input aria-label="Search sales by item title or buyer name" placeholder="Search item title or buyer name..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} style={{ ...inp, maxWidth: isMobile ? "none" : 260, flex: isMobile ? "1 1 100%" : undefined }} />
<MobileDisclosure isMobile={isMobile} label="Filters and sorting"><div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : undefined }}>        <select value={saleCat} onChange={(e) => setSaleCat(e.target.value)} style={{ ...sel, maxWidth: isMobile ? "none" : 140, flex: isMobile ? "1 1 135px" : undefined }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={salePlat} onChange={(e) => setSalePlat(e.target.value)} style={{ ...sel, maxWidth: isMobile ? "none" : 160, flex: isMobile ? "1 1 135px" : undefined }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={salePayment} onChange={(e) => setSalePayment(e.target.value)} style={{ ...sel, maxWidth: isMobile ? "none" : 170, flex: isMobile ? "1 1 135px" : undefined }}><option value="All">All Payments</option>{PAYMETHODS.map((p) => <option key={p}>{p}</option>)}</select>
        {isMobile && <select aria-label="Sort sales" value={saleSort} onChange={(e) => setSaleSort(e.target.value)} style={{ ...sel, maxWidth: "none", flex: "1 1 135px" }}>
          <option value="date_desc">Newest</option>
          <option value="date_asc">Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="profit_desc">Profit down</option>
          <option value="profit_asc">Profit up</option>
          <option value="sale_desc">Sale down</option>
          <option value="sale_asc">Sale up</option>
        </select>}
</div></MobileDisclosure>
        {(saleFinancialFocus || saleSearch || saleCat !== "All" || salePlat !== "All" || salePayment !== "All" || saleSort !== "date_desc") && <button onClick={clearFilters} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b97ad" }}>{visibleSales.length} shown</span>
      </div>
      <div aria-label="Visible sales totals" style={{ fontSize: 12, color: "#9aa6bb", marginBottom: 10 }}>Visible (all dates, current filters): {visible.units} units · {currency(visible.cost)} known cost{visible.unknown ? ` · ${visible.unknown} unknown cost` : ""} · {currency(visibleRevenue)} revenue · {currency(visibleProfit)} recorded profit. Select all selects only visible records.</div>

      {sales.length === 0 ? (
        <EmptyState
          title="No sales yet"
          hint="Record your first sale by hand to start tracking revenue and profit."
          actions={[
            { label: "+ Add Sale", primary: true, onClick: () => setAddSaleOpen(true) },
          ]}
        />
      ) : (
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", overflow: "hidden" }}>
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "48px minmax(240px, 1.45fr) minmax(95px, 0.62fr) 70px 112px 96px 96px 96px 104px", gap: 8, padding: "10px 16px", fontSize: 11, color: "#8b97ad", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #232c3c", fontWeight: 600, alignItems: "center", background: "#121a2b" }}>
            <input type="checkbox" checked={allVisibleSalesSelected} onChange={toggleAllSales} style={{ ...cb, justifySelf: "center" }} />
            <span style={tableHead()}>Item</span><span style={tableHead("center")}>Platform</span><span style={tableHead("center")}>Size</span><span style={tableHead("center")}>Date</span><span style={tableHead("right")}>Cost</span><span style={tableHead("right")}>Sale</span><span style={tableHead("right")}>Profit</span><span style={tableHead("center")}>Actions</span>
          </div>
        )}
        {mobileSelectAll(allVisibleSalesSelected, toggleAllSales, visibleSales.length)}
        {visibleSales.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#8b97ad", fontSize: 13 }}>No sales match these filters.<button onClick={clearFilters} style={{ ...ghostBtn, display: "block", margin: "10px auto 0", padding: "5px 12px", fontSize: 11 }}>Clear filters</button></div>}
        {[...orderGroups].map(([key, items], index) => {
          if (items.length === 1) return saleRow(items[0], index);
          const expanded = expandedOrders.has(key);
          const total = items.reduce((sum, sale) => sum + Number(sale.salePrice || 0), 0);
          const groupCosts = scopeTotals(items, "costPrice");
          const cost = groupCosts.cost;
          const profit = items.reduce((sum, sale) => sum + saleProfit(sale), 0);
          const names = [...new Set(items.map((sale) => sale.name))].join(", ");
          return <div key={key}>
            <button aria-expanded={expanded} aria-label={`${expanded ? "Collapse" : "Expand"} order for ${items[0].customer || "unnamed buyer"}, ${items.length} items`} onClick={() => setExpandedOrders((previous) => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; })} style={{ width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #232c3c", background: expanded ? "#182235" : "#121a2b", color: "#e5e7eb", padding: isMobile ? 12 : "12px 16px", cursor: "pointer", display: "grid", gridTemplateColumns: isMobile ? "20px minmax(0, 1fr) auto" : "48px minmax(240px, 1.45fr) minmax(95px, 0.62fr) 70px 112px 96px 96px 96px 104px", gap: 8, alignItems: "center", fontFamily: "inherit", fontSize: 12 }}>
              <span aria-hidden="true" style={{ color: "#8b97ad", textAlign: "center", fontSize: 15 }}>{expanded ? "⌄" : "›"}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{items[0].customer || "Unnamed buyer"}<span style={{ color: "#8b97ad", fontSize: 11, fontWeight: 400, marginLeft: 8 }}>{items.length} items</span></span>
                <span title={names} style={{ display: "block", color: "#7c8aa0", fontSize: 11, marginTop: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{names}</span>
                {isMobile && <span style={{ display: "block", color: "#7c8aa0", fontSize: 11, marginTop: 4 }}>{items[0].platform} · {items[0].saleDate}</span>}
              </span>
              {isMobile ? <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}><strong>{currency(total)}</strong><span style={{ display: "block", marginTop: 5, color: profit >= 0 ? "#34d399" : "#f87171", fontSize: 11 }}>{currency(profit)} profit</span></span> : <>
                <span style={{ justifySelf: "center" }}><PlatformBadge platform={items[0].platform} compact /></span>
                <span style={{ color: "#7c8aa0", textAlign: "center" }}>—</span>
                <span style={{ color: "#8b97ad", textAlign: "center", fontSize: 11 }}>{items[0].saleDate}</span>
                <span style={{ color: "#8b97ad", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{currency(cost)}{groupCosts.unknown > 0 && <small style={{ display: "block" }}>{groupCosts.unknown} unknown</small>}</span>
                <strong style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{currency(total)}</strong>
                <strong style={{ color: profit >= 0 ? "#34d399" : "#f87171", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{currency(profit)}</strong>
                <span style={{ textAlign: "center", color: "#8b97ad", fontSize: 11 }}>{expanded ? "Hide items" : "View items"}</span>
              </>}
            </button>
            {expanded && <div style={{ borderLeft: "2px solid #334155" }}>{items.map((sale, childIndex) => saleRow(sale, childIndex))}</div>}
          </div>;
        })}
      </div>
      )}
      {isMobile && <div aria-label="Sales quick actions" style={{ position: "fixed", bottom: 58, left: 0, right: 0, zIndex: 96, background: "#121a2b", borderTop: "1px solid #334155", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 11, color: "#9aa6bb" }}>{selectedSales.size ? `${selectedSales.size} selected${hiddenSelectedCount ? ` · ${hiddenSelectedCount} hidden` : ""}` : `${visibleSales.length} visible`}</span>
        {selectedSales.size > 0 && <button onClick={() => setBulkEditSaleOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "8px 10px" }}>Edit selected</button>}
        <button onClick={() => setAddSaleOpen(true)} style={{ ...primaryBtn, fontSize: 12, padding: "8px 10px" }}>+ Add Sale</button>
      </div>}
      {isMobile && <div style={{ height: 70 }} />}
    </div>
  );
}
