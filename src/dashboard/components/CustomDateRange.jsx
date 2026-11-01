import { useEffect, useState } from "react";
import { customDateRangeError } from "../shared/dates.js";
import { inp } from "../shared/styles.js";

export default function CustomDateRange({ from, to, onFromChange, onToChange }) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  useEffect(() => { setDraftFrom(from); setDraftTo(to); }, [from, to]);
  const error = customDateRangeError(draftFrom, draftTo);
  const apply = () => {
    if (error) return;
    onFromChange(draftFrom);
    onToChange(draftTo);
  };
  const onKeyDown = (event) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  // Native date fields emit empty values while a segment is being edited.
  // Apply on blur so calculations only receive a completed, ordered range.
  return <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#7c8aa0" }}>
      From<input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} onBlur={apply} onKeyDown={onKeyDown} style={{ ...inp, maxWidth: 160 }} />
    </label>
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "#7c8aa0" }}>
      To<input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} onBlur={apply} onKeyDown={onKeyDown} style={{ ...inp, maxWidth: 160 }} />
    </label>
    {error && <span role="status" style={{ fontSize: 12, color: "#fbbf24" }}>{error} Showing the last valid range.</span>}
  </div>;
}
