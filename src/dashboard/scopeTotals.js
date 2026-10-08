import { knownMoney } from "./financialCompleteness.js";

export function scopeTotals(records, costField, selection = new Set(), keyField = "id") {
  const selected = records.filter((record) => selection.has(record[keyField]));
  const costRecords = records.filter((record) => knownMoney(record[costField]) && record.costConfirmed !== false);
  const units = records.reduce((sum, record) => sum + (costField === "costPrice" ? Math.max(1, Number(record.quantity) || 1) : 1), 0);
  return { units, cost: costRecords.reduce((sum, record) => sum + Number(record[costField]), 0), unknown: records.length - costRecords.length, selected: selected.length };
}
