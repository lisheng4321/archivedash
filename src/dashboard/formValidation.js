export const validAmount = (value) => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
export function recordError(name, amount, amountLabel = 'Cost') {
  if (!String(name || '').trim()) return 'Enter a product or expense name.';
  if (!validAmount(amount)) return `${amountLabel} must be a number of zero or more.`;
  return '';
}
export function draftChanged(draft, initial, numericFields = []) {
  const normalize = (value) => Object.fromEntries(Object.entries(value).map(([key, v]) => [key, numericFields.includes(key) ? String(v ?? '') : v]));
  return JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(initial));
}
export const allVisibleSelected = (items, selected, key = 'id') => items.length > 0 && items.every((item) => selected.has(item[key]));
export function toggleVisibleSelection(items, selected, key = 'id') {
  const next = new Set(selected);
  const remove = allVisibleSelected(items, selected, key);
  items.forEach((item) => remove ? next.delete(item[key]) : next.add(item[key]));
  return next;
}
