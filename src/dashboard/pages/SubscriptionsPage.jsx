import { subCategory, subCategoryColor } from "../subscriptions.js";
import {
  SUB_CATEGORIES,
  inp,
  sel,
  primaryBtn,
  ghostBtn,
  badge,
  KPI,
  currency,
  formatMoney,
  frequencyLabel,
  subAmountAud,
  subMonthlyAud,
  today,
} from "../shared.jsx";

export default function SubscriptionsPage({ ctx }) {
  const {
    pagePad,
    isMobile,
    subStats,
    subsCount,
    sortedSubs,
    subSearch,
    setSubSearch,
    subCatFilter,
    setSubCatFilter,
    subSort,
    setSubSort,
    setPage,
    setSubModalOpen,
    logSub,
    logAllOverdue,
    toggleSubActive,
    setConfirmDel,
    fxRates,
  } = ctx;

  const setSubSortField = (field) => {
    setSubSort((prev) => {
      const prevField = prev.replace(/_(asc|desc)$/, "");
      const prevDir = prev.endsWith("_desc") ? "desc" : "asc";
      const nextDir = prevField === field && prevDir === "asc" ? "desc" : "asc";
      return `${field}_${nextDir}`;
    });
  };
  const subSortIcon = (field) => subSort.startsWith(`${field}_`) ? (subSort.endsWith("_asc") ? " ↑" : " ↓") : "";
  const subHeaderBtn = (field, label) => (
    <button onClick={() => setSubSortField(field)} style={{ background: "transparent", border: "none", color: subSort.startsWith(`${field}_`) ? "#93c5fd" : "#56627a", padding: 0, textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
      {label}{subSortIcon(field)}
    </button>
  );
  const subCatChip = (cat) => {
    const [bg, fg] = subCategoryColor(cat);
    return <span style={{ display: "inline-flex", alignItems: "center", width: "fit-content", padding: "2px 7px", borderRadius: 999, background: bg, color: fg, fontSize: 10, fontWeight: 700, lineHeight: 1.2 }}>{cat}</span>;
  };
  const filtersActive = subSearch || subCatFilter !== "All" || subSort !== "nextDue_asc";
  const clearFilters = () => { setSubSearch(""); setSubCatFilter("All"); setSubSort("nextDue_asc"); };
  const rowBtn = (extra) => ({ padding: isMobile ? "7px 12px" : "4px 7px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 5, fontSize: isMobile ? 12 : 11, cursor: "pointer", ...extra });

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Subscriptions</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#56627a" }}>{subStats.active.length} active · {currency(subStats.monthlyBurn)}/mo · {currency(subStats.annualCost)}/yr</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {subStats.overdue.length > 0 && <button onClick={logAllOverdue} style={{ ...primaryBtn, background: "#dc2626" }}>Log {subStats.overdue.length} overdue</button>}
          <button onClick={() => setSubModalOpen("new")} style={primaryBtn}>+ Add subscription</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={() => setPage("subs")} style={{ ...ghostBtn, background: "#1e293b", color: "#93c5fd" }}>Subscriptions{subStats.overdue.length > 0 ? ` (${subStats.overdue.length})` : ""}</button>
        <button onClick={() => setPage("expenses")} style={ghostBtn}>Expenses</button>
      </div>
      {subStats.overdue.length > 0 && (
        <div style={{ background: "#3b1f1f", border: "1px solid #ef444466", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#fca5a5" }}>
          {subStats.overdue.length} subscription{subStats.overdue.length === 1 ? " is" : "s are"} overdue. Click "Log overdue" to auto-create expense entries and roll dates forward.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <KPI label="Active" value={subStats.active.length} />
        <KPI label="Monthly burn" value={currency(subStats.monthlyBurn)} accent="#f59e0b" />
        <KPI label="Annual cost" value={currency(subStats.annualCost)} accent="#f59e0b" />
        <KPI label="Overdue" value={subStats.overdue.length} accent={subStats.overdue.length > 0 ? "#f87171" : undefined} />
      </div>
      {subStats.byCategory.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
          {subStats.byCategory.map(({ category, count, monthly }) => {
            const [bg, fg] = subCategoryColor(category);
            return (
              <button key={category} onClick={() => setSubCatFilter(subCatFilter === category ? "All" : category)} aria-pressed={subCatFilter === category} title={subCatFilter === category ? "Clear category filter" : `Filter by ${category}`} style={{ background: subCatFilter === category ? bg : "#121a2b", border: `1px solid ${subCatFilter === category ? fg : "#232c3c"}`, borderRadius: 8, padding: "9px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ color: fg, fontSize: 12, fontWeight: 800 }}>{category}</span>
                  <span style={{ color: "#7c8aa0", fontSize: 10 }}>{count}</span>
                </div>
                <div style={{ marginTop: 4, color: "#f3f6fb", fontSize: 14, fontWeight: 800 }}>{currency(monthly)}<span style={{ color: "#7c8aa0", fontSize: 10, fontWeight: 600 }}> /mo</span></div>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="search" aria-label="Search subscriptions" placeholder="Search subscriptions..." value={subSearch} onChange={(e) => setSubSearch(e.target.value)} style={{ ...inp, maxWidth: isMobile ? "none" : 210 }} />
        <select aria-label="Filter by category" value={subCatFilter} onChange={(e) => setSubCatFilter(e.target.value)} style={{ ...sel, maxWidth: 170, flex: isMobile ? "1 1 120px" : undefined }}><option value="All">All categories</option>{SUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Sort subscriptions" value={subSort} onChange={(e) => setSubSort(e.target.value)} style={{ ...sel, maxWidth: 150, flex: isMobile ? "1 1 110px" : undefined }}><option value="nextDue_asc">Next due ↑</option><option value="nextDue_desc">Next due ↓</option><option value="monthly_desc">Monthly ↓</option><option value="monthly_asc">Monthly ↑</option><option value="category_asc">Category A-Z</option><option value="name_asc">Name A-Z</option></select>
        {filtersActive && <button onClick={clearFilters} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#56627a" }}>{sortedSubs.length} shown · {currency(sortedSubs.reduce((a, s) => a + subMonthlyAud(s, fxRates), 0))}/mo</span>
      </div>
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", overflow: "hidden" }}>
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 150px 125px 100px 100px 180px", gap: 8, padding: "10px 16px", fontSize: 11, color: "#56627a", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #232c3c", fontWeight: 600 }}>
            {subHeaderBtn("name", "Name")}{subHeaderBtn("category", "Category")}{subHeaderBtn("amount", "Amount")}{subHeaderBtn("frequency", "Frequency")}{subHeaderBtn("monthly", "Monthly")}{subHeaderBtn("nextDue", "Next due")}<span>Actions</span>
          </div>
        )}
        {sortedSubs.length === 0 && (subsCount > 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "#56627a", fontSize: 13 }}>
            No subscriptions match the current filters.
            <button onClick={clearFilters} style={{ ...ghostBtn, display: "block", margin: "10px auto 0", padding: "5px 12px", fontSize: 11 }}>Clear filters</button>
          </div>
        ) : (
          <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No subscriptions yet. Add eBay Pro, software subs, etc.</div>
        ))}
        {sortedSubs.map((s) => {
          const t = today();
          const isOverdue = s.active && s.nextDue && s.nextDue <= t;
          const me = subMonthlyAud(s, fxRates);
          const amountAud = subAmountAud(s, fxRates);
          const code = String(s.currency || "AUD").toUpperCase();
          const amountLabel = code === "AUD" ? currency(s.amount) : `${formatMoney(s.amount, code)} (${currency(amountAud)})`;
          const freqText = frequencyLabel(s.frequency, s.customDays);
          const category = subCategory(s);
          if (isMobile) {
            return (
              <div key={s.id} style={{ padding: "10px 14px", borderBottom: "1px solid #232c3c11", opacity: s.active ? 1 : 0.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 500 }}>{s.name}{!s.active && <span style={badge("#232c3c","#7c8aa0")}>PAUSED</span>}{isOverdue && <span style={badge("#3b1f1f","#f87171")}>OVERDUE</span>}</div>
                  <div style={{ fontSize: 13, color: "#f3f6fb", fontWeight: 600 }}>{amountLabel}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>{subCatChip(category)}<span style={{ fontSize: 11, color: "#7c8aa0" }}>{freqText} · {currency(me)}/mo · <span style={{ color: isOverdue ? "#f87171" : undefined, fontWeight: isOverdue ? 600 : undefined }}>{s.nextDue ? `due ${s.nextDue}` : "no due date"}</span></span></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {s.active && <button onClick={() => logSub(s)} style={rowBtn({ background: "#2563eb", color: "#fff" })}>Log</button>}
                  <button onClick={() => setSubModalOpen(s)} style={rowBtn()}>Edit</button>
                  <button onClick={() => toggleSubActive(s)} style={rowBtn({ color: s.active ? "#fbbf24" : "#34d399" })}>{s.active ? "Pause" : "Resume"}</button>
                  <button onClick={() => setConfirmDel({ type: "sub", id: s.id, name: s.name })} aria-label={`Delete ${s.name}`} title="Delete" style={rowBtn({ color: "#f87171" })}>✕</button>
                </div>
              </div>
            );
          }
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 120px 150px 125px 100px 100px 180px", gap: 8, padding: "10px 16px", alignItems: "center", fontSize: 13, borderBottom: "1px solid #232c3c11", opacity: s.active ? 1 : 0.5 }}>
              <div><span style={{ color: "#e5e7eb" }}>{s.name}</span>{!s.active && <span style={badge("#232c3c","#7c8aa0")}>PAUSED</span>}{isOverdue && <span style={badge("#3b1f1f","#f87171")}>OVERDUE</span>}{s.tags && <div style={{ fontSize: 10, color: "#7c8aa0" }}>{s.tags}</div>}</div>
              <span>{subCatChip(category)}</span>
              <span style={{ color: "#f3f6fb", fontWeight: 500 }}>{amountLabel}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>{freqText}</span>
              <span style={{ color: "#9ca3af", fontSize: 12 }}>{currency(me)}</span>
              <span style={{ color: isOverdue ? "#f87171" : "#7c8aa0", fontSize: 12 }}>{s.nextDue || "—"}</span>
              <div style={{ display: "flex", gap: 3 }}>
                {s.active && <button onClick={() => logSub(s)} title="Log charge and advance due date" style={rowBtn({ background: "#2563eb", color: "#fff", fontWeight: 500 })}>Log</button>}
                <button onClick={() => setSubModalOpen(s)} style={rowBtn()}>Edit</button>
                <button onClick={() => toggleSubActive(s)} title={s.active ? "Pause" : "Resume"} aria-label={`${s.active ? "Pause" : "Resume"} ${s.name}`} style={rowBtn({ color: s.active ? "#fbbf24" : "#34d399" })}>{s.active ? "⏸" : "▶"}</button>
                <button onClick={() => setConfirmDel({ type: "sub", id: s.id, name: s.name })} aria-label={`Delete ${s.name}`} title="Delete" style={rowBtn({ color: "#f87171" })}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
