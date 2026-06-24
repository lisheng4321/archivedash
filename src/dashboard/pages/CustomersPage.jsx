import { useMemo, useState } from "react";
import CustomerMarketingPanel from "../components/CustomerMarketingPanel.jsx";
import { accentTextBtn, currency, dangerQuietBtn, ghostBtn, inp, KPI, primaryBtn, sel, SortHeader } from "../shared.jsx";

const PLATFORM_FILTERS = ["All", "eBay", "Facebook", "Discord", "Other"];

export default function CustomersPage({ ctx }) {
  const {
    pagePad,
    isMobile,
    customerRows,
    customerSearch,
    setCustomerSearch,
    customerPlatform,
    setCustomerPlatform,
    customerSort,
    setCustomerSort,
    activeCustomerKey,
    setActiveCustomerKey,
    updateCustomerProfile,
    addCustomer,
    removeCustomer,
    setAddSaleOpen,
    settings,
    persistSettings,
  } = ctx;

  const [addOpen, setAddOpen] = useState(false);
  const [customerBrand, setCustomerBrand] = useState("All");
  const [customerProductType, setCustomerProductType] = useState("All");
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState(new Set());
  const [marketingOpen, setMarketingOpen] = useState(false);
  const options = useMemo(() => ({
    brands: [...new Set(customerRows.flatMap((customer) => customer.brandsList || []))].sort(),
    productTypes: [...new Set(customerRows.flatMap((customer) => customer.productTypesList || []))].sort(),
  }), [customerRows]);
  const visibleCustomers = useMemo(() => customerRows.filter((customer) => (
    (customerBrand === "All" || customer.brandsList.includes(customerBrand))
    && (customerProductType === "All" || customer.productTypesList.includes(customerProductType))
  )), [customerRows, customerBrand, customerProductType]);
  const active = visibleCustomers.find((c) => c.key === activeCustomerKey) || visibleCustomers[0] || null;
  const repeatCustomers = visibleCustomers.filter((c) => c.orderCount > 1).length;
  const totalRevenue = visibleCustomers.reduce((a, c) => a + c.revenue, 0);
  const totalProfit = visibleCustomers.reduce((a, c) => a + c.profit, 0);
  const filtersActive = customerSearch || customerPlatform !== "All" || customerBrand !== "All" || customerProductType !== "All" || customerSort !== "profit_desc";
  const filterState = { search: customerSearch, platform: customerPlatform, brand: customerBrand, productType: customerProductType, sort: customerSort };
  const applyFilters = (filters = {}) => {
    setCustomerSearch(filters.search || "");
    setCustomerPlatform(filters.platform || "All");
    setCustomerBrand(filters.brand || "All");
    setCustomerProductType(filters.productType || "All");
    setCustomerSort(filters.sort || "profit_desc");
  };
  const clearFilters = () => applyFilters({});
  const allVisibleSelected = visibleCustomers.length > 0 && visibleCustomers.every((customer) => selectedCustomerKeys.has(customer.key));
  const toggleCustomer = (key) => setSelectedCustomerKeys((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const toggleVisible = () => setSelectedCustomerKeys((current) => {
    const next = new Set(current);
    if (allVisibleSelected) visibleCustomers.forEach((customer) => next.delete(customer.key));
    else visibleCustomers.forEach((customer) => next.add(customer.key));
    return next;
  });

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Customers</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>{visibleCustomers.length} customers - {repeatCustomers} repeat - {currency(totalRevenue)} revenue</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setMarketingOpen((value) => !value)} style={{ ...ghostBtn, color: "#93c5fd", borderColor: "#2563eb66" }}>Buyer marketing{selectedCustomerKeys.size ? ` (${selectedCustomerKeys.size})` : ""}</button>
          <button onClick={() => setAddOpen(true)} style={ghostBtn}>+ Add Customer</button>
          <button onClick={() => setAddSaleOpen(true)} style={primaryBtn}>+ Record Sale</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        <KPI label="Customers" value={visibleCustomers.length} />
        <KPI label="Repeat buyers" value={repeatCustomers} accent={repeatCustomers ? "#60a5fa" : undefined} />
        <KPI label="Customer revenue" value={currency(totalRevenue)} />
        <KPI label="Customer profit" value={currency(totalProfit)} accent={totalProfit >= 0 ? "#34d399" : "#f87171"} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="Search customer, email, phone, address..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} style={{ ...inp, maxWidth: 280 }} />
        <div style={{ display: "flex", gap: 3, background: "#121a2b", borderRadius: 8, padding: 3, border: "1px solid #232c3c", flexWrap: "wrap" }}>
          {PLATFORM_FILTERS.map((p) => (
            <button key={p} onClick={() => setCustomerPlatform(p)} style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "none", cursor: "pointer", background: customerPlatform === p ? "#2563eb" : "transparent", color: customerPlatform === p ? "#fff" : "#9ca3af", fontFamily: "inherit" }}>{p}</button>
          ))}
        </div>
        <FilterSelect label="Brand" value={customerBrand} onChange={setCustomerBrand} options={options.brands} />
        <FilterSelect label="Product type" value={customerProductType} onChange={setCustomerProductType} options={options.productTypes} />
        {isMobile && <select aria-label="Sort customers" value={customerSort} onChange={(e) => setCustomerSort(e.target.value)} style={{ ...sel, maxWidth: 150 }}>
          <option value="profit_desc">Profit down</option>
          <option value="profit_asc">Profit up</option>
          <option value="revenue_desc">Revenue down</option>
          <option value="revenue_asc">Revenue up</option>
          <option value="orders_desc">Orders down</option>
          <option value="orders_asc">Orders up</option>
          <option value="last_desc">Last purchase down</option>
          <option value="last_asc">Last purchase up</option>
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
        </select>}
        {filtersActive && <button onClick={clearFilters} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Clear</button>}
        <button onClick={toggleVisible} disabled={!visibleCustomers.length} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12, opacity: visibleCustomers.length ? 1 : 0.45 }}>{allVisibleSelected ? "Clear visible" : "Select visible"}</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#8b97ad" }}>{visibleCustomers.length} shown · {selectedCustomerKeys.size} selected</span>
      </div>

      <CustomerMarketingPanel isMobile={isMobile} open={marketingOpen} setOpen={setMarketingOpen} customers={customerRows} selectedKeys={selectedCustomerKeys} setSelectedKeys={setSelectedCustomerKeys} filters={filterState} applyFilters={applyFilters} settings={settings} persistSettings={persistSettings} />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(520px, 1.1fr) minmax(360px, 0.9fr)", gap: 14 }}>
        <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, overflow: "hidden" }}>
          {!isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: "28px 1.4fr 0.8fr 70px 95px 95px 95px", gap: 8, padding: "10px 16px", fontSize: 11, color: "#8b97ad", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1px solid #232c3c", fontWeight: 700 }}>
              <input aria-label="Select all visible customers" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /><SortHeader field="name" label="Customer" sort={customerSort} setSort={setCustomerSort} /><span>Platform</span><SortHeader field="orders" label="Orders" sort={customerSort} setSort={setCustomerSort} align="right" /><SortHeader field="revenue" label="Revenue" sort={customerSort} setSort={setCustomerSort} align="right" /><SortHeader field="profit" label="Profit" sort={customerSort} setSort={setCustomerSort} align="right" /><SortHeader field="last" label="Last" sort={customerSort} setSort={setCustomerSort} />
            </div>
          )}
          {visibleCustomers.length === 0 ? (
            <div style={{ padding: 36, textAlign: "center", color: "#8b97ad", fontSize: 13 }}>{filtersActive ? "No customers match these filters." : "No customers yet"}{filtersActive && <button onClick={clearFilters} style={{ ...ghostBtn, display: "block", margin: "10px auto 0", padding: "5px 12px", fontSize: 11 }}>Clear filters</button>}</div>
          ) : visibleCustomers.map((customer, idx) => (
            <CustomerRow key={customer.key} customer={customer} active={active?.key === customer.key} selected={selectedCustomerKeys.has(customer.key)} onToggle={() => toggleCustomer(customer.key)} index={idx} isMobile={isMobile} onClick={() => setActiveCustomerKey(customer.key)} />
          ))}
        </div>

        <CustomerDetail customer={active} isMobile={isMobile} updateCustomerProfile={updateCustomerProfile} removeCustomer={removeCustomer} setActiveCustomerKey={setActiveCustomerKey} setAddSaleOpen={setAddSaleOpen} />
      </div>

      {addOpen && <AddCustomerModal onClose={() => setAddOpen(false)} onSave={async (profile) => { const key = await addCustomer(profile.name, profile); setActiveCustomerKey(key); setAddOpen(false); }} />}
    </div>
  );
}

function CustomerRow({ customer, active, selected, onToggle, index, isMobile, onClick }) {
  const bg = active ? "#1e293b" : index % 2 === 0 ? "#0d131f" : "#121a2b";
  const platforms = customer.platformGroupsList.length ? customer.platformGroupsList.join(", ") : customer.defaultPlatform;
  if (isMobile) {
    return (
      <div onClick={onClick} style={{ padding: "11px 12px", background: bg, borderBottom: "1px solid #232c3c22", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input aria-label={`Select ${customer.name}`} type="checkbox" checked={selected} onChange={onToggle} onClick={(event) => event.stopPropagation()} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
          <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</span>
          <span style={{ color: customer.profit >= 0 ? "#34d399" : "#f87171", fontSize: 12, fontWeight: 700 }}>{currency(customer.profit)}</span>
        </div>
        <div style={{ color: "#7c8aa0", fontSize: 11 }}>{platforms} - {customer.orderCount} orders - {customer.lastPurchase || "No sales"}</div>
        <div style={{ color: "#64748b", fontSize: 10, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[...customer.brandsList, ...customer.productTypesList].slice(0, 4).join(" · ") || "No interests inferred"}</div>
        </div>
      </div>
    );
  }
  return (
    <div onClick={onClick} style={{ display: "grid", gridTemplateColumns: "28px 1.4fr 0.8fr 70px 95px 95px 95px", gap: 8, padding: "11px 16px", alignItems: "center", fontSize: 13, background: bg, borderBottom: "1px solid #232c3c11", cursor: "pointer" }}>
      <input aria-label={`Select ${customer.name}`} type="checkbox" checked={selected} onChange={onToggle} onClick={(event) => event.stopPropagation()} />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#e5e7eb", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.name}</div>
        <div style={{ color: "#8b97ad", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{customer.profile.email || customer.profile.phone || customer.profile.tags || "No contact saved"}</div>
      </div>
      <span style={{ color: "#93c5fd", fontSize: 12 }}>{platforms}</span>
      <span style={{ color: "#9ca3af", fontSize: 12, textAlign: "right" }}>{customer.orderCount}</span>
      <span style={{ color: "#f3f6fb", fontWeight: 700, textAlign: "right" }}>{currency(customer.revenue)}</span>
      <span style={{ color: customer.profit >= 0 ? "#34d399" : "#f87171", fontWeight: 700, textAlign: "right" }}>{currency(customer.profit)}</span>
      <span style={{ color: "#7c8aa0", fontSize: 12 }}>{customer.lastPurchase || "-"}</span>
    </div>
  );
}

function CustomerDetail({ customer, isMobile, updateCustomerProfile, removeCustomer, setActiveCustomerKey, setAddSaleOpen }) {
  if (!customer) {
    return <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 24, color: "#374151", fontSize: 13, textAlign: "center" }}>Select a customer</div>;
  }
  const p = customer.profile || {};
  const update = (field, value) => updateCustomerProfile(customer.key, { [field]: value });
  return (
    <div style={{ background: "#121a2b", border: "1px solid #232c3c", borderRadius: 12, padding: 16, alignSelf: "start", position: isMobile ? "static" : "sticky", top: 46 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#f3f6fb", fontSize: 16, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || customer.name}</div>
        <div style={{ color: "#7c8aa0", fontSize: 12 }}>{customer.orderCount} orders - {currency(customer.averageOrder)} avg order{p.contactSource ? ` - ${p.contactSource}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setAddSaleOpen(true)} style={{ ...accentTextBtn, padding: "7px 10px", fontSize: 12 }}>Record Sale</button>
          <button onClick={async () => { if (window.confirm(`Remove ${p.name || customer.name} from saved customers? Sales history will stay intact.`)) { await removeCustomer(customer.key); setActiveCustomerKey(null); } }} style={{ ...dangerQuietBtn, padding: "7px 10px", fontSize: 12 }}>Remove</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Mini label="Revenue" value={currency(customer.revenue)} />
        <Mini label="Profit" value={currency(customer.profit)} color={customer.profit >= 0 ? "#34d399" : "#f87171"} />
        <Mini label="Last purchase" value={customer.lastPurchase || "-"} />
        <Mini label="Platforms" value={customer.platformGroupsList.join(", ") || customer.defaultPlatform} />
      </div>

      <Section title="Profile">
        <Field label="Display name"><input value={p.name || customer.name} onChange={(e) => update("name", e.target.value)} style={inp} /></Field>
        <Field label="Default platform"><select value={p.defaultPlatform || customer.defaultPlatform || "Other"} onChange={(e) => update("defaultPlatform", e.target.value)} style={sel}>{PLATFORM_FILTERS.filter((x) => x !== "All").map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Tags"><input value={p.tags || ""} onChange={(e) => update("tags", e.target.value)} style={inp} placeholder="repeat buyer, preorder, VIP..." /></Field>
      </Section>

      <Section title="Buyer interests">
        <div style={{ color: "#7c8aa0", fontSize: 11, lineHeight: 1.45, marginBottom: 9 }}>Interests are inferred from linked sales. Add comma-separated values below to correct or expand them.</div>
        <Field label="Brands / franchises"><input value={p.brands || ""} onChange={(e) => update("brands", e.target.value)} style={inp} placeholder="Pokémon TCG, Nike..." /></Field>
        <Field label="Product types"><input value={p.productTypes || ""} onChange={(e) => update("productTypes", e.target.value)} style={inp} placeholder="TCG sealed, Sneakers..." /></Field>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {[...customer.brandsList, ...customer.productTypesList].map((interest) => <span key={interest} style={{ background: "#0d1f33", border: "1px solid #1d4ed866", color: "#93c5fd", borderRadius: 999, padding: "3px 7px", fontSize: 10, fontWeight: 700 }}>{interest}</span>)}
        </div>
      </Section>

      <Section title="Contact">
        <Field label="Company"><input value={p.companyName || ""} onChange={(e) => update("companyName", e.target.value)} style={inp} placeholder="Company / shipping partner" /></Field>
        <Field label="Email"><input value={p.email || ""} onChange={(e) => update("email", e.target.value)} style={inp} placeholder="buyer@email.com" /></Field>
        <Field label="Phone"><input value={p.phone || ""} onChange={(e) => update("phone", e.target.value)} style={inp} placeholder="Phone number" /></Field>
        <Field label="Address"><textarea value={p.address || ""} onChange={(e) => update("address", e.target.value)} style={{ ...inp, minHeight: 72, resize: "vertical" }} placeholder="Shipping/contact address" /></Field>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
          <Field label="Suburb / city"><input value={p.city || ""} onChange={(e) => update("city", e.target.value)} style={inp} /></Field>
          <Field label="State"><input value={p.state || ""} onChange={(e) => update("state", e.target.value)} style={inp} /></Field>
          <Field label="Postcode"><input value={p.postcode || ""} onChange={(e) => update("postcode", e.target.value)} style={inp} /></Field>
          <Field label="Country"><input value={p.country || ""} onChange={(e) => update("country", e.target.value)} style={inp} /></Field>
        </div>
      </Section>

      <Section title="Platform IDs">
        <Field label="eBay username"><input value={p.ebayUsername || ""} onChange={(e) => update("ebayUsername", e.target.value)} style={inp} /></Field>
        <Field label="eBay buyer ID"><input value={p.ebayBuyerId || ""} onChange={(e) => update("ebayBuyerId", e.target.value)} style={inp} /></Field>
        <Field label="Facebook name"><input value={p.facebookName || ""} onChange={(e) => update("facebookName", e.target.value)} style={inp} /></Field>
        <Field label="Discord handle"><input value={p.discordHandle || ""} onChange={(e) => update("discordHandle", e.target.value)} style={inp} /></Field>
      </Section>

      <Section title="eBay Fulfillment">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
          <Field label="Carrier"><input value={p.shippingCarrier || ""} onChange={(e) => update("shippingCarrier", e.target.value)} style={inp} /></Field>
          <Field label="Service"><input value={p.shippingService || ""} onChange={(e) => update("shippingService", e.target.value)} style={inp} /></Field>
          <Field label="Reference ID"><input value={p.shipToReferenceId || ""} onChange={(e) => update("shipToReferenceId", e.target.value)} style={inp} /></Field>
          <Field label="Last order"><input value={p.lastEbayOrderId || ""} onChange={(e) => update("lastEbayOrderId", e.target.value)} style={inp} /></Field>
        </div>
      </Section>

      <Section title="Notes">
        <textarea value={p.notes || ""} onChange={(e) => update("notes", e.target.value)} style={{ ...inp, minHeight: 84, resize: "vertical" }} placeholder="Preferences, delivery quirks, repeat order notes..." />
      </Section>

      <Section title="Outreach">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
          <Field label="Status"><select value={p.outreachStatus || "planned"} onChange={(e) => update("outreachStatus", e.target.value)} style={sel}><option value="planned">Planned</option><option value="contacted">Contacted</option><option value="replied">Replied</option><option value="purchased">Purchased</option></select></Field>
          <Field label="Last campaign quantity"><input type="number" min="1" value={p.lastCampaignQuantity || 1} onChange={(e) => update("lastCampaignQuantity", Math.max(1, Number(e.target.value) || 1))} style={inp} /></Field>
        </div>
        <div style={{ color: "#7c8aa0", fontSize: 11 }}>{p.lastContactedAt ? `Last contacted ${new Date(p.lastContactedAt).toLocaleString("en-AU")}` : "No outreach recorded yet"}</div>
      </Section>

      <Section title="Sales History">
        {customer.sales.length === 0 ? (
          <div style={{ color: "#374151", fontSize: 13, textAlign: "center", padding: 14 }}>No linked sales yet</div>
        ) : customer.sales.slice(0, 8).map((sale) => (
          <div key={sale.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 0", borderTop: "1px solid #232c3c22" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#e5e7eb", fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sale.name}</div>
              <div style={{ color: "#8b97ad", fontSize: 11 }}>{sale.platform} - {sale.saleDate}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ color: "#f3f6fb", fontSize: 12, fontWeight: 700 }}>{currency(sale.salePrice)}</div>
              <div style={{ color: sale.profit >= 0 ? "#34d399" : "#f87171", fontSize: 11 }}>{currency(sale.profit)}</div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 10 }}><div style={{ color: "#9ca3af", fontSize: 11, fontWeight: 650, marginBottom: 4 }}>{label}</div>{children}</div>;
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select aria-label={`Filter customers by ${label.toLowerCase()}`} value={value} onChange={(event) => onChange(event.target.value)} style={{ ...sel, maxWidth: 170 }}>
      <option value="All">All {label.toLowerCase()}s</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function Section({ title, children }) {
  return <div style={{ borderTop: "1px solid #232c3c", paddingTop: 12, marginTop: 12 }}><div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800, marginBottom: 9 }}>{title}</div>{children}</div>;
}

function Mini({ label, value, color }) {
  return <div style={{ background: "#0d1117", borderRadius: 8, padding: "9px 10px", minWidth: 0 }}><div style={{ color: "#8b97ad", fontSize: 11, marginBottom: 2 }}>{label}</div><div style={{ color: color || "#f3f6fb", fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div></div>;
}

function AddCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: "", defaultPlatform: "eBay", email: "", phone: "", address: "", notes: "" });
  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const canSave = form.name.trim();
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.68)", zIndex: 220, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 520, background: "#121a2b", border: "1px solid #253047", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid #232c3c", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#f3f6fb", fontSize: 16, fontWeight: 800 }}>Add Customer</div>
          <button onClick={onClose} style={{ ...ghostBtn, padding: "6px 10px" }}>Close</button>
        </div>
        <div style={{ padding: 18 }}>
          <Field label="Name"><input value={form.name} onChange={(e) => set("name", e.target.value)} style={inp} autoFocus /></Field>
          <Field label="Default platform"><select value={form.defaultPlatform} onChange={(e) => set("defaultPlatform", e.target.value)} style={sel}>{PLATFORM_FILTERS.filter((x) => x !== "All").map((x) => <option key={x}>{x}</option>)}</select></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Field label="Email"><input value={form.email} onChange={(e) => set("email", e.target.value)} style={inp} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} style={inp} /></Field>
          </div>
          <Field label="Address"><textarea value={form.address} onChange={(e) => set("address", e.target.value)} style={{ ...inp, minHeight: 74, resize: "vertical" }} /></Field>
          <Field label="Notes"><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} style={{ ...inp, minHeight: 74, resize: "vertical" }} /></Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={ghostBtn}>Cancel</button>
            <button onClick={() => canSave && onSave(form)} disabled={!canSave} style={{ ...primaryBtn, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed" }}>Save Customer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
