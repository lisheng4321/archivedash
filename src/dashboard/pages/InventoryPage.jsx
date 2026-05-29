import { cb, currency, ghostBtn, inp, primaryBtn, sel } from "../shared.jsx";

export default function InventoryPage({ ctx }) {
  const {
    pagePad,
    inventory,
    selectedInv,
    setBulkSellOpen,
    setBulkEditOpen,
    setConfirmDel,
    syncGmailInventory,
    gmailBusy,
    setGmailQueueOpen,
    gmailImports,
    loadGmailImports,
    listingPlatforms,
    openAddInventory,
    gmailQueueOpen,
    gmailQueuePanel,
    invSearch,
    setInvSearch,
    invCat,
    setInvCat,
    invStatus,
    setInvStatus,
    invSort,
    setInvSort,
    invCollapse,
    setInvCollapse,
    filteredInv,
    selectedValue,
    isMobile,
    toggleAll,
    mobileSelectAll,
    groupedInv,
    invRow,
    expandedGroups,
    groupRow
  } = ctx;

  const productCount = new Set(inventory.map((item) => String(item.name || "").trim().toLowerCase()).filter(Boolean)).size;
  const inventoryValue = inventory.reduce((a, i) => a + (Number(i.price) || 0), 0);
  const selectedItems = inventory.filter((item) => selectedInv.has(item.id));
  const selectedProducts = new Set(selectedItems.map((item) => String(item.name || "").trim().toLowerCase()).filter(Boolean)).size;
  const selectedCategories = [...new Set(selectedItems.map((item) => item.category).filter(Boolean))];

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Inventory</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>{productCount} products - {inventory.length} units - {currency(inventoryValue)}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {selectedInv.size > 0 && <>
            <button onClick={() => setBulkSellOpen(true)} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Sell {selectedInv.size}</button>
            <button onClick={() => setBulkEditOpen(true)} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Edit {selectedInv.size}</button>
            <button onClick={() => setConfirmDel({ type: "multi", name: `${selectedInv.size} items` })} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete {selectedInv.size}</button>
          </>}
          <button onClick={async () => { setGmailQueueOpen(true); await syncGmailInventory(); }} disabled={gmailBusy} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px", color: "#93c5fd" }}>Sync Gmail</button>
          <button onClick={async () => { setGmailQueueOpen((v) => !v); if (!gmailImports.length) await loadGmailImports(); }} style={{ ...ghostBtn, fontSize: 12, padding: "7px 12px" }}>Gmail queue{gmailImports.length ? ` (${gmailImports.length})` : ""}</button>
          <button onClick={openAddInventory} style={primaryBtn}>+ Add inventory</button>
        </div>
      </div>

      {gmailQueueOpen && gmailQueuePanel()}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search name / brand..." value={invSearch} onChange={(e) => setInvSearch(e.target.value)} style={{ ...inp, maxWidth: 200 }} />
        <select value={invCat} onChange={(e) => setInvCat(e.target.value)} style={{ ...sel, maxWidth: 140 }}><option value="All">All Categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={invStatus} onChange={(e) => { const next = e.target.value; setInvStatus(next); if (next === "Preorders" && invSort === "name_asc") setInvSort("preorder_asc"); }} style={{ ...sel, maxWidth: 140 }}>
          <option value="All">All Status</option>
          <option value="Preorders">Preorders</option>
          <option value="Listed">Listed</option>
          <option value="Unlisted">Unlisted</option>
          {listingPlatforms.some((p) => String(p).toLowerCase().includes("facebook")) && <option value="Facebook">Facebook</option>}
          {listingPlatforms.some((p) => String(p).toLowerCase().includes("ebay")) && <option value="eBay">eBay</option>}
        </select>
        <select value={invSort} onChange={(e) => setInvSort(e.target.value)} style={{ ...sel, maxWidth: 150 }}>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="preorder_asc">Preorder date up</option>
          <option value="preorder_desc">Preorder date down</option>
          <option value="price_desc">Price down</option>
          <option value="price_asc">Price up</option>
          <option value="date_desc">Newest</option>
          <option value="date_asc">Oldest</option>
        </select>
        <label style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}><input type="checkbox" checked={invCollapse} onChange={(e) => setInvCollapse(e.target.checked)} style={cb} />Group</label>
        {(invSearch || invCat !== "All" || invStatus !== "All" || invSort !== "name_asc") && <button onClick={() => { setInvSearch(""); setInvCat("All"); setInvStatus("All"); setInvSort("name_asc"); }} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 11 }}>Clear</button>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filteredInv.length} items{selectedInv.size > 0 && ` - ${selectedInv.size} selected - ${currency(selectedValue)}`}</span>
      </div>

      <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1f2937", overflow: "hidden" }}>
        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "48px 2fr 115px 0.7fr 80px 85px 100px 55px 130px", gap: 5, padding: "10px 16px", fontSize: 11, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #1f2937", fontWeight: 600, alignItems: "center", background: "#111827" }}>
            <input type="checkbox" checked={selectedInv.size === filteredInv.length && filteredInv.length > 0} onChange={toggleAll} style={cb} /><span>Name</span><span>Listed</span><span>Category</span><span>Size</span><span>Price</span><span>Date</span><span>Qty</span><span>Actions</span>
          </div>
        )}
        {mobileSelectAll(selectedInv.size === filteredInv.length && filteredInv.length > 0, toggleAll, filteredInv.length)}
        {groupedInv.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#374151", fontSize: 13 }}>No inventory</div>}
        {groupedInv.map((item, idx) => {
          if (!item._group) return invRow(item, false, idx);
          const key = item.name;
          const isExpanded = expandedGroups.has(key);
          return (
            <div key={key}>
              {groupRow(item, isExpanded, key, idx)}
              {isExpanded && item._items.map((sub, childIdx) => invRow(sub, true, idx + childIdx + 1))}
            </div>
          );
        })}
      </div>

      {selectedInv.size > 0 && (
        <div style={{ position: "fixed", right: isMobile ? 12 : 24, bottom: isMobile ? 78 : 24, zIndex: 95, background: "#111827", border: "1px solid #2563eb66", boxShadow: "0 18px 40px rgba(0,0,0,0.45)", borderRadius: 10, padding: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", maxWidth: isMobile ? "calc(100vw - 24px)" : 520 }}>
          <div style={{ minWidth: isMobile ? "100%" : 150 }}>
            <div style={{ color: "#f1f5f9", fontSize: 13, fontWeight: 800 }}>{selectedInv.size} selected</div>
            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{selectedProducts} products - {currency(selectedValue)}{selectedCategories.length ? ` - ${selectedCategories.slice(0, 2).join(", ")}${selectedCategories.length > 2 ? ` +${selectedCategories.length - 2}` : ""}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setBulkEditOpen(true)} style={{ ...primaryBtn, fontSize: 12, padding: "7px 12px" }}>Edit</button>
            <button onClick={() => setBulkSellOpen(true)} style={{ ...ghostBtn, color: "#93c5fd", fontSize: 12, padding: "7px 12px" }}>Sell</button>
            <button onClick={() => setConfirmDel({ type: "multi", name: `${selectedInv.size} items` })} style={{ ...ghostBtn, color: "#f87171", fontSize: 12, padding: "7px 12px" }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
