// ArchiveDash shared inline-style constants.
// Presentation only. No data / auth / Supabase logic lives here.
const C = {
  app: "#0b0f19",
  panel: "#121a2b",
  inset: "#0d1117",
  selected: "#1e293b",
  border: "#232c3c",
  raised: "#1a2333",
  ghost: "#1f2937",
  accent: "#2563eb",
  fgPrimary: "#f3f6fb",
  fgBody: "#d6dbe4",
  fgSecondary: "#9aa6bb",
  fgMuted: "#8b97ad",
  fgDisabled: "#56627a",
  success: "#34d399",
  danger: "#f87171",
  dangerAction: "#dc2626",
  warning: "#f59e0b",
  info: "#60a5fa",
  fg1: "#f3f6fb",
  fg3: "#d6dbe4",
  fg4: "#9aa6bb",
  fg5: "#8b97ad",
  destructive: "#dc2626",
};

const cardHighlight = "inset 0 1px 0 rgba(255,255,255,0.04)";

const inp = {
  width: "100%",
  padding: "9px 11px",
  background: C.inset,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: "#e5e7eb",
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: "inherit",
  transition: "border-color 120ms ease, box-shadow 120ms ease",
};
const sel = { ...inp, appearance: "none" };
const primaryBtn = {
  padding: "9px 18px",
  background: C.accent,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  letterSpacing: 0.1,
  transition: "filter 120ms ease, box-shadow 120ms ease",
};
const ghostBtn = {
  padding: "9px 18px",
  background: C.ghost,
  color: C.fg3,
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "filter 120ms ease",
};
const destructiveBtn = { ...primaryBtn, background: C.destructive };
const cb = { width: 16, height: 16, accentColor: C.accent, cursor: "pointer" };

const badge = (bg, fg) => ({
  fontSize: 11,
  background: bg,
  color: fg,
  padding: "2px 6px",
  borderRadius: 4,
  marginLeft: 5,
  fontWeight: 700,
  letterSpacing: 0.2,
});

const cardSurface = {
  background: C.panel,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  boxShadow: cardHighlight,
};
const panel = { ...cardSurface, padding: 16 };
const smallCaps = {
  fontSize: 11,
  fontWeight: 800,
  color: C.fgMuted,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};
const mutedText = { fontSize: 12, color: C.fg5 };
const chip = {
  fontSize: 12,
  color: C.fg4,
  background: C.ghost,
  border: `1px solid ${C.border}`,
  padding: "4px 10px",
  borderRadius: 999,
  fontFamily: "inherit",
};

export {
  C,
  inp,
  sel,
  primaryBtn,
  ghostBtn,
  destructiveBtn,
  cb,
  badge,
  cardSurface,
  cardHighlight,
  panel,
  smallCaps,
  mutedText,
  chip,
};
