// A recorded zero is a real value; a missing value is never a free item.
export const knownMoney = (value) => ["string", "number"].includes(typeof value) && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

export function financialIssue(record, issue, inventory = false) {
  if (issue === "cost") return !knownMoney(record[inventory ? "price" : "costPrice"]) || record.costConfirmed === false;
  const field = issue === "fees" ? "platformFees" : "shippingPrice";
  const flag = issue === "fees" ? "feesConfirmed" : "postageConfirmed";
  if (!knownMoney(record[field])) return true;
  // Legacy positive amounts are recorded. Legacy zeros need explicit confirmation.
  return record[flag] === false || (record[flag] !== true && Number(record[field]) === 0);
}

export function financialCompleteness(sales = [], inventory = []) {
  const cost = sales.filter((sale) => financialIssue(sale, "cost"));
  const fees = sales.filter((sale) => financialIssue(sale, "fees"));
  const postage = sales.filter((sale) => financialIssue(sale, "postage"));
  const stock = inventory.filter((item) => financialIssue(item, "cost", true));
  const incomplete = sales.filter((sale) => ["cost", "fees", "postage"].some((issue) => financialIssue(sale, issue)));
  return { cost, fees, postage, stock, incomplete, salesCount: sales.length };
}
