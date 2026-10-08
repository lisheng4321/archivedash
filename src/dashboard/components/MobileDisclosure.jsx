export default function MobileDisclosure({ isMobile, label, children }) {
  if (!isMobile) return <>{children}</>;
  return <details style={{ width: "100%", marginBottom: 10, fontSize: 12, color: "#9aa6bb" }}><summary style={{ cursor: "pointer", padding: "7px 0" }}>{label}</summary>{children}</details>;
}
