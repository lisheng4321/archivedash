import { useEffect, useMemo, useState } from "react";
import { load as loadData, save as saveData } from "./supabase.js";

const STORAGE_KEY = "arch-fee-calculators";
const DEFAULT_REVISION = "ebay-pro-basic-au-2026-03-27";

const DEFAULT_CALCULATORS = [
  { id: "ebay-au-tier-1", name: "eBay AU Pro Basic - Tier 1", platform: "eBay AU", category: "Home Appliances / Technology Devices", rate: 8.03, fixedFee: 0.33, flatFee: 0, cliff: 4000, aboveCliffRate: 2.75, intlRate: 1.1, belowStdRate: 5.5, notes: "Updated 27 Mar 2026, incl. GST" },
  { id: "ebay-au-tier-2", name: "eBay AU Pro Basic - Tier 2", platform: "eBay AU", category: "Most categories", rate: 10.34, fixedFee: 0.33, flatFee: 0, cliff: 4000, aboveCliffRate: 2.75, intlRate: 1.1, belowStdRate: 5.5, notes: "Updated 27 Mar 2026, incl. GST" },
  { id: "ebay-au-tier-3", name: "eBay AU Pro Basic - Tier 3", platform: "eBay AU", category: "Vehicle Parts & Accessories", rate: 11.22, fixedFee: 0.33, flatFee: 0, cliff: 4000, aboveCliffRate: 2.75, intlRate: 1.1, belowStdRate: 5.5, notes: "Updated 27 Mar 2026, incl. GST" },
  { id: "ebay-au-tier-4", name: "eBay AU Pro Basic - Tier 4", platform: "eBay AU", category: "Business, Collectables, Fashion, Media, Sporting Goods, Tech Accessories", rate: 11.77, fixedFee: 0.33, flatFee: 0, cliff: 4000, aboveCliffRate: 2.75, intlRate: 1.1, belowStdRate: 5.5, notes: "Updated 27 Mar 2026, incl. GST" },
  { id: "ebay-au-nft", name: "eBay AU Pro Basic - NFTs", platform: "eBay AU", category: "Non-fungible tokens", rate: 5.5, fixedFee: 0.33, flatFee: 0, cliff: 0, aboveCliffRate: 0, intlRate: 1.1, belowStdRate: 5.5, notes: "Flat NFT category rate, incl. GST" },
  { id: "ebay-au-services", name: "eBay AU Pro Basic - Services", platform: "eBay AU", category: "Services", rate: 0, fixedFee: 0.33, flatFee: 44, cliff: 0, aboveCliffRate: 0, intlRate: 1.1, belowStdRate: 5.5, notes: "AU$44 flat Services fee + order fee, incl. GST" },
  { id: "facebook-marketplace", name: "Facebook Marketplace", platform: "Facebook Marketplace", category: "Local / Manual", rate: 0, fixedFee: 0, flatFee: 0, cliff: 0, aboveCliffRate: 0, intlRate: 0, belowStdRate: 0, notes: "No platform fee by default" },
  { id: "discord-manual", name: "Discord / Direct", platform: "Discord", category: "Manual", rate: 0, fixedFee: 0, flatFee: 0, cliff: 0, aboveCliffRate: 0, intlRate: 0, belowStdRate: 0, notes: "Manual private sale" },
  { id: "stockx-basic", name: "StockX - Basic estimate", platform: "StockX", category: "Standard", rate: 12, fixedFee: 0, flatFee: 0, cliff: 0, aboveCliffRate: 0, intlRate: 0, belowStdRate: 0, notes: "Editable placeholder" },
];
const DEFAULT_BY_ID = new Map(DEFAULT_CALCULATORS.map((c) => [c.id, c]));
const EBAY_DEFAULT_IDS = new Set(DEFAULT_CALCULATORS.filter((c) => c.id.startsWith("ebay-au-")).map((c) => c.id));

const blankPreset = () => ({
  id: genId(),
  name: "New calculator",
  platform: "Other",
  category: "Custom",
  rate: 0,
  fixedFee: 0,
  flatFee: 0,
  cliff: 0,
  aboveCliffRate: 0,
  intlRate: 0,
  belowStdRate: 0,
  notes: "",
});

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clampNum = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const pct = (v) => (clampNum(v)).toFixed(2) + "%";
const rateToDecimal = (v) => clampNum(v) / 100;

const currency = (v) => {
  const n = Number(v);
  if (isNaN(n)) return "AU$0.00";
  return (n < 0 ? "-AU$" : "AU$") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const inp = { width: "100%", padding: "9px 11px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, color: "#e5e7eb", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const sel = { ...inp, appearance: "none" };
const cb = { width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" };
const card = { background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 18 };
const labelStyle = { fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5, fontWeight: 500 };
const primaryBtn = { padding: "9px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const ghostBtn = { padding: "9px 16px", background: "#1f2937", color: "#d1d5db", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" };
const miniIconBtn = (disabled) => ({ width: 22, height: 22, border: "none", borderRadius: 5, background: "#1f2937", color: disabled ? "#374151" : "#9ca3af", cursor: disabled ? "not-allowed" : "pointer", fontSize: 12, lineHeight: "22px", padding: 0 });

function cleanPreset(preset) {
  return {
    ...blankPreset(),
    ...preset,
    rate: clampNum(preset.rate),
    fixedFee: clampNum(preset.fixedFee),
    flatFee: clampNum(preset.flatFee),
    cliff: clampNum(preset.cliff),
    aboveCliffRate: clampNum(preset.aboveCliffRate),
    intlRate: clampNum(preset.intlRate),
    belowStdRate: clampNum(preset.belowStdRate),
  };
}

function refreshBuiltInCalculators(calculators) {
  const seen = new Set();
  const refreshed = calculators.map((preset) => {
    const latest = DEFAULT_BY_ID.get(preset.id);
    if (latest && EBAY_DEFAULT_IDS.has(preset.id)) {
      seen.add(preset.id);
      return cleanPreset({ ...preset, ...latest, revision: DEFAULT_REVISION });
    }
    return cleanPreset(preset);
  });
  DEFAULT_CALCULATORS.forEach((preset) => {
    if (!seen.has(preset.id) && EBAY_DEFAULT_IDS.has(preset.id)) refreshed.push(cleanPreset({ ...preset, revision: DEFAULT_REVISION }));
  });
  return refreshed;
}

function loadCalculators() {
  if (typeof window === "undefined") return DEFAULT_CALCULATORS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || parsed.length === 0) return refreshBuiltInCalculators(DEFAULT_CALCULATORS);
    return refreshBuiltInCalculators(parsed);
  } catch {
    return refreshBuiltInCalculators(DEFAULT_CALCULATORS);
  }
}

function saveCalculators(calculators) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(calculators));
}

function calcFees({ salePrice, shipping, calculator, isIntl, isBelowStd, adRate }) {
  const total = salePrice + shipping;
  if (total <= 0 || !calculator) return null;
  const baseRate = rateToDecimal(calculator.rate);
  const cliff = clampNum(calculator.cliff);
  const aboveCliffRate = rateToDecimal(calculator.aboveCliffRate);
  let platformFee;

  if (cliff > 0 && total > cliff && aboveCliffRate > 0) {
    platformFee = cliff * baseRate + (total - cliff) * aboveCliffRate;
  } else {
    platformFee = total * baseRate;
  }

  const intlFee = isIntl ? total * rateToDecimal(calculator.intlRate) : 0;
  const belowStdFee = isBelowStd ? total * rateToDecimal(calculator.belowStdRate) : 0;
  const adFee = adRate > 0 ? total * rateToDecimal(adRate) : 0;
  const fixedFee = clampNum(calculator.fixedFee);
  const flatFee = clampNum(calculator.flatFee);
  const totalFees = platformFee + fixedFee + flatFee + intlFee + belowStdFee + adFee;
  const netPayout = total - totalFees;
  const effRate = totalFees / total;

  return { total, platformFee, fixedFee, flatFee, intlFee, belowStdFee, adFee, totalFees, netPayout, effRate };
}

function reverseCalc({ targetNet, calculator, isIntl, isBelowStd, adRate }) {
  const baseRate = rateToDecimal(calculator.rate);
  const fixedFee = clampNum(calculator.fixedFee) + clampNum(calculator.flatFee);
  const intl = isIntl ? rateToDecimal(calculator.intlRate) : 0;
  const belowStd = isBelowStd ? rateToDecimal(calculator.belowStdRate) : 0;
  const ad = adRate > 0 ? rateToDecimal(adRate) : 0;
  const cliff = clampNum(calculator.cliff);
  const aboveCliffRate = rateToDecimal(calculator.aboveCliffRate);

  const denomLow = 1 - baseRate - intl - belowStd - ad;
  if (denomLow <= 0) return null;
  const lowEstimate = (targetNet + fixedFee) / denomLow;
  if (!cliff || lowEstimate <= cliff || !aboveCliffRate) return lowEstimate;

  const denomHigh = 1 - aboveCliffRate - intl - belowStd - ad;
  if (denomHigh <= 0) return null;
  return (targetNet + cliff * baseRate - cliff * aboveCliffRate + fixedFee) / denomHigh;
}

export default function Calculator({ isMobile = false }) {
  const [mode, setMode] = useState("forward");
  const [calculators, setCalculators] = useState(loadCalculators);
  const [selectedId, setSelectedId] = useState(() => loadCalculators()[3]?.id || loadCalculators()[0]?.id);
  const [salePrice, setSalePrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [cost, setCost] = useState("");
  const [isIntl, setIsIntl] = useState(false);
  const [isBelowStd, setIsBelowStd] = useState(false);
  const [adRate, setAdRate] = useState("0");
  const [targetNet, setTargetNet] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const remote = await loadData(STORAGE_KEY, null);
      if (!alive) return;
      if (Array.isArray(remote) && remote.length > 0) {
        const cleaned = refreshBuiltInCalculators(remote);
        setCalculators(cleaned);
        setSelectedId((prev) => cleaned.some((c) => c.id === prev) ? prev : cleaned[0].id);
      }
      setHydrated(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveCalculators(calculators);
    saveData(STORAGE_KEY, calculators);
    if (!calculators.some((c) => c.id === selectedId)) setSelectedId(calculators[0]?.id || "");
  }, [calculators, selectedId, hydrated]);

  const calculator = calculators.find((c) => c.id === selectedId) || calculators[0];
  const editing = calculators.find((c) => c.id === editingId) || null;

  const result = useMemo(() => {
    if (!calculator) return null;
    if (mode === "forward") {
      return calcFees({
        salePrice: parseFloat(salePrice) || 0,
        shipping: parseFloat(shipping) || 0,
        calculator,
        isIntl,
        isBelowStd,
        adRate: parseFloat(adRate) || 0,
      });
    }
    const tn = parseFloat(targetNet) || 0;
    if (tn <= 0) return null;
    const total = reverseCalc({ targetNet: tn, calculator, isIntl, isBelowStd, adRate: parseFloat(adRate) || 0 });
    if (!total) return null;
    return calcFees({ salePrice: total, shipping: 0, calculator, isIntl, isBelowStd, adRate: parseFloat(adRate) || 0 });
  }, [mode, salePrice, shipping, calculator, isIntl, isBelowStd, adRate, targetNet]);

  const costNum = parseFloat(cost) || 0;
  const profit = result ? result.netPayout - costNum : 0;
  const margin = result && result.total > 0 ? profit / result.total : 0;
  const roi = costNum > 0 ? profit / costNum : 0;

  const updateCalculator = (id, updates) => {
    setCalculators((prev) => prev.map((c) => c.id === id ? cleanPreset({ ...c, ...updates }) : c));
  };

  const addCalculator = () => {
    const next = blankPreset();
    setCalculators((prev) => [next, ...prev]);
    setSelectedId(next.id);
    setEditingId(next.id);
    setManagerOpen(true);
  };

  const duplicateCalculator = (preset) => {
    const copy = { ...preset, id: genId(), name: `${preset.name} copy` };
    setCalculators((prev) => [cleanPreset(copy), ...prev]);
    setSelectedId(copy.id);
    setEditingId(copy.id);
  };

  const deleteCalculator = (id) => {
    if (calculators.length <= 1) return;
    setCalculators((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const moveCalculator = (id, direction) => {
    setCalculators((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const resetDefaults = () => {
    const defaults = refreshBuiltInCalculators(DEFAULT_CALCULATORS);
    setCalculators(defaults);
    setSelectedId(defaults.find((c) => c.id === "ebay-au-tier-4")?.id || defaults[0].id);
    setEditingId(null);
  };

  const tabBtn = (id) => ({
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: mode === id ? 600 : 400,
    borderRadius: 6,
    background: mode === id ? "#1d4ed8" : "transparent",
    color: mode === id ? "#fff" : "#9ca3af",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    flex: isMobile ? 1 : "0 0 auto",
  });

  return (
    <div style={{ padding: isMobile ? "14px 12px" : "20px 24px", maxWidth: 1180 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>Fee Calculator</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>
            Editable calculators for eBay categories and selling platforms
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={addCalculator} style={primaryBtn}>+ Add calculator</button>
          <button onClick={() => { setManagerOpen((v) => !v); setEditingId(calculator?.id || null); }} style={ghostBtn}>Manage</button>
        </div>
      </div>

      {managerOpen && (
        <CalculatorManager
          calculators={calculators}
          selectedId={selectedId}
          editing={editing}
          setSelectedId={setSelectedId}
          setEditingId={setEditingId}
          updateCalculator={updateCalculator}
          duplicateCalculator={duplicateCalculator}
          deleteCalculator={deleteCalculator}
          moveCalculator={moveCalculator}
          resetDefaults={resetDefaults}
          isMobile={isMobile}
        />
      )}

      <div style={{ display: "flex", gap: 4, background: "#111827", borderRadius: 8, padding: 4, border: "1px solid #1f2937", marginBottom: 16, width: isMobile ? "100%" : "fit-content" }}>
        <button onClick={() => setMode("forward")} style={tabBtn("forward")}>{isMobile ? "Forward" : "Forward (price to net)"}</button>
        <button onClick={() => setMode("reverse")} style={tabBtn("reverse")}>{isMobile ? "Reverse" : "Reverse (target net to price)"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 14 }}>Inputs</div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Calculator preset</div>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={sel}>
              {calculators.map((c) => <option key={c.id} value={c.id}>{c.name} - {pct(c.rate)}</option>)}
            </select>
            {calculator && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{calculator.platform} - {calculator.category}{calculator.notes ? ` - ${calculator.notes}` : ""}</div>}
          </div>

          {mode === "forward" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <Field label="Sale price (AU$)"><input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} style={inp} placeholder="0.00" autoFocus={!isMobile} /></Field>
                <Field label="Shipping charged"><input type="number" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} style={inp} placeholder="0.00" /></Field>
              </div>
              <Field label="Cost (optional, for profit calc)"><input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} style={inp} placeholder="0.00" /></Field>
            </>
          ) : (
            <Field label="Target net payout (AU$)">
              <input type="number" step="0.01" value={targetNet} onChange={(e) => setTargetNet(e.target.value)} style={inp} placeholder="What you want to take home" autoFocus={!isMobile} />
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>Calculates list price needed to net this after fees. Assumes shipping is included in price.</div>
            </Field>
          )}

          <Field label="Promoted / ad rate (%)">
            <input type="number" step="0.1" min="0" max="100" value={adRate} onChange={(e) => setAdRate(e.target.value)} style={inp} placeholder="0" />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
            <Toggle checked={isIntl} onChange={setIsIntl} disabled={!calculator?.intlRate} label={`International fee (+${pct(calculator?.intlRate || 0)})`} />
            <Toggle checked={isBelowStd} onChange={setIsBelowStd} disabled={!calculator?.belowStdRate} label={`Below Standard fee (+${pct(calculator?.belowStdRate || 0)})`} />
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 14 }}>Breakdown</div>
          {!result ? (
            <div style={{ color: "#374151", fontSize: 13, padding: "60px 0", textAlign: "center" }}>
              Enter {mode === "forward" ? "a sale price" : "a target net"} to see the breakdown
            </div>
          ) : (
            <>
              <div style={{ background: "#0d1117", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{mode === "forward" ? "Net payout" : "List price needed"}</div>
                <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#34d399" }}>{currency(mode === "forward" ? result.netPayout : result.total)}</div>
                {mode === "reverse" && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>To net <span style={{ color: "#9ca3af" }}>{currency(parseFloat(targetNet) || 0)}</span></div>}
              </div>

              <div style={{ fontSize: 13 }}>
                <Line label="Total sale" value={currency(result.total)} bold />
                <Line label={`Platform fee (${pct(calculator.rate)}${calculator.cliff && result.total > calculator.cliff ? " + cliff" : ""})`} value={"-" + currency(result.platformFee)} negative />
                {result.flatFee > 0 && <Line label="Flat category fee" value={"-" + currency(result.flatFee)} negative />}
                {result.fixedFee > 0 && <Line label="Fixed order fee" value={"-" + currency(result.fixedFee)} negative />}
                {result.adFee > 0 && <Line label={`Promoted / ad fee (${adRate}%)`} value={"-" + currency(result.adFee)} negative />}
                {result.intlFee > 0 && <Line label={`International fee (${pct(calculator.intlRate)})`} value={"-" + currency(result.intlFee)} negative />}
                {result.belowStdFee > 0 && <Line label={`Below Standard fee (${pct(calculator.belowStdRate)})`} value={"-" + currency(result.belowStdFee)} negative />}
                <Line label="Total fees" value={"-" + currency(result.totalFees)} negative bold border />
                <Line label="Effective fee rate" value={pct(result.effRate * 100)} subtle />
                <Line label="Net payout" value={currency(result.netPayout)} bold large />
              </div>

              {mode === "forward" && costNum > 0 && (
                <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Profit</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Stat label="Net profit" value={currency(profit)} color={profit >= 0 ? "#34d399" : "#f87171"} />
                    <Stat label="Margin" value={pct(margin * 100)} color={margin >= 0 ? "#34d399" : "#f87171"} />
                    <Stat label="ROI" value={pct(roi * 100)} color={roi >= 0 ? "#34d399" : "#f87171"} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>Current preset reference</div>
        {calculator && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 12, fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
            <Ref label="Platform" value={calculator.platform} />
            <Ref label="Category" value={calculator.category} />
            <Ref label="Base fee" value={pct(calculator.rate)} />
            <Ref label="Fixed fee" value={currency(calculator.fixedFee)} />
            <Ref label="Flat fee" value={calculator.flatFee ? currency(calculator.flatFee) : "None"} />
            <Ref label="Cliff" value={calculator.cliff ? currency(calculator.cliff) : "None"} />
            <Ref label="Above cliff" value={calculator.aboveCliffRate ? pct(calculator.aboveCliffRate) : "None"} />
            <Ref label="International" value={calculator.intlRate ? pct(calculator.intlRate) : "None"} />
            <Ref label="Below Standard" value={calculator.belowStdRate ? pct(calculator.belowStdRate) : "None"} />
          </div>
        )}
      </div>
    </div>
  );
}

function CalculatorManager({ calculators, selectedId, editing, setSelectedId, setEditingId, updateCalculator, duplicateCalculator, deleteCalculator, moveCalculator, resetDefaults, isMobile }) {
  return (
    <div style={{ ...card, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 700 }}>Manage calculators</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Add, edit, duplicate, or delete category/platform fee presets.</div>
        </div>
        <button onClick={resetDefaults} style={{ ...ghostBtn, padding: "7px 11px", fontSize: 12 }}>Reset defaults</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(260px, 0.8fr) minmax(420px, 1.2fr)", gap: 14 }}>
        <div style={{ border: "1px solid #1f2937", borderRadius: 10, overflow: "hidden" }}>
          {calculators.map((calc, idx) => (
            <div key={calc.id} onClick={() => { setSelectedId(calc.id); setEditingId(calc.id); }} style={{ padding: "9px 11px", cursor: "pointer", background: calc.id === selectedId ? "#1e293b" : idx % 2 === 0 ? "#0d131f" : "#111827", borderBottom: "1px solid #1f293722" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: "#e5e7eb", fontSize: 13, fontWeight: calc.id === selectedId ? 700 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{calc.name}</span>
                <span style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{pct(calc.rate)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 2 }}>
                <div style={{ color: "#6b7280", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{calc.platform} - {calc.category}</div>
                <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); moveCalculator(calc.id, -1); }} disabled={idx === 0} title="Move up" style={miniIconBtn(idx === 0)}>↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveCalculator(calc.id, 1); }} disabled={idx === calculators.length - 1} title="Move down" style={miniIconBtn(idx === calculators.length - 1)}>↓</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {editing ? (
          <div style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
              <Field label="Calculator name"><input value={editing.name} onChange={(e) => updateCalculator(editing.id, { name: e.target.value })} style={inp} /></Field>
              <Field label="Platform"><input value={editing.platform} onChange={(e) => updateCalculator(editing.id, { platform: e.target.value })} style={inp} /></Field>
              <Field label="Category / tier"><input value={editing.category} onChange={(e) => updateCalculator(editing.id, { category: e.target.value })} style={inp} /></Field>
              <Field label="Base fee rate (%)"><input type="number" step="0.01" value={editing.rate} onChange={(e) => updateCalculator(editing.id, { rate: e.target.value })} style={inp} /></Field>
              <Field label="Fixed fee (AU$)"><input type="number" step="0.01" value={editing.fixedFee} onChange={(e) => updateCalculator(editing.id, { fixedFee: e.target.value })} style={inp} /></Field>
              <Field label="Flat category fee (AU$)"><input type="number" step="0.01" value={editing.flatFee || 0} onChange={(e) => updateCalculator(editing.id, { flatFee: e.target.value })} style={inp} /></Field>
              <Field label="Cliff amount (AU$)"><input type="number" step="0.01" value={editing.cliff} onChange={(e) => updateCalculator(editing.id, { cliff: e.target.value })} style={inp} /></Field>
              <Field label="Rate above cliff (%)"><input type="number" step="0.01" value={editing.aboveCliffRate} onChange={(e) => updateCalculator(editing.id, { aboveCliffRate: e.target.value })} style={inp} /></Field>
              <Field label="International extra (%)"><input type="number" step="0.01" value={editing.intlRate} onChange={(e) => updateCalculator(editing.id, { intlRate: e.target.value })} style={inp} /></Field>
              <Field label="Below Standard extra (%)"><input type="number" step="0.01" value={editing.belowStdRate} onChange={(e) => updateCalculator(editing.id, { belowStdRate: e.target.value })} style={inp} /></Field>
              <Field label="Notes"><input value={editing.notes || ""} onChange={(e) => updateCalculator(editing.id, { notes: e.target.value })} style={inp} /></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button onClick={() => moveCalculator(editing.id, -1)} disabled={calculators[0]?.id === editing.id} style={{ ...ghostBtn, opacity: calculators[0]?.id === editing.id ? 0.5 : 1 }}>Move Up</button>
              <button onClick={() => moveCalculator(editing.id, 1)} disabled={calculators[calculators.length - 1]?.id === editing.id} style={{ ...ghostBtn, opacity: calculators[calculators.length - 1]?.id === editing.id ? 0.5 : 1 }}>Move Down</button>
              <button onClick={() => duplicateCalculator(editing)} style={ghostBtn}>Duplicate</button>
              <button onClick={() => deleteCalculator(editing.id)} disabled={calculators.length <= 1} style={{ ...ghostBtn, color: "#f87171", opacity: calculators.length <= 1 ? 0.5 : 1 }}>Delete</button>
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid #1f2937", borderRadius: 10, padding: 28, color: "#374151", fontSize: 13, textAlign: "center" }}>Select a calculator to edit it.</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={labelStyle}>{label}</div>{children}</div>;
}

function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: disabled ? "#4b5563" : "#9ca3af", cursor: disabled ? "not-allowed" : "pointer" }}>
      <input type="checkbox" checked={!disabled && checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ ...cb, opacity: disabled ? 0.45 : 1 }} />
      {label}
    </label>
  );
}

function Line({ label, value, bold, negative, subtle, large, border }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: border ? "1px solid #1f2937" : "none", marginTop: border ? 4 : 0, gap: 8 }}>
      <span style={{ color: subtle ? "#6b7280" : "#9ca3af", fontSize: subtle ? 12 : 13 }}>{label}</span>
      <span style={{ color: negative ? "#f59e0b" : subtle ? "#9ca3af" : "#f1f5f9", fontWeight: bold ? 700 : 500, fontSize: large ? 16 : 13, whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Ref({ label, value }) {
  return (
    <div style={{ background: "#0d1117", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 700 }}>{value}</div>
    </div>
  );
}
