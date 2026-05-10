# Changelog

All notable changes to ArchiveDash. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning loosely follows [SemVer](https://semver.org/) — `MAJOR.MINOR.PATCH`:

- **MAJOR** (1.x.x) — breaking changes to data model or storage schema
- **MINOR** (x.1.x) — new features, backward-compatible
- **PATCH** (x.x.1) — bug fixes, tweaks, copy changes

---

## [0.6.5] - 2026-05-10

### Fixed
- **Notepad crash after refactor** by restoring the React hook import needed by the split-out notepad editor.
- **Subscription modal imports** restored after the dashboard module split.

---

## [0.6.4] - 2026-05-10

### Changed
- **Dashboard refactor** splits shared constants/helpers, modals, and Inventory/Sales/Health page views out of the main dashboard file.
- **System Health** no longer warns about old eBay sales missing fee data or sales with zero cost stock.

---

## [0.6.3] - 2026-05-10

### Added
- **System Health page** with Supabase/account checks, eBay and Gmail queue status, and preorder warnings.

### Changed
- **Mobile navigation** now sits at the bottom of the screen instead of taking left-side space.
- **Quick notes button** moves above the mobile nav so it stays reachable without overlap.

---

## [0.6.2] - 2026-05-10

### Changed
- **Dashboard month comparison** now uses a rolling same-period comparison, such as May 1-8 vs April 1-8, instead of comparing against the full previous month.

---

## [0.6.1] - 2026-05-09

### Added
- **Notepad undo/redo** controls in the editor toolbar.
- **Month comparison badge** next to the dashboard net profit graph, comparing this month against the previous month.

### Changed
- **Sidebar utilities** now sit in a separated group so Backup and Settings feel less crowded.

---

## [0.6.0] - 2026-05-09

### Added
- **Gmail Inventory Import** - connect Gmail from Settings, then sync purchase confirmations into an Inventory review queue.
- **Inventory Gmail queue** - review, edit, add, or ignore Gmail-drafted inventory before it enters stock.
- **Gmail Edge Functions** - added OAuth start/callback plus Gmail receipt scanning and draft queue storage.

### Changed
- **Supabase setup SQL** is now safe to re-run without duplicate table, index, or policy errors.

---

## [0.5.4] — 2026-05-09

### Changed
- **Add Sale modal** is wider, with more room for inventory titles and per-item pricing.
- **Sale / Shipping / Fees inputs** now have visible labels and larger columns instead of cramped placeholders.
- **Sale button text** now capitalises `Sale` consistently.

---

## [0.5.3] — 2026-05-09

### Added
- **Pre-record eBay sale review** — clicking `Record sale` now opens an editable review step before the sale is saved.
- **Editable eBay shipping and fees** — sale price, shipping, and platform fees can be adjusted before recording.

### Changed
- **eBay fee prefill** now uses the stored eBay fee when available, otherwise estimates eBay AU fees from the order total so the profit preview is closer before save.

---

## [0.5.2] — 2026-05-09

### Added
- **Sales-first recording workflow** — Sales now has `+ Add sale`, with searchable inventory selection and support for recording multiple sold items at once.
- **Sales-page eBay queue** — eBay awaiting-postage drafts can be synced, reviewed, recorded, or ignored directly from Sales.

### Changed
- **Settings is setup-only for eBay** — Settings now keeps eBay connection controls and sends review work back to Sales.
- **Sales filter summary** now shows the number of filtered rows instead of repeating the large profit total in the top-right.

---

## [0.5.1] — 2026-05-05

### Added
- **Per-note font size** — A− / A+ buttons + dropdown (12 / 13 / 14 / 15 / 16 / 18 / 20 / 24 / 28 / 32). Stored on each note so different notes can have different sizes. Restored from the lost 0.3.x line.
- **Editable templates** — new "⚙ Manage templates" entry in the template dropdown opens a manager where you can rename, edit body (HTML allowed), delete, or add new templates. Default 5 are seeded as "SEED" entries on first load but are otherwise just like custom ones — fully editable / deletable. "Reset to defaults" button restores the seeds.
- **Export .txt per note** — button on the full-page editor toolbar. Strips HTML, converts `<br>` / `<div>` / `<p>` / `<li>` to line breaks, renders checkboxes as `[x]` / `[ ]`. Downloads as `<note-title>-<date>.txt`.
- **Floating notepad button** — circular button bottom-right on every non-notepad page opens the slide-out. Replaces the yellow shortcut button that was below the sidebar nav.
- New Supabase storage key: `arch-templates` (user-managed templates array, seeded from defaults on first load).

### Changed
- **Date/time format** in the top bar restyled to `Tue, 5 May, 19:36:43 AEST · Sydney` with clock glyph, matching the preferred look in the screenshots.
- **Preorder banner** restructured from inline pill chips to a row layout: each preorder gets its own row with the item name on the left, release date in the middle, business-day badge on the right. Header now shows a bell icon, the title "Preorders releasing soon", and a count badge. Up to 6 rows shown (4 on mobile), with a "+ N more" footer if there's overflow.
- Slide-out notepad uses a compact toolbar (no font size, no export) — that detail-work belongs on the full page.

---

## [0.5.0] — 2026-05-05

### Added
- **Multi-note Notepad** — single notepad replaced with a workspace of separate notes. New / search / pin / delete per note. Pinned float to top, rest sorted by most recently updated. Each note has its own title, content, and updated timestamp.
- **Notepad as a primary page** — full-page split view (notes list + editor) accessible from the sidebar nav. The slide-out quick panel is still available on every other page for fast capture, with a note switcher dropdown and `↗` shortcut to jump to the full page.
- **Inline checkboxes** — toolbar `☑` button inserts a checkbox + editable label. Click any checkbox to toggle (auto-saves). Checked items get visually muted. Works in both the full page and the slide-out.
- **Quick-insert templates** — 5 templates seeded for the workflow: Presale listing, Restock checklist, FB group post cluster, Customer order, HK sourcing trip. `${date}` placeholder auto-fills with today's Sydney date. Pre-populated with rich text + checkboxes ready to tick through.
- **Note search** — search box on the notepad page filters the notes list by title or stripped content.
- **Pin / unpin notes** — pinned notes float to the top of the list. Star button on each note's header.

### Changed
- Notepad slide-out widened (340 → 360px) to accommodate the toolbar with the new buttons.
- Sidebar nav grew from 8 to 9 items (added primary Notepad entry between Subs and Calculator). The yellow notepad-shortcut button below the nav stack is now strictly a quick-access toggle for the slide-out.
- JSON export schema bumped to `version: 5`. Now includes `notes` array.
- New Supabase storage keys: `arch-notes` (note array), `arch-notes-active` (last-viewed note id).

### Migrated
- Old `arch-notepad` (single rich-text string) is auto-converted on first load to a single note titled "Imported notes". Original key left intact for safety; new data lives under `arch-notes`. Legacy `version: 4` JSON imports with the old `notepad` field also auto-migrate.

### Preserved (re-port from withdrawn 0.3.x onto Supabase base)
- Multi-note + templates + checkboxes were originally introduced in 0.3.x but lost when that line was rolled back for autosave reasons. Re-implemented here on top of the Supabase base, keeping rich-text formatting (B/I/U/bullets) intact and inheriting cross-device sync.

---

## [0.4.0] — 2026-05-05

### Added
- **Subscriptions page** — recurring expenses (weekly / fortnightly / monthly / yearly) with auto next-due tracking and monthly equivalent calc. "Log overdue" bulk action auto-creates expense entries (categorised as Software & Subs) and rolls dates forward as many cycles as needed to catch up. Per-row Log / Pause / Resume / Edit / Delete. Red dot on subs nav when any are overdue. New Supabase storage key: `arch-subs`.
- **Preorder reminders** — tiered badges next to inventory items based on business days until release: red ≤5d, amber ≤15d, blue ≤40d, gray beyond, pink "RELEASED" if past. Top-of-dashboard banner surfaces upcoming preorders. Blue dot on dashboard nav when any preorder is within 40 business days. Replaces the old single pink "PRE" badge.
- **Live Sydney clock** — sticky top bar on every page, auto-handles AEST/AEDT via `Intl.DateTimeFormat` with `Australia/Sydney`. Save status indicator (Idle / Saving / Saved) shown alongside.
- **Monthly subs burn KPI** — added to dashboard KPI grid (second row now has 6 KPIs).
- **Subs overdue banner on dashboard** — when any subscription is overdue, red banner shows total overdue $ with a one-click "Log all due" button.
- **Version stamp** — `v0.4.0` shown at bottom of sidebar; `appVersion` field included in JSON exports for backup traceability.

### Changed
- JSON export schema bumped to `version: 4`. Now includes `subs` array and `appVersion` field.
- Backup page status counter now shows subs count.
- Sidebar nav grew from 7 to 8 items (added Subs between Expenses and Calculator).

### Fixed (rolled back from withdrawn 0.3.x)
- The 0.3.x line introduced a `localStorage` shim that broke cross-device sync because data was no longer hitting Supabase. Reverted to Supabase-backed `load` / `save` from `./supabase.js` — autosave now works as expected across all devices.
- Restored features that were lost in the 0.3.x rewrite:
  - 1D and 1Y time ranges on dashboard
  - Mobile responsive layouts for inventory / sales / expenses rows
  - Rich-text notepad with Bold / Italic / Underline / Bullet list (slide-out panel)
  - eBay Fee Calculator (separate `Calculator.jsx` component)
  - Expense categories (`expCategory` field)

---

## [0.3.x] — Withdrawn

The 0.3.0 → 0.3.1 line introduced a multi-note notepad, quick-insert templates, and a floating quick-note widget, but did so by switching from Supabase to localStorage. This broke cross-device autosave and dropped several features that had been built in earlier versions but weren't carried forward by the rewrite. Rolled back. Multi-note and templates may return in a later release if useful, but only on top of Supabase persistence.

---

## [0.2.x] — Pre-rewrite stable

Last known-good Supabase-backed version. Features as documented in [0.4.0] before the additions above.

---

## [0.1.0] — Initial release

### Added
- Dashboard with net profit, gross profit, sales income, inventory value, AOV, sell-through, platform fees, margin %. Ranges: 1D / 1W / 1M / MTD / 3M / YTD / 1Y / ALL / Custom.
- Inventory with multi-quantity add, bulk edit, search / sort / filter, collapsible groups, in-transit / preorder flags.
- Sales history with full P&L breakdown, edit-any-sale, customer attribution.
- Expenses with date range filter and category.
- Slide-out rich-text notepad.
- Backup / restore (JSON + sales CSV).
- Settings for categories, platforms, customer database.
- eBay Fee Calculator (Pro Basic plan, AU GST).
- Storage: Supabase via `src/supabase.js`.

---

## Version planning (forward)

Loose roadmap. Subject to change.

- **0.4.x patches** — bug fixes for subscriptions, preorder badge edge cases, mobile polish.
- **0.5.0** — likely candidates: per-customer LTV view, outstanding presale liabilities sum, brand performance ranking, cash flow projection by month.
- **1.0.0** — when the data model and feature surface are stable enough that breaking schema changes would be rare.

[0.4.0]: https://github.com/lisheng4321/archivedash/releases/tag/v0.4.0
[0.1.0]: https://github.com/lisheng4321/archivedash/releases/tag/v0.1.0
