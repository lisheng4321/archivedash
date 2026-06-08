# Agent Guide

ArchiveDash is a Vite + React dashboard backed by Supabase. This file is shared context for Codex, Claude, and any other coding agent working in this repo.

## Coordination

- Treat uncommitted changes as someone else's work unless you made them in the current turn.
- Do not edit inside `.claude/`; it is ignored and contains Claude-managed worktrees.
- Prefer small, domain-focused moves while the reorganization is in progress.
- Keep compatibility barrels in place when splitting files so existing imports can be migrated gradually.
- Run `npm run build` before handing off changes that touch app code.

## Local Commands

- `npm install` installs dependencies.
- `npm run dev` starts Vite.
- `npm run build` creates a production build.
- `npm run dev:local` and `npm run build:local` are Windows-friendly wrappers for this workspace.

## Current Structure

- `src/App.jsx` handles login/signup and renders the dashboard after auth.
- `src/Dashboard.jsx` is still the main application coordinator. It owns app state, persistence, navigation, and cross-page actions.
- `src/dashboard/pages/` contains domain pages such as dashboard home, inventory, sales, reports, customers, settings, health, and pricing.
- `src/dashboard/components/` contains reusable dashboard-only components.
- `src/dashboard/shared/` contains constants, date helpers, money helpers, note sanitizing, style objects, and base UI components.
- `src/dashboard/shared.jsx` is a temporary barrel for shared modules.
- `src/dashboard/modals.jsx` is a compatibility barrel for domain modal modules under `src/dashboard/modals/`.
- `src/pricing/pricingEngine.js` holds pricing comparison logic.
- `supabase/functions/` contains Edge Functions.
- `supabase/migrations/` contains database migrations.

## Reorganization Boundaries

Good next steps:

- Extract the remaining large inline page blocks from `src/Dashboard.jsx`, starting with subscriptions or expenses when that workflow receives focused work.
- Continue splitting large modal domain files only when a specific domain needs work; keep `src/dashboard/modals.jsx` as the compatibility barrel.
- Move page-specific helpers out of `src/Dashboard.jsx` only when the page receives enough context to own them cleanly.
- Eventually replace imports from `src/dashboard/shared.jsx` with imports from `src/dashboard/shared/index.js` or direct shared modules.

Avoid for now:

- Renaming persistence keys such as `arch-inv2`, `arch-sales2`, `arch-exp2`, and `arch-settings`.
- Changing Supabase table names or RLS semantics without testing against a linked project.
- Reformatting whole files as a side effect of small moves.
