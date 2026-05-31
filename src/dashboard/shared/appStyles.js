// ArchiveDash global interaction styles.
// Injected once on import; presentation-only.
const CSS = `
button, [role="button"], a, input, select, textarea {
  transition: filter 120ms ease, box-shadow 120ms ease,
              outline-color 120ms ease, transform 120ms ease;
}
button:not(:disabled):hover,
[role="button"]:not([aria-disabled="true"]):hover { filter: brightness(1.08); }
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
`;

if (typeof document !== "undefined" && !document.getElementById("ad-global-styles")) {
  const el = document.createElement("style");
  el.id = "ad-global-styles";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export {};
