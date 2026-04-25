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

## File structure

```
├── index.html              # Entry point
├── src/
│   ├── main.jsx           # React mount
│   ├── App.jsx            # Auth wrapper (login/signup)
│   ├── Dashboard.jsx      # Full dashboard (all features)
│   └── supabase.js        # Supabase client + data layer
├── supabase-setup.sql     # Database schema (run once)
├── package.json
└── vite.config.js
```
