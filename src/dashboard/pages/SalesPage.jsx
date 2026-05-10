import { cb, currency, ghostBtn, inp, primaryBtn, sel } from "../shared.jsx";

export default function SalesPage({ ctx }) {
  const {
    pagePad,
    sales,
    stats,
    selectedSales,
    setAddSaleOpen,
    setBulkEditSaleOpen,
    setConfirmDel,
    syncEbayOrders,
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

  return (<div style={{ padding: pagePad }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div><h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Sales</h2><p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{sales.length} sales · {currency(sales.reduce((a, s) => a + s.salePrice, 0))} revenue · {currency(sales.reduce((a, s) => a + s.profit, 0))} profit</p></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedSales.size > 0 && <><button onClick={() => setBulkEditSaleOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedSales.size}</button><button onClick={deleteSelectedSales} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedSales.size}</button></>}
              <button onClick={() => setAddSaleOpen(true)} style={primaryBtn}>+ Add Sale</button>
              <button onClick={async () => { setEbayQueueOpen(true); await syncEbayOrders(); }} disabled={ebayBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", color: "#93c5fd" }}>Sync eBay</button>
              <button onClick={async () => { setEbayQueueOpen((v) => !v); if (!ebayImports.length) await loadEbayImports(); }} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>eBay queue{ebayImports.length ? ` (${ebayImports.length})` : ""}</button>
            </div>
          </div>
          {selectedSales.size > 0 && (
            <div style={{ background: "#111827", borderRadius: 10, border: "1px solid #1f2937", padding: "10px 16px", marginBottom: 12, display: "flex", gap: 24, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
              <span style={{ color: "#6b7280" }}>{selectedSales.size} selected</span>
              <span style={{ color: "#f1f5f9" }}>Revenue: <strong>{currency(selectedSalesRevenue)}</strong></span>
              <span style={{ color: selectedSalesProfit >= 0 ? "#34d399" : "#f87171" }}>Profit: <strong>{currency(selectedSalesProfit)}</strong></span>
            </div>
          )}
          {ebayQueueOpen && ebayQueuePanel()}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input placeholder="Search name / brand..." value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)} style={{ ...inp, maxWidth: 190 }} />
            <select value={saleCat} onChange={(e) => setSaleCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={salePlat} onChange={(e) => setSalePlat(e.target.value)} style={{ ...sel, maxWidth: 160 }}><option value="All">All Platforms</option>{PLATS.map((p) => <option key={p}>{p}</option>)}</select>
            <select value={saleSort} onChange={(e) => setSaleSort(e.target.value)} style={{ ...sel, maxWidth: 130 }}><option value="date_desc">Newest</option><option value="date_asc">Oldest</option><option value="name_asc">Name A-Z</option><option value="profit_desc">Profit ↓</option><option value="profit_asc">Profit ↑</option><option value="sale_desc">Sale ↓</option></select>
            {(saleSearch||saleCat!=="All"||salePlat!=="All"||saleSort!=="date_desc")&&<button onClick={() => { setSaleSearch(""); setSaleCat("All"); setSalePlat("All"); setSaleSort("date_desc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredSales.length} shown</span>
          </div>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
            {!isMobile && (
              <div style={{ display: "grid", gridTemplateColumns: "48px 1.8fr 0.8fr 55px 85px 75px 75px 75px 80px", gap: 4, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center", background: "#111827" }}>
                <input type="checkbox" checked={selectedSales.size===filteredSales.length&&filteredSales.length>0} onChange={toggleAllSales} style={cb} />
                <span>Item</span><span>Platform</span><span>Size</span><span>Date</span><span>Cost</span><span>Sale</span><span>Profit</span><span>Actions</span>
              </div>
            )}
            {mobileSelectAll(selectedSales.size===filteredSales.length&&filteredSales.length>0, toggleAllSales, filteredSales.length)}
            {filteredSales.length===0&&<div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No sales</div>}
            {filteredSales.map((s, idx) => saleRow(s, idx))}
          </div>
        </div>
  );
}
