import { ghostBtn, primaryBtn, inp } from "../shared.jsx";
import { NotepadEditor } from "../modals.jsx";

export default function NotepadPage({ ctx }) {
  const {
    pagePad,
    isMobile,
    notes,
    activeNote,
    activeNoteId,
    setActiveNoteId,
    noteSearch,
    setNoteSearch,
    sortedNotes,
    createNote,
    updateNote,
    moveNote,
    toggleLockNote,
    togglePinNote,
    setConfirmDel,
    userTemplates,
    setTplManagerOpen,
    exportNoteTxt,
  } = ctx;

  return (<div style={{ padding: pagePad, display: "flex", flexDirection: "column", height: "calc(100vh - 32px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f3f6fb" }}>Notepad</h2>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b97ad" }}>
                {notes.length} note{notes.length === 1 ? "" : "s"}
                {activeNote && activeNote.updatedAt ? ` · saved ${new Date(activeNote.updatedAt).toLocaleString("en-AU", { timeZone: "Australia/Sydney", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}` : ""}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>
            {/* LEFT: Notes list */}
            <div style={{ width: isMobile ? "100%" : 240, maxHeight: isMobile ? 150 : "none", background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid #232c3c" }}>
                <button onClick={() => createNote()} style={{ ...primaryBtn, width: "100%", padding: "7px 10px", fontSize: 12 }}>+ New note</button>
              </div>
              <div style={{ padding: "8px 10px", borderBottom: "1px solid #232c3c" }}>
                <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search notes…" style={{ ...inp, padding: "6px 10px", fontSize: 12 }} />
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: "6px" }}>
                {sortedNotes.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#374151" }}>No notes yet.<br />Hit "+ New note".</div>}
                {sortedNotes.map((n) => {
                  const isActive = n.id === activeNoteId;
                  const dateStr = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short" }) : "";
                  return (
                    <div key={n.id} onClick={() => setActiveNoteId(n.id)} style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 3, cursor: "pointer", background: isActive ? "#1e293b" : "transparent", border: isActive ? "1px solid #2563eb55" : "1px solid transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        {n.pinned && <span style={{ fontSize: 11, color: "#fbbf24" }}>●</span>}
                        {n.locked && <span title="Locked" aria-label="Locked" style={{ fontSize: 11, color: "#93c5fd", lineHeight: 1 }}>🔒</span>}
                        <div style={{ fontSize: 13, color: isActive ? "#f3f6fb" : "#d1d5db", fontWeight: isActive ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{n.title || "Untitled"}</div>
                        <button onClick={(e) => { e.stopPropagation(); moveNote(n.id, -1); }} title="Move up" style={{ ...ghostBtn, padding: isMobile ? 0 : "5px 7px", fontSize: 12, minWidth: isMobile ? 40 : 28, minHeight: isMobile ? 40 : 28 }}>↑</button>
                        <button onClick={(e) => { e.stopPropagation(); moveNote(n.id, 1); }} title="Move down" style={{ ...ghostBtn, padding: isMobile ? 0 : "5px 7px", fontSize: 12, minWidth: isMobile ? 40 : 28, minHeight: isMobile ? 40 : 28 }}>↓</button>
                      </div>
                      <div style={{ fontSize: 11, color: "#8b97ad", marginTop: 2 }}>{dateStr}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Editor */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0, minHeight: 0 }}>
              {!activeNote ? (
                <div style={{ flex: 1, background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
                  <div style={{ color: "#8b97ad", fontSize: 13 }}>No note selected</div>
                  <button onClick={() => createNote()} style={primaryBtn}>+ Create your first note</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input value={activeNote.title} disabled={Boolean(activeNote.locked)} onChange={(e) => updateNote(activeNote.id, { title: e.target.value })} placeholder="Note title" style={{ ...inp, flex: 1, minWidth: 200, minHeight: 40, fontSize: 15, fontWeight: 600, opacity: activeNote.locked ? 0.72 : 1, cursor: activeNote.locked ? "not-allowed" : "text" }} />
                    {/* Routine note controls grouped together */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={() => toggleLockNote(activeNote.id)} title={activeNote.locked ? "Unlock editing" : "Lock editing"} style={{ ...ghostBtn, padding: "9px 14px", minHeight: 40, minWidth: 44, fontSize: 13, color: activeNote.locked ? "#93c5fd" : "#9ca3af", border: activeNote.locked ? "1px solid #2563eb66" : ghostBtn.border }}>{activeNote.locked ? "Locked" : "Lock"}</button>
                      <button onClick={() => togglePinNote(activeNote.id)} title={activeNote.pinned ? "Unpin" : "Pin"} style={{ ...ghostBtn, padding: "9px 14px", minHeight: 40, minWidth: 44, fontSize: 13, color: activeNote.pinned ? "#fbbf24" : "#9ca3af" }}>{activeNote.pinned ? "★" : "☆"}</button>
                    </div>
                    {/* Destructive control separated from routine controls */}
                    <button onClick={() => setConfirmDel({ type: "note", id: activeNote.id, name: activeNote.title || "Untitled" })} title="Delete note" style={{ ...ghostBtn, marginLeft: "auto", padding: "9px 14px", minHeight: 40, minWidth: 44, fontSize: 13, color: "#f87171", background: "#2a1a1d", border: "1px solid #ef444444" }}>Delete</button>
                  </div>
                  <div style={{ flex: 1, background: "#121a2b", borderRadius: 12, border: "1px solid #232c3c", overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <NotepadEditor note={activeNote} onUpdate={(changes) => updateNote(activeNote.id, changes)} isMobile={isMobile} templates={userTemplates || []} onManageTemplates={() => setTplManagerOpen(true)} onExport={() => exportNoteTxt(activeNote)} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>);
}
