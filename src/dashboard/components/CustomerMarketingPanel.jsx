import { useMemo, useState } from "react";
import { ghostBtn, inp, primaryBtn, sel } from "../shared.jsx";

const DEFAULT_CAMPAIGN = {
  name: "Astral Radiance buyer outreach",
  product: "Astral Radiance booster boxes",
  unitPrice: "550",
  stock: "9",
  defaultQuantity: "1",
  shippingIncluded: true,
  bundlesAllowed: true,
  reserveStock: true,
  subject: "Astral Radiance booster boxes available",
  message: "Hi {{name}}, I have {{product}} available for AU${{price}} each, with shipping included. I currently have {{stock}} available and can do bundles if you would like more than one. Let me know if you're interested.",
};

const contactFor = (customer) => customer.profile.email
  || customer.profile.ebayUsername
  || customer.profile.ebayBuyerId
  || customer.profile.facebookName
  || customer.profile.discordHandle
  || customer.profile.phone
  || "No contact saved";

const personalize = (template, customer, form) => String(template || "")
  .replaceAll("{{name}}", customer?.name || "there")
  .replaceAll("{{product}}", form.product || "this item")
  .replaceAll("{{price}}", Number(form.unitPrice || 0).toLocaleString("en-AU"))
  .replaceAll("{{stock}}", String(form.stock || 0));

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const downloadCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function CustomerMarketingPanel({
  isMobile,
  open,
  setOpen,
  customers,
  selectedKeys,
  setSelectedKeys,
  filters,
  applyFilters,
  settings,
  persistSettings,
}) {
  const [form, setForm] = useState(DEFAULT_CAMPAIGN);
  const [audienceName, setAudienceName] = useState("Pokémon buyers");
  const [activeCampaignId, setActiveCampaignId] = useState("");
  const [notice, setNotice] = useState("");
  const selected = useMemo(() => customers.filter((customer) => selectedKeys.has(customer.key)), [customers, selectedKeys]);
  const audiences = settings.marketingAudiences || [];
  const campaigns = settings.marketingCampaigns || [];
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) || null;
  const quantity = Math.max(1, Number(form.defaultQuantity) || 1);
  const stock = Math.max(0, Number(form.stock) || 0);
  const requestedUnits = selected.length * quantity;
  const reservedUnits = form.reserveStock ? Math.min(stock, requestedUnits) : 0;
  const statusCounts = activeCampaign ? Object.values(activeCampaign.statusByCustomer || {}).reduce((counts, entry) => {
    const status = entry.status || "planned";
    counts[status] = (counts[status] || 0) + 1;
    if (status === "purchased") counts.unitsSold += Number(entry.quantity) || 1;
    return counts;
  }, { planned: 0, contacted: 0, replied: 0, purchased: 0, unitsSold: 0 }) : null;

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const saveAudience = async () => {
    if (!audienceName.trim() || selected.length === 0) return;
    const audience = {
      id: `audience-${Date.now()}`,
      name: audienceName.trim(),
      filters,
      customerKeys: selected.map((customer) => customer.key),
      createdAt: new Date().toISOString(),
    };
    await persistSettings({ ...settings, marketingAudiences: [audience, ...audiences] });
    setNotice(`Saved audience: ${audience.name}`);
  };

  const loadAudience = (audience) => {
    applyFilters(audience.filters || {});
    setSelectedKeys(new Set(audience.customerKeys || []));
    setNotice(`Loaded ${audience.name}`);
  };

  const removeAudience = async (id) => {
    await persistSettings({ ...settings, marketingAudiences: audiences.filter((audience) => audience.id !== id) });
  };

  const saveCampaign = async () => {
    if (!form.name.trim() || !form.product.trim() || selected.length === 0) return;
    const now = new Date().toISOString();
    const previous = activeCampaign;
    const statusByCustomer = {};
    selected.forEach((customer) => {
      statusByCustomer[customer.key] = previous?.statusByCustomer?.[customer.key] || { status: "planned", quantity };
    });
    const campaign = {
      ...(previous || {}),
      ...form,
      id: previous?.id || `campaign-${Date.now()}`,
      customerKeys: selected.map((customer) => customer.key),
      statusByCustomer,
      reservedUnits,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };
    const nextCampaigns = previous
      ? campaigns.map((item) => item.id === previous.id ? campaign : item)
      : [campaign, ...campaigns];
    await persistSettings({ ...settings, marketingCampaigns: nextCampaigns });
    setActiveCampaignId(campaign.id);
    setNotice(`${previous ? "Updated" : "Saved"} campaign: ${campaign.name}`);
  };

  const loadCampaign = (campaign) => {
    setForm({ ...DEFAULT_CAMPAIGN, ...campaign });
    setSelectedKeys(new Set(campaign.customerKeys || []));
    setActiveCampaignId(campaign.id);
    setNotice(`Loaded ${campaign.name}`);
  };

  const markStatus = async (status) => {
    if (!activeCampaign || selected.length === 0) return;
    const now = new Date().toISOString();
    const statusByCustomer = { ...(activeCampaign.statusByCustomer || {}) };
    const nextProfiles = { ...(settings.customerProfiles || {}) };
    selected.forEach((customer) => {
      statusByCustomer[customer.key] = { ...(statusByCustomer[customer.key] || {}), status, quantity, updatedAt: now };
      nextProfiles[customer.key] = {
        ...(nextProfiles[customer.key] || {}),
        outreachStatus: status,
        lastCampaignId: activeCampaign.id,
        lastContactedAt: status === "planned" ? nextProfiles[customer.key]?.lastContactedAt || "" : now,
        lastCampaignQuantity: quantity,
        updatedAt: Date.now(),
      };
    });
    const nextCampaigns = campaigns.map((campaign) => campaign.id === activeCampaign.id
      ? { ...campaign, statusByCustomer, updatedAt: now }
      : campaign);
    await persistSettings({ ...settings, customerProfiles: nextProfiles, marketingCampaigns: nextCampaigns });
    setNotice(`Marked ${selected.length} buyer${selected.length === 1 ? "" : "s"} as ${status}.`);
  };

  const copyMessages = async () => {
    const text = selected.map((customer) => `${customer.name} — ${contactFor(customer)}\n${personalize(form.message, customer, form)}`).join("\n\n---\n\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Copied ${selected.length} personalised message${selected.length === 1 ? "" : "s"}.`);
    } catch {
      setNotice("Clipboard access was blocked. Export the audience CSV instead.");
    }
  };

  const openEmailDraft = () => {
    const emails = selected.map((customer) => customer.profile.email).filter(Boolean);
    if (!emails.length) {
      setNotice("No selected buyers have email addresses. Copy or export the messages instead.");
      return;
    }
    const subject = encodeURIComponent(form.subject);
    const body = encodeURIComponent(personalize(form.message, { name: "there" }, form));
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${subject}&body=${body}`;
  };

  const exportAudience = () => {
    const rows = [["Customer", "Contact", "Email", "Platform", "Brands", "Product types", "Orders", "Revenue", "Status", "Campaign message"]];
    selected.forEach((customer) => rows.push([
      customer.name,
      contactFor(customer),
      customer.profile.email || "",
      customer.platformGroupsList.join(" | ") || customer.defaultPlatform,
      customer.brandsList.join(" | "),
      customer.productTypesList.join(" | "),
      customer.orderCount,
      customer.revenue,
      activeCampaign?.statusByCustomer?.[customer.key]?.status || customer.profile.outreachStatus || "planned",
      personalize(form.message, customer, form),
    ]));
    downloadCsv("archivedash-buyer-audience.csv", rows);
    setNotice(`Exported ${selected.length} buyer${selected.length === 1 ? "" : "s"}.`);
  };

  if (!open) return null;

  return (
    <section aria-label="Buyer marketing workspace" style={{ background: "#101827", border: "1px solid #2563eb66", borderRadius: 12, padding: isMobile ? 12 : 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#f3f6fb", fontSize: 15, fontWeight: 800 }}>Buyer marketing</div>
          <div style={{ color: "#8b97ad", fontSize: 12, marginTop: 2 }}>{selected.length} selected · build, message, and track an audience</div>
        </div>
        <button onClick={() => setOpen(false)} style={{ ...ghostBtn, padding: "6px 10px", fontSize: 12 }}>Close</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.25fr) minmax(280px, 0.75fr)", gap: 14 }}>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1.4fr 0.7fr 0.55fr 0.65fr", gap: 8 }}>
            <Field label="Campaign"><input value={form.name} onChange={(event) => updateForm("name", event.target.value)} style={inp} /></Field>
            <Field label="Product"><input value={form.product} onChange={(event) => updateForm("product", event.target.value)} style={inp} /></Field>
            <Field label="Price each"><input type="number" min="0" value={form.unitPrice} onChange={(event) => updateForm("unitPrice", event.target.value)} style={inp} /></Field>
            <Field label="Stock"><input type="number" min="0" value={form.stock} onChange={(event) => updateForm("stock", event.target.value)} style={inp} /></Field>
            <Field label="Qty / buyer"><input type="number" min="1" value={form.defaultQuantity} onChange={(event) => updateForm("defaultQuantity", event.target.value)} style={inp} /></Field>
          </div>
          <Field label="Subject"><input value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} style={inp} /></Field>
          <Field label="Message template">
            <textarea value={form.message} onChange={(event) => updateForm("message", event.target.value)} style={{ ...inp, minHeight: 96, resize: "vertical" }} />
            <div style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>Use {"{{name}}"}, {"{{product}}"}, {"{{price}}"}, and {"{{stock}}"} for personalisation.</div>
          </Field>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", color: "#cbd5e1", fontSize: 12, marginBottom: 12 }}>
            <Check label="Shipping included" checked={form.shippingIncluded} onChange={(value) => updateForm("shippingIncluded", value)} />
            <Check label="Bundles allowed" checked={form.bundlesAllowed} onChange={(value) => updateForm("bundlesAllowed", value)} />
            <Check label="Reserve stock" checked={form.reserveStock} onChange={(value) => updateForm("reserveStock", value)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={saveCampaign} disabled={!selected.length} style={{ ...primaryBtn, opacity: selected.length ? 1 : 0.45 }}>Save campaign</button>
            <button onClick={copyMessages} disabled={!selected.length} style={{ ...ghostBtn, opacity: selected.length ? 1 : 0.45 }}>Copy messages</button>
            <button onClick={openEmailDraft} disabled={!selected.length} style={{ ...ghostBtn, opacity: selected.length ? 1 : 0.45 }}>Open email draft</button>
            <button onClick={exportAudience} disabled={!selected.length} style={{ ...ghostBtn, opacity: selected.length ? 1 : 0.45 }}>Export CSV</button>
            <span style={{ color: requestedUnits > stock ? "#fbbf24" : "#93c5fd", fontSize: 11 }}>{form.reserveStock ? `${reservedUnits} of ${stock} units earmarked${requestedUnits > stock ? ` · ${requestedUnits - stock} requested over stock` : ""}` : `${stock} units available`}</span>
          </div>
        </div>

        <div style={{ background: "#0d1117", border: "1px solid #232c3c", borderRadius: 10, padding: 12 }}>
          <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800, marginBottom: 8 }}>Saved audiences</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <input value={audienceName} onChange={(event) => setAudienceName(event.target.value)} style={{ ...inp, minWidth: 0 }} placeholder="Audience name" />
            <button onClick={saveAudience} disabled={!selected.length} style={{ ...ghostBtn, whiteSpace: "nowrap", opacity: selected.length ? 1 : 0.45 }}>Save</button>
          </div>
          {audiences.length === 0 ? <Empty text="No saved audiences yet." /> : audiences.slice(0, 5).map((audience) => (
            <div key={audience.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderTop: "1px solid #232c3c" }}>
              <button onClick={() => loadAudience(audience)} style={{ ...ghostBtn, flex: 1, minWidth: 0, padding: "5px 8px", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{audience.name} · {audience.customerKeys?.length || 0}</button>
              <button onClick={() => removeAudience(audience.id)} aria-label={`Delete ${audience.name}`} style={{ ...ghostBtn, padding: "5px 8px", color: "#f87171" }}>×</button>
            </div>
          ))}

          <div style={{ color: "#f3f6fb", fontSize: 13, fontWeight: 800, margin: "14px 0 8px" }}>Campaign tracking</div>
          {campaigns.length === 0 ? <Empty text="Save the campaign to start tracking." /> : (
            <select value={activeCampaignId} onChange={(event) => { const campaign = campaigns.find((item) => item.id === event.target.value); if (campaign) loadCampaign(campaign); }} style={{ ...sel, width: "100%", marginBottom: 8 }}>
              <option value="">Choose a campaign</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          )}
          {statusCounts && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, marginBottom: 8 }}>
                <Stat label="Contacted" value={statusCounts.contacted} />
                <Stat label="Replied" value={statusCounts.replied} />
                <Stat label="Purchased" value={statusCounts.purchased} />
                <Stat label="Units sold" value={statusCounts.unitsSold} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["contacted", "replied", "purchased"].map((status) => <button key={status} onClick={() => markStatus(status)} disabled={!selected.length} style={{ ...ghostBtn, padding: "5px 8px", fontSize: 11, textTransform: "capitalize", opacity: selected.length ? 1 : 0.45 }}>{status}</button>)}
              </div>
            </>
          )}
        </div>
      </div>
      {notice && <div role="status" style={{ color: "#93c5fd", fontSize: 11, marginTop: 10 }}>{notice}</div>}
    </section>
  );
}

function Field({ label, children }) {
  return <label style={{ display: "block", color: "#9ca3af", fontSize: 11, fontWeight: 650, marginBottom: 9 }}>{label}<span style={{ display: "block", marginTop: 4 }}>{children}</span></label>;
}

function Check({ label, checked, onChange }) {
  return <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function Empty({ text }) {
  return <div style={{ color: "#64748b", fontSize: 11, padding: "7px 0" }}>{text}</div>;
}

function Stat({ label, value }) {
  return <div style={{ background: "#121a2b", borderRadius: 7, padding: "7px 8px" }}><div style={{ color: "#64748b", fontSize: 10 }}>{label}</div><div style={{ color: "#f3f6fb", fontSize: 14, fontWeight: 800 }}>{value}</div></div>;
}
