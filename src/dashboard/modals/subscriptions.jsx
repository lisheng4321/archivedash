import { useEffect, useState } from "react";
import { FREQ_OPTIONS, FREQ_LABEL, CURRENCY_OPTIONS, SUB_CATEGORIES, formatMoney, currency, today, frequencyLabel, subAmountAud, subMonthlyAud, inp, sel, primaryBtn, ghostBtn, cb, Modal, UnsavedDialog, Field, Row, ModalActions } from "../shared.jsx";

function SubModal({ sub, onSave, onClose }) {
  const [sf, setSf] = useState(sub ? { category: "Other", currency: "AUD", fxRateToAud: 1, customDays: "", ...sub } : { name: "", category: "Other", amount: "", currency: "AUD", fxRateToAud: 1, fxUpdatedAt: "", frequency: "monthly", customDays: "", nextDue: today(), tags: "", active: true });
  const [dirty, setDirty] = useState(false);
  const [showU, setShowU] = useState(false);
  const [fxStatus, setFxStatus] = useState("");
  const up = (u) => { setSf((prev) => ({ ...prev, ...u })); setDirty(true); };
  const gc = () => { if (dirty) setShowU(true); else onClose(); };
  const currencyCode = String(sf.currency || "AUD").toUpperCase();
  const isForeign = currencyCode !== "AUD";
  const audAmount = subAmountAud(sf);
  const me = subMonthlyAud(sf);
  useEffect(() => {
    let alive = true;
    if (!isForeign) {
      setFxStatus("");
      setSf((prev) => ({ ...prev, fxRateToAud: 1, fxUpdatedAt: "" }));
      return () => { alive = false; };
    }
    setFxStatus("Refreshing AUD rate...");
    fetch(`https://api.frankfurter.dev/v2/rate/${encodeURIComponent(currencyCode)}/AUD`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("rate")))
      .then((data) => {
        if (!alive || !Number(data.rate)) return;
        setSf((prev) => ({ ...prev, fxRateToAud: data.rate, fxUpdatedAt: data.date || today() }));
        setFxStatus(`Live rate loaded${data.date ? ` (${data.date})` : ""}`);
      })
      .catch(() => { if (alive) setFxStatus("Could not refresh. You can enter the rate manually."); });
    return () => { alive = false; };
  }, [currencyCode, isForeign]);
  const save = () => {
    if (!sf.name || !sf.amount || !sf.nextDue) return;
    const customDays = sf.frequency === "custom" ? Math.max(1, parseInt(sf.customDays, 10) || 0) : "";
    if (sf.frequency === "custom" && !customDays) return;
    onSave({
      ...sf,
      category: SUB_CATEGORIES.includes(sf.category) ? sf.category : "Other",
      amount: parseFloat(sf.amount),
      currency: currencyCode,
      fxRateToAud: isForeign ? (parseFloat(sf.fxRateToAud) || 1) : 1,
      fxUpdatedAt: isForeign ? (sf.fxUpdatedAt || today()) : "",
      customDays,
    });
  };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title={sub ? "Edit subscription" : "Add subscription"}>
    <Field label="Name" req><input value={sf.name} onChange={(e) => up({ name: e.target.value })} style={inp} placeholder="e.g. eBay Pro Basic" autoFocus /></Field>
    <Row cols={3}>
      <Field label="Amount" req><input type="number" step="0.01" value={sf.amount} onChange={(e) => up({ amount: e.target.value })} style={inp} placeholder="0.00" /></Field>
      <Field label="Currency"><select value={currencyCode} onChange={(e) => up({ currency: e.target.value })} style={sel}>{CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label="AUD rate"><input type="number" step="0.0001" disabled={!isForeign} value={isForeign ? sf.fxRateToAud : 1} onChange={(e) => up({ fxRateToAud: e.target.value, fxUpdatedAt: today() })} style={{ ...inp, opacity: isForeign ? 1 : 0.55 }} placeholder="1.0000" /></Field>
    </Row>
    {isForeign && <div style={{ margin: "-4px 0 10px", fontSize: 11, color: fxStatus.startsWith("Could") ? "#fbbf24" : "#7c8aa0" }}>{fxStatus || "Rate is stored on this subscription and can be edited per charge."}</div>}
    <Row cols={3}>
      <Field label="Category"><select value={sf.category || "Other"} onChange={(e) => up({ category: e.target.value })} style={sel}>{SUB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="Frequency"><select value={sf.frequency} onChange={(e) => up({ frequency: e.target.value })} style={sel}>{FREQ_OPTIONS.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}</select></Field>
      <Field label={sf.frequency === "custom" ? "Every X days" : "Next due"} req>{sf.frequency === "custom" ? <input type="number" min="1" step="1" value={sf.customDays} onChange={(e) => up({ customDays: e.target.value })} style={inp} placeholder="28" /> : <input type="date" value={sf.nextDue} onChange={(e) => up({ nextDue: e.target.value })} style={inp} />}</Field>
    </Row>
    {sf.frequency === "custom" ? <Row><Field label="Next due" req><input type="date" value={sf.nextDue} onChange={(e) => up({ nextDue: e.target.value })} style={inp} /></Field><Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field></Row> : <Field label="Tags"><input value={sf.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field>}
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer", marginBottom: 10 }}><input type="checkbox" checked={sf.active} onChange={(e) => up({ active: e.target.checked })} style={cb} /> Active (auto-log when due)</label>
    {parseFloat(sf.amount) > 0 && (
      <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, fontSize: 12, color: "#9ca3af" }}>
        <div>Charge: <span style={{ color: "#f3f6fb", fontWeight: 600 }}>{formatMoney(sf.amount, currencyCode)}</span>{isForeign && <span style={{ color: "#56627a" }}> = {currency(audAmount)}</span>}</div>
        <div style={{ marginTop: 4 }}>Monthly equivalent: <span style={{ color: "#f3f6fb", fontWeight: 600 }}>{currency(me)}</span><span style={{ color: "#56627a" }}> · {currency(me * 12)}/yr · {frequencyLabel(sf.frequency, sf.customDays)}</span></div>
      </div>
    )}
    <ModalActions><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={save} style={primaryBtn}>{sub ? "Save" : "Add subscription"}</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

export {
  SubModal
};
