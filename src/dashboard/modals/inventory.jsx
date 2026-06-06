import { useState } from "react";
import { getDefaultSize, getSizes, currency, today, inp, sel, primaryBtn, ghostBtn, cb, Modal, UnsavedDialog, Field, Row, ModalActions, ResponsiveGrid } from "../shared.jsx";

function EditInvModal({ item, onSave, onClose, categories, customers, platforms = [] }) {
  const [ef, setEf] = useState({ name: item.name, category: item.category, size: item.size || getDefaultSize(item.category), price: item.price, ebayListedPrice: item.ebayListedPrice || "", brand: item.brand || "", purchaseDate: item.purchaseDate, preorderDate: item.preorderDate || "", listedPlatforms: Array.isArray(item.listedPlatforms) ? item.listedPlatforms : [], tags: item.tags || "", customer: item.customer || "" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const listed = Array.isArray(ef.listedPlatforms) ? ef.listedPlatforms : [];
  const toggleListedPlatform = (platform, checked) => {
    const next = new Set(listed);
    checked ? next.add(platform) : next.delete(platform);
    up({ listedPlatforms: [...next] });
  };
  const gc = () => { setShowU(true); };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit item">
    <Field label="Product name" req><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field>
    <Row cols={3}><Field label="Category"><select value={ef.category} onChange={(e) => up({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Size"><select value={ef.size} onChange={(e) => up({ size: e.target.value })} style={sel}>{getSizes(ef.category).map((s) => <option key={s}>{s}</option>)}</select></Field>
    <Field label="Cost (AU$)"><input type="number" step="0.01" value={ef.price} onChange={(e) => up({ price: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Brand"><input value={ef.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field><Field label="Purchase date"><input type="date" value={ef.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Preorder date"><input type="date" value={ef.preorderDate} onChange={(e) => up({ preorderDate: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={ef.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <Field label="Listed on"><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{platforms.map((p) => <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", cursor: "pointer" }}><input type="checkbox" checked={listed.includes(p)} onChange={(e) => toggleListedPlatform(p, e.target.checked)} style={cb} /> {p}</label>)}</div></Field>
    {listed.some((p) => String(p).toLowerCase().includes("ebay")) && <Field label="eBay listed price (AU$)"><input type="number" step="0.01" value={ef.ebayListedPrice || ""} onChange={(e) => up({ ebayListedPrice: e.target.value })} style={inp} placeholder="Current eBay listing price" /></Field>}
    <Field label="Customer"><input list="cust-list" value={ef.customer} onChange={(e) => up({ customer: e.target.value })} style={inp} placeholder="Optional" /><datalist id="cust-list">{customers.map((c) => <option key={c} value={c} />)}</datalist></Field>
    <ModalActions marginTop={10}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...ef, price: parseFloat(ef.price), ebayListedPrice: ef.ebayListedPrice ? parseFloat(ef.ebayListedPrice) : undefined })} style={primaryBtn}>Save</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Bulk Edit Inventory Modal ───

function BulkEditModal({ items, onSave, onClose, categories, platforms = [] }) {
  const [nameSet, setNameSet] = useState("");
  const [titleFind, setTitleFind] = useState("");
  const [titleReplace, setTitleReplace] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [titleSuffix, setTitleSuffix] = useState("");
  const [cat, setCat] = useState("");
  const [size, setSize] = useState("");
  const [cost, setCost] = useState("");
  const [brand, setBrand] = useState("");
  const [clearBrand, setClearBrand] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [preorderDate, setPreorderDate] = useState("");
  const [clearPreorderDate, setClearPreorderDate] = useState(false);
  const [customer, setCustomer] = useState("");
  const [clearCustomer, setClearCustomer] = useState(false);
  const [setTags, setSetTags] = useState("");
  const [addTags, setAddTags] = useState("");
  const [clearTags, setClearTags] = useState(false);
  const [ebayListedPrice, setEbayListedPrice] = useState("");
  const [clearEbayListedPrice, setClearEbayListedPrice] = useState(false);
  const [addListedPlatform, setAddListedPlatform] = useState("");
  const [clearListingPlatforms, setClearListingPlatforms] = useState(false);
  const [showU, setShowU] = useState(false);
  const sizes = cat ? getSizes(cat) : [...new Set(items.flatMap((item) => getSizes(item.category || "")))];
  const totalValue = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  const productCount = new Set(items.map((item) => String(item.name || "").trim().toLowerCase()).filter(Boolean)).size;
  const listedCount = items.filter((item) => Array.isArray(item.listedPlatforms) && item.listedPlatforms.length > 0).length;
  const withEbayPrice = items.filter((item) => item.ebayListedPrice !== undefined && item.ebayListedPrice !== "").length;
  const summarize = (values, empty = "Mixed") => {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return empty;
    const extra = counts.size - top.length;
    return `${top.map(([value, count]) => `${value} (${count})`).join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
  };
  const summaryRows = [
    ["Units", items.length],
    ["Products", productCount],
    ["Value", currency(totalValue)],
    ["Categories", summarize(items.map((item) => item.category), "None")],
    ["Brands", summarize(items.map((item) => item.brand), "None")],
    ["Listed", `${listedCount} units`],
    ["eBay price", `${withEbayPrice} units`],
  ];
  const previewNames = [...new Set(items.map((item) => item.name).filter(Boolean))].slice(0, 5);
  const hasDraft = [nameSet, titleFind, titleReplace, titlePrefix, titleSuffix, cat, size, cost, brand, purchaseDate, preorderDate, customer, setTags, addTags, ebayListedPrice, addListedPlatform].some((value) => String(value || "").length > 0) || clearBrand || clearPreorderDate || clearCustomer || clearTags || clearEbayListedPrice || clearListingPlatforms;
  const requestClose = () => { if (hasDraft) setShowU(true); else onClose(); };
  const apply = () => {
    const updates = {};
    if (nameSet.trim()) updates.nameSet = nameSet.trim();
    if (titleFind) updates.titleFind = titleFind;
    if (titleReplace) updates.titleReplace = titleReplace;
    if (titlePrefix) updates.titlePrefix = titlePrefix;
    if (titleSuffix) updates.titleSuffix = titleSuffix;
    if (cat) updates.category = cat;
    if (size) updates.size = size;
    if (cost !== "") updates.price = parseFloat(cost);
    if (clearBrand) updates.brand = "";
    else if (brand) updates.brand = brand;
    if (purchaseDate) updates.purchaseDate = purchaseDate;
    if (clearPreorderDate) updates.preorderDate = "";
    else if (preorderDate) updates.preorderDate = preorderDate;
    if (clearCustomer) updates.customer = "";
    else if (customer) updates.customer = customer;
    if (clearTags) updates.clearTags = true;
    if (setTags) updates.setTags = setTags;
    if (addTags) updates.addTags = addTags;
    if (clearEbayListedPrice) updates.ebayListedPrice = undefined;
    else if (ebayListedPrice !== "") updates.ebayListedPrice = parseFloat(ebayListedPrice);
    if (addListedPlatform) updates.addListedPlatform = addListedPlatform;
    if (clearListingPlatforms) updates.clearListingPlatforms = true;
    onSave(updates);
  };
  return (<><Modal open={true} onClose={onClose} guardedClose={requestClose} title={`Bulk edit ${items.length} items`} maxWidth={980}>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 560px", minWidth: 0 }}>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave fields blank to keep current values.</p>
    <Field label="Set product title"><input value={nameSet} onChange={(e) => setNameSet(e.target.value)} style={inp} placeholder="Same title for all selected" /></Field>
    <Row><Field label="Find in title"><input value={titleFind} onChange={(e) => setTitleFind(e.target.value)} style={inp} placeholder="Text to replace" /></Field>
    <Field label="Replace with"><input value={titleReplace} onChange={(e) => setTitleReplace(e.target.value)} style={inp} placeholder="Replacement text" /></Field></Row>
    <Row><Field label="Title prefix"><input value={titlePrefix} onChange={(e) => setTitlePrefix(e.target.value)} style={inp} placeholder="Add before title" /></Field>
    <Field label="Title suffix"><input value={titleSuffix} onChange={(e) => setTitleSuffix(e.target.value)} style={inp} placeholder="Add after title" /></Field></Row>
    <Row cols={3}><Field label="Category"><select value={cat} onChange={(e) => { setCat(e.target.value); setSize(""); }} style={sel}><option value="">No change</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Size"><select value={size} onChange={(e) => setSize(e.target.value)} style={sel}><option value="">No change</option>{sizes.map((s) => <option key={s}>{s}</option>)}</select></Field>
    <Field label="Cost (AU$)"><input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} style={inp} placeholder="No change" /></Field></Row>
    <Row><Field label="Brand"><input value={brand} onChange={(e) => { setBrand(e.target.value); if (e.target.value) setClearBrand(false); }} style={inp} placeholder="No change" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearBrand} onChange={(e) => { setClearBrand(e.target.checked); if (e.target.checked) setBrand(""); }} style={cb} /> Clear brand</label></Field></Row>
    <Row cols={3}><Field label="Purchase date"><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} style={inp} /></Field>
    <Field label="Preorder date"><input type="date" value={preorderDate} onChange={(e) => { setPreorderDate(e.target.value); if (e.target.value) setClearPreorderDate(false); }} style={inp} /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearPreorderDate} onChange={(e) => { setClearPreorderDate(e.target.checked); if (e.target.checked) setPreorderDate(""); }} style={cb} /> Clear preorder</label></Field></Row>
    <Row><Field label="Customer"><input value={customer} onChange={(e) => { setCustomer(e.target.value); if (e.target.value) setClearCustomer(false); }} style={inp} placeholder="No change" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearCustomer} onChange={(e) => { setClearCustomer(e.target.checked); if (e.target.checked) setCustomer(""); }} style={cb} /> Clear customer</label></Field></Row>
    <Row cols={3}><Field label="Set tags"><input value={setTags} onChange={(e) => { setSetTags(e.target.value); if (e.target.value) setClearTags(false); }} style={inp} placeholder="Replace tags" /></Field>
    <Field label="Add tags"><input value={addTags} onChange={(e) => setAddTags(e.target.value)} style={inp} placeholder="Append tags" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearTags} onChange={(e) => { setClearTags(e.target.checked); if (e.target.checked) setSetTags(""); }} style={cb} /> Clear tags</label></Field></Row>
    <Row><Field label="Add listed platform"><select value={addListedPlatform} onChange={(e) => setAddListedPlatform(e.target.value)} style={sel}><option value="">No change</option>{platforms.map((p) => <option key={p}>{p}</option>)}</select></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearListingPlatforms} onChange={(e) => setClearListingPlatforms(e.target.checked)} style={cb} /> Clear listed platforms</label></Field></Row>
    <Row><Field label="eBay listed price (AU$)"><input type="number" step="0.01" value={ebayListedPrice} onChange={(e) => { setEbayListedPrice(e.target.value); if (e.target.value) setClearEbayListedPrice(false); }} style={inp} placeholder="No change" /></Field>
    <Field label=" "><label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", paddingTop: 8 }}><input type="checkbox" checked={clearEbayListedPrice} onChange={(e) => { setClearEbayListedPrice(e.target.checked); if (e.target.checked) setEbayListedPrice(""); }} style={cb} /> Clear listed price</label></Field></Row>
    <ModalActions marginTop={10}><button onClick={requestClose} style={ghostBtn}>Cancel</button>
    <button onClick={apply} style={primaryBtn}>Apply to {items.length} items</button></ModalActions>
      </div>
      <aside style={{ flex: "0 1 240px", position: "sticky", top: 0, background: "#0d1117", border: "1px solid #232c3c", borderRadius: 10, padding: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.25)" }}>
        <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Selection summary</div>
        <div style={{ display: "grid", gap: 8 }}>
          {summaryRows.map(([label, value]) => (
            <ResponsiveGrid key={label} columns="76px 1fr" mobileColumns="1fr" gap={8} style={{ alignItems: "baseline" }}>
              <span style={{ color: "#56627a", fontSize: 11 }}>{label}</span>
              <span style={{ color: "#d1d5db", fontSize: 12, fontWeight: 650, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
            </ResponsiveGrid>
          ))}
        </div>
        {previewNames.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #232c3c" }}>
            <div style={{ color: "#56627a", fontSize: 11, marginBottom: 6 }}>Titles</div>
            <div style={{ display: "grid", gap: 5 }}>
              {previewNames.map((name) => <div key={name} title={name} style={{ color: "#9ca3af", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>)}
              {productCount > previewNames.length && <div style={{ color: "#56627a", fontSize: 11 }}>+{productCount - previewNames.length} more</div>}
            </div>
          </div>
        )}
      </aside>
    </div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Gmail Inventory Review Modal ───

function GmailInventoryReviewModal({ draft, categories, onAdd, onClose }) {
  const defaultCat = categories.includes("Collectables") ? "Collectables" : (categories[0] || "Other");
  const [form, setForm] = useState({
    name: draft.item_title || "",
    category: defaultCat,
    size: getDefaultSize(defaultCat),
    price: draft.unit_cost || draft.total_cost || "",
    quantity: Math.max(1, Number(draft.quantity || 1)),
    purchaseDate: draft.email_date || today(),
    preorderDate: draft.preorder_date || "",
    brand: draft.vendor || "",
    tags: draft.order_reference ? `Gmail ${draft.order_reference}` : "Gmail import",
    customer: "",
  });
  const [showU, setShowU] = useState(false);
  const up = (u) => setForm({ ...form, ...u });
  const total = (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 1);

  return (<><Modal open={true} onClose={onClose} guardedClose={() => setShowU(true)} title="Review Gmail Inventory" maxWidth={720}>
    <div style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14 }}>
      <div style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{draft.subject || draft.item_title}</div>
      <div style={{ color: "#7c8aa0", fontSize: 11 }}>{draft.sender || "Unknown sender"} · {draft.email_date || "No date"}</div>
    </div>
    <Field label="Product name" req><input value={form.name} onChange={(e) => up({ name: e.target.value })} style={inp} autoFocus /></Field>
    <Row cols={3}><Field label="Category"><select value={form.category} onChange={(e) => up({ category: e.target.value, size: getDefaultSize(e.target.value) })} style={sel}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Size"><select value={form.size} onChange={(e) => up({ size: e.target.value })} style={sel}>{getSizes(form.category).map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Unit cost"><input type="number" step="0.01" value={form.price} onChange={(e) => up({ price: e.target.value })} style={inp} /></Field></Row>
    <Row cols={3}><Field label="Quantity"><input type="number" min="1" value={form.quantity} onChange={(e) => up({ quantity: e.target.value })} style={inp} /></Field><Field label="Purchase date"><input type="date" value={form.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field><Field label="Preorder date"><input type="date" value={form.preorderDate} onChange={(e) => up({ preorderDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Brand / vendor"><input value={form.brand} onChange={(e) => up({ brand: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={form.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row>
    <ResponsiveGrid columns="repeat(3, minmax(0, 1fr))" mobileColumns="repeat(3, minmax(0, 1fr))" gap={8} style={{ background: "#0d1117", borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12 }}>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Source</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{draft.vendor || "Gmail"}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Quantity</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{form.quantity || 1}</div></div>
      <div><div style={{ color: "#56627a", marginBottom: 2 }}>Total cost</div><div style={{ color: "#f3f6fb", fontWeight: 700 }}>{currency(total)}</div></div>
    </ResponsiveGrid>
    <ModalActions marginTop={0}><button onClick={() => setShowU(true)} style={ghostBtn}>Cancel</button><button onClick={() => { if (!form.name || !form.price) return; onAdd(draft, form); }} style={primaryBtn}>Add Inventory</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

export {
  EditInvModal,
  BulkEditModal,
  GmailInventoryReviewModal
};
