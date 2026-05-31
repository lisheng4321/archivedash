import { SUB_CATEGORIES } from "./shared.jsx";

const subCategory = (sub) => SUB_CATEGORIES.includes(sub?.category) ? sub.category : "Other";

const subCategoryColor = (cat) => ({
  Botting: ["#1e3a5f", "#93c5fd"],
  AI: ["#312e81", "#c4b5fd"],
  Marketplaces: ["#1f3b2d", "#86efac"],
  Domains: ["#3b2f1f", "#fbbf24"],
  Infrastructure: ["#232c3c", "#cbd5e1"],
  Finance: ["#3b1f2b", "#f9a8d4"],
  Other: ["#121a2b", "#9ca3af"],
}[cat] || ["#121a2b", "#9ca3af"]);

export {
  subCategory,
  subCategoryColor,
};
