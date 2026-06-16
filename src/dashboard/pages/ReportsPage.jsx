import { currency, ghostBtn, inp, KPI, primaryBtn, sel, TIME_RANGES } from "../shared.jsx";

export default function ReportsPage({ ctx }) {
  const {
    pagePad,
    isMobile,
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
    reportPaymentMode,
    setReportPaymentMode,
    reportPaymentMethods,
    setReportPaymentMethods,
    toggleReportPaymentMethod,
    CATS,
    PLATS,
    PAYMETHODS,
    reportStats,
    velocityStats,
    agingStats,
    exportReportCSV,
  } = ctx;

  const rb = (r) => ({
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: range === r ? 600 : 400,
    borderRadius: 6,
    background: range === r ? "#2563eb" : "transparent",
    color: range === r ? "#fff" : "#7c8aa0",
    border: "none",
    cursor: "pointer",
  });

  const Row = ({ label, value, accent, strong }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #232c3c22", fontSize: 13 }}>
      <span style={{ color: strong ? "#f3f6fb" : "#9ca3af", fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span style={{ color: accent || "#f3f6fb", fontWeight: strong ? 800 : 650 }}>{value}</span>
    </div>
  );

  const MiniTable = ({ title, rows, empty, amountLabel = "Amount" }) => (
    <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f6fb", marginBottom: 10 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ color: "#374151", fontSize: 13, textAlign: "center", padding: 18 }}>{empty}</div>
      ) : (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px", gap: 8, padding: "0 0 8px", color: "#8b97ad", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>
            <span>Name</span><span style={{ textAlign: "right" }}>Count</span><span style={{ textAlign: "right" }}>{amountLabel}</span>
          </div>
          {rows.map((r) => (
            <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1fr 60px 100px", gap: 8, padding: "8px 0", borderTop: "1px solid #232c3c22", fontSize: 12, alignItems: "center" }}>
              <span style={{ color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
              <span style={{ color: "#9ca3af", textAlign: "right" }}>{r.count}</span>
              <span style={{ color: r.amount >= 0 ? "#f3f6fb" : "#f87171", fontWeight: 700, textAlign: "right" }}>{currency(r.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Reports</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>{reportStats.sales.length} sales - {reportStats.expenses.length} expenses - {reportStats.cutFrom} to {range === "Custom" ? reportStats.cutTo : "today"}</p>
        </div>
        <button onClick={exportReportCSV} style={primaryBtn}>Export report CSV</button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 3, background: "#121a2b", borderRadius: 8, padding: 3, border: "1px solid #232c3c", flexWrap: "wrap" }}>{TIME_RANGES.map((r) => <button key={r} style={rb(r)} onClick={() => setRange(r)}>{r}</button>)}</div>
        <select value={dashCat} onChange={(e) => setDashCat(e.target.value)} style={{ ...sel, maxWidth: 160 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={dashPlat} onChange={(e) => setDashPlat(e.target.value)} style={{ ...sel, maxWidth: 170 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={reportPaymentMode} onChange={(e) => setReportPaymentMode(e.target.value)} style={{ ...sel, maxWidth: 180 }}>
          <option value="all">All Payments</option>
          <option value="include">Only selected</option>
          <option value="exclude">Exclude selected</option>
        </select>
        {range === "Custom" && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ ...inp, maxWidth: 150 }} />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ ...inp, maxWidth: 150 }} />
          </>
        )}
        {(dashCat !== "All" || dashPlat !== "All" || reportPaymentMode !== "all" || reportPaymentMethods.length > 0) && <button onClick={() => { setDashCat("All"); setDashPlat("All"); setReportPaymentMode("all"); setReportPaymentMethods([]); }} style={{ ...ghostBtn, padding: "7px 11px", fontSize: 12 }}>Clear</button>}
        {reportPaymentMode !== "all" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
            {PAYMETHODS.map((method) => {
              const checked = reportPaymentMethods.includes(method);
              return (
                <label key={method} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 30, padding: "5px 9px", borderRadius: 6, border: checked ? "1px solid #2563eb88" : "1px solid #232c3c", background: checked ? "#1e293b" : "#121a2b", color: checked ? "#dbeafe" : "#9ca3af", fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleReportPaymentMethod(method)} style={{ margin: 0 }} />
                  {method}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)", gap: 10, marginBottom: 14 }}>
        <KPI label="Revenue" value={currency(reportStats.revenue)} />
        <KPI label="Gross profit" value={currency(reportStats.grossProfit)} accent={reportStats.grossProfit >= 0 ? "#34d399" : "#f87171"} />
        <KPI label="Net profit" value={currency(reportStats.netProfit)} accent={reportStats.netProfit >= 0 ? "#34d399" : "#f87171"} />
        <KPI label="Sold 30d" value={velocityStats.sold30.length} />
        <KPI label="90+ day stock" value={agingStats.aged90.length} accent={agingStats.aged90.length ? "#f59e0b" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f6fb", marginBottom: 10 }}>Profit & Loss</div>
          <Row label="Revenue" value={currency(reportStats.revenue)} strong />
          <Row label="Cost of goods sold" value={currency(reportStats.cogs)} />
          <Row label="Shipping paid" value={currency(reportStats.shipping)} />
          <Row label="Platform fees" value={currency(reportStats.fees)} />
          <Row label="Gross profit" value={currency(reportStats.grossProfit)} accent={reportStats.grossProfit >= 0 ? "#34d399" : "#f87171"} strong />
          <Row label="Operating expenses" value={currency(reportStats.operatingExpenses)} />
          <Row label="Net profit" value={currency(reportStats.netProfit)} accent={reportStats.netProfit >= 0 ? "#34d399" : "#f87171"} strong />
        </div>

        <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f3f6fb", marginBottom: 10 }}>Tax Snapshot</div>
          <Row label="Assessable sales income" value={currency(reportStats.revenue)} strong />
          <Row label="Inventory cost recorded" value={currency(reportStats.cogs)} />
          <Row label="Selling costs recorded" value={currency(reportStats.shipping + reportStats.fees)} />
          <Row label="Business expenses recorded" value={currency(reportStats.operatingExpenses)} />
          <Row label="Estimated taxable profit" value={currency(reportStats.netProfit)} accent={reportStats.netProfit >= 0 ? "#34d399" : "#f87171"} strong />
          <p style={{ margin: "12px 0 0", color: "#7c8aa0", fontSize: 11, lineHeight: 1.45 }}>Use this as a working reseller summary, not tax advice. It only reflects what has been recorded in ArchiveDash.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
        <MiniTable title="Platform Revenue" rows={reportStats.platformRows} empty="No platform sales in this range." amountLabel="Revenue" />
        <MiniTable title="Payment Revenue" rows={reportStats.paymentRows} empty="No payment-method sales in this range." amountLabel="Revenue" />
        <MiniTable title="Category Profit" rows={reportStats.categoryRows} empty="No category profit in this range." amountLabel="Profit" />
        <MiniTable title="Expense Categories" rows={reportStats.expenseRows} empty="No expenses in this range." />
        <MiniTable title="Expense Payments" rows={reportStats.expensePaymentRows} empty="No expenses in this range." />
      </div>
    </div>
  );
}
