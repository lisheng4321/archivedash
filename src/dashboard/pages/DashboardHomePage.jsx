import PeriodComparisonChart from "../components/PeriodComparisonChart.jsx";
import { RESELLER_DASHBOARD_CARDS } from "../settings.js";
import { TIME_RANGES, cardSurface, cb, currency, ghostBtn, inp, KPI, preorderBadge, sel, smallCaps, subAmountAud } from "../shared.jsx";

function ProfitMarginKPI({ profitLabel, profitValue, profitVisible, marginLabel, marginValue, marginVisible, accent }) {
  if (!profitVisible && !marginVisible) return null;
  const primaryLabel = profitVisible ? profitLabel : marginLabel;
  const primaryValue = profitVisible ? profitValue : marginValue;
  return (
    <div style={{ ...cardSurface, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ ...smallCaps, marginBottom: 5 }}>{primaryLabel}</div>
      <div style={{ fontSize: 20, fontWeight: 750, color: accent, fontVariantNumeric: "tabular-nums" }}>{primaryValue}</div>
      {profitVisible && marginVisible && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginTop: 8, paddingTop: 7, borderTop: "1px solid #232c3c" }}>
          <span style={{ fontSize: 11, color: "#8b97ad", fontWeight: 700 }}>{marginLabel}</span>
          <span style={{ fontSize: 14, color: accent, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{marginValue}</span>
        </div>
      )}
    </div>
  );
}

function DetailKPI({ label, value, detailLabel, detailValue, accent = "#f3f6fb" }) {
  return (
    <div style={{ ...cardSurface, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ ...smallCaps, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 750, color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginTop: 8, paddingTop: 7, borderTop: "1px solid #232c3c" }}>
        <span style={{ fontSize: 11, color: "#8b97ad", fontWeight: 700 }}>{detailLabel}</span>
        <span style={{ fontSize: 14, color: accent, fontWeight: 800, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{detailValue}</span>
      </div>
    </div>
  );
}

export default function DashboardHomePage({ ctx }) {
  const {
    pagePad,
    isMobile,
    stats,
    velocityStats,
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
    dashSource,
    setDashSource,
    purchaseSources,
    CATS,
    PLATS,
    dashboardCards,
    dashboardCardLabels,
    setDashboardCard,
    settings,
    persistSettings,
    upcomingPreorderGroups,
    upcomingPreorderCommitted,
    setPage,
    setInvPreorderView,
    setInvStatus,
    setInvSort,
    agingStats,
    subStats,
    fxRates,
    logAllOverdue,
    periodComparison,
    periodTrend,
    profitTarget,
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 16, flexWrap: "wrap", gap: isMobile ? 12 : 8 }}>
        <div style={{ minWidth: 0, width: isMobile ? "100%" : undefined }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Dashboard</h2>
          {isMobile ? (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
              {[
                `${stats.onHandUnits} on hand`,
                `${currency(stats.invValue)} stock`,
                `${stats.preorderUnits} preorders`,
                `${currency(stats.preorderValue)} committed`,
                `${velocityStats.sold30Units} sold 30d`,
              ].map((label) => <span key={label} style={{ padding: "3px 7px", borderRadius: 999, background: "#121a2b", border: "1px solid #232c3c", color: "#8b97ad", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{label}</span>)}
            </div>
          ) : (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>
              {stats.onHandProductCount} products / {stats.onHandUnits} units on hand · {currency(stats.invValue)} stock · {stats.preorderUnits} preorder units / {currency(stats.preorderValue)} committed · {velocityStats.sold30Units} sold 30d
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: isMobile ? "nowrap" : "wrap", justifyContent: isMobile ? "flex-start" : "flex-end", width: isMobile ? "100%" : undefined, minWidth: 0 }}>
          <button onClick={() => setDashboardCustomizeOpen((v) => !v)} style={{ ...ghostBtn, padding: "7px 12px", fontSize: 12 }}>Cards</button>
          <div style={{ display: "flex", gap: 3, background: "#121a2b", borderRadius: 8, padding: 3, border: "1px solid #232c3c", flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : undefined, minWidth: 0, flex: isMobile ? 1 : undefined, scrollbarWidth: "none" }}>{TIME_RANGES.map((r) => <button key={r} style={{ ...rangeButtonStyle(r), flexShrink: 0 }} onClick={() => setRange(r)}>{r}</button>)}</div>
        </div>
      </div>

      {dashboardCustomizeOpen && (
        <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f6fb" }}>Dashboard cards</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => persistSettings({ ...settings, dashboardCards: RESELLER_DASHBOARD_CARDS })} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11, color: "#93c5fd" }}>Reseller preset</button>
              <button onClick={() => persistSettings({ ...settings, dashboardCards: {} })} style={{ ...ghostBtn, padding: "5px 9px", fontSize: 11 }}>Reset</button>
            </div>
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
        <select value={dashCat} onChange={(e) => setDashCat(e.target.value)} style={{ ...sel, maxWidth: isMobile ? "none" : 150, flex: isMobile ? "1 1 140px" : undefined }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={dashPlat} onChange={(e) => setDashPlat(e.target.value)} style={{ ...sel, maxWidth: isMobile ? "none" : 170, flex: isMobile ? "1 1 140px" : undefined }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={dashSource} onChange={(e) => setDashSource(e.target.value)} style={{ ...sel, maxWidth: isMobile ? "none" : 190, flex: isMobile ? "1 1 150px" : undefined }}><option value="All">All Purchase Sources</option><option value="Unknown">Unknown</option>{purchaseSources.map((source) => <option key={source} value={source}>{source}</option>)}</select>
      </div>

      {dashboardCards.actionStrip && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Preorder exposure", value: stats.preorderUnits, detail: `${currency(stats.preorderValue)} committed`, tone: stats.preorderUnits ? "#60a5fa" : "#7c8aa0", onClick: () => { setPage("inventory"); setInvPreorderView("preorders"); setInvStatus("All"); setInvSort("preorder_asc"); } },
            { label: "Aged stock (90d+)", value: agingStats.aged90.length, detail: `${currency(agingStats.agedValue)} tied up`, tone: agingStats.aged90.length ? "#f59e0b" : "#7c8aa0", onClick: () => setPage("inventory") },
          ].map((a) => (
            <button key={a.label} onClick={a.onClick} style={{ textAlign: "left", background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: "11px 13px", cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 11, color: "#7c8aa0", marginBottom: 4 }}>{a.label}</div>
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: isMobile ? 2 : 8, alignItems: isMobile ? "flex-start" : "baseline" }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: a.tone }}>{a.value}</span>
                <span style={{ fontSize: 11, color: "#8b97ad", lineHeight: 1.3 }}>{a.detail}</span>
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
              <span style={{ fontSize: 11, color: "#93c5fd", fontWeight: 700 }}>{currency(upcomingPreorderCommitted)} committed</span>
            </div>
            <button onClick={() => { setPage("inventory"); setInvPreorderView("preorders"); setInvStatus("All"); setInvSort("preorder_asc"); }} style={{ padding: "3px 10px", background: "transparent", color: "#60a5fa", border: "none", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>View all</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {upcomingPreorderGroups.slice(0, isMobile ? 4 : 6).map((i) => {
              const b = preorderBadge(i._bdays);
              return (
                <div key={`${i.id}-${i._releaseExpectedDate}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#0d1117", borderRadius: 6, border: "1px solid #232c3c66" }}>
                  <span style={{ fontSize: 13, color: "#e5e7eb", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</span>
                  {i._count > 1 && <span style={{ fontSize: 11, color: "#93c5fd", background: "#1e3a5f", borderRadius: 999, padding: "2px 7px", fontWeight: 700, flexShrink: 0 }}>{i._count} units</span>}
                  {!isMobile && <span style={{ fontSize: 11, color: "#cbd5e1", flexShrink: 0 }}>{currency(i._totalValue)}</span>}
                  {!isMobile && <span style={{ fontSize: 11, color: "#7c8aa0", flexShrink: 0 }}>{i._releaseExpectedDate}</span>}
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

      {dashboardCards.netProfitGraph && <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: isMobile ? "14px 14px 12px" : "16px 20px 12px", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto", alignItems: "start", marginBottom: 4, gap: isMobile ? 10 : 20 }}>
          <div style={{ minWidth: 0 }}>
            <div title="Sales minus product cost, outbound shipping, platform fees and recorded expenses." style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 3 }}>Realized Profit</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: stats.netProfit>=0?"#34d399":"#f87171" }}>{currency(stats.netProfit)}</div>
              {dashboardCards.netMargin && <div style={{ fontSize: isMobile ? 11 : 12, color: "#93c5fd", background: "#10203a", border: "1px solid #1d4ed866", borderRadius: 999, padding: "3px 8px", fontWeight: 700, lineHeight: 1.25 }}>{(stats.netMargin * 100).toFixed(1)}% margin</div>}
              <div title={`Current period ${periodComparison.currentStart} to ${periodComparison.currentEnd}: ${currency(periodComparison.current)} - Previous period ${periodComparison.previousStart} to ${periodComparison.previousEnd}: ${currency(periodComparison.previous)}`} style={{ fontSize: isMobile ? 11 : 12, color: periodComparison.delta >= 0 ? "#34d399" : "#f87171", background: periodComparison.delta >= 0 ? "#0d1f17" : "#1f1215", border: `1px solid ${periodComparison.delta >= 0 ? "#16653466" : "#7f1d1d66"}`, borderRadius: 999, padding: "3px 8px", fontWeight: 700, lineHeight: 1.25 }}>
                {periodComparison.pct === null ? "new vs previous period" : `${periodComparison.delta >= 0 ? "+" : ""}${periodComparison.pct.toFixed(1)}% vs previous period`}
              </div>
            </div>
          </div>
          <div style={{ textAlign: isMobile ? "left" : "right", minWidth: isMobile ? 0 : 110, display: isMobile ? "grid" : "block", gridTemplateColumns: isMobile ? "1fr auto" : undefined, alignItems: "baseline", gap: isMobile ? "3px 10px" : undefined, paddingTop: isMobile ? 8 : 0, borderTop: isMobile ? "1px solid #232c3c" : "none" }}>
            <div style={{ fontSize: isMobile ? 11 : 12, color: "#8b97ad", whiteSpace: "nowrap" }}>Units sold</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: "#f3f6fb", textAlign: "right" }}>{periodComparison.salesCount}</div>
            <div title={`Previous period ${periodComparison.previousStart} to ${periodComparison.previousEnd}: ${periodComparison.previousSalesCount} units`} style={{ gridColumn: isMobile ? "1 / -1" : undefined, fontSize: 11, color: periodComparison.salesDelta >= 0 ? "#34d399" : "#f87171", marginTop: isMobile ? 0 : 2, lineHeight: 1.25 }}>{periodComparison.salesPct === null ? "new vs previous" : `${periodComparison.salesDelta >= 0 ? "+" : ""}${periodComparison.salesPct.toFixed(1)}% vs previous`}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto", gap: 10, alignItems: "center", margin: "4px 0 10px", padding: "9px 11px", borderRadius: 8, background: "#0d1422", border: "1px solid #232c3c" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6, fontSize: 11 }}>
              <span style={{ color: "#cbd5e1", fontWeight: 700 }}>Monthly target {currency(profitTarget.monthly)}</span>
              <span style={{ color: profitTarget.aheadBehind >= 0 ? "#34d399" : "#f59e0b", fontWeight: 800 }}>{currency(Math.abs(profitTarget.aheadBehind))} {profitTarget.aheadBehind >= 0 ? "ahead" : "behind"} pace</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "#1e293b", overflow: "hidden" }}><div style={{ width: `${Math.max(0, Math.min(100, profitTarget.progress * 100))}%`, height: "100%", borderRadius: 999, background: profitTarget.aheadBehind >= 0 ? "#34d399" : "#3b82f6" }} /></div>
          </div>
          <div title={`Derived daily pace: ${currency(profitTarget.dailyPace)} across ${profitTarget.daysInMonth} days`} style={{ color: "#8b97ad", fontSize: 11, textAlign: isMobile ? "left" : "right", whiteSpace: "nowrap" }}>{currency(profitTarget.realized)} realized · {(profitTarget.progress * 100).toFixed(0)}% of month</div>
        </div>
        <PeriodComparisonChart points={periodTrend} isMobile={isMobile} />
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        {dashboardCards.salesIncome && <DetailKPI label="Sales" value={currency(stats.salesIncome)} detailLabel="Units sold" detailValue={stats.salesUnits} />}
        <ProfitMarginKPI profitLabel="Realized profit" profitValue={currency(stats.netProfit)} profitVisible={dashboardCards.netProfit && !dashboardCards.netProfitGraph} marginLabel="Realized margin" marginValue={(stats.netMargin * 100).toFixed(1) + "%"} marginVisible={dashboardCards.netMargin && !dashboardCards.netProfitGraph} accent={stats.netProfit>=0?"#34d399":"#f87171"} />
        <ProfitMarginKPI profitLabel="Gross profit" profitValue={currency(stats.grossProfit)} profitVisible={dashboardCards.grossProfit} marginLabel="Gross margin" marginValue={(stats.grossMargin * 100).toFixed(1) + "%"} marginVisible={dashboardCards.grossMargin} accent={stats.grossProfit>=0?"#34d399":"#f87171"} />
        {dashboardCards.inventorySpend && <DetailKPI label="Inventory Spend" value={currency(stats.inventorySpend)} detailLabel="Acquired / committed cost" detailValue={stats.acquiredUnits ? `${stats.acquiredUnits} units · ${currency(stats.averageAcquisitionCost)} avg.` : "n/a"} />}
        {dashboardCards.profitRoi && <DetailKPI label="Profit ROI" value={`${(stats.profitRoi * 100).toFixed(1)}%`} detailLabel="Cost basis" detailValue={currency(stats.salesCost)} accent={stats.profitRoi >= 0 ? "#34d399" : "#f87171"} />}
        {dashboardCards.inventoryValue && <KPI label="Inventory value" value={currency(stats.invValue)} />}
        {dashboardCards.salesCount && <KPI label="Units sold" value={stats.salesUnits} />}
        {dashboardCards.avgOrderValue && <KPI label="Avg. order value" value={currency(stats.aov)} />}
        {dashboardCards.totalExpenses && <KPI label="Total expenses" value={currency(stats.totalExpenses)} />}
        {dashboardCards.platformFees && <KPI label="Platform fees" value={currency(stats.totalFees)} />}
        {dashboardCards.monthlySubs && <KPI label="Monthly subs" value={currency(subStats.monthlyBurn)} />}
      </div>

      {dashboardCards.costBreakdown && (
        <div style={{ ...cardSurface, padding: "13px 16px", marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, color: "#f3f6fb", fontWeight: 700 }}>Selling Costs</div>
              <div style={{ fontSize: 11, color: "#8b97ad", marginTop: 2 }}>Costs between gross profit and realized profit</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 17, color: "#f3f6fb", fontWeight: 800 }}>{currency(stats.costLeakage)}</div>
              <div style={{ fontSize: 11, color: "#8b97ad" }}>{(stats.costLeakageRate * 100).toFixed(1)}% of sales</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 8 }}>
            {[
              ["Platform fees", stats.totalFees],
              ["Outbound shipping", stats.totalShipping],
              ["Other expenses", stats.totalExpenses],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#0d1422", border: "1px solid #232c3c", borderRadius: 8, padding: "9px 11px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: "#8b97ad", fontWeight: 700 }}>{label}</span>
                <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 800 }}>{currency(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <div key={`${i.name}-${i.category}-${i._ageStart}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid #232c3c22" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: "#8b97ad" }}>{i._count > 1 ? `${i._count} units · ` : ""}{i.category} · {i._ageLabel} {i._ageStart || "unknown"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: "#f3f6fb", fontWeight: 700 }}>{i._daysHeld}d</div>
                    <div style={{ fontSize: 11, color: "#7c8aa0" }}>{currency(i._totalValue)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {dashboardCards.velocity && (
            <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f6fb", marginBottom: 10 }}>Inventory Velocity</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                <KPI label="Units sold 30d" value={velocityStats.sold30Units} />
                <KPI label="30d sell-through" value={`${(velocityStats.monthlySellThrough * 100).toFixed(1)}%`} accent="#60a5fa" />
                <KPI label="Median to sell" value={velocityStats.medianDaysToSell === null ? "n/a" : `${velocityStats.medianDaysToSell}d`} />
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

      {dashboardCards.recentSales && <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {dashboardCards.recentSales && <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#9ca3af", marginBottom: 10 }}>Recent Sales</div>
          {stats.rs.length===0?<div style={{ color: "#374151", fontSize: 13, padding: 16, textAlign: "center" }}>No sales</div>:stats.rs.map((s) => (<div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #232c3c22", gap: 8 }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div><div style={{ fontSize: 11, color: "#8b97ad" }}>{s.platform} · {s.size||"OS"} · {s.saleDate}{s.customer?` · ${s.customer}`:""}</div></div><div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{currency(s.salePrice)}</div><div style={{ fontSize: 11, color: s.profit>=0?"#34d399":"#f87171" }}>{currency(s.profit)}</div></div></div>))}
        </div>}
      </div>}
    </div>
  );
}
