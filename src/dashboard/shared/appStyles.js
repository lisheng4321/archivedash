// ArchiveDash global interaction styles.
// Injected once on import; presentation-only.
const CSS = `
button, [role="button"], a, input, select, textarea {
  transition: filter 120ms ease, box-shadow 120ms ease,
              outline-color 120ms ease, transform 120ms ease;
}
button:not(:disabled):hover,
[role="button"]:not([aria-disabled="true"]):hover { filter: brightness(1.08); }
button[style*="--ad-hover-bg"]:not(:disabled):hover,
[role="button"][style*="--ad-hover-bg"]:not([aria-disabled="true"]):hover,
.ad-nav-button:not(:disabled):hover {
  background: var(--ad-hover-bg, #1a2333) !important;
  filter: none;
}
button:not(:disabled):active,
[role="button"]:not([aria-disabled="true"]):active {
  filter: brightness(0.95); transform: translateY(0.5px);
}
button:disabled { cursor: not-allowed; opacity: 0.5; }
input:focus-visible, select:focus-visible, textarea:focus-visible,
button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid #2563eb; outline-offset: 1px;
}
input:focus-visible, select:focus-visible, textarea:focus-visible {
  box-shadow: 0 0 0 3px rgba(37,99,235,0.18);
}
* { scrollbar-width: thin; scrollbar-color: #2a3548 transparent; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #232c3c; border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
::-webkit-scrollbar-thumb:hover { background: #2f3a4e; background-clip: padding-box; }
::selection { background: rgba(37,99,235,0.32); }
input, select, textarea { font-family: inherit; }
body { font-variant-numeric: tabular-nums; }
.ad-nav-tip::after {
  content: attr(data-tip);
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  transform: translateY(-50%);
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #232c3c;
  background: #1a2333;
  color: #f3f6fb;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 100ms ease;
  z-index: 220;
}
.ad-nav-tip:hover::after,
.ad-nav-tip:focus-visible::after { opacity: 1; }
.archive-data-row {
  position: relative;
  background: #121a2b;
  transition: background-color 120ms ease, box-shadow 120ms ease;
}
.archive-data-row:hover { background: #1a2333 !important; }
.archive-data-row[data-selected="true"] {
  background: #1e293b !important;
  box-shadow: inset 2px 0 0 #2563eb;
}
.archive-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}
.archive-row-action-wrap {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
}
.archive-row-menu {
  position: absolute;
  top: 50%;
  right: 32px;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  transform: translateY(-50%);
  border: 1px solid #334155;
  border-radius: 8px;
  background: #182235;
  box-shadow: 0 8px 22px rgba(0,0,0,0.34);
  white-space: nowrap;
}
@media (hover: hover) {
  .archive-row-actions {
    opacity: 0;
    pointer-events: none;
    transition: opacity 100ms ease;
  }
  .archive-data-row:hover .archive-row-actions,
  .archive-data-row:focus-within .archive-row-actions {
    opacity: 1;
    pointer-events: auto;
  }
}
`;

if (typeof document !== "undefined" && !document.getElementById("ad-global-styles")) {
  const el = document.createElement("style");
  el.id = "ad-global-styles";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export {};
