# ArchiveDash

Reseller P&L tracking dashboard. Built with React + Supabase. Hosted on Vercel.

## Setup (15 min)

### Step 1: Supabase (database + auth)

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free tier)
2. Create a new project. Pick any name/password/region
3. Wait for the project to finish provisioning (~2 min)
4. Go to **SQL Editor** (left sidebar) → **New query**
5. Paste the contents of `supabase-setup.sql` → click **Run**
6. Go to **Settings** → **API** (left sidebar)
7. Copy your **Project URL** and **anon public** key — you'll need these next

### Fix Supabase Security Advisor findings

If Advisor reports that `public.gmail_oauth_states` or `public.gmail_tokens` has RLS disabled, apply the included migration after logging in with the Supabase CLI:

```bash
npx supabase login
npx supabase db push --linked
npx supabase db advisors --linked --type security
```

The migration enables RLS on the Gmail OAuth tables, removes browser-role access, and keeps service-role access for the Edge Functions that manage OAuth tokens.

### Step 2: Deploy to Vercel

1. Push this folder to a GitHub repo (public or private)
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` = your Project URL from step 6
   - `VITE_SUPABASE_ANON_KEY` = your anon key from step 6
4. Click **Deploy**
5. Your app is live at `your-project.vercel.app`

### Step 3: Create your account

1. Open your Vercel URL
2. Click **Sign up** → enter your email + password
3. Check your email for a confirmation link
4. Click the link → go back to the app → **Log in**

### Step 4: Import your data

1. Log in to the app
2. Go to **Backup** → **Merge import (safe)**
3. Upload your `archivedash-full-import.json` backup file
4. All 1,372+ sales, inventory, and expenses will be imported

## Local development

```bash
cp .env.example .env
# Fill in your Supabase URL and anon key in .env
npm install
npm run dev
```

On Windows, if Vite has trouble loading the local config from this workspace, use:

```bash
npm run dev:local
npm run build:local
```

## Live eBay pricing comps

The Pricing page can fetch live AU active comps through the `ebay-sync-pricing-comps` Supabase Edge Function.

Required Supabase Edge Function secrets:

```bash
EBAY_CLIENT_ID=your-ebay-client-id
EBAY_CLIENT_SECRET=your-ebay-client-secret
```

Deploy the functions from the project folder:

```bash
supabase functions deploy ebay-oauth-start
supabase functions deploy ebay-sync-listings
supabase functions deploy ebay-sync-pricing-comps
```

Reconnect eBay from Settings after deploying `ebay-oauth-start`; the listing sync needs the `sell.inventory.readonly` scope.

Sold comps are not live yet. eBay's official sold-history route is Marketplace Insights, which requires limited-release access from eBay.

## File structure

```text
index.html                    # Entry point
src/
  main.jsx                    # React mount
  App.jsx                     # Auth wrapper
  Dashboard.jsx               # Main app coordinator and remaining dashboard views
  Calculator.jsx              # eBay fee calculator
  supabase.js                 # Supabase client and app data persistence
  dashboard/
    components/               # Dashboard-only components
    inventory.js              # Inventory/listing helper functions
    modals.jsx                # Compatibility barrel for domain modal modules
    modals/                   # Inventory, sales, expenses, notes, and subscription modals
    pages/                    # Dashboard home, inventory, sales, reports, customers, settings, health, pricing pages
    settings.js               # Settings defaults and normalizers
    shared.jsx                # Temporary shared barrel
    shared/                   # Constants, dates, money, notes, styles, UI primitives
    subscriptions.js          # Subscription display helpers
  pricing/
    pricingEngine.js          # Pricing profile and comp evaluation logic
supabase/
  functions/                  # Supabase Edge Functions
  migrations/                 # Database migrations
supabase-setup.sql            # Initial database schema
AGENTS.md                     # Shared agent guide for Codex, Claude, and other agents
CLAUDE.md                     # Claude-specific handoff notes
package.json
vite.config.js
```

## Agent workflow

This repo is being reorganised gradually. Codex, Claude, and any other agents should read `AGENTS.md` before editing. Claude-specific notes live in `CLAUDE.md`; Claude worktrees are kept under `.claude/worktrees/` and are ignored by git.
