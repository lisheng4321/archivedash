# Changelog

All notable changes to ArchiveDash. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning loosely follows [SemVer](https://semver.org/) — `MAJOR.MINOR.PATCH`:

- **MAJOR** (1.x.x) — breaking changes to data model or storage schema
- **MINOR** (x.1.x) — new features, backward-compatible
- **PATCH** (x.x.1) — bug fixes, tweaks, copy changes

---

## [0.3.1] — 2026-05-04

### Fixed
- Production deployment was rendering blank with React error #310 ("Rendered more hooks than during the previous render"). Two `useMemo` calls (`activeNote`, `sortedNotes`) were declared after the `if (loading) return` early return, so React saw a different number of hooks between the loading and loaded renders. Moved both above the early return.
- Added a `localStorage` shim (`src/storage.js`) imported at the top of `main.jsx` so `window.storage` exists in a real browser. Without this the load/save calls silently no-op in production.

---

## [0.3.0] — 2026-05-04

### Added
- **Multi-note Notepad** — replaced the single-textarea notepad with a workspace. Notes list (sidebar) + editor (main pane). New / search / pin / delete per note. Pinned notes float to top, rest sorted by most recently updated.
- **Edit ↔ Preview toggle** — Preview mode renders `- [ ] task` and `- [x] done` lines as clickable checkboxes that mutate the underlying text. Other lines render as preformatted text.
- **Quick-insert templates** — 5 templates: Presale listing, Restock checklist, FB group post cluster, Customer order, HK sourcing trip. `${date}` placeholder auto-fills with today's Sydney date. Inserts at cursor in Edit mode.
- **☐ Task button** — one-click insert of `- [ ] ` for fast checklist entry.
- **Per-note title, font size, pin state** — each note is independent.
- **Quick-note floating widget** — bottom-right circular button on every page except notepad. 340×380 panel with note switcher, new-note button, jump-to-notepad shortcut. Same auto-save backbone.
- **Version stamp** — `v0.3.0` shown at the bottom of the sidebar; `appVersion` field included in JSON exports for backup traceability.

### Changed
- JSON export schema bumped to `version: 5`. Now includes `notes` array (multi-note) and `appVersion` field.
- Backup page status counter now shows note count.

### Migrated
- Old `arch-notepad` (single-note, `{content, fontSize, updatedAt}`) is auto-converted to one note titled "Imported notes" on first load. Original key left intact for safety; new data lives under `arch-notes`.
- Legacy `version: 4` JSON imports (with `notepad: {...}`) auto-migrate to the new notes array on import.

---

## [0.2.0] — 2026-05-04

### Added
- **Preorder reminders** — tiered badges next to inventory items based on business days until release: red ≤5d, amber ≤15d, blue ≤40d, gray beyond, pink "RELEASED" if past. Top-of-dashboard banner surfaces upcoming preorders. Blue dot on dashboard nav when any preorder is within 40 business days.
- **Subscriptions page** — recurring expenses (weekly / fortnightly / monthly / yearly) with auto next-due tracking and monthly equivalent calc. "Log all overdue" bulk action auto-creates expense entries and rolls dates forward. Red dot on subs nav when any are overdue. Dashboard KPI for monthly subs burn.
- **Live Sydney clock** — sticky top bar on every page, auto-handles AEST/AEDT via `Intl.DateTimeFormat` with `Australia/Sydney`. Save status indicator moved here from sidebar.
- **Notepad (single-note)** — JetBrains Mono editor, font size 12–32 with A−/A+ + dropdown, 800ms debounced auto-save, Tab inserts 2 spaces, Sydney timestamp insert, .txt export, word/char count.
- New storage keys: `arch-subs`, `arch-notepad`.

### Changed
- JSON export schema bumped to `version: 4`. Now includes `subs` and `notepad` fields.
- Expense modal hint added pointing to Subscriptions for recurring costs.
- Sidebar nav grew from 6 to 8 items (added Subs, Notepad).

---

## [0.1.0] — Initial release

### Added
- **Dashboard** — net profit, gross profit, sales income, inventory value, AOV, sell-through, platform fees. Time ranges: 1W / 1M / MTD / 3M / YTD / ALL / Custom. Filterable by category and platform. Sparkline chart of cumulative profit.
- **Inventory** — multi-quantity add, bulk edit / delete, search + sort + filter, collapsible groups for duplicate names, in-transit / preorder flags, duplicate row, customer attribution.
- **Sales** — full sale history with cost / fees / shipping / profit breakdown, edit any past sale, customer attribution.
- **Expenses** — one-off business expenses with date range filter.
- **Backup & Restore** — JSON export (everything), CSV export (sales only), merge import (dedup by id) or replace import.
- **Settings** — manage categories, platforms, customer database. Customers auto-save on sale.
- Storage keys: `arch-inv2`, `arch-sales2`, `arch-exp2`, `arch-settings`.

---

## Version planning (forward)

Loose roadmap for what bumps to what. Subject to change.

- **0.3.x patches** — bug fixes for the multi-note workspace, template tweaks, preview-mode polish.
- **0.4.0** — likely candidates: per-customer LTV view, outstanding presale liabilities, brand performance ranking, cash flow projection by month.
- **1.0.0** — when the data model and feature surface are stable enough that breaking schema changes would be rare. Not soon — keep iterating.

[0.3.0]: https://github.com/lisheng4321/archivedash/releases/tag/v0.3.0
[0.2.0]: https://github.com/lisheng4321/archivedash/releases/tag/v0.2.0
[0.1.0]: https://github.com/lisheng4321/archivedash/releases/tag/v0.1.0
