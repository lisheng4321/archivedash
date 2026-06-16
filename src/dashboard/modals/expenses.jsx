import { useState } from "react";
import { EXP_CATEGORIES, inp, sel, primaryBtn, ghostBtn, Modal, UnsavedDialog, Field, Row, ModalActions } from "../shared.jsx";

function EditExpModal({ expense, onSave, onClose, paymentMethods = [] }) {
  const [ef, setEf] = useState({ name: expense.name, amount: expense.amount, purchaseDate: expense.purchaseDate, tags: expense.tags || "", expCategory: expense.expCategory || "Other", paymentMethod: expense.paymentMethod || "Other" });
  const [showU, setShowU] = useState(false);
  const up = (u) => { setEf({ ...ef, ...u }); };
  const gc = () => { setShowU(true); };
  return (<><Modal open={true} onClose={onClose} guardedClose={gc} title="Edit expense">
    <Field label="Name" req><input value={ef.name} onChange={(e) => up({ name: e.target.value })} style={inp} /></Field>
    <Row><Field label="Amount (AU$)" req><input type="number" step="0.01" value={ef.amount} onChange={(e) => up({ amount: e.target.value })} style={inp} /></Field><Field label="Date"><input type="date" value={ef.purchaseDate} onChange={(e) => up({ purchaseDate: e.target.value })} style={inp} /></Field></Row>
    <Row><Field label="Category"><select value={ef.expCategory} onChange={(e) => up({ expCategory: e.target.value })} style={sel}>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="Payment method"><select value={ef.paymentMethod} onChange={(e) => up({ paymentMethod: e.target.value })} style={sel}>{[...new Set([...paymentMethods, ef.paymentMethod || "Other"])].filter(Boolean).map((p) => <option key={p}>{p}</option>)}</select></Field></Row>
    <Field label="Tags"><input value={ef.tags} onChange={(e) => up({ tags: e.target.value })} style={inp} /></Field>
    <ModalActions marginTop={10}><button onClick={gc} style={ghostBtn}>Cancel</button><button onClick={() => onSave({ ...expense, ...ef, amount: parseFloat(ef.amount) })} style={primaryBtn}>Save</button></ModalActions>
  </Modal><UnsavedDialog open={showU} onDiscard={onClose} onCancel={() => setShowU(false)} /></>);
}

// ─── Bulk Edit Expense Modal ───

function BulkEditExpModal({ items, onSave, onClose, paymentMethods = [] }) {
  const [cat, setCat] = useState(""); const [pay, setPay] = useState("");
  return (<Modal open={true} onClose={onClose} title={`Bulk edit ${items.length} expenses`}>
    <p style={{ fontSize: 12, color: "#7c8aa0", marginBottom: 14 }}>Leave blank to keep current values.</p>
    <Field label="Category"><select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}><option value="">— No change —</option>{EXP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Payment method"><select value={pay} onChange={(e) => setPay(e.target.value)} style={sel}><option value="">No change</option>{paymentMethods.map((p) => <option key={p}>{p}</option>)}</select></Field>
    <ModalActions marginTop={10}><button onClick={onClose} style={ghostBtn}>Cancel</button>
    <button onClick={() => { const updates = {}; if (cat) updates.expCategory = cat; if (pay) updates.paymentMethod = pay; onSave(updates); }} style={primaryBtn}>Apply to {items.length} expenses</button></ModalActions>
  </Modal>);
}

export {
  EditExpModal,
  BulkEditExpModal
};
