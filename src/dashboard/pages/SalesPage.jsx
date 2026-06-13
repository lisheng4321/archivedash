import { cb, currency, EmptyState, ghostBtn, inp, primaryBtn, sel } from "../shared.jsx";

const tableHead = (align = "left") => ({ textAlign: align, minWidth: 0 });

export default function SalesPage({ ctx }) {
  const {
    pagePad,
    sales,
    selectedSales,
    setAddSaleOpen,
    setBulkEditSaleOpen,
    setConfirmDel,
    syncEbayOrders,
    connectEbay,
    ebayBusy,
    setEbayQueueOpen,
    ebayImports,
    loadEbayImports,
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

  const since30 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();
  const recentSales = sales.filter((sale) => String(sale.saleDate || "") >= since30);
  const recentRevenue = recentSales.reduce((a, s) => a + (Number(s.salePrice) || 0), 0);
  const recentProfit = recentSales.reduce((a, s) => a + (Number(s.profit) || 0), 0);
  const latestSaleDate = [...sales].map((sale) => sale.saleDate).filter(Boolean).sort().pop();
  const clearFilters = () => { setSaleSearch(""); setSaleCat("All"); setSalePlat("All"); setSaleSort("date_desc"); };

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Sales</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>30d {recentSales.length} sales - {currency(recentRevenue)} revenue - {currency(recentProfit)} profit{latestSaleDate ? ` - latest ${latestSaleDate}` : ""}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedSales.size > 0 && <>
            <button onClick={() => setBulkEditSaleOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedSales.size}</button>
            <button onClick={() => setConfirmDel({ type: "multi-sale", name: `${selectedSales.size} sales` })} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedSales.size}</button>
          </>}
          <button onClick={() => setAddSaleOpen(true)} style={primaryBtn}>+ Add Sale</button>
          <button onClick={async () => { setEbayQueueOpen(true); await syncEbayOrders(); }} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", color: "#93c5fd" }}>Sync eBay</button>
          <button onClick={async () => { setEbayQueueOpen((v) => !v); if (!ebayImports.length) await loadEbayImports(); }} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>eBay queue{ebayImports.length ? ` (${ebayImports.length})` : ""}</button>
        </div>
      </div>

      {selectedSales.size > 0 && (
        <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", padding: "10px 16px", marginBottom: 12, display: "flex", gap: 24, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
          <span style={{ color: "#7c8aa0" }}>{selectedSales.size} selected</span>
          <span style={{ color: "#f3f6fb" }}>Revenue: <strong>{currency(selectedSalesRevenue)}</strong></span>
          <span style={{ color: selectedSalesProfit >= 0 ? "#34d399" : "#f87171" }}>Profit: <strong>{currency(selectedSalesProfit)}</strong></span>
        </div>
      )}

      {ebayQueueOpen && ebayQueuePanel()}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search name / brand..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} style={{ ...inp, maxWidth: 190 }} />
        <select value={saleCat} onChange={(e) => setSaleCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={salePlat} onChange={(e) => setSalePlat(e.target.value)} style={{ ...sel, maxWidth: 160 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={saleSort} onChange={(e) => setSaleSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}>
          <option value="date_desc">Newest</option>
          <option value="date_asc">Oldest</option>
          <option value="name_asc">Name A-Z</option>
          <option value="profit_desc">Profit down</option>
          <option value="profit_asc">Profit up</option>
          <option value="sale_desc">Sale down</option>
        </select>
        {(saleSearch || saleCat !== "All" || salePlat !== "All" || saleSort !== "date_desc") && <button onClick={clearFilters} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b97ad" }}>{filteredSales.length} shown</span>
      </div>

      {sales.length === 0 ? (
        <EmptyState
          title="No sales yet"
          hint="Record your first sale by hand, or connect eBay to pull in orders awaiting postage automatically."
          actions={[
            { label: "+ Add Sale", primary: true, onClick: () => setAddSaleOpen(true) },
            connectEbay ? { label: ebayBusy ? "Connecting…" : "Connect eBay", disabled: ebayBusy, onClick: connectEbay } : null,
          ]}
        />
      ) : (
      <div style={{ background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", overflow: "hidden" }}>
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "48px 1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", fontSize: 11, color: "#8b97ad", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #232c3c", fontWeight: 600, alignItems: "center", background: "#121a2b" }}>
            <input type="checkbox" checked={selectedSales.size === filteredSales.length && filteredSales.length > 0} onChange={toggleAllSales} style={cb} />
            <span style={tableHead()}>Item</span><span style={tableHead()}>Platform</span><span style={tableHead()}>Size</span><span style={tableHead()}>Date</span><span style={tableHead("right")}>Cost</span><span style={tableHead("right")}>Sale</span><span style={tableHead("right")}>Profit</span><span style={tableHead("center")}>Actions</span>
          </div>
        )}
        {mobileSelectAll(selectedSales.size === filteredSales.length && filteredSales.length > 0, toggleAllSales, filteredSales.length)}
        {filteredSales.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#8b97ad", fontSize: 13 }}>No sales match these filters.<button onClick={clearFilters} style={{ ...ghostBtn, display: "block", margin: "10px auto 0", padding: "5px 12px", fontSize: 11 }}>Clear filters</button></div>}
        {filteredSales.map((s, idx) => saleRow(s, idx))}
      </div>
      )}
    </div>
  );
}
