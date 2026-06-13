import { Children, cloneElement, isValidElement, useEffect, useRef, useState } from "react";
import "./appStyles.js";
import { VERSION } from "./constants.js";
import { C, cardSurface, destructiveBtn, ghostBtn, inp, primaryBtn, smallCaps } from "./styles.js";

function useIsMobile() {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const onR = () => setM(window.innerWidth < 768);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return m;
}

function ConfirmDialog({ open, msg, onConfirm, onCancel, label }) {
  if (!open) return null;
  return (<div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ ...cardSurface, padding: 24, maxWidth: 380, width: "100%", boxShadow: `${cardSurface.boxShadow}, 0 24px 80px rgba(0,0,0,0.45)` }}>
      <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 18, lineHeight: 1.5 }}>{msg}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={onConfirm} style={destructiveBtn}>{label || "Delete"}</button>
      </div>
    </div>
  </div>);
}

// Destructive-action dialog: shows affected record counts and requires the
// user to type a confirmation keyword (e.g. RESTORE / REPLACE / DELETE).
function DangerConfirmDialog({ open, title, intro, counts, keyword, snapshotNote, confirmLabel, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  useEffect(() => { setTyped(""); }, [open, keyword]);
  if (!open) return null;
  const ready = !busy && typed.trim().toUpperCase() === String(keyword || "").toUpperCase();
  return (<div onClick={busy ? undefined : onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ ...cardSurface, padding: 24, maxWidth: 420, width: "100%", borderColor: "#ef444455", boxShadow: `${cardSurface.boxShadow}, 0 24px 80px rgba(0,0,0,0.45)` }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>{title}</div>
      {intro && <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 12 }}>{intro}</div>}
      {Array.isArray(counts) && counts.length > 0 && (
        <div style={{ background: "#0d1117", border: "1px solid #232c3c", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          {counts.map((c) => (
            <div key={c.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#9ca3af", padding: "2px 0" }}>
              <span>{c.label}</span>
              <span style={{ color: "#e5e7eb", fontWeight: 600 }}>{c.value}</span>
            </div>
          ))}
        </div>
      )}
      {snapshotNote && <div style={{ fontSize: 12, color: "#34d399", marginBottom: 12 }}>{snapshotNote}</div>}
      <label style={{ ...smallCaps, display: "block", color: "#7c8aa0", marginBottom: 6 }}>Type {keyword} to confirm</label>
      <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} autoFocus placeholder={keyword} style={{ ...inp, marginBottom: 18 }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} disabled={busy} style={ghostBtn}>Cancel</button>
        <button onClick={onConfirm} disabled={!ready} style={{ ...destructiveBtn, opacity: ready ? 1 : 0.5, cursor: ready ? "pointer" : "not-allowed" }}>{busy ? "Working…" : (confirmLabel || "Confirm")}</button>
      </div>
    </div>
  </div>);
}

function UnsavedDialog({ open, onDiscard, onCancel }) {
  if (!open) return null;
  return (<div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ ...cardSurface, padding: 24, maxWidth: 380, width: "100%", boxShadow: `${cardSurface.boxShadow}, 0 24px 80px rgba(0,0,0,0.45)` }}>
      <div style={{ fontSize: 14, color: "#e5e7eb", marginBottom: 6, fontWeight: 600 }}>Unsaved changes</div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 18 }}>Are you sure you want to close? Changes will be lost.</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancel} style={ghostBtn}>Keep editing</button>
        <button onClick={onDiscard} style={destructiveBtn}>Discard</button>
      </div>
    </div>
  </div>);
}

function Modal({ open, onClose, title, children, guardedClose, maxWidth = 560 }) {
  const isMobile = useIsMobile();
  const backdropPointerDown = useRef(false);
  if (!open) return null;
  const close = guardedClose || onClose;
  const backdropDown = (e) => { backdropPointerDown.current = e.target === e.currentTarget; };
  const backdropUp = (e) => {
    if (backdropPointerDown.current && e.target === e.currentTarget) close();
    backdropPointerDown.current = false;
  };
  return (<div onMouseDown={backdropDown} onMouseUp={backdropUp} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 200, display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "center", padding: isMobile ? 8 : 16, boxSizing: "border-box" }}>
    <div role="dialog" aria-modal="true" style={{ ...cardSurface, width: "100%", maxWidth: isMobile ? "100%" : maxWidth, maxHeight: isMobile ? "calc(100vh - 16px)" : "90vh", overflowY: "auto", borderRadius: isMobile ? 10 : cardSurface.borderRadius, boxShadow: `${cardSurface.boxShadow}, 0 30px 90px rgba(0,0,0,0.5)` }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", padding: isMobile ? "12px 14px" : "14px 20px", borderBottom: "1px solid #232c3c", background: "#121a2b" }}>
        <h3 style={{ margin: 0, color: "#f3f6fb", fontSize: 15, fontWeight: 600 }}>{title}</h3>
        <button aria-label="Close" onClick={close} style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#1f2937", border: "1px solid #232c3c", borderRadius: 8, color: "#9aa6bb", fontSize: 18, cursor: "pointer" }}>{"\u2715"}</button>
      </div>
      <div style={{ padding: isMobile ? 14 : 20 }}>{children}</div>
    </div>
  </div>);
}

const Field = ({ label, req, children }) => (<div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, color: "#9aa6bb", display: "block", marginBottom: 5, fontWeight: 600 }}>{label}{req && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>{children}</div>);
const Row = ({ children, cols = 2 }) => {
  const isMobile = useIsMobile();
  return <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${cols}, 1fr)`, gap: isMobile ? 0 : 12 }}>{children}</div>;
};
function ModalActions({ children, justify = "flex-end", mobileStack = true, marginTop = 14, style }) {
  const isMobile = useIsMobile();
  const stack = isMobile && mobileStack;
  const bodyPadding = isMobile ? 14 : 20;
  const actionChildren = stack ? Children.map(children, (child) => (
    isValidElement(child) ? cloneElement(child, { style: { ...child.props.style, width: "100%" } }) : child
  )) : children;
  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 2, display: "flex", justifyContent: stack ? "stretch" : justify, gap: 8, marginTop, marginLeft: -bodyPadding, marginRight: -bodyPadding, marginBottom: -bodyPadding, padding: `12px ${bodyPadding}px ${bodyPadding}px`, flexDirection: stack ? "column-reverse" : "row", background: C.panel, borderTop: `1px solid ${C.border}`, ...style }}>
      {actionChildren}
    </div>
  );
}
function ResponsiveGrid({ children, columns, mobileColumns = "1fr", gap = 12, style, ...props }) {
  const isMobile = useIsMobile();
  return (
    <div {...props} style={{ display: "grid", gridTemplateColumns: isMobile ? mobileColumns : columns, gap, ...style }}>
      {children}
    </div>
  );
}
function KPI({ label, value, accent }) { return (<div style={{ ...cardSurface, padding: "14px 16px", flex: 1, minWidth: 0 }}><div style={{ ...smallCaps, marginBottom: 5 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 750, color: accent || "#f3f6fb", fontVariantNumeric: "tabular-nums" }}>{value}</div></div>); }

function TopBar({ saveStatus, isMobile }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    ...(isMobile ? {} : { weekday: "short", timeZoneName: "short" }),
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const month = isMobile ? get("month").slice(0, 3) : get("month");
  const dateStr = `${isMobile ? "" : `${get("weekday")}, `}${get("day")} ${month}`;
  const timeStr = `${get("hour")}:${get("minute")}`;
  const tz = get("timeZoneName");
  const dot = saveStatus === "saving" ? "#f59e0b" : saveStatus === "saved" ? "#34d399" : saveStatus === "error" ? "#f87171" : "#374151";
  const dotLabel = saveStatus === "saving" ? "Saving\u2026" : saveStatus === "saved" ? "Saved" : "Idle";
  const statusLabel = saveStatus === "error" ? "Save failed" : dotLabel;
  const isError = saveStatus === "error";
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 90, background: "#0b0f19", borderBottom: "1px solid #232c3c", padding: isMobile ? "6px 12px" : "6px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#7c8aa0", height: 32, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden", whiteSpace: "nowrap" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#8b97ad", flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        <span style={{ color: "#f3f6fb", fontWeight: 500 }}>{`${dateStr}, ${timeStr}${isMobile ? "" : ` ${tz}`}`}</span>
        {!isMobile && <span style={{ color: "#8b97ad" }}>{"\u00b7 Sydney"}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
        {isError ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 999, background: "#7f1d1d", border: "1px solid #f87171", color: "#fecaca", fontSize: 11, fontWeight: 800, letterSpacing: 0.2, whiteSpace: "nowrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171" }} />
            Save failed
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, transition: "background 200ms", boxShadow: `0 0 0 3px ${dot}22` }} />
            {(!isMobile || saveStatus === "saving") && <span style={{ whiteSpace: "nowrap" }}>{statusLabel}</span>}
          </span>
        )}
        <span title="Version" style={{ marginLeft: isMobile ? 0 : 6, padding: "2px 6px", borderRadius: 999, border: "1px solid #232c3c", background: "#121a2b", color: "#a7c8fb", fontSize: 11, fontWeight: 800, lineHeight: 1.2, letterSpacing: 0.2 }}>v{VERSION}</span>
      </div>
    </div>
  );
}

// Empty state that can point to the next useful action. `actions` is an
// optional array of { label, onClick, primary, disabled } button descriptors.
function EmptyState({ title, hint, actions }) {
  const buttons = Array.isArray(actions) ? actions.filter(Boolean) : [];
  return (
    <div style={{ ...cardSurface, padding: "28px 18px", textAlign: "center", color: "#7c8aa0" }}>
      <div style={{ color: "#d1d5db", fontSize: 13, fontWeight: 700, marginBottom: hint ? 5 : 0 }}>{title}</div>
      {hint && <div style={{ fontSize: 12, lineHeight: 1.5 }}>{hint}</div>}
      {buttons.length > 0 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
          {buttons.map((a) => (
            <button key={a.label} onClick={a.onClick} disabled={a.disabled} style={{ ...(a.primary ? primaryBtn : ghostBtn), ...(a.disabled ? { opacity: 0.6, cursor: "not-allowed" } : {}) }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function Spark({ data, color = "#3b82f6" }) {
  const w = 500, h = 100;
  if (!data || data.length < 2) return <div style={{ height: h, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>No trend data yet</div>;
  const max = Math.max(...data), min = Math.min(...data), r = max - min || 1;
  const pts = data.map((v, i) => [((i / (data.length - 1)) * (w - 8)) + 4, h - 8 - ((v - min) / r) * (h - 16)]);
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
  const area = line + ` L${pts[pts.length - 1][0]} ${h} L${pts[0][0]} ${h} Z`;
  return (<svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><path d={area} fill="url(#sg)" /><path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" /><circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={color} /></svg>);
}

export {
  useIsMobile,
  ConfirmDialog,
  DangerConfirmDialog,
  UnsavedDialog,
  Modal,
  Field,
  Row,
  ModalActions,
  ResponsiveGrid,
  KPI,
  TopBar,
  EmptyState,
  Spark,
};
