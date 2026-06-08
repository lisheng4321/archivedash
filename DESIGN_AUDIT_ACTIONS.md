# ArchiveDash Design Audit Actions

Source: Claude Design audit exported as `ArchiveDash Design Audit.html`.

This file turns the design audit into an implementation queue. Keep `ROADMAP.md`, `AGENT_HANDOFF.md`, `DESIGN_BRIEF.md`, and `SMOKE_TEST.md` as the broader control pack.

## Audit Summary

The audit found that ArchiveDash is structurally sound and already dense/practical, but several trust-critical states are too quiet. The first sprint should focus on data safety, mobile state visibility, connection clarity, destructive-action separation, and better first-run guidance.

## Top Risks

1. Destructive backup/import actions are too easy to trigger.
   - `restoreSupabaseBackup(snapshot)` currently runs from the Restore button with no detailed in-app confirmation.
   - Replace import and clear-all flows rely on native browser confirmation.
   - The audit recommends record-count summaries, typed confirmation, and an automatic snapshot before restore/replace.

2. Mobile hides important app state.
   - `TopBar` shows only a save-status dot on mobile.
   - Settings and Subscriptions alert dots can be buried in the mobile More menu.
   - The audit recommends visible save status on mobile and a rolled-up alert indicator on More.

3. Integration connection state is ambiguous.
   - Settings uses "Connect / refresh" style actions without clear connected, disconnected, stale, or action-needed states.
   - eBay/Gmail connection state should be obvious before the user reaches Pricing, imports, or queues.

4. Destructive controls sit too close to routine controls.
   - Replace import sits next to Merge import.
   - Notepad Delete sits close to Pin/Lock controls.
   - Settings chip deletion is small and immediate.

5. First-run and empty-state guidance is missing.
   - There is no demo-data path.
   - Empty Inventory, Sales, and Pricing states should point to the next useful action.

## First Sprint Queue

### 1. Harden Backup And Restore

Status: implemented and build-verified.

Scope:
- Backup and Restore UI in `src/Dashboard.jsx`.
- Future extraction to `BackupPage`.
- `ConfirmDialog` in `src/dashboard/shared/ui.jsx` if needed.

Implementation notes:
- Route Restore, Replace import, and Clear all data through in-app confirmation.
- Show record counts before replacing/restoring data.
- Require typed confirmation for destructive actions such as `RESTORE`, `REPLACE`, or `DELETE`.
- Create a pre-action snapshot before restore or replace when Supabase is configured.
- Move Replace import into a visually separate Danger Zone.
- Rename or reduce the doubled Settings/Backup heading confusion.

Verification:
- JSON export still works.
- Merge import still works.
- Replace import requires confirmation.
- Restore requires confirmation.
- Pre-action snapshot appears when expected.
- `npm run build` passes.

Implementation note:
- Added `DangerConfirmDialog`, typed confirmations, record counts, a Danger Zone for replace/clear, and a fail-closed pre-action snapshot guard.
- Manual browser checks are still recommended for real file-picker, restore, and Supabase snapshot behavior.

### 2. Make Mobile App State Visible

Status: implemented and build-verified.

Scope:
- `TopBar` in `src/dashboard/shared/ui.jsx`.
- Mobile nav logic in `src/Dashboard.jsx`.

Implementation notes:
- Show mobile save-status text or an explicit failed-save message instead of relying only on color.
- Roll up hidden Settings/Subscriptions alerts onto the More button.
- Use highest severity for the More alert indicator.
- Keep the More menu dismissible and safe-area-aware.

Verification:
- Failed-save state is visible on mobile.
- Health/subscription alerts are visible even when their destination is inside More.
- Mobile nav remains usable and does not overlap content.

Implementation note:
- Added a labeled failed-save pill, mobile "Saving..." text, nav alert severity helper, rolled-up More alert dot, and per-item alert dots inside the mobile More menu.
- Manual mobile viewport checks are still recommended for the smallest widths.

### 3. Clarify eBay And Gmail Connection State

Status: implemented and build-verified.

Scope:
- `src/dashboard/pages/SettingsPage.jsx`.
- `src/dashboard/pages/HealthPage.jsx`.
- Existing `ebayStatus`, `gmailStatus`, queue state, and sync metadata.

Implementation notes:
- Show connection pills: Connected, Not connected, Action needed, or Stale.
- Split Connect from Refresh where possible.
- Show last synced or last checked when known.
- Keep disconnected state different from failed state.

Verification:
- eBay and Gmail cards communicate setup state clearly.
- Queue buttons still open expected queues.
- Health page links still route correctly.

Implementation note:
- Added `IntegrationPill` and `integrationTone`, surfaced connection pills in Settings and Health, split Connect from Sync now, and passed the needed integration status props through `Dashboard.jsx`.
- State is still inferred from free-text status because no durable connection/last-synced record exists yet.

### 4. Separate Destructive Controls And Raise Mobile Hit Targets

Status: implemented and build-verified.

Scope:
- Backup block in `src/Dashboard.jsx`.
- Notepad full-page controls in `src/Dashboard.jsx`.
- `ChipList` in `src/dashboard/pages/SettingsPage.jsx`.

Implementation notes:
- Separate Delete from Pin/Lock in Notepad.
- Put destructive backup/import controls in a separate Danger Zone.
- Increase mobile hit targets toward 44px.
- Add guard/undo-style friction for deleting categories/platforms/customers where practical.

Verification:
- Notepad delete still uses confirmation.
- Pin/Lock controls remain easy to reach.
- Settings chip removal remains possible but safer.

Implementation note:
- Separated Notepad Delete from Lock/Pin, increased Notepad control hit targets, enlarged note move buttons, and added two-step inline removal for Settings chips.
- Manual browser checks are still recommended on narrow mobile viewports.

### 5. Add Next-Action Empty States

Status: implemented and build-verified.

Scope:
- Shared `EmptyState` if available.
- Inventory, Sales, Pricing, and first-run surfaces.

Implementation notes:
- Inventory empty state should point to Add inventory or import receipts.
- Sales empty state should point to Add sale or connect eBay.
- Pricing empty state should point to sync comps or add a manual card.
- Add a quiet empty-install card for "Explore with sample data" versus "Start clean".
- Demo records must be clearly tagged and removable as a set.

Verification:
- Empty states do not look like errors.
- Demo data does not mix silently with real records.
- Export/import behavior remains predictable.

Implementation note:
- Extended `EmptyState` with optional actions, added next-action empty states for Inventory, Sales, and Pricing, and added a first-run sample-data path with removable `demo: true` sample records.
- Manual browser checks are still recommended for an empty local store and sample-data removal behavior.

### 6. Improve Market Review Evidence Clarity

Status: implemented and build-verified.

Scope:
- `src/dashboard/pages/PricingPage.jsx`.
- `src/pricing/pricingEngine.js`.

Implementation notes:
- Add Live, Sample, Stale, and Manual source chips.
- Dim or qualify recommendations derived from non-live data.
- Keep existing confidence/reason text; the audit says the "why" is already fairly strong.

Verification:
- Live comps remain distinguishable from sample/manual data.
- Pricing recommendations do not imply more confidence than the evidence supports.

Implementation note:
- Added `reviewEvidenceSource`, Live/Stale/Sample/Manual evidence chips, dimmed non-live suggestions, and a qualifier line for non-live recommendations.
- Manual browser checks are still recommended with real synced comps, stale cached comps, and manual-only cards.

## First Sprint Status

All six first-sprint design-audit items are implemented and build-verified. The remaining work is manual browser verification across the affected flows, then choosing the next roadmap slice.

## Recommended Claude Code Task

Use this for the next roadmap slice after browser verification.

```text
You are working in ArchiveDash, a Vite + React reseller P&L dashboard backed by Supabase.

Read AGENTS.md, ROADMAP.md, AGENT_HANDOFF.md, SMOKE_TEST.md, and DESIGN_AUDIT_ACTIONS.md first.

Task:
Extract BackupPage from src/Dashboard.jsx now that Backup and Restore has been hardened.

Implement:
- Move the Backup and Restore page markup into a focused page component under src/dashboard/pages/.
- Keep all existing behavior from the hardened Backup and Restore flow.
- Preserve existing persistence keys and import/export/snapshot behavior.
- Keep the change focused; do not refactor unrelated Dashboard state.
- Keep compatibility barrels and existing imports working.

Controls:
- Do not edit inside .claude/.
- Treat uncommitted changes as someone else's work.
- Keep the change small and domain-focused.
- Do not perform broad refactors or whole-file reformatting.
- Keep compatibility barrels in place.
- Do not rename persistence keys.
- Run npm run build before handoff.

Handoff:
- List changed files.
- Summarize behavior changes.
- Include build result.
- Include manual checks performed or still needed.
- Call out any risk or follow-up.
```

## Codex Verification After Claude Code

- Check `git status --short --branch`.
- Review only files changed by Claude Code.
- Confirm no `.claude/` files were copied into the repo.
- Confirm persistence keys were not renamed.
- Run `npm run build`.
- Manually inspect Backup and Restore flows.
- Update this file when items are completed or reprioritized.
