-- ArchiveDash Supabase Setup
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Create the data table
create table app_data (
  user_id uuid references auth.users on delete cascade not null,
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- 2. Enable Row Level Security
alter table app_data enable row level security;

-- 3. Create policies so users can only access their own data
create policy "Users can read own data"
  on app_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on app_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on app_data for update
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on app_data for delete
  using (auth.uid() = user_id);

-- 4. Create index for fast lookups
create index idx_app_data_user_key on app_data (user_id, key);
