import { useEffect, useMemo, useRef, useState } from "react";
import { FONT_SIZES, TEMPLATES, renderTemplate, sanitizeHtml, stripHtml, genId, inp, sel, primaryBtn, ghostBtn, badge, Modal, UnsavedDialog, Field, ModalActions } from "../shared.jsx";

function NotepadEditor({ note, onUpdate, height = "100%", showTemplates = true, isMobile = false, templates = [], onManageTemplates, onExport, compact = false }) {
  const editorRef = useRef(null);
  const [tplOpen, setTplOpen] = useState(false);
  const lastNoteId = useRef(null);

  // Load fresh HTML when active note changes
  useEffect(() => {
    if (!editorRef.current || !note) return;
    if (lastNoteId.current !== note.id) {
      editorRef.current.innerHTML = sanitizeHtml(note.content || "");
      lastNoteId.current = note.id;
    }
  }, [note?.id]);

  if (!note) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", fontSize: 13, padding: 20 }}>
        Select or create a note to start writing.
      </div>
    );
  }

  const fontSize = note.fontSize || 14;
  const locked = Boolean(note.locked);
  const updateContent = () => {
    if (locked) return;
    if (editorRef.current) onUpdate({ content: sanitizeHtml(editorRef.current.innerHTML) });
  };

  const exec = (cmd, val = null) => {
    if (locked) return;
    document.execCommand(cmd, false, val);
    updateContent();
  };

  const undoRedo = (cmd) => {
    if (locked || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(cmd);
    requestAnimationFrame(updateContent);
  };

  const insertHtml = (html) => {
    if (locked || !editorRef.current) return;
    editorRef.current.focus();
    document.execCommand("insertHTML", false, sanitizeHtml(html));
    updateContent();
  };

  const insertPlainText = (text) => {
    const tmp = document.createElement("div");
    tmp.textContent = text || "";
    insertHtml(tmp.innerHTML.replace(/\n/g, "<br>"));
  };

  const insertCheckbox = () => {
    insertHtml(`<div><label><input type="checkbox"> </label></div>`);
  };

  const insertTemplate = (tpl) => {
    insertHtml(renderTemplate(tpl.body));
    setTplOpen(false);
  };

  const bumpFont = (delta) => {
    if (locked) return;
    const idx = FONT_SIZES.indexOf(fontSize);
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, (idx === -1 ? 2 : idx) + delta));
    onUpdate({ fontSize: FONT_SIZES[nextIdx] });
  };

  // Click handler for any rendered checkbox inside the editor
  const onEditorClick = (e) => {
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "checkbox") {
      if (locked) {
        e.preventDefault();
        return;
      }
      if (t.checked) t.setAttribute("checked", "checked"); else t.removeAttribute("checked");
      requestAnimationFrame(updateContent);
    }
  };

  const onEditorPaste = (e) => {
    e.preventDefault();
    if (locked) return;
    const html = e.clipboardData?.getData("text/html");
    const text = e.clipboardData?.getData("text/plain") || "";
    if (html) insertHtml(html);
    else insertPlainText(text);
  };

  const tBtn = { width: isMobile ? 28 : 30, height: isMobile ? 26 : 28, background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height, minHeight: 0 }}>
      <div style={{ display: "flex", gap: isMobile ? 3 : 4, padding: isMobile ? "6px 8px" : "8px 12px", borderBottom: "1px solid #232c3c", flexWrap: "wrap", alignItems: "center" }}>
        <button onMouseDown={(e) => { e.preventDefault(); undoRedo("undo"); }} title="Undo" style={tBtn}>↶</button>
        <button onMouseDown={(e) => { e.preventDefault(); undoRedo("redo"); }} title="Redo" style={tBtn}>↷</button>
        <span style={{ width: 1, height: 18, background: "#232c3c", margin: "0 2px" }} />
        <button onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} title="Bold" style={{ ...tBtn, fontWeight: 800 }}>B</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} title="Italic" style={{ ...tBtn, fontStyle: "italic" }}>I</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} title="Underline" style={{ ...tBtn, textDecoration: "underline" }}>U</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} title="Bullet list" style={{ ...tBtn, fontSize: 16, lineHeight: 1 }}>•</button>
        <button onMouseDown={(e) => { e.preventDefault(); insertCheckbox(); }} title="Insert checkbox" style={{ ...tBtn, fontSize: 12 }}>☑</button>

        {!compact && !isMobile && (<>
          <span style={{ width: 1, height: 18, background: "#232c3c", margin: "0 2px" }} />
          <button onMouseDown={(e) => { e.preventDefault(); bumpFont(-1); }} title="Smaller text" style={{ ...tBtn, fontWeight: 700 }}>A−</button>
          <select disabled={locked} value={fontSize} onChange={(e) => !locked && onUpdate({ fontSize: parseInt(e.target.value) })} title="Font size" style={{ ...sel, height: 28, padding: "0 6px", fontSize: 12, width: 64, flexShrink: 0, opacity: locked ? 0.45 : 1, cursor: locked ? "not-allowed" : "pointer" }}>
            {FONT_SIZES.map((f) => <option key={f} value={f}>{f}px</option>)}
          </select>
          <button onMouseDown={(e) => { e.preventDefault(); bumpFont(1); }} title="Bigger text" style={{ ...tBtn, fontSize: 15, fontWeight: 700 }}>A+</button>
        </>)}

        {showTemplates && !isMobile && templates.length > 0 && (
          <div style={{ position: "relative", marginLeft: 4 }}>
            <button onMouseDown={(e) => { e.preventDefault(); setTplOpen((o) => !o); }} title="Insert template" style={{ ...tBtn, width: "auto", padding: "0 10px", fontSize: 11 }}>+ Template ▾</button>
            {tplOpen && (
              <>
                <div onClick={() => setTplOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
                <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#0b0f19", border: "1px solid #232c3c", borderRadius: 8, padding: 4, minWidth: 220, zIndex: 11, boxShadow: "0 6px 18px rgba(0,0,0,0.5)" }}>
                  {templates.map((t) => (
                    <button key={t.id} onMouseDown={(e) => { e.preventDefault(); insertTemplate(t); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#d1d5db", fontSize: 12, cursor: "pointer", borderRadius: 6, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#232c3c"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{t.name}</button>
                  ))}
                  {onManageTemplates && (<>
                    <div style={{ height: 1, background: "#232c3c", margin: "4px 0" }} />
                    <button onMouseDown={(e) => { e.preventDefault(); setTplOpen(false); onManageTemplates(); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "transparent", border: "none", color: "#9ca3af", fontSize: 11, cursor: "pointer", borderRadius: 6, fontFamily: "inherit" }} onMouseEnter={(e) => e.currentTarget.style.background = "#232c3c"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>⚙ Manage templates…</button>
                  </>)}
                </div>
              </>
            )}
          </div>
        )}

        {!compact && !isMobile && onExport && (
          <button onClick={onExport} title="Export this note as .txt" style={{ ...tBtn, width: "auto", padding: "0 10px", fontSize: 11, marginLeft: "auto" }}>Export .txt</button>
        )}
      </div>
      <div
        ref={editorRef}
        className="np-edit"
        contentEditable={!locked}
        aria-readonly={locked}
        onInput={updateContent}
        onClick={onEditorClick}
        onPaste={onEditorPaste}
        onDrop={(e) => e.preventDefault()}
        suppressContentEditableWarning
        style={{ flex: 1, background: locked ? "#0b1220" : "#0d1117", color: locked ? "#cbd5e1" : "#e5e7eb", border: "none", padding: 16, fontSize, lineHeight: 1.7, outline: "none", fontFamily: "'DM Sans', sans-serif", overflowY: "auto", minHeight: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", cursor: locked ? "default" : "text" }}
      />
    </div>
  );
}

// ─── Template Manager Modal ───

function TemplateManagerModal({ templates, onSave, onClose }) {
  const [list, setList] = useState(templates.map((t) => ({ ...t })));
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", body: "" });
  const [dirty, setDirty] = useState(false);
  const [showU, setShowU] = useState(false);

  const startEdit = (t) => { setEditingId(t.id); setDraft({ name: t.name, body: t.body }); };
  const cancelEdit = () => { setEditingId(null); setDraft({ name: "", body: "" }); };
  const saveEdit = () => {
    if (!draft.name.trim()) return;
    if (editingId === "new") {
      setList([...list, { id: genId(), name: draft.name.trim(), body: draft.body, builtIn: false }]);
    } else {
      setList(list.map((t) => t.id === editingId ? { ...t, name: draft.name.trim(), body: draft.body } : t));
    }
    setDirty(true);
    cancelEdit();
  };
  const removeTpl = (id) => { setList(list.filter((t) => t.id !== id)); setDirty(true); };

  const gc = () => { if (dirty || editingId) setShowU(true); else onClose(); };

  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Manage templates">
    <p style={{ fontSize: 12, color: "#7c8aa0", margin: "0 0 12px" }}>
      Templates inserted from the notepad toolbar. HTML is allowed. Use <code style={{ background: "#232c3c", padding: "1px 4px", borderRadius: 3 }}>{"${date}"}</code> to insert today's Sydney date when used.
    </p>

    {editingId ? (
      <div style={{ background: "#0d1117", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <Field label="Name" req><input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inp} placeholder="e.g. Quick listing" autoFocus /></Field>
        <Field label="Body (HTML allowed)">
          <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} style={{ ...inp, minHeight: 160, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: 1.5, resize: "vertical" }} placeholder='<b>Title</b><div>Item: </div><div><label><input type="checkbox"> Step 1</label></div>' />
        </Field>
        <ModalActions marginTop={0}>
          <button onClick={cancelEdit} style={ghostBtn}>Cancel</button>
          <button onClick={saveEdit} style={primaryBtn}>{editingId === "new" ? "Add" : "Save"}</button>
        </ModalActions>
      </div>
    ) : (
      <button onClick={() => { setEditingId("new"); setDraft({ name: "", body: "" }); }} style={{ ...primaryBtn, marginBottom: 12, width: "100%" }}>+ New template</button>
    )}

    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
      {list.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#374151" }}>No templates. Add one above.</div>}
      {list.map((t) => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#0d1117", borderRadius: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#e5e7eb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}{t.builtIn && <span style={badge("#232c3c", "#7c8aa0")}>SEED</span>}</div>
            <div style={{ fontSize: 11, color: "#7c8aa0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtml(t.body).slice(0, 80) || "Empty"}</div>
          </div>
          <button onClick={() => startEdit(t)} style={{ padding: "4px 9px", background: "#232c3c", color: "#d1d5db", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Edit</button>
          <button onClick={() => removeTpl(t.id)} style={{ padding: "4px 9px", background: "#232c3c", color: "#f87171", border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
      ))}
    </div>

    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
      <button onClick={() => { if (confirm("Reset all templates to the built-in defaults? Your custom templates will be lost.")) { setList(TEMPLATES.map((t) => ({ id: genId(), name: t.name, body: t.body, builtIn: true }))); setDirty(true); } }} style={{ ...ghostBtn, fontSize: 11, padding: "5px 10px" }}>Reset to defaults</button>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={gc} style={ghostBtn}>Cancel</button>
        <button onClick={() => onSave(list)} style={primaryBtn}>Save changes</button>
      </div>
    </div>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}


export {
  NotepadEditor,
  TemplateManagerModal
};
