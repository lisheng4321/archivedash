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
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.2,
    flexShrink: 0,
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: compact ? "3px 6px" : "4px 8px", color: "#7c8aa0", fontSize: 11, marginTop: compact ? 3 : 4 }}>
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
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{ef.name}</div><div style={{ fontSize: 12, color: "#8b97ad" }}>{ef.category} Â· {sale.size || "OS"}{sale.brand ? ` Â· ${sale.brand}` : ""}</div></div>
    <Row><Field label="Item name"><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field><Field label="Cost (AU$)"><input type="number" step="0.01" value={ef.costPrice} onChange={(e) => up({ costPrice: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Sale price (AU$)" req><input type="number" step="0.01" value={ef.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} /></Field><Field label="Sale date"><input type="date" value={ef.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={ef.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} /></Field><Field label="Fees"><input type="number" step="0.01" value={ef.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} /></Field><Field label="Platform"><select value={ef.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-list2" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} /><datalist id="cust-list2">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field></Row>
    <ResponsiveGrid columns="repeat(4, minmax(0, 1fr))" mobileColumns="repeat(2, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 12, padding: 14, marginTop: 4, fontSize: 12 }}>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(cost)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </ResponsiveGrid>
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...sale, ...ef, costPrice: cost, salePrice: sp, shippingPrice: ship, platformFees: fees, profit: preview })} style={primaryBtn}>Save</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// â”€â”€â”€ Sell Modal â”€â”€â”€

function SellModal({ item, onSell, onClose, platforms, customers }) {
  const [sf, setSf] = useState({ platform: platforms[0]||"Other", salePrice: "", shippingPrice: "", platformFees: "", saleDate: today(), tags: "", customer: "" });
  const [dirty, setDirty] = useState(false); const [showU, setShowU] = useState(false);
  const up = (u) => { setSf({ ...sf, ...u }); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const sp = parseFloat(sf.salePrice)||0, ship = parseFloat(sf.shippingPrice)||0, fees = parseFloat(sf.platformFees)||0;
  const preview = computeProfit({ salePrice: sp, cost: item.price, shipping: ship, fees });
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Create a new sale">
    <div style={{ background: "#0d1117", padding: 12, borderRadius: 8, marginBottom: 14 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#e5e7eb" }}>{item.name}</div><div style={{ fontSize: 12, color: "#8b97ad" }}>Cost: {currency(item.price)} Â· {item.category} Â· {item.size||"OS"}{item.brand ? ` Â· ${item.brand}` : ""}</div></div>
    <Row><Field label="Sale price" req><input type="number" step="0.01" value={sf.salePrice} onChange={(e) => up({ salePrice: e.target.value })} style={inp} placeholder="0" autoFocus /></Field><Field label="Sale date"><input type="date" value={sf.saleDate} onChange={(e) => up({ saleDate: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Shipping"><input type="number" step="0.01" value={sf.shippingPrice} onChange={(e) => up({ shippingPrice: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Fees"><input type="number" step="0.01" value={sf.platformFees} onChange={(e) => up({ platformFees: e.target.value })} style={inp} placeholder="0" /></Field><Field label="Platform" req><select value={sf.platform} onChange={(e) => up({ platform: e.target.value })} style={sel}>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Row><Field label="Customer"><input list="cust-sell" value={sf.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-sell">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    {sp > 0 && <ResponsiveGrid columns="repeat(4, minmax(0, 1fr))" mobileColumns="repeat(2, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 12, padding: 14, marginTop: 4, fontSize: 12 }}>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Cost</div><div style={{ color: "#9ca3af", fontWeight: 600 }}>{currency(item.price)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Fees+Ship</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(fees+ship)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(sp)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Profit</div><div style={{ color: preview>=0?"#34d399":"#f87171", fontWeight: 700, fontSize: 15 }}>{currency(preview)}</div></div>
    </ResponsiveGrid>}
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => { if (!sf.salePrice) return; onSell(sf); }} style={primaryBtn}>Create sale</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// â”€â”€â”€ Bulk Edit Sale Modal â”€â”€â”€

function BulkEditSaleModal({ items, onSave, onClose, platforms }) {
  const [plat, setPlat] = useState(""); const [cat, setCat] = useState("");
  const totalProfit = items.reduce((a, s) => a + s.profit, 0);
  const totalRevenue = items.reduce((a, s) => a + s.salePrice, 0);
  return (<Modal open={true} onClose={onClose} title={`Bulk edit ${items.length} sales`}>
    <ResponsiveGrid columns="repeat(3, minmax(0, 1fr))" mobileColumns="repeat(3, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Selected</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{items.length} sales</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Profit</div><div style={{ color: totalProfit >= 0 ? "#34d399" : "#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
    </ResponsiveGrid>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
    <Row><Field label="Platform"><select value={plat} onChange={(e) => setPlat(e.target.value)} style={sel}><option value="">â€” No change â€”</option>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field>
    <Field label="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}><option value="">â€” No change â€”</option>{DEF_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field></Row>
    <ModalActions marginTop={10}><button onClick={onClose} style={ghostBtn}>Cancel</button>
    <button onClick={() => { const updates = {}; if (plat) updates.platform = plat; if (cat) updates.category = cat; onSave(updates); }} style={primaryBtn}>Apply to {items.length} sales</button></ModalActions>
  </Modal>);
}

// â”€â”€â”€ Bulk Sell Modal â”€â”€â”€

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
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Items</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{items.length}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Revenue</div><div style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(totalRevenue)}</div></div>
      <div><div style={{ color: "#8b97ad", marginBottom: 2 }}>Total profit</div><div style={{ color: totalProfit>=0?"#34d399":"#f87171", fontWeight: 700 }}>{currency(totalProfit)}</div></div>
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
            <input type="number" step="0.01" placeholder="Fees $" value={r.platformFees} onChang×‹h‘éì¶»§q«^uY\ÎˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™Îˆœˆ_HÏ‚ˆÜ[ˆÝ[O^ÞÈ›ÛÚ^™NˆL‹›ÛÙZYÚˆŒÛÛÜŽˆÜŒÊ›Ùš]LÈˆÌÍÎNHŽˆˆÙŽÌMÌHŠNˆˆÌÍÍMLH‹^[YÛŽˆœšYÚˆ_OžÜÜŒØÝ\œ™[˜ÞJ›Ùš]
Nˆ¸ %ŸOÜÜ[‚ˆÔ™\ÜÛœÚ]™QÜšY‚ˆÙ]ŠNÂˆJ_BˆÙ]‚ˆ[Ù[XÝ[ÛœÏ]ÛˆÛÛXÚÏ^ÙØßHÝ[O^ÙÚÜÝŸOØ[˜Ù[Ø]Û]ÛˆÛÛXÚÏ^Ê
HOˆÈYˆ
X[šXÙY
H™]\›ŽÈÛ”Ù[
Ú\™Y›ÝÜÊNÈ_HÝ[O^ÞÈ‹‹œš[X\žP‹ÜXÚ]Nˆ[šXÙYÌNŒH_O”Ù[Ú][\Ë›[™ÝH][\ÏØ]ÛÓ[Ù[XÝ[ÛœÏ‚ˆÓ[Ù[[œØ]™YX[ÙÈÜ[^ÜÚÝÕ_HÛ‘\ØØ\™^ÛÛÛÜÙ_HÛØ[˜Ù[^Ê
HOˆÙ]ÚÝÕJ˜[ÙJ_HÏÏŠNÂŸB‚‹ËÈ8¥ 8¥ 8¥ X[X[Ø[H[Ù[8¥ 8¥ 8¥ ‚™[˜Ý[ÛˆX[X[Ø[S[Ù[
È[™[ÜžKÛ”Ù[ÛÛÜÙK]›Ü›\ËÝ\ÝÛY\œÈJHÂˆÛÛœÝ\Ó[Øš[HH\ÙR\Ó[Øš[J
NÂˆÛÛœÝÜ]Y\žKÙ]]Y\žWHH\ÙTÝ]JˆŠNÂˆÛÛœÝÜÙ[XÝYYËÙ]Ù[XÝYY×HH\ÙTÝ]J™]ÈÙ]

JNÂˆÛÛœÝÜÚ\™YÙ]Ú\™YHH\ÙTÝ]JÈ]›Ü›Nˆ]›Ü›\ÖÌ_“Ý\ˆ‹Ø[Q]NˆÙ^J
KÝ\ÝÛY\ŽˆˆˆJNÂˆÛÛœÝÜ›ÝÜËÙ]›ÝÜ×HH\ÙTÝ]JßJNÂˆÛÛœÝÜÚÝÕKÙ]ÚÝÕWHH\ÙTÝ]J˜[ÙJNÂˆÛÛœÝØÈH

HOˆÙ]ÚÝÕJYJNÂˆÛÛœÝHH]Y\žKš[J
KÓÝÙ\Ø\ÙJ
NÂˆÛÛœÝš[\™YH[™[ÜžBˆ™š[\Š
][JHOˆ\HÚ][K›˜[YK][K˜œ˜[™][K˜Ø]YÛÜžK][KYÜË][K˜Ý\ÝÛY\—KœÛÛYJ
ŠHOˆÝš[™ÊˆˆŠKÓÝÙ\Ø\ÙJ
Kš[˜ÛY\ÊJJJBˆœÛXÙJ
NÂˆÛÛœÝÙ[XÝY][\ÈH[™[ÜžK™š[\Š
][JHOˆÙ[XÝYYËš\Ê][KšY
JNÂˆÛÛœÝÙÙÛHH
][JHOˆÂˆÙ]Ù[XÝYYÊ
™]ŠHOˆÂˆÛÛœÝ™^H™]ÈÙ]
™]ŠNÂˆYˆ
™^š\Ê][KšY
JH™^™[]J][KšY
NÂˆ[ÙH™^˜Y
][KšY
NÂˆ™]\›ˆ™^ÂˆJNÂˆÙ]›ÝÜÊ
™]ŠHOˆ™]–Ú][KšYHÈ™]ˆˆÈ‹‹œ™]‹Ú][KšYNˆÈØ[TšXÙNˆˆ‹Ú\[™ÔšXÙNˆˆ‹]›Ü›Q™Y\ÎˆˆˆHJNÂˆNÂˆÛÛœÝ\]T›ÝÈH
YJHOˆÙ]›ÝÜÊ
™]ŠHOˆ
È‹‹œ™]‹ÚYNˆÈ‹‹Š™]–ÚYHßJK‹‹HHJJNÂˆÛÛœÝ™\\™Y›ÝÜÈHÙ[XÝY][\Ë›X\

][JHOˆ
ÈYˆ][KšY‹‹Š›ÝÜÖÚ][KšYHßJHJJNÂˆÛÛœÝ™]šY]ÜÈHÙ[XÝY][\Ë›X\

][JHOˆÂˆÛÛœÝˆH›ÝÜÖÚ][KšYHßNÂˆÛÛœÝÜH\œÙQ›Ø]
‹œØ[TšXÙJ_Ú\H\œÙQ›Ø]
‹œÚ\[™ÔšXÙJ_™Y\ÈH\œÙQ›Ø]
‹œ]›Ü›Q™Y\Ê_Âˆ™]\›ˆÈ‹‹š][KÜÚ\™Y\Ë›Ùš]ˆÛÛ\]T›Ùš]
ÈØ[TšXÙNˆÜÛÜÝˆ][KœšXÙKÚ\[™ÎˆÚ\™Y\ÈJHNÂˆJNÂˆÛÛœÝÝ[›Ùš]H™]šY]ÜËœ™YXÙJ
K
HOˆH
Èœ›Ùš]
NÂˆÛÛœÝÝ[™]™[YHH™]šY]ÜËœ™YXÙJ
K
HOˆH
ÈœÜ
NÂˆÛÛœÝ[šXÙYHÙ[XÝY][\Ë›[™Ýˆ	‰ˆ™]šY]ÜË™]™\žJ

HOˆœÜˆ
NÂ‚ˆ™]\›ˆ
[Ù[Ü[^ÝY_HÛÛÜÙO^ÛÛÛÜÙ_HÝX\™YÛÜÙO^ÙØßH]OHYØ[HˆX^ÚY^ÎNO‚ˆ›ÝÈÛÛÏ^ÌßOšY[X™[H”]›Ü›Hˆ™\OÙ[XÝ˜[YO^ÜÚ\™Yœ]›Ü›_HÛÚ[™ÙO^ÊJHOˆÙ]Ú\™Y
È‹‹œÚ\™Y]›Ü›NˆK\™Ù]˜[YHJ_HÝ[O^ÜÙ[OžÜ]›Ü›\Ë›X\


HOˆÜ[ÛˆÙ^O^ÜOžÜOÛÜ[ÛŠ_OÜÙ[XÝÑšY[šY[X™[H”Ø[H]H[œ]\OH™]Hˆ˜[YO^ÜÚ\™YœØ[Q]_HÛÚ[™ÙO^ÊJHOˆÙ]Ú\™Y
È‹‹œÚ\™YØ[Q]NˆK\™Ù]˜[YHJ_HÝ[O^Ú[œHÏÑšY[šY[X™[HÝ\ÝÛY\ˆ[œ]\ÝH˜Ý\Ý[X[X[\Ø[Hˆ˜[YO^ÜÚ\™Y˜Ý\ÝÛY\ŸHÛÚ[™ÙO^ÊJHOˆÙ]Ú\™Y
È‹‹œÚ\™YÝ\ÝÛY\ŽˆK\™Ù]˜[YHJ_HÝ[O^Ú[œHXÙZÛ\H“Ü[Û˜[ˆÏ][\ÝYH˜Ý\Ý[X[X[\Ø[HžØÝ\ÝÛY\œË›X\

ÊHOˆÜ[ÛˆÙ^O^ØßH˜[YO^ØßHÏŠ_OÙ][\ÝÑšY[Ô›ÝÏ‚ˆ™\ÜÛœÚ]™QÜšYÛÛ[[œÏHœ™\X]
ËZ[›X^
YœŠJHˆ[Øš[PÛÛ[[œÏHœ™\X]
ËZ[›X^
YœŠJHˆØ\^ÎHÝ[O^ÞÈ˜XÚÙÜ›Ý[™ˆˆÌLLMÈ‹›Ü™\”˜Y]\ÎˆY[™ÎˆL‹X\™Ú[›ÝÛNˆL‹›ÛÚ^™NˆLˆ_O‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O”Ù[XÝYÙ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÙŒÙ™˜ˆ‹›ÛÙZYÚˆŒ_OžÜÙ[XÝY][\Ë›[™ÝH][^ÜÙ[XÝY][\Ë›[™ÝOOHHÈˆˆˆœÈŸOÙ]Ù]‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O”™]™[YOÙ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÙŒÙ™˜ˆ‹›ÛÙZYÚˆŒ_OžØÝ\œ™[˜ÞJÝ[™]™[YJ_OÙ]Ù]‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O”›Ùš]Ù]]ˆÝ[O^ÞÈÛÛÜŽˆÝ[›Ùš]LÈˆÌÍÎNHŽˆˆÙŽÌMÌH‹›ÛÙZYÚˆÌ_OžØÝ\œ™[˜ÞJÝ[›Ùš]
_OÙ]Ù]‚ˆÔ™\ÜÛœÚ]™QÜšY‚ˆšY[X™[H”ÙX\˜Ú[™[ÜžH[œ]˜[YO^Ü]Y\ž_HÛÚ[™ÙO^ÊJHOˆÙ]]Y\žJK\™Ù]˜[YJ_HÝ[O^Ú[œHXÙZÛ\H”ÙX\˜Ú˜[YKœ˜[™Ø]YÛÜžK‹‹ˆˆ]]Ñ›ØÝ\Ï^ÈZ\Ó[Øš[_HÏÑšY[‚ˆ™\ÜÛœÚ]™QÜšYÛÛ[[œÏH›Z[›X^
ÍŽMYœŠHZ[›X^
LKŒÙœŠHˆØ\^Ú\Ó[Øš[HÈLˆˆMHÝ[O^ÞÈZ[’ZYÚˆ\Ó[Øš[HÈˆÍŒ_O‚ˆ]ˆÝ[O^ÞÈ›Ü™\ŽˆŒ\ÛÛYÌŒÌ˜ÌØÈ‹›Ü™\”˜Y]\ÎˆÝ™\™›ÝÎˆ˜]]È‹X^ZYÚˆ\Ó[Øš[HÈŒˆÍŒ˜XÚÙÜ›Ý[™ˆˆÌLLMÈˆ_O‚ˆÙš[\™Y›[™ÝOOH	‰ˆ]ˆÝ[O^ÞÈY[™ÎˆN^[YÛŽˆ˜Ù[\ˆ‹ÛÛÜŽˆˆÎŽMØY‹›ÛÚ^™NˆLˆ_O“›È[™[ÜžHX]Ú\ËÙ]ŸBˆÙš[\™Y›X\

][K[™^
HOˆÂˆÛÛœÝÚXÚÙYHÙ[XÝYYËš\Ê][KšY
NÂˆ™]\›ˆ
ˆ]ˆÙ^O^Ú][KšYHÛÛXÚÏ^Ê
HOˆÙÙÛJ][J_HÝ[O^ÞÈ\Ü^Nˆ™ÜšY‹ÜšY[\]PÛÛ[[œÎˆŒœZ[›X^
YœŠH]]È‹Ø\ˆL[YÛ’][\Îˆ˜Ù[\ˆ‹Y[™ÎˆŒLLœ‹Ý\œÛÜŽˆœÚ[\ˆ‹›Ü™\›ÝÛNˆŒ\ÛÛYÌŒÌ˜ÌØÌŒˆ‹˜XÚÙÜ›Ý[™ˆÚXÚÙYÈˆÌYLŽLØˆˆˆ
[™^	HˆOOHÈˆÌLÌYˆˆˆˆÌLŒXL˜ˆŠH_O‚ˆ[œ]\OH˜ÚXÚØ›ÞˆÚXÚÙY^ØÚXÚÙYHÛÚ[™ÙO^Ê
HOˆÙÙÛJ][J_HÛÛXÚÏ^ÊJHOˆKœÝÜ›ÜYØ][ÛŠ
_HÝ[O^ØØŸHÏ‚ˆ]ˆÝ[O^ÞÈZ[•ÚYˆ_O‚ˆ]ˆÝ[O^ÞÈÛÛÜŽˆˆÙMYMÙXˆ‹›ÛÚ^™NˆL‹›ÛÙZYÚˆÌÝ™\™›ÝÎˆšY[ˆ‹^Ý™\™›ÝÎˆ™[\Ú\È‹Ú]TÜXÙNˆ››ÝÜ˜\ˆ_OžÚ][K›˜[Y_OÙ]‚ˆØ[R][RY[]H][O^Ú][_HÚÝÐÛÜÝ^Ù˜[Ù_HÛÛ\XÝÏ‚ˆÙ]‚ˆ]ˆÝ[O^ÞÈÛÛÜŽˆˆÙŒÙ™˜ˆ‹›ÛÚ^™NˆL‹›ÛÙZYÚˆÌ_OžØÝ\œ™[˜ÞJ][KœšXÙJ_OÙ]‚ˆÙ]‚ˆ
NÂˆJ_BˆÙ]‚ˆ]ˆÝ[O^ÞÈ›Ü™\ŽˆŒ\ÛÛYÌŒÌ˜ÌØÈ‹›Ü™\”˜Y]\ÎˆÝ™\™›ÝÎˆ˜]]È‹X^ZYÚˆ\Ó[Øš[HÈÌŒˆÍŒ˜XÚÙÜ›Ý[™ˆˆÌLLMÈˆ_O‚ˆÜÙ[XÝY][\Ë›[™ÝOOH	‰ˆ]ˆÝ[O^ÞÈY[™ÎˆN^[YÛŽˆ˜Ù[\ˆ‹ÛÛÜŽˆˆÎŽMØY‹›ÛÚ^™NˆLˆ_O”Ù[XÝ[™[ÜžHÈšXÙHHØ[KÙ]ŸBˆÜÙ[XÝY][\Ë›X\

][JHOˆÂˆÛÛœÝˆH›ÝÜÖÚ][KšYHßNÂˆÛÛœÝÜH\œÙQ›Ø]
‹œØ[TšXÙJ_Ú\H\œÙQ›Ø]
‹œÚ\[™ÔšXÙJ_™Y\ÈH\œÙQ›Ø]
‹œ]›Ü›Q™Y\Ê_ÂˆÛÛœÝ›Ùš]HÛÛ\]T›Ùš]
ÈØ[TšXÙNˆÜÛÜÝˆ][KœšXÙKÚ\[™ÎˆÚ\™Y\ÈJNÂˆ™]\›ˆ
ˆ]ˆÙ^O^Ú][KšYHÝ[O^ÞÈY[™ÎˆŒLLœ‹›Ü™\›ÝÛNˆŒ\ÛÛYÌŒÌ˜ÌØÍ‹˜XÚÙÜ›Ý[™ˆˆÌLLMÈˆ_O‚ˆ]ˆÝ[O^ÞÈ\Ü^Nˆ™›^‹\ÝYžPÛÛ[ˆœÜXÙKX™]ÙY[ˆ‹Ø\ˆX\™Ú[›ÝÛNˆË[YÛ’][\Îˆ™›^\Ý\ˆ_O‚ˆ]ˆÝ[O^ÞÈZ[•ÚYˆ_O]ˆÝ[O^ÞÈÛÛÜŽˆˆÙMYMÙXˆ‹›ÛÚ^™NˆL‹›ÛÙZYÚˆŒÝ™\™›ÝÎˆšY[ˆ‹^Ý™\™›ÝÎˆ™[\Ú\È‹Ú]TÜXÙNˆ››ÝÜ˜\ˆ_OžÚ][K›˜[Y_OÙ]Ø[R][RY[]H][O^Ú][_HÏÙ]‚ˆ]ÛˆÛÛXÚÏ^Ê
HOˆÙÙÛJ][J_HÝ[O^ÞÈ‹‹™ÚÜÝ‹Y[™ÎˆŒÜÜ‹›ÛÚ^™NˆLKÛÛÜŽˆˆÙŽÌMÌH‹›^Úš[šÎˆ_O”™[[Ý™OØ]Û‚ˆÙ]‚ˆ™\ÜÛœÚ]™QÜšYÛÛ[[œÏHœ™\X]
ËZ[›X^
LŒYœŠJHLœˆ[Øš[PÛÛ[[œÏHŒYœˆYœˆˆØ\^ÎHÝ[O^ÞÈ[YÛ’][\Îˆ™[™ˆ_O‚ˆ]]ˆÝ[O^ÞÈ›ÛÚ^™NˆLKÛÛÜŽˆˆÎXØLØYˆ‹X\™Ú[›ÝÛNˆ›ÛÙZYÚˆŒ_O”Ø[OÙ][œ]\OH›[X™\ˆˆÝ\HŒŒHˆXÙZÛ\H”Ø[HšXÙHˆ˜[YO^Ü‹œØ[TšXÙHˆŸHÛÚ[™ÙO^ÊJHOˆ\]T›ÝÊ][KšYÈØ[TšXÙNˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™ÎˆÜ\ˆ_HÏÙ]‚ˆ]]ˆÝ[O^ÞÈ›ÛÚ^™NˆLKÛÛÜŽˆˆÎXØLØYˆ‹X\™Ú[›ÝÛNˆ›ÛÙZYÚˆŒ_O”Ú\[™ÏÙ][œ]\OH›[X™\ˆˆÝ\HŒŒHˆXÙZÛ\H”Ú\[™Èˆ˜[YO^Ü‹œÚ\[™ÔšXÙHˆŸHÛÚ[™ÙO^ÊJHOˆ\]T›ÝÊ][KšYÈÚ\[™ÔšXÙNˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™ÎˆÜ\ˆ_HÏÙ]‚ˆ]]ˆÝ[O^ÞÈ›ÛÚ^™NˆLKÛÛÜŽˆˆÎXØLØYˆ‹X\™Ú[›ÝÛNˆ›ÛÙZYÚˆŒ_O‘™Y\ÏÙ][œ]\OH›[X™\ˆˆÝ\HŒŒHˆXÙZÛ\H‘™Y\Èˆ˜[YO^Ü‹œ]›Ü›Q™Y\ÈˆŸHÛÚ[™ÙO^ÊJHOˆ\]T›ÝÊ][KšYÈ]›Ü›Q™Y\ÎˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™ÎˆÜ\ˆ_HÏÙ]‚ˆÜ[ˆÝ[O^ÞÈ›ÛÚ^™NˆL‹›ÛÙZYÚˆÌÛÛÜŽˆÜŒÊ›Ùš]LÈˆÌÍÎNHŽˆˆÙŽÌMÌHŠNˆˆÌÍÍMLH‹^[YÛŽˆœšYÚ‹Y[™Ð›ÝÛNˆ_OžÜÜŒØÝ\œ™[˜ÞJ›Ùš]
Nˆ¸ %ŸOÜÜ[‚ˆÔ™\ÜÛœÚ]™QÜšY‚ˆÙ]‚ˆ
NÂˆJ_BˆÙ]‚ˆÔ™\ÜÛœÚ]™QÜšY‚ˆ[Ù[XÝ[ÛœÏ]ÛˆÛÛXÚÏ^ÙØßHÝ[O^ÙÚÜÝŸOØ[˜Ù[Ø]Û]ÛˆÛÛXÚÏ^Ê
HOˆÈYˆ
X[šXÙY
H™]\›ŽÈÛ”Ù[
Ù[XÝY][\ËÚ\™Y™\\™Y›ÝÜÊNÈ_HÝ[O^ÞÈ‹‹œš[X\žP‹ÜXÚ]Nˆ[šXÙYÌNŒH_O”™XÛÜ™ÜÙ[XÝY][\Ë›[™ÝˆŸHØ[^ÜÙ[XÝY][\Ë›[™ÝOOHHÈˆˆˆœÈŸOØ]ÛÓ[Ù[XÝ[ÛœÏ‚ˆÓ[Ù[[œØ]™YX[ÙÈÜ[^ÜÚÝÕ_HÛ‘\ØØ\™^ÛÛÛÜÙ_HÛØ[˜Ù[^Ê
HOˆÙ]ÚÝÕJ˜[ÙJ_HÏÏŠNÂŸB‚™[˜Ý[ÛˆX˜^TØ[T™]šY]Ó[Ù[
È˜Y][\ËÛ”™XÛÜ™ÛÛÜÙHJHÂˆÛÛœÝ]HHX]›X^
K[X™\Š˜Yœ]X[]HJJNÂˆÛÛœÝØ[UÝ[H[X™\Š˜YœØ[WÜšXÙH
NÂˆÛÛœÝÚ\Ý[H[X™\Š˜YœÚ\[™×ÜšXÙH
NÂˆÛÛœÝ˜]Ñ™YUÝ[H[X™\Š˜Yœ]›Ü›WÙ™Y\È
NÂˆÛÛœÝ™YUÝ[H˜]Ñ™YUÝ[ˆÈ˜]Ñ™YUÝ[ˆ\Ý[X]QX˜^Q™YJØ[UÝ[
NÂˆÛÛœÝÜÚ\™YÙ]Ú\™YHH\ÙTÝ]JÂˆ]›Ü›Nˆ™P˜^HUH‹ˆØ[Q]Nˆ˜YœØ[WÙ]HÙ^J
KˆÝ\ÝÛY\Žˆ˜Y˜^Y\—Ý\Ù\›˜[YHˆ‹ˆJNÂˆÛÛœÝÜ›ÝÜËÙ]›ÝÜ×HH\ÙTÝ]J][\Ë›X\

][JHOˆ
ÂˆYˆ][KšYˆØ[TšXÙNˆ
Ø[UÝ[È]JKÑš^Y
ŠKˆÚ\[™ÔšXÙNˆ
Ú\Ý[È]JKÑš^Y
ŠKˆ]›Ü›Q™Y\Îˆ
™YUÝ[È]JKÑš^Y
ŠKˆJJJNÂˆÛÛœÝÜÚÝÕKÙ]ÚÝÕWHH\ÙTÝ]J˜[ÙJNÂˆÛÛœÝ\]T›ÝÈH
YJHOˆÙ]›ÝÜÊ›ÝÜË›X\

ŠHOˆ‹šYOOHYÈÈ‹‹œ‹‹‹HHˆŠJNÂˆÛÛœÝ™]šY]ÜÈH][\Ë›X\

][JHOˆÂˆÛÛœÝˆH›ÝÜË™š[™


HOˆšYOOH][KšY
HßNÂˆÛÛœÝÜH\œÙQ›Ø]
‹œØ[TšXÙJ_Ú\H\œÙQ›Ø]
‹œÚ\[™ÔšXÙJ_™Y\ÈH\œÙQ›Ø]
‹œ]›Ü›Q™Y\Ê_Âˆ™]\›ˆÈ‹‹š][KÜÚ\™Y\Ë›Ùš]ˆÛÛ\]T›Ùš]
ÈØ[TšXÙNˆÜÛÜÝˆ][KœšXÙKÚ\[™ÎˆÚ\™Y\ÈJHNÂˆJNÂˆÛÛœÝÝ[™]™[YHH™]šY]ÜËœ™YXÙJ
K
HOˆH
ÈœÜ
NÂˆÛÛœÝÝ[Ú\H™]šY]ÜËœ™YXÙJ
K
HOˆH
ÈœÚ\
NÂˆÛÛœÝÝ[™Y\ÈH™]šY]ÜËœ™YXÙJ
K
HOˆH
È™™Y\Ë
NÂˆÛÛœÝÝ[›Ùš]H™]šY]ÜËœ™YXÙJ
K
HOˆH
Èœ›Ùš]
NÂˆÛÛœÝ[šXÙYH™]šY]ÜË™]™\žJ

HOˆœÜˆ
NÂ‚ˆ™]\›ˆ
[Ù[Ü[^ÝY_HÛÛÜÙO^ÛÛÛÜÙ_HÝX\™YÛÜÙO^Ê
HOˆÙ]ÚÝÕJYJ_H]OH”™]šY]ÈP˜^HØ[H‚ˆ]ˆÝ[O^ÞÈ˜XÚÙÜ›Ý[™ˆˆÌLLMÈ‹›Ü™\”˜Y]\ÎˆY[™ÎˆL‹X\™Ú[›ÝÛNˆM_O‚ˆ]ˆÝ[O^ÞÈÛÛÜŽˆˆÙMYMÙXˆ‹›ÛÚ^™NˆLË›ÛÙZYÚˆÌX\™Ú[›ÝÛNˆÈ_OžÙ˜Yš][WÝ]_OÙ]‚ˆ]ˆÝ[O^ÞÈÛÛÜŽˆˆÍØÎXL‹›ÛÚ^™NˆLH_O“Ü™\ˆÙ˜Y›Ü™\—ÚY[šÛ›ÝÛˆŸH0­È]HÜ]_H0­ÈÙ˜Y˜^Y\—Ý\Ù\›˜[YH•[šÛ›ÝÛˆ^Y\ˆŸOÙ]‚ˆÙ]‚ˆ›ÝÈÛÛÏ^ÌßOšY[X™[H”]›Ü›H[œ]˜[YO^ÜÚ\™Yœ]›Ü›_HÛÚ[™ÙO^ÊJHOˆÙ]Ú\™Y
È‹‹œÚ\™Y]›Ü›NˆK\™Ù]˜[YHJ_HÝ[O^Ú[œHÏÑšY[šY[X™[H”Ø[H]H[œ]\OH™]Hˆ˜[YO^ÜÚ\™YœØ[Q]_HÛÚ[™ÙO^ÊJHOˆÙ]Ú\™Y
È‹‹œÚ\™YØ[Q]NˆK\™Ù]˜[YHJ_HÝ[O^Ú[œHÏÑšY[šY[X™[HÝ\ÝÛY\ˆ[œ]˜[YO^ÜÚ\™Y˜Ý\ÝÛY\ŸHÛÚ[™ÙO^ÊJHOˆÙ]Ú\™Y
È‹‹œÚ\™YÝ\ÝÛY\ŽˆK\™Ù]˜[YHJ_HÝ[O^Ú[œHÏÑšY[Ô›ÝÏ‚ˆ™\ÜÛœÚ]™QÜšYÛÛ[[œÏHœ™\X]
Z[›X^
YœŠJHˆ[Øš[PÛÛ[[œÏHœ™\X]
‹Z[›X^
YœŠJHˆØ\^ÎHÝ[O^ÞÈ˜XÚÙÜ›Ý[™ˆˆÌLLMÈ‹›Ü™\”˜Y]\ÎˆY[™ÎˆL‹X\™Ú[›ÝÛNˆL‹›ÛÚ^™NˆLˆ_O‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O”™]™[YOÙ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÙŒÙ™˜ˆ‹›ÛÙZYÚˆÌ_OžØÝ\œ™[˜ÞJÝ[™]™[YJ_OÙ]Ù]‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O”Ú\[™ÏÙ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÙŒÙ™˜ˆ‹›ÛÙZYÚˆÌ_OžØÝ\œ™[˜ÞJÝ[Ú\
_OÙ]Ù]‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O‘™Y\ÏÙ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÙŒÙ™˜ˆ‹›ÛÙZYÚˆÌ_OžØÝ\œ™[˜ÞJÝ[™Y\Ê_OÙ]Ù]‚ˆ]]ˆÝ[O^ÞÈÛÛÜŽˆˆÎŽMØY‹X\™Ú[›ÝÛNˆˆ_O”›Ùš]Ù]]ˆÝ[O^ÞÈÛÛÜŽˆÝ[›Ùš]LÈˆÌÍÎNHŽˆˆÙŽÌMÌH‹›ÛÙZYÚˆ_OžØÝ\œ™[˜ÞJÝ[›Ùš]
_OÙ]Ù]‚ˆÔ™\ÜÛœÚ]™QÜšY‚ˆÜ˜]Ñ™YUÝ[H	‰ˆ]ˆÝ[O^ÞÈ›ÛÚ^™NˆLKÛÛÜŽˆˆÙ˜˜™Œ‹X\™Ú[Žˆ‹LœLˆ_O‘™Y\È\™H\Ý[X]Yœ›ÛHP˜^HUH›È˜\ÚXÈY\ˆ]ÊPVWÐUWÑ‘QWÔUH
ˆL
KÑš^Y
Š_IH
ÈØÝ\œ™[˜ÞJPVWÐUWÑ’VQÓÔ‘T—Ñ‘QJ_KˆY][H™Y›Ü™H™XÛÜ™[™ÈYˆP˜^HÚÝÜÈHY™™\™[[[Ý[Ù]ŸBˆ]ˆÝ[O^ÞÈX^ZYÚˆÌÝ™\™›ÝÖNˆ˜]]È‹›Ü™\”˜Y]\Îˆ›Ü™\ŽˆŒ\ÛÛYÌŒÌ˜ÌØÈˆ_O‚ˆÚ][\Ë›X\

][JHOˆÂˆÛÛœÝˆH›ÝÜË™š[™


HOˆšYOOH][KšY
HßNÂˆÛÛœÝÜH\œÙQ›Ø]
‹œØ[TšXÙJ_Ú\H\œÙQ›Ø]
‹œÚ\[™ÔšXÙJ_™Y\ÈH\œÙQ›Ø]
‹œ]›Ü›Q™Y\Ê_ÂˆÛÛœÝ›Ùš]HÛÛ\]T›Ùš]
ÈØ[TšXÙNˆÜÛÜÝˆ][KœšXÙKÚ\[™ÎˆÚ\™Y\ÈJNÂˆ™]\›ˆ
]ˆÙ^O^Ú][KšYHÝ[O^ÞÈY[™ÎˆŒLLœ‹›Ü™\›ÝÛNˆŒ\ÛÛYÌŒÌ˜ÌØÍ‹˜XÚÙÜ›Ý[™ˆˆÌLLMÈˆ_O‚ˆ]ˆÝ[O^ÞÈ\Ü^Nˆ™›^‹\ÝYžPÛÛ[ˆœÜXÙKX™]ÙY[ˆ‹Ø\ˆX\™Ú[›ÝÛNˆÈ_O‚ˆ]ˆÝ[O^ÞÈZ[•ÚYˆ_O]ˆÝ[O^ÞÈÛÛÜŽˆˆÙMYMÙXˆ‹›ÛÚ^™NˆLË›ÛÙZYÚˆÌÝ™\™›ÝÎˆšY[ˆ‹^Ý™\™›ÝÎˆ™[\Ú\È‹Ú]TÜXÙNˆ››ÝÜ˜\ˆ_OžÚ][K›˜[Y_OÙ]Ù]‚ˆ]ˆÝ[O^ÞÈÛÛÜŽˆ›Ùš]LÈˆÌÍÎNHŽˆˆÙŽÌMÌH‹›ÛÚ^™NˆLË›ÛÙZYÚˆ_OžØÝ\œ™[˜ÞJ›Ùš]
_OÙ]‚ˆÙ]‚ˆ]ˆÝ[O^ÞÈX\™Ú[›ÝÛNˆÈ_OØ[R][RY[]H][O^Ú][_HÏÙ]‚ˆ™\ÜÛœÚ]™QÜšYÛÛ[[œÏHœ™\X]
ËZ[›X^
YœŠJHˆ[Øš[PÛÛ[[œÏHŒYœˆˆØ\^ÍŸO‚ˆšY[X™[H”Ø[HšXÙH[œ]\OH›[X™\ˆˆÝ\HŒŒHˆ˜[YO^Ü‹œØ[TšXÙ_HÛÚ[™ÙO^ÊJHOˆ\]T›ÝÊ][KšYÈØ[TšXÙNˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™Îˆœˆ_HÏÑšY[‚ˆšY[X™[H”Ú\[™È[œ]\OH›[X™\ˆˆÝ\HŒŒHˆ˜[YO^Ü‹œÚ\[™ÔšXÙ_HÛÚ[™ÙO^ÊJHOˆ\]T›ÝÊ][KšYÈÚ\[™ÔšXÙNˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™Îˆœˆ_HÏÑšY[‚ˆšY[X™[H‘™Y\È[œ]\OH›[X™\ˆˆÝ\HŒŒHˆ˜[YO^Ü‹œ]›Ü›Q™Y\ßHÛÚ[™ÙO^ÊJHOˆ\]T›ÝÊ][KšYÈ]›Ü›Q™Y\ÎˆK\™Ù]˜[YHJ_HÝ[O^ÞÈ‹‹š[œ›ÛÚ^™NˆL‹Y[™Îˆœˆ_HÏÑšY[‚ˆÔ™\ÜÛœÚ]™QÜšY‚ˆÙ]ŠNÂˆJ_BˆÙ]‚ˆ[Ù[XÝ[ÛœÏ]ÛˆÛÛXÚÏ^Ê
HOˆÙ]ÚÝÕJYJ_HÝ[O^ÙÚÜÝŸOØ[˜Ù[Ø]Û]ÛˆÛÛXÚÏ^Ê
HOˆÈYˆ
X[šXÙY
H™]\›ŽÈÛ”™XÛÜ™
˜YÈ][\ËÚ\™Y›ÝÜÈJNÈ_HÝ[O^ÞÈ‹‹œš[X\žP‹ÜXÚ]Nˆ[šXÙYÌNŒH_O”™XÛÜ™Ø[OØ]ÛÓ[Ù[XÝ[ÛœÏ‚ˆÓ[Ù[[œØ]™YX[ÙÈÜ[^ÜÚÝÕ_HÛ‘\ØØ\™^ÛÛÛÜÙ_HÛØ[˜Ù[^Ê
HOˆÙ]ÚÝÕJ˜[ÙJ_HÏÏŠNÂŸB‚™^ÜÂˆY]Ø[S[Ù[ˆÙ[[Ù[ˆ[ÑY]Ø[S[Ù[ˆ[ÔÙ[[Ù[ˆX[X[Ø[S[Ù[ˆX˜^TØ[T™]šY]Ó[Ù[ŸNÂ