import { useState, useMemo } from "react";

// ─── Pro Basic fee constants (incl. GST) ───
// Source: eBay AU Pro Selling Fees, updated 27 Mar 2026
const TIER_RATES = {
  1: { rate: 0.0803, label: "Tier 1 — Tech Devices, Home Appliances" },
  2: { rate: 0.1034, label: "Tier 2 — General (most items)" },
  3: { rate: 0.1122, label: "Tier 3 — Vehicle Parts & Accessories" },
  4: { rate: 0.1177, label: "Tier 4 — Collectables, Fashion, Media" },
};
const CLIFF = 4000;
const ABOVE_CLIFF_RATE = 0.0275;
const FIXED_ORDER_FEE = 0.33;
const INTL_RATE = 0.011;
const BELOW_STANDARD_RATE = 0.055;

const currency = (v) => {
  const n = Number(v);
  if (isNaN(n)) return "AU$0.00";
  return (n < 0 ? "-AU$" : "AU$") + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
const pct = (v) => (v * 100).toFixed(2) + "%";

// ─── Styles (match Dashboard.jsx) ───
const inp = { width: "100%", padding: "9px 11px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8, color: "#e5e7eb", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const sel = { ...inp, appearance: "none" };
const cb = { width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" };
const card = { background: "#111827", borderRadius: 12, border: "1px solid #1f2937", padding: 18 };
const labelStyle = { fontSize: 12, color: "#9ca3af", display: "block", marginBottom: 5, fontWeight: 500 };

// ─── Core calc ───
function calcFees({ salePrice, shipping, tier, isIntl, isBelowStd, adRate }) {
  const total = salePrice + shipping;
  if (total <= 0) return null;
  const tierRate = TIER_RATES[tier].rate;
  let fvf;
  if (total <= CLIFF) {
    fvf = total * tierRate;
  } else {
    fvf = CLIFF * tierRate + (total - CLIFF) * ABOVE_CLIFF_RATE;
  }
  const intlFee = isIntl ? total * INTL_RATE : 0;
  const belowStdFee = isBelowStd ? total * BELOW_STANDARD_RATE : 0;
  const adFee = adRate > 0 ? total * (adRate / 100) : 0;
  const totalFees = fvf + FIXED_ORDER_FEE + intlFee + belowStdFee + adFee;
  const netPayout = total - totalFees;
  const effRate = totalFees / total;
  return { total, fvf, fixedFee: FIXED_ORDER_FEE, intlFee, belowStdFee, adFee, totalFees, netPayout, effRate };
}

// Reverse calc: given target net, find list price that nets it
function reverseCalc({ targetNet, tier, isIntl, isBelowStd, adRate }) {
  const tierRate = TIER_RATES[tier].rate;
  const intl = isIntl ? INTL_RATE : 0;
  const belowStd = isBelowStd ? BELOW_STANDARD_RATE : 0;
  const ad = adRate > 0 ? adRate / 100 : 0;

  const denomLow = 1 - tierRate - intl - belowStd - ad;
  if (denomLow <= 0) return null;
  const lowEstimate = (targetNet + FIXED_ORDER_FEE) / denomLow;
  if (lowEstimate <= CLIFF) return lowEstimate;

  const denomHigh = 1 - ABOVE_CLIFF_RATE - intl - belowStd - ad;
  if (denomHigh <= 0) return null;
  return (targetNet + CLIFF * tierRate - CLIFF * ABOVE_CLIFF_RATE + FIXED_ORDER_FEE) / denomHigh;
}

// ─── Component ───
export default function Calculator({ isMobile = false }) {
  const [mode, setMode] = useState("forward");
  const [salePrice, setSalePrice] = useState("");
  const [shipping, setShipping] = useState("0");
  const [cost, setCost] = useState("");
  const [tier, setTier] = useState(4);
  const [isIntl, setIsIntl] = useState(false);
  const [isBelowStd, setIsBelowStd] = useState(false);
  const [adRate, setAdRate] = useState("0");
  const [targetNet, setTargetNet] = useState("");

  const result = useMemo(() => {
    if (mode === "forward") {
      return calcFees({
        salePrice: parseFloat(salePrice) || 0,
        shipping: parseFloat(shipping) || 0,
        tier, isIntl, isBelowStd,
        adRate: parseFloat(adRate) || 0,
      });
    } else {
      const tn = parseFloat(targetNet) || 0;
      if (tn <= 0) return null;
      const total = reverseCalc({ targetNet: tn, tier, isIntl, isBelowStd, adRate: parseFloat(adRate) || 0 });
      if (!total) return null;
      return calcFees({
        salePrice: total, shipping: 0, tier, isIntl, isBelowStd,
        adRate: parseFloat(adRate) || 0,
      });
    }
  }, [mode, salePrice, shipping, tier, isIntl, isBelowStd, adRate, targetNet]);

  const costNum = parseFloat(cost) || 0;
  const profit = result ? result.netPayout - costNum : 0;
  const margin = result && result.total > 0 ? profit / result.total : 0;
  const roi = costNum > 0 ? profit / costNum : 0;

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
    <div style={{ padding: isMobile ? "14px 12px" : "20px 24px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9" }}>eBay Fee Calculator</h2>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4b5563" }}>Pro Basic plan · AU GST included · updated Mar 2026</p>
      </div>

      <div style={{ display: "flex", gap: 4, background: "#111827", borderRadius: 8, padding: 4, border: "1px solid #1f2937", marginBottom: 16, width: isMobile ? "100%" : "fit-content" }}>
        <button onClick={() => setMode("forward")} style={tabBtn("forward")}>{isMobile ? "Forward" : "Forward (price → net)"}</button>
        <button onClick={() => setMode("reverse")} style={tabBtn("reverse")}>{isMobile ? "Reverse" : "Reverse (target net → price)"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 14 }}>Inputs</div>

          {mode === "forward" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={labelStyle}>Sale price (AU$)</div>
                  <input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} style={inp} placeholder="0.00" autoFocus={!isMobile} />
                </div>
                <div>
                  <div style={labelStyle}>Shipping charged</div>
                  <input type="number" step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} style={inp} placeholder="0.00" />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={labelStyle}>Cost (optional, for profit calc)</div>
                <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} style={inp} placeholder="0.00" />
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={labelStyle}>Target net payout (AU$)</div>
              <input type="number" step="0.01" value={targetNet} onChange={(e) => setTargetNet(e.target.value)} style={inp} placeholder="What you want to take home" autoFocus={!isMobile} />
              <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>Calculates list price needed to net this after fees. Assumes shipping included in price.</div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Category tier</div>
            <select value={tier} onChange={(e) => setTier(parseInt(e.target.value))} style={sel}>
              {Object.entries(TIER_RATES).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({pct(v.rate)})</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={labelStyle}>Promoted Listings ad rate (%)</div>
            <input type="number" step="0.1" min="0" max="20" value={adRate} onChange={(e) => setAdRate(e.target.value)} style={inp} placeholder="0" />
            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>Leave 0 if not using Promoted Listings.</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>
              <input type="checkbox" checked={isIntl} onChange={(e) => setIsIntl(e.target.checked)} style={cb} />
              International sale (+1.1%)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9ca3af", cursor: "pointer" }}>
              <input type="checkbox" checked={isBelowStd} onChange={(e) => setIsBelowStd(e.target.checked)} style={cb} />
              Below Standard rating (+5.5%)
            </label>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 14 }}>Breakdown</div>

          {!result ? (
            <div style={{ color: "#374151", fontSize: 13, padding: "60px 0", textAlign: "center" }}>
              Enter {mode === "forward" ? "a sale price" : "a target net"} to see the breakdown
            </div>
          ) : (
            <>
              <div style={{ background: "#0d1117", borderRadius: 10, padding: "16px 18px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                  {mode === "forward" ? "Net payout" : "List price needed"}
                </div>
                <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: "#34d399" }}>
                  {currency(mode === "forward" ? result.netPayout : result.total)}
                </div>
                {mode === "reverse" && (
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                    To net <span style={{ color: "#9ca3af" }}>{currency(parseFloat(targetNet) || 0)}</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 13 }}>
                <Line label="Total sale" value={currency(result.total)} bold />
                <Line label={`Final value fee (${pct(TIER_RATES[tier].rate)}${result.total > CLIFF ? " + cliff" : ""})`} value={"-" + currency(result.fvf)} negative />
                <Line label="Fixed order fee" value={"-" + currency(result.fixedFee)} negative />
                {result.adFee > 0 && <Line label={`Promoted Listings (${adRate}%)`} value={"-" + currency(result.adFee)} negative />}
                {result.intlFee > 0 && <Line label="International fee (1.1%)" value={"-" + currency(result.intlFee)} negative />}
                {result.belowStdFee > 0 && <Line label="Below Standard fee (5.5%)" value={"-" + currency(result.belowStdFee)} negative />}
                <Line label="Total fees" value={"-" + currency(result.totalFees)} negative bold border />
                <Line label="Effective fee rate" value={pct(result.effRate)} subtle />
                <Line label="Net payout" value={currency(result.netPayout)} bold large />
              </div>

              {mode === "forward" && costNum > 0 && (
                <div style={{ background: "#0d1117", borderRadius: 10, padding: 14, marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Profit</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Stat label="Net profit" value={currency(profit)} color={profit >= 0 ? "#34d399" : "#f87171"} />
                    <Stat label="Margin" value={pct(margin)} color={margin >= 0 ? "#34d399" : "#f87171"} />
                    <Stat label="ROI" value={pct(roi)} color={roi >= 0 ? "#34d399" : "#f87171"} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 10 }}>Pro Basic reference</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 16, fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Final value fees (incl. GST)</div>
            <div>Tier 1: 8.03% · Tier 2: 10.34%</div>
            <div>Tier 3: 11.22% · Tier 4: 11.77%</div>
            <div style={{ color: "#6b7280", marginTop: 2 }}>Above $4,000 → 2.75%</div>
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Other fees</div>
            <div>Fixed: $0.33 per order</div>
            <div>International delivery: +1.1%</div>
            <div>Below Standard: +5.5%</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#4b5563", marginTop: 10 }}>
          Sub: $27.45/mo (tracked separately in Expenses, not per-sale)
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, bold, negative, subtle, large, border }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "7px 0",
      borderTop: border ? "1px solid #1f2937" : "none",
      marginTop: border ? 4 : 0,
      gap: 8,
    }}>
      <span style={{ color: subtle ? "#6b7280" : "#9ca3af", fontSize: subtle ? 12 : 13 }}>{label}</span>
      <span style={{
        color: negative ? "#f59e0b" : subtle ? "#9ca3af" : "#f1f5f9",
        fontWeight: bold ? 600 : 400,
        fontSize: large ? 16 : 13,
        whiteSpace: "nowrap",
      }}>{value}</span>
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
