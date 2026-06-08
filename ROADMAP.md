# ArchiveDash Roadmap

ArchiveDash is a practical reseller P&L dashboard. The roadmap favors data safety, mobile usability, pricing confidence, and steady cleanup over large rewrites.

## Current Baseline

- App version: 0.6.20.
- `main` is the live source of truth; Claude worktrees under `.claude/` are isolated and ignored.
- `src/Dashboard.jsx` remains the main coordinator for app state, persistence, navigation, backup, notepad, expenses, and subscriptions.
- Core domain pages already live under `src/dashboard/pages/`.
- Modal code is split by domain under `src/dashboard/modals/`, with `src/dashboard/modals.jsx` kept as the compatibility barrel.
- ArchiveDash Scout stays separate and should feed ArchiveDash through reviewed CSV/JSON or a future import bridge.

## Product Principles

- Keep the interface operational, compact, and data-dense.
- Preserve the existing information architecture unless a specific workflow proves it should change.
- Treat backup, restore, imports, and Supabase sync as trust-critical flows.
- Make mobile workflows genuinely usable, not just visually smaller.
- Build pricing around clear evidence, confidence, and reviewability.
- Prefer small, verified improvements over broad refactors.

## Phase 1: 0.6.x Stabilization

Goal: make the current product trustworthy before adding more surface area.

- Run a mobile sweep across dashboard, inventory, sales, customers, pricing, reports, settings, backup, and notepad.
- Verify backup/export/import flows: JSON export, CSV export, merge import, replace import, Supabase snapshot, and Supabase restore.
- Verify note locking, failed-save retry behavior, import queues, bulk sale flows, and subscription rollover.
- Add and maintain a manual smoke-test checklist.
- Keep every app-code change build-verified with `npm run build`.

## Phase 2: 0.7 Release Readiness

Goal: make ArchiveDash usable by someone who is not already deep in the app.

- Add a first-run or demo-data workflow.
- Improve setup guidance around Supabase, backup restore, eBay connection, Gmail connection, and import queues.
- Make System Health more actionable by showing what is connected, stale, blocked, or missing.
- Polish Settings and Backup into a confidence-building control center.
- Update README and changelog so setup and recovery steps match the live app.

## Phase 3: 0.8 Pricing And Comps

Goal: turn pricing into a serious resale decision surface.

- Keep ArchiveDash Scout separate from ArchiveDash application code.
- Define a reviewed Scout import format using CSV/JSON first.
- Separate active listings, sold comps, manual comps, and stale comps clearly.
- Move durable pricing preferences into app-backed storage where appropriate.
- Add confidence labels for weak title match, outlier, stale comp, shipping-adjusted total, and manual override.

## Phase 4: 0.9 Business Intelligence

Goal: turn captured data into better decisions.

- Add customer lifetime value and repeat-buyer views.
- Add outstanding preorder or presale liability totals.
- Add brand and category performance ranking.
- Add monthly cash-flow projection.
- Expand aged-stock and sell-through recommendations.
- Improve report exports for bookkeeping and review.

## Phase 5: 1.0 Hardening

Goal: freeze the core shape so future work is less risky.

- Document stable storage keys and migration expectations.
- Review Supabase migrations, policies, and Edge Functions.
- Add deployment and recovery checklists.
- Add import/export fixtures where practical.
- Reduce `src/Dashboard.jsx` into a thinner coordinator.
- Keep breaking schema or persistence changes rare and deliberate.

## Engineering Track

Run this alongside the product phases.

- Extract `BackupPage` from `src/Dashboard.jsx`.
- Extract `NotepadPage` from `src/Dashboard.jsx`.
- Continue splitting large modal domain files only when touching that domain.
- Keep compatibility barrels during gradual migration.
- Eventually replace imports from `src/dashboard/shared.jsx` with `src/dashboard/shared/index.js` or direct shared modules.
- Do not rename persistence keys such as `arch-inv2`, `arch-sales2`, `arch-exp2`, or `arch-settings` without a tested migration plan.

## Suggested First Sprint

1. Use `AGENT_HANDOFF.md`, `DESIGN_BRIEF.md`, and `SMOKE_TEST.md` as the shared control pack.
2. Ask Claude Design for a focused mobile and confidence audit of Backup, Settings, Pricing, Notepad, and navigation.
3. Ask Claude Code to extract `BackupPage` from `src/Dashboard.jsx`.
4. Have Codex verify the live checkout, review diffs, run the build, and update docs if needed.
5. Continue with backup/mobile polish before extracting `NotepadPage`.
