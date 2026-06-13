import PeriodComparisonChart from "../components/PeriodComparisonChart.jsx";
import { TIME_RANGES, cb, currency, ghostBtn, inp, KPI, preorderBadge, sel, subAmountAud } from "../shared.jsx";

export default function DashboardHomePage({ ctx }) {
  const {
    pagePad,
    isMobile,
    inventory,
    stats,
    velocityStats,
    inventoryProductCount,
    dashboardCustomizeOpen,
    setDashboardCustomizeOpen,
    range,
    setRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    dashCat,
    setDashCat,
    dashPlat,
    setDashPlat,
    CATS,
    PLATS,
    dashboardCards,
    dashboardCardLabels,
    setDashboardCard,
    settings,
    persistSettings,
    ebayImports,
    setEbayQueueOpen,
    loadEbayImports,
    gmailImports,
    setGmailQueueOpen,
    loadGmailImports,
    upcomingPreorderGroups,
    upcomingPreorders,
    setPage,
    setInvStatus,
    setInvSort,
    agingStats,
    subStats,
    fxRates,
    logAllOverdue,
    periodComparison,
    periodTrend,
    renderPreBadge,
  } = ctx;

  const rangeButtonStyle = (r) => ({
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: range === r ? 600 : 400,
    borderRadius: 6,
    background: range === r ? "#2563eb" : "transparent",
    color: range === r ? "#fff" : "#7c8aa0",
    border: "none",
    cursor: "pointer",
  });

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Dashboard</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>{inventoryProductCount} products / {inventory.length} units - {currency(stats.invValue)} stock - {velocityStats.sold30.length} sold 30d</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button onClick={() => setDashboardCustomizeOpen((v) => !v)} style={{ ...ghostBtn, padding: "7px 12px", fontSize: 12 }}>Cards</button>
          <div style={{ display: "flex", gap: 3, background: "#121a2b", borderRadius: 8, padding: 3, border: "1px solid #232c3c", flexWrap: "wrap" }}>{TIME_RANGES.map((r) => <button key={r} style={rangeButtonStyle(r)} onClick={() => setRange(r)}>{r}</button>)}</div>
        </div>
      </div>

      {dashboardCustomizeOpen && (
        <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f6fb" }}>Dashboard cards</div>
            <button onClick={() => persistSettings({ ...settings, dashboardCards: {} })} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11 }}>Reset</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, minmax(130px, 1fr))", gap: 8 }}>
            {dashboardCardLabels.map(([key, label]) => (
              <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#9ca3af", cursor: "pointer", minWidth: 0 }}>
                <input type="checkbox" checked={dashboardCards[key]} onChange={(e) => setDashboardCard(key, e.target.checked)} style={cb} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {range === "Custom" && <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: 12, color: "#7c8aa0" }}>From</span><input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...inp, maxWidth: 160 }} /><span style={{ fontSize: 12, color: "#7c8aa0" }}>To</span><input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...inp, maxWidth: 160 }} /></div>}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={dashCat} onChange={(e) => setDashCat(e.target.value)} style={{ ...sel, maxWidth: 150 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={dashPlat} onChange={(e) => setDashPlat(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
      </div>

      {dashboardCards.actionStrip && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
          {[
            { label: "eBay queue", value: ebayImports.length, detail: "awaiting postage", tone: ebayImports.length ? "#60a5fa" : "#7c8aa0", onClick: async () => { setPage("sales"); setEbayQueueOpen(true); if (!ebayImports.length) await loadEbayImports(); } },
            { label: "Gmail queue", value: gmailImports.length, detail: "inventory drafts", tone: gmailImports.length ? "#60a5fa" : "#7c8aa0", onClick: async () => { setPage("inventory"); setGmailQueueOpen(true); if (!gmailImports.length) await loadGmailImports(); } },
            { label: "Preorders", value: upcomingPreorderGroups.length, detail: upcomingPreorders.length === upcomingPreorderGroups.length ? "release window" : `${upcomingPreorders.length} units due`, tone: upcomingPreorders.length ? "#60a5fa" : "#7c8aa0", onClick: () => { setPage("inventory"); setInvStatus("Preorders"); setInvSort("preorder_asc"); } },
            { label: "Aged stock", value: agingStats.aged90.length, detail: "90+ days held", tone: agingStats.aged90.length ? "#f59e0b" : "#7c8aa0", onClick: () => setPage("inventory") },
          ].map((a) => (
            <button key={a.label} onClick={a.onClick} style={{ textAlign: "left", background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 11, color: "#7c8aa0", marginBottom: 4 }}>{a.label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: a.tone }}>{a.value}</span>
                <span style={{ fontSize: 11, color: "#8b97ad" }}>{a.detail}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {dashboardCards.preorderAlerts && upcomingPreorderGroups.length > 0 && (
        <div style={{ background: "linear-gradient(180deg, #0f1a2e 0%, #121a2b 100%)", border: "1px solid #2563eb55", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
              <span style={{ fontSize: 13, color: "#f3f6fb", fontWeight: 600 }}>Preorders releasing soon</span>
              <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, background: "#2563eb", color: "#fff", fontWeight: 600 }}>{upcomingPreorderGroups.length}</span>
            </div>
            <button onClick={() => setPage("inventory")} style={{ padding: "3px 10px", background: "transparent", color: "#60a5fa", border: "none", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>View all</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {upcomingPreorderGroups.slice(0, isMobile ? 4 : 6).map((i) => {
              const b = preorderBadge(i._bdays);
              return (
                <div key={`${i.id}-${i.preorderDate}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#0d1117", borderRadius: 6, border: "1px solid #232c3c66" }}>
                  <span style={{ fontSize: 13, color: "#e5e7eb", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                  {i._count > 1 && <span style={{ fontSize: 11, color: "#93c5fd", background: "#1e3a5f", borderRadius: 999, padding: "2px 7px", fontWeight: 700, flexShrink: 0 }}>{i._count} units</span>}
                  {!isMobile && <span style={{ fontSize: 11, color: "#7c8aa0", flexShrink: 0 }}>{i.preorderDate}</span>}
                  <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: b.bg, color: b.fg, fontWeight: 600, flexShrink: 0 }}>{b.text}</span>
                </div>
              );
            })}
            {upcomingPreorderGroups.length > (isMobile ? 4 : 6) && (
              <div style={{ fontSize: 11, color: "#8b97ad", textAlign: "center", paddingTop: 4 }}>+ {upcomingPreorderGroups.length - (isMobile ? 4 : 6)} more groups</div>
            )}
          </div>
        </div>
      )}

      {subStats.overdue.length > 0 && (
        <div style={{ background: "#121a2b", border: "1px solid #ef444455", borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>{subStats.overdue.length} subscription{subStats.overdue.length === 1 ? "" : "s"} overdue · {currency(subStats.overdue.reduce((a, s) => a + subAmountAud(s, fxRates), 0))}</span>
          <button onClick={logAllOverdue} style={{ padding: "4px 12px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Log all due</button>
        </div>
      )}

      {dashboardCards.netProfitGraph && <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: "16px 20px 12px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 3 }}>Net Profit</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: stats.netProfit>=0?"#34d399":"#f87171" }}>{currency(stats.netProfit)}</div>
              <div title={`Current period ${periodComparison.currentStart} to ${periodComparison.currentEnd}: ${currency(periodComparison.current)} - Previous period ${periodComparison.previousStart} to ${periodComparison.previousEnd}: ${currency(periodComparison.previous)}`} style={{ fontSize: 12, color: periodComparison.delta >= 0 ? "#34d399" : "#f87171", background: periodComparison.delta >= 0 ? "#0d1f17" : "#1f1215", border: `1px solid ${periodComparison.delta >= 0 ? "#16653466" : "#7f1d1d66"}`, borderRadius: 999, padding: "3px 8px", fontWeight: 700 }}>
                {periodComparison.pct === null ? "new vs previous period" : `${periodComparison.delta >= 0 ? "+" : ""}${periodComparison.pct.toFixed(1)}% vs previous period`}
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: "#7c8aa0" }}>Sales volume</div><div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 600, color: "#f3f6fb" }}>{periodComparison.salesCount}</div><div title={`Previous period ${periodComparison.previousStart} to ${periodComparison.previousEnd}: ${periodComparison.previousSalesCount} sales`} style={{ fontSize: 11, color: periodComparison.salesDelta >= 0 ? "#34d399" : "#f87171", marginTop: 2 }}>{periodComparison.salesPct === null ? "new vs previous" : `${periodComparison.salesDelta >= 0 ? "+" : ""}${periodComparison.salesPct.toFixed(1)}% vs previous`}</div></div>
        </div>
        <PeriodComparisonChart points={periodTrend} isMobile={isMobile} />
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
        {dashboardCards.salesIncome && <KPI label="Sales income" value={currency(stats.salesIncome)} />}
        {dashboardCards.netProfit && <KPI label="Net profit" value={currency(stats.netProfit)} accent={stats.netProfit>=0?"#34d399":"#f87171"} />}
        {dashboardCards.grossProfit && <KPI label="Gross profit" value={currency(stats.grossProfit)} accent={stats.grossProfit>=0?"#34d399":"#f87171"} />}
        {dashboardCards.inventorySpend && <KPI label="Inventory spend" value={currency(stats.inventorySpend)} />}
        {dashboardCards.inventoryValue && <KPI label="Inventory value" value={currency(stats.invValue)} />}
        {dashboardCards.salesCount && <KPI label="Sales count" value={stats.cnt} />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        {dashboardCards.avgOrderValue && <KPI label="Avg. order value" value={currency(stats.aov)} />}
        {dashboardCards.netMargin && <KPI label="Net margin" value={(stats.netMargin * 100).toFixed(1) + "%"} accent={stats.netMargin>=0?"#34d399":"#f87171"} />}
        {dashboardCards.grossMargin && <KPI label="Gross margin" value={(stats.grossMargin * 100).toFixed(1) + "%"} accent={stats.grossMargin>=0?"#34d399":"#f87171"} />}
        {dashboardCards.totalExpenses && <KPI label="Total expenses" value={currency(stats.totalExpenses)} />}
        {dashboardCards.platformFees && <KPI label="Platform fees" value={currency(stats.totalFees)} />}
        {dashboardCards.monthlySubs && <KPI label="Monthly subs" value={currency(subStats.monthlyBurn)} />}
      </div>

      {(dashboardCards.aging || dashboardCards.velocity) && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
          {dashboardCards.aging && (
            <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f6fb", marginBottom: 10 }}>Inventory Aging</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                <KPI label="Avg. held" value={`${agingStats.avgDays}d`} />
                <KPI label="90+ days" value={agingStats.aged90.length} accent={agingStats.aged90.length ? "#f59e0b" : undefined} />
                <KPI label="Aged value" value={currency(agingStats.agedValue)} accent={agingStats.agedValue ? "#f59e0b" : undefined} />
              </div>
              {agingStats.oldest.length === 0 ? <div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No inventory yet</div> : agingStats.oldest.slice(0, 4).map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid #232c3c22" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: "#8b97ad" }}>{i.category} - bought {i.purchaseDate || "unknown"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: "#f3f6fb", fontWeight: 700 }}>{i._daysHeld}d</div>
                    <div style={{ fontSize: 11, color: "#7c8aa0" }}>{currency(i.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {dashboardCards.velocity && (
            <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f6fb", marginBottom: 10 }}>Inventory Velocity</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                <KPI label="Sold 30d" value={velocityStats.sold30.length} />
                <KPI label="Sell-through" value={`${(velocityStats.monthlySellThrough * 100).toFixed(1)}%`} accent="#60a5fa" />
                <KPI label="Stock cover" value={velocityStats.daysCover === null ? "n/a" : `${velocityStats.daysCover}d`} />
              </div>
              {velocityStats.topCategories.length === 0 ? <div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No recent sales data</div> : velocityStats.topCategories.map((r) => (
                <div key={r.category} style={{ display: "grid", gridTemplateColumns: "1fr 60px 90px", gap: 8, padding: "7px 0", borderBottom: "1px solid #232c3c22", fontSize: 12, alignItems: "center" }}>
                  <span style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.category}</span>
                  <span style={{ color: "#9ca3af" }}>{r.count} sold</span>
                  <span style={{ color: r.profit >= 0 ? "#34d399" : "#f87171", textAlign: "right", fontWeight: 700 }}>{currency(r.profit)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        {dashboardCards.recentSales && <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Sales</div>
          {stats.rs.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No sales</div>:stats.rs.map((s) => (<div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #232c3c22", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 11, color: "#8b97ad" }}>{s.platform} · {s.size||"OS"} · {s.saleDate}{s.customer?` · ${s.customer}`:""}</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(s.salePrice)}</div><div style={{ fontSize: 11, color: s.profit>=0?"#34d399":"#f87171" }}>{currency(s.profit)}</div></div></div>))}
        </div>}
        {dashboardCards.recentInventory && <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Inventory</div>
          {stats.ri.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No items</div>:stats.ri.map((i) => (<div key={i.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #232c3c22", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}{renderPreBadge(i)}</div><div style={{ fontSize: 11, color: "#8b97ad" }}>{i.category} · {i.size||"OS"}{i.brand?` · ${i.brand}`:""}</div></div><div style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{currency(i.price)}</div></div>))}
        </div>}
      </div>
    </div>
  );
}
