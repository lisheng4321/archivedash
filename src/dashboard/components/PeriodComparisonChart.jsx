import { useState } from "react";
import { currency } from "../shared.jsx";

const shortDateLabel = (dateStr = "") => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr || "";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

export { shortDateLabel };

export default function PeriodComparisonChart({ points = [], isMobile }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const chartPoints = points.length ? points : [
    { key: "empty-1", label: "Start", currentDate: "", previousDate: "", current: 0, previous: 0, currentSales: 0, previousSales: 0 },
    { key: "empty-2", label: "End", currentDate: "", previousDate: "", current: 0, previous: 0, currentSales: 0, previousSales: 0 },
  ];
  const width = 1000;
  const height = isMobile ? 180 : 168;
  const pad = { top: 10, right: 22, bottom: 28, left: 76 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = chartPoints.flatMap((p) => [Number(p.current) || 0, Number(p.previous) || 0, 0]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawSpan = Math.max(1, rawMax - rawMin);
  const niceStep = (range) => {
    const rough = Math.max(1, range / 5);
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
  };
  const step = niceStep(rawSpan);
  const paddedMin = rawMin - rawSpan * 0.12;
  const paddedMax = rawMax + rawSpan * 0.12;
  const min = Math.floor(paddedMin / step) * step;
  const max = Math.ceil(paddedMax / step) * step;
  const span = max === min ? 1 : max - min;
  const tickValues = [];
  for (let value = min; value <= max + step / 2; value += step) tickValues.push(Math.abs(value) < 0.0001 ? 0 : value);
  const xFor = (index) => pad.left + (chartPoints.length <= 1 ? plotW / 2 : (index / (chartPoints.length - 1)) * plotW);
  const yFor = (value) => pad.top + ((max - value) / span) * plotH;
  const pathFor = (key) => chartPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${yFor(Number(p[key]) || 0).toFixed(2)}`).join(" ");
  const labelIndexes = [...new Set([0, Math.floor((chartPoints.length - 1) / 2), chartPoints.length - 1])];
  const hoverPoint = hoverIndex === null ? chartPoints[chartPoints.length - 1] : chartPoints[hoverIndex];
  const hoverX = xFor(hoverIndex === null ? chartPoints.length - 1 : hoverIndex);
  const hoverY = yFor(Math.max(Number(hoverPoint.current) || 0, Number(hoverPoint.previous) || 0));
  const tooltipLeft = hoverX < 120 ? "110px" : hoverX > width - 120 ? "calc(100% - 110px)" : `${(hoverX / width) * 100}%`;
  const hoverBand = chartPoints.length <= 1 ? plotW : plotW / Math.max(1, chartPoints.length - 1);

  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label="Net profit current period compared with previous period" style={{ display: "block", overflow: "visible" }}>
        {tickValues.map((value) => (
          <g key={value}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(value)} y2={yFor(value)} stroke={value === 0 ? "#334155" : "#232c3c"} strokeWidth={value === 0 ? "1.2" : "1"} />
          </g>
        ))}
        <path d={pathFor("previous")} fill="none" stroke="#64748b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 7" />
        <path d={pathFor("current")} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chartPoints.map((p, i) => (
          <g key={p.key || `${p.currentDate}-${i}`}>
            <rect
              x={Math.max(pad.left, xFor(i) - hoverBand / 2)}
              y={pad.top}
              width={Math.min(hoverBand, width - pad.right - Math.max(pad.left, xFor(i) - hoverBand / 2))}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          </g>
        ))}
        {hoverIndex !== null && <>
          <line x1={hoverX} x2={hoverX} y1={pad.top} y2={pad.top + plotH} stroke="#2563eb" strokeWidth="1" opacity="0.7" />
          <circle cx={hoverX} cy={yFor(Number(hoverPoint.current) || 0)} r="4" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
          <circle cx={hoverX} cy={yFor(Number(hoverPoint.previous) || 0)} r="4" fill="#64748b" stroke="#0f172a" strokeWidth="2" />
        </>}
      </svg>
      {tickValues.map((value) => (
        <div key={value} style={{ position: "absolute", left: 0, top: yFor(value) - 7, width: 68, textAlign: "right", color: value === 0 ? "#94a3b8" : "#64748b", fontSize: 11, pointerEvents: "none" }}>{currency(value)}</div>
      ))}
      {labelIndexes.map((index) => {
        const point = chartPoints[index];
        const transform = index === 0 ? "translateX(0)" : index === chartPoints.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
        return (
          <div key={`${point?.key || index}-label`} style={{ position: "absolute", left: `${(xFor(index) / width) * 100}%`, bottom: 18, transform, color: "#64748b", fontSize: 11, whiteSpace: "nowrap", pointerEvents: "none" }}>{point?.label}</div>
        );
      })}
      {hoverIndex !== null && <div style={{ position: "absolute", top: Math.max(8, Math.min(height - 88, hoverY - 64)), left: tooltipLeft, transform: "translateX(-50%)", width: 210, padding: "8px 10px", borderRadius: 8, background: "#0b1220", border: "1px solid #232c3c", boxShadow: "0 12px 28px rgba(0,0,0,.35)", pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 700 }}>{hoverPoint.currentDate || "Current"}</span>
          <span style={{ color: "#bfdbfe", fontSize: 11, fontWeight: 700 }}>{currency(hoverPoint.current || 0)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>{hoverPoint.previousDate || "Previous"}</span>
          <span style={{ color: "#cbd5e1", fontSize: 11, fontWeight: 700 }}>{currency(hoverPoint.previous || 0)}</span>
        </div>
        <div style={{ color: "#64748b", fontSize: 11 }}>Units sold: <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{hoverPoint.currentSales || 0}</span> vs <span style={{ color: "#e5e7eb", fontWeight: 700 }}>{hoverPoint.previousSales || 0}</span></div>
      </div>}
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: -10, fontSize: 11, color: "#94a3b8" }}>
        <span><span style={{ display: "inline-block", width: 18, height: 3, background: "#3b82f6", borderRadius: 999, marginRight: 6, verticalAlign: "middle" }} />Current period</span>
        <span><span style={{ display: "inline-block", width: 18, height: 0, borderTop: "3px dashed #64748b", marginRight: 6, verticalAlign: "middle" }} />Previous period</span>
      </div>
    </div>
  );
}
