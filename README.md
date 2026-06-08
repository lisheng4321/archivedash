# ArchiveDash

ArchiveDash is a practical reseller P&L dashboard for tracking inventory, sales, expenses, subscriptions, customer activity, notes, backup/restore workflows, and pricing review evidence.

It is built with React + Vite, backed by Supabase, and deployed on Vercel.

## What It Covers

- Inventory tracking with categories, platforms, preorder flags, aging, grouped sizes, and bulk actions.
- Sales history with profit, fees, customer attribution, eBay order imports, and CSV export.
- Expenses and subscriptions with recurring-cost tracking.
- Customers, reports, dashboard KPIs, and an eBay fee calculator.
- Multi-note Notepad with locking, pinning, templates, export, and a floating quick-note panel.
- Backup and Restore with JSON export, merge import, typed confirmations for destructive actions, Supabase snapshots, and a separate Danger Zone.
- Market Review with live/stale/manual evidence labels and confidence-aware pricing suggestions.
- eBay and Gmail integration surfaces for sales imports, inventory receipt imports, and pricing comps.

## Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a project.
2. Open the Supabase SQL Editor.
3. Run `supabase-setup.sql`.
4. Open Settings > API.
5. Copy the Project URL and anon public key.

### 2. Deploy To Vercel

1. Push this repo to GitHub.
2. Import it into [Vercel](https://vercel.com).
3. Add these environment variables:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. Deploy.
5. Open the deployed app, sign up, confirm your email, and log in.

### 3. Import Existing Data

In ArchiveDash, go to Settings > Backup & Restore.

- Use **Merge import (safe)** to add data from a backup without clearing current data.
- Use **Replace import** only when you intend to overwrite current data. It requires typed confirmation.
- Use **Clear all data** only when resetting inventory, sales, and expenses. It requires typed confirmation.

When Supabase backups are configured, destructive restore/replace/clear flows save a pre-action snapshot first.

## Local Development

```bash
cp .env.example .env
npm install
npm run dev
```

Fill `.env` with your Supabase URL and anon key.

On Windows, if Vite has trouble loading local config from this workspace, use:

```bash
npm run dev:local
npm run build:local
```

Standard production build:

```bash
npm run build
```

## Supabase Security

If Supabase Security Advisor reports OAuth token/state tables with weak access controls, apply the included migrations after linking the project with the Supabase CLI:

```bash
npx supabase login
npx supabase db push --linked
npx supabase db advisors --linked --type security
```

The migrations enable RLS on OAuth state/token tables, remove browser-role access to stored integration tokens, and keep service-role access for Edge Functions.

## eBay And Gmail Integrations

ArchiveDash uses Supabase Edge Functions for eBay and Gmail flows.

Useful eBay functions include:

```bash
supabase functions deploy ebay-oauth-start
supabase functions deploy ebay-oauth-callback
supabase functions deploy ebay-sync-orders
supabase functions deploy ebay-sync-listings
supabase functions deploy ebay-sync-pricing-comps
```

Useful Gmail functions include:

```bash
supabase functions deploy gmail-oauth-start
supabase functions deploy gmail-oauth-callback
supabase functions deploy gmail-sync-inventory
```

Required eBay secrets:

```text
EBAY_CLIENT_ID=your-ebay-client-id
EBAY_CLIENT_SECRET=your-ebay-client-secret
```

Reconnect integrations from Settings after deploying OAuth-related functions. The app surfaces eBay and Gmail as connected, not connected, action needed, or setup needed so integration state is visible before using queues or pricing workflows.

## Project Docs

Planning, handoff, and verification docs live in `docs/`:

- `docs/roadmap.md` - product and engineering roadmap.
- `docs/smoke-test.md` - manual release and workflow checks.
- `docs/agent-handoff.md` - controls for Codex, Claude Code, and Claude Design.
- `docs/design-brief.md` - compact design direction.
- `docs/design-audit-actions.md` - first-sprint audit actions and follow-up queue.

Agent-facing root docs:

- `AGENTS.md` - shared instructions for coding agents.
- `CLAUDE.md` - Claude-specific handoff notes.

## File Structure

```text
index.html                    # Vite entry point
src/
  main.jsx                    # React mount
  App.jsx                     # Auth wrapper
  Dashboard.jsx               # Main app coordinator and remaining inline dashboard views
  Calculator.jsx              # Fee calculator
  supabase.js                 # Supabase client and app persistence
  storage.js                  # Storage helpers
  dashboard/
    components/               # Dashboard-only components
    inventory.js              # Inventory/listing helpers
    modals.jsx                # Compatibility barrel for modal modules
    modals/                   # Inventory, sales, expenses, notes, subscription modals
    pages/                    # Extracted dashboard pages
    settings.js               # Settings defaults and normalizers
    shared.jsx                # Temporary shared barrel
    shared/                   # Constants, dates, money, notes, styles, UI primitives
    subscriptions.js          # Subscription helpers
  pricing/
    pricingEngine.js          # Pricing comparison and evidence logic
supabase/
  functions/                  # Supabase Edge Functions
  migrations/                 # Database migrations
docs/                         # Roadmap, handoff, smoke-test, and design docs
supabase-setup.sql            # Initial database schema
package.json
vite.config.js
```

## Agent Workflow

ArchiveDash is being reorganized gradually. Before editing, agents should read `AGENTS.md` and the relevant docs in `docs/`.

Current guardrails:

- Do not edit inside `.claude/`.
- Keep changes scoped to the active task.
- Preserve compatibility barrels while migration is gradual.
- Do not rename persistence keys without a tested migration plan.
- Run `npm run build` before handing off app-code changes.
