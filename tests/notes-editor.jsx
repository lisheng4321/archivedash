// Test-only fixture. No database or production account is used.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NotepadEditor } from '../src/dashboard/modals/notes.jsx';
function NotesEditorFixture() {
  const [note, setNote] = useState({id:'fixture',content:'Original note',fontSize:14});
  return <main>
    <h1>Notes editor regression fixture</h1>
    <button onClick={()=>setNote(n=>({...n,content:'Recovered snapshot text'}))}>Recover same note</button>
    <button onClick={()=>setNote({id:'second',content:'Second note text'})}>Switch note</button>
    <button onClick={()=>setNote(n=>({...n,locked:!n.locked}))}>Toggle lock</button>
    <NotepadEditor note={note} onUpdate={changes=>setNote(n=>({...n,...changes}))} height={240}/>
    <NotepadEditor note={note} onUpdate={changes=>setNote(n=>({...n,...changes}))} height={240}/>
    <output>{note.content}</output>
  </main>;
}
createRoot(document.getElementById('root')).render(<NotesEditorFixture/>);
