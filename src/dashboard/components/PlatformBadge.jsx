const platformKind = (platform = "") => {
  const value = String(platform).toLowerCase();
  if (value.includes("ebay")) return "ebay";
  if (value.includes("facebook")) return "facebook";
  return "other";
};

const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  height: 20,
  padding: "0 7px",
  borderRadius: 5,
  border: "1px solid #232c3c",
  background: "#1f2937",
  color: "#9aa6bb",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: 0,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

function EbayLogo() {
  const letters = [
    ["e", "#e53238"],
    ["b", "#0064d2"],
    ["a", "#f5af02"],
    ["y", "#86b817"],
  ];
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline", gap: 0, fontFamily: "Arial, Helvetica, sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1 }}>
      {letters.map(([letter, color]) => <span key={letter} style={{ color }}>{letter}</span>)}
    </span>
  );
}

function FacebookLogo() {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: 4, background: "#1877f2", color: "#fff", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>
      f
    </span>
  );
}

export default function PlatformBadge({ platform, compact = false, style }) {
  const kind = platformKind(platform);
  const label = String(platform || "Platform");
  if (kind === "ebay") {
    return (
      <span title={label} aria-label={label} style={{ ...badgeBase, padding: compact ? "0 5px" : "0 7px", background: "#101827", ...style }}>
        <EbayLogo />
      </span>
    );
  }
  if (kind === "facebook") {
    return (
      <span title={label} aria-label={label} style={{ ...badgeBase, padding: compact ? "0 5px" : "0 6px", background: "#10203a", borderColor: "#1d4ed866", ...style }}>
        <FacebookLogo />
      </span>
    );
  }
  return <span title={label} style={{ ...badgeBase, ...style }}>{label.replace(/\s+marketplace/i, "")}</span>;
}

export { platformKind };
