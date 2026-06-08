import { useState } from "react";
import { DEF_CATEGORIES, EBAY_AU_FEE_RATE, EBAY_AU_FIXED_ORDER_FEE, currency, computeProfit, estimateEbayFee, today, inp, sel, primaryBtn, ghostBtn, cb, Modal, UnsavedDialog, Field, Row, ModalActions, ResponsiveGrid, useIsMobile } from "../shared.jsx";

function SaleItemIdentity({ item, showCost = true, compact = false }) {
  const meta = [item.category, item.brand].filter(Boolean);
  const sizeLabel = item.size || "OS";
  const labelStyle = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: compact ? 17 : 20,
    padding: compact ? "1px 6px" : "2px 7px",
    borderRadius: 6,
    background: "#172554",
    border: "1px solid #2563eb66",
    color: "#bfdbfe",
    fontSize: compact ? 10 : 11,
    fontWeight: 800,
    lineHeight: 1.2,
    flexShrink: 0,
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: compact ? "3px 6px" : "4px 8px", color: "#7c8aa0", fontSize: compact ? 10 : 11, marginTop: compact ? 3 : 4 }}>
      <span style={labelStyle}>Size {sizeLabel}</span>
      {meta.map((part, index) => <span key={`${part}-${index}`}>{part}</span>)}
      {showCost && <span>Cost {currency(item.price)}</span>}
    </div>
  );
}

function EditSaleModal({ sale, onSave, onClose, platforms, customers }) {
  const [ef, setEf] = useState({ name: sale.name, category: sale.category, costPrice: sale.costPrice, salePrice: sale.salePrice, shippingPrice: sale.shippingPrice, platformFees: sale.platformFees, platform: sale.platform, saleDate: sale.saleDate, tags: sale.tags || "", brand: sale.brand || "", customer: sale.customer || "" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const gc = () => { setShowU(true); };
  const sp = parseFloat(ef.salePrice)||0, ship = parseFloat(ef.shippingPrice)||0, fees = parseFloat(ef.platformFees)||0, cost = parseFloat(ef.costPrice)||0;
  const preview = computeProfit({ salePrice: sp, cost, shipping: ship, fees });
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{ef.name}</div><div style={{ fontSize: 12, color: "#56627a" }}>{ef.category} · {sale.size || "OS"}{sale.brand ? ` · ${sale.brand}` : ""}</div></div>
    <Row><Field label="Item name"><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field><Field label="Cost (AU$)"><input type="number" step="0.01" value={ef.costPrice} onChange={(e) => up({ costPrice: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Sale price (AU$)" req><input type="number" step="0.01" value={ef.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={ef.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={ef.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} /></Field><Field label="Fees"><input type="number" step="0.01" value={ef.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} /></Field><Field label="Platform"><select value={ef.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-list2" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} /><datalist id="cust-list2">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field></Row>
    <ResponsiveGrid columns="repeat(4, minmax(0, 1fr))" mobileColumns="repeat(2, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 4, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(cost)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </ResponsiveGrid>
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...sale, ...ef, costPrice: cost, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: preview })} style={primaryBtn}>Save</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Sell Modal ───

function SellModal({ item, onSell, onClose, platforms, customers }) {
  const [sf, setSf] = useState({ platform: platforms[0]||"Other", salePrice: "", shippingPrice: "", platformFees: "", saleDate: today(), tags: "", customer: "" });
  const [dirty, setDirty] = useState(false); const [showU, setShowU] = useState(false);
  const up = (u) => { setSf({ ...sf, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const sp = parseFloat(sf.salePrice)||0, ship = parseFloat(sf.shippingPrice)||0, fees = parseFloat(sf.platformFees)||0;
  const preview = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Create a new sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{item.name}</div><div style={{ fontSize: 12, color: "#56627a" }}>Cost: {currency(item.price)} · {item.category} · {item.size||"OS"}{item.brand ? ` · ${item.brand}` : ""}</div></div>
    <Row><Field label="Sale price" req><input type="number" step="0.01" value={sf.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} placeholder="0" autoFocus /></Field><Field label="Sale date"><input type="date" value={sf.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={sf.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Fees"><input type="number" step="0.01" value={sf.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Platform" req><select value={sf.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-sell" value={sf.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-sell">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    {sp > 0 && <ResponsiveGrid columns="repeat(4, minmax(0, 1fr))" mobileColumns="repeat(2, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 4, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(item.price)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f59e0b", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </ResponsiveGrid>}
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!sf.salePrice) return; onSell(sf); }} style={primaryBtn}>Create sale</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Bulk Edit Sale Modal ───

function BulkEditSaleModal({ items, onSave, onClose, platforms }) {
  const [plat, setPlat] = useState(""); const [cat, setCat] = useState("");
  const totalProfit = items.reduce((a, s) => a + s.profit, 0);
  const totalRevenue = items.reduce((a, s) => a + s.salePrice, 0);
  return (<Modal open={true} onClose={onClose} title={`Bulk edit ${items.length} sales`}>
    <ResponsiveGrid columns="repeat(3, minmax(0, 1fr))" mobileColumns="repeat(3, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Selected</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{items.length} sales</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </ResponsiveGrid>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
    <Row><Field label="Platform"><select value={plat} onChange={(e) => setPlat(e.target.value)} style={sel}><option value="">— No change —</option>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field>
    <Field label="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}><option value="">— No change —</option>{DEF_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field></Row>
    <ModalActions marginTop={10}><button onClick={onClose} style={ghostBtn}>Cancel</button>
    <button onClick={() => { const updates = {}; if (plat) updates.platform = plat; if (cat) updates.category = cat; onSave(updates); }} style={primaryBtn}>Apply to {items.length} sales</button></ModalActions>
  </Modal>);
}

// ─── Bulk Sell Modal ───

function BulkSellModal({ items, onSell, onClose, platforms, customers }) {
  const [shared, setShared] = useState({ platform: platforms[0]||"Other", saleDate: today(), customer: "" });
  const [rows, setRows] = useState(items.map((i) => ({ id: i.id, salePrice: "", shippingPrice: "", platformFees: "" })));
  const [showU, setShowU] = useState(false);
  const gc = () => setShowU(true);
  const updateRow = (id, u) => setRows(rows.map((r) => r.id === id ? { ...r, ...u } : r));

  const previews = items.map((item) => {
    const r = rows.find((x) => x.id === item.id) || {};
    const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
    return { ...item, sp, ship, fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }) };
  });
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const allPriced = previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={`Sell ${items.length} items`}>
    <ResponsiveGrid columns="repeat(3, minmax(0, 1fr))" mobileColumns="repeat(3, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Items</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{items.length}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Total profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </ResponsiveGrid>
    <Row cols={3}><Field label="Platform" req><select value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input list="cust-bulk" value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-bulk">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field></Row>
    <div style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 8, marginTop: 4 }}>Per-item pricing</div>
    <div style={{ maxHeight: 280, overflowY: "auto", borderRadius: 8, border: "1px solid #232c3c" }}>
      {items.map((item) => {
        const r = rows.find((x) => x.id === item.id) || {};
        const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
        const profit = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
        return (<div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c44", background: "#0d1117" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#e5e7eb", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
              <SaleItemIdentity item={item} />
            </div>
          </div>
          <ResponsiveGrid columns="1fr 1fr 1fr 80px" mobileColumns="1fr 1fr" gap={6} style={{ alignItems: "center" }}>
            <input type="number" step="0.01" placeholder="Sale $" value={r.salePrice} onChange={(e) => updateRow(item.id, { salePrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            <input type="number" step="0.01" placeholder="Ship $" value={r.shippingPrice} onChange={(e) => updateRow(item.id, { shippingPrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            <input type="number" step="0.01" placeholder="Fees $" value={r.platformFees} onChange={(e) => updateRow(item.id, { platformFees: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: sp>0?(profit>=0?"#34d399":"#f87171"):"#374151", textAlign: "right" }}>{sp>0?currency(profit):"—"}</span>
          </ResponsiveGrid>
        </div>);
      })}
    </div>
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!allPriced) return; onSell(shared, rows); }} style={{ ...primaryBtn, opacity: allPriced?1:0.5 }}>Sell {items.length} items</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Manual Sale Modal ───

function ManualSaleModal({ inventory, onSell, onClose, platforms, customers }) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [shared, setShared] = useState({ platform: platforms[0]||"Other", saleDate: today(), customer: "" });
  const [rows, setRows] = useState({});
  const [showU, setShowU] = useState(false);
  const gc = () => setShowU(true);
  const q = query.trim().toLowerCase();
  const filtered = inventory
    .filter((item) => !q || [item.name, item.brand, item.category, item.tags, item.customer].some((v) => String(v || "").toLowerCase().includes(q)))
    .slice(0, 80);
  const selectedItems = inventory.filter((item) => selectedIds.has(item.id));
  const toggle = (item) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    setRows((prev) => prev[item.id] ? prev : { ...prev, [item.id]: { salePrice: "", shippingPrice: "", platformFees: "" } });
  };
  const updateRow = (id, u) => setRows((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...u } }));
  const preparedRows = selectedItems.map((item) => ({ id: item.id, ...(rows[item.id] || {}) }));
  const previews = selectedItems.map((item) => {
    const r = rows[item.id] || {};
    const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
    return { ...item, sp, ship, fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }) };
  });
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const allPriced = selectedItems.length > 0 && previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Add Sale" maxWidth={980}>
    <Row cols={3}><Field label="Platform" req><select value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input list="cust-manual-sale" value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-manual-sale">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field></Row>
    <ResponsiveGrid columns="repeat(3, minmax(0, 1fr))" mobileColumns="repeat(3, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Selected</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </ResponsiveGrid>
    <Field label="Search inventory"><input value={query} onChange={(e) => setQuery(e.target.value)} style={inp} placeholder="Search name, brand, category..." autoFocus={!isMobile} /></Field>
    <ResponsiveGrid columns="minmax(340px, 0.95fr) minmax(500px, 1.3fr)" gap={isMobile ? 12 : 14} style={{ minHeight: isMobile ? 0 : 360 }}>
      <div style={{ border: "1px solid #232c3c", borderRadius: 8, overflow: "auto", maxHeight: isMobile ? 260 : 360, background: "#0d1117" }}>
        {filtered.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#56627a", fontSize: 12 }}>No inventory matches.</div>}
        {filtered.map((item, index) => {
          const checked = selectedIds.has(item.id);
          return (
            <div key={item.id} onClick={() => toggle(item)} style={{ display: "grid", gridTemplateColumns: "26px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #232c3c22", background: checked ? "#1e293b" : (index % 2 === 0 ? "#0d131f" : "#121a2b") }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(item)} onClick={(e) => e.stopPropagation()} style={cb} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <SaleItemIdentity item={item} showCost={false} compact />
              </div>
              <div style={{ color: "#f3f6fb", fontSize: 12, fontWeight: 700 }}>{currency(item.price)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ border: "1px solid #232c3c", borderRadius: 8, overflow: "auto", maxHeight: isMobile ? 320 : 360, background: "#0d1117" }}>
        {selectedItems.length === 0 && <div style={{ padding: 18, textAlign: "center", color: "#56627a", fontSize: 12 }}>Select inventory to price the sale.</div>}
        {selectedItems.map((item) => {
          const r = rows[item.id] || {};
          const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
          const profit = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
          return (
            <div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c44", background: "#0d1117" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div><SaleItemIdentity item={item} /></div>
                <button onClick={() => toggle(item)} style={{ ...ghostBtn, padding: "3px 7px", fontSize: 11, color: "#f87171", flexShrink: 0 }}>Remove</button>
              </div>
              <ResponsiveGrid columns="repeat(3, minmax(120px, 1fr)) 92px" mobileColumns="1fr 1fr" gap={8} style={{ alignItems: "end" }}>
                <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Sale</div><input type="number" step="0.01" placeholder="Sale price" value={r.salePrice || ""} onChange={(e) => updateRow(item.id, { salePrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "7px 9px" }} /></div>
                <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Shipping</div><input type="number" step="0.01" placeholder="Shipping" value={r.shippingPrice || ""} onChange={(e) => updateRow(item.id, { shippingPrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "7px 9px" }} /></div>
                <div><div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4, fontWeight: 600 }}>Fees</div><input type="number" step="0.01" placeholder="Fees" value={r.platformFees || ""} onChange={(e) => updateRow(item.id, { platformFees: e.target.value })} style={{ ...inp, fontSize: 12, padding: "7px 9px" }} /></div>
                <span style={{ fontSize: 12, fontWeight: 700, color: sp>0?(profit>=0?"#34d399":"#f87171"):"#374151", textAlign: "right", paddingBottom: 8 }}>{sp>0?currency(profit):"—"}</span>
              </ResponsiveGrid>
            </div>
          );
        })}
      </div>
    </ResponsiveGrid>
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!allPriced) return; onSell(selectedItems, shared, preparedRows); }} style={{ ...primaryBtn, opacity: allPriced?1:0.5 }}>Record {selectedItems.length || ""} Sale{selectedItems.length === 1 ? "" : "s"}</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

function EbaySaleReviewModal({ draft, items, onRecord, onClose }) {
  const qty = Math.max(1, Number(draft.quantity || 1));
  const saleTotal = Number(draft.sale_price || 0);
  const shipTotal = Number(draft.shipping_price || 0);
  const rawFeeTotal = Number(draft.platform_fees || 0);
  const feeTotal = rawFeeTotal > 0 ? rawFeeTotal : estimateEbayFee(saleTotal);
  const [shared, setShared] = useState({
    platform: "eBay AU",
    saleDate: draft.sale_date || today(),
    customer: draft.buyer_username || "",
  });
  const [rows, setRows] = useState(items.map((item) => ({
    id: item.id,
    salePrice: (saleTotal / qty).toFixed(2),
    shippingPrice: (shipTotal / qty).toFixed(2),
    platformFees: (feeTotal / qty).toFixed(2),
  })));
  const [showU, setShowU] = useState(false);
  const updateRow = (id, u) => setRows(rows.map((r) => r.id === id ? { ...r, ...u } : r));
  const previews = items.map((item) => {
    const r = rows.find((x) => x.id === item.id) || {};
    const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
    return { ...item, sp, ship, fees, profit: computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees }) };
  });
  const totalRevenue = previews.reduce((a, p) => a + p.sp, 0);
  const totalShip = previews.reduce((a, p) => a + p.ship, 0);
  const totalFees = previews.reduce((a, p) => a + p.fees, 0);
  const totalProfit = previews.reduce((a, p) => a + p.profit, 0);
  const allPriced = previews.every((p) => p.sp > 0);

  return (<><Modal open={true} onClose={onClose} guardedClose={() => setShowU(true)} title="Review eBay Sale">
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{draft.item_title}</div>
      <div style={{ color: "#7c8aa0", fontSize: 11 }}>Order {draft.order_id || "unknown"} · qty {qty} · {draft.buyer_username || "Unknown buyer"}</div>
    </div>
    <Row cols={3}><Field label="Platform"><input value={shared.platform} onChange={(e) => setShared({ ...shared, platform: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={shared.saleDate} onChange={(e) => setShared({ ...shared, saleDate: e.target.value })} style={inp} /></Field><Field label="Customer"><input value={shared.customer} onChange={(e) => setShared({ ...shared, customer: e.target.value })} style={inp} /></Field></Row>
    <ResponsiveGrid columns="repeat(4, minmax(0, 1fr))" mobileColumns="repeat(2, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Shipping</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{currency(totalShip)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Fees</div><div style={{ color: "#f59e0b", fontWeight: 700 }}>{currency(totalFees)}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 800 }}>{currency(totalProfit)}</div></div>
    </ResponsiveGrid>
    {rawFeeTotal <= 0 && <div style={{ fontSize: 11, color: "#fbbf24", margin: "-2px 0 10px" }}>Fees are estimated from eBay AU Pro Basic Tier 4 at {(EBAY_AU_FEE_RATE * 100).toFixed(2)}% + {currency(EBAY_AU_FIXED_ORDER_FEE)}. Edit them before recording if eBay shows a different amount.</div>}
    <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 8, border: "1px solid #232c3c" }}>
      {items.map((item) => {
        const r = rows.find((x) => x.id === item.id) || {};
        const sp = parseFloat(r.salePrice)||0, ship = parseFloat(r.shippingPrice)||0, fees = parseFloat(r.platformFees)||0;
        const profit = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
        return (<div key={item.id} style={{ padding: "10px 12px", borderBottom: "1px solid #232c3c44", background: "#0d1117" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
            <div style={{ minWidth: 0 }}><div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div></div>
            <div style={{ color: profit>=0?"#34d399":"#f87171", fontSize: 13, fontWeight: 800 }}>{currency(profit)}</div>
          </div>
          <div style={{ marginBottom: 7 }}><SaleItemIdentity item={item} /></div>
          <ResponsiveGrid columns="repeat(3, minmax(0, 1fr))" mobileColumns="1fr" gap={6}>
            <Field label="Sale price"><input type="number" step="0.01" value={r.salePrice} onChange={(e) => updateRow(item.id, { salePrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></Field>
            <Field label="Shipping"><input type="number" step="0.01" value={r.shippingPrice} onChange={(e) => updateRow(item.id, { shippingPrice: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></Field>
            <Field label="Fees"><input type="number" step="0.01" value={r.platformFees} onChange={(e) => updateRow(item.id, { platformFees: e.target.value })} style={{ ...inp, fontSize: 12, padding: "6px 8px" }} /></Field>
          </ResponsiveGrid>
        </div>);
      })}
    </div>
    <ModalActions><button onClick={() => setShowU(true)} style={ghostBtn}>Cancel</button><button onClick={() => { if (!allPriced) return; onRecord(draft, { items, shared, rows }); }} style={{ ...primaryBtn, opacity: allPriced?1:0.5 }}>Record Sale</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

export {
  EditSaleModal,
  SellModal,
  BulkEditSaleModal,
  BulkSellModal,
  ManualSaleModal,
  EbaySaleReviewModal
};
