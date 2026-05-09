-- ArchiveDash Supabase Setup
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Create the data table
create table if not exists app_data (
  user_id uuid references auth.users on delete cascade not null,
  key text not null,
  value jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- 2. Enable Row Level Security
alter table app_data enable row level security;

-- 3. Create policies so users can only access their own data
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_data'
      and policyname = 'Users can read own data'
  ) then
    create policy "Users can read own data"
      on app_data for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_data'
      and policyname = 'Users can insert own data'
  ) then
    create policy "Users can insert own data"
      on app_data for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_data'
      and policyname = 'Users can update own data'
  ) then
    create policy "Users can update own data"
      on app_data for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'app_data'
      and policyname = 'Users can delete own data'
  ) then
    create policy "Users can delete own data"
      on app_data for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- 4. Create index for fast lookups
create index if not exists idx_app_data_user_key on app_data (user_id, key);

-- 5. eBay sales import queue
create table if not exists ebay_oauth_states (
  state text primary key,
  user_id uuid references auth.users on delete cascade not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists ebay_tokens (
  user_id uuid references auth.users on delete cascade primary key,
  access_token text not null,
  refresh_token text not null,
  token_type text,
  scope text,
  expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists ebay_import_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  order_id text not null,
  line_item_id text not null,
  item_title text not null,
  sku text,
  quantity integer default 1,
  sale_price numeric default 0,
  shipping_price numeric default 0,
  platform_fees numeric default 0,
  buyer_username text,
  sale_date date,
  raw jsonb,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_id, line_item_id)
);

alter table ebay_import_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ebay_import_queue'
      and policyname = 'Users can read own ebay imports'
  ) then
    create policy "Users can read own ebay imports"
      on ebay_import_queue for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ebay_import_queue'
      and policyname = 'Users can update own ebay imports'
  ) then
    create policy "Users can update own ebay imports"
      on ebay_import_queue for update
      using (auth.uid() = user_id);
  end if;
end $$;

-- 6. Gmail inventory import queue
create table if not exists gmail_oauth_states (
  state text primary key,
  user_id uuid references auth.users on delete cascade not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

create table if not exists gmail_tokens (
  user_id uuid references auth.users on delete cascade primary key,
  access_token text not null,
  refresh_token text not null,
  token_type text,
  scope text,
  expires_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists gmail_import_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  message_id text not null,
  thread_id text,
  subject text,
  sender text,
  email_date date,
  item_title text not null,
  vendor text,
  quantity integer default 1,
  unit_cost numeric default 0,
  total_cost numeric default 0,
  order_reference text,
  raw jsonb,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, message_id)
);

alter table gmail_import_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gmail_import_queue'
      and policyname = 'Users can read own gmail imports'
  ) then
    create policy "Users can read own gmail imports"
      on gmail_import_queue for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'gmail_import_queue'
      and policyname = 'Users can update own gmail imports'
  ) then
    create policy "Users can update own gmail imports"
      on gmail_import_queue for update
      using (auth.uid() = user_id);
  end if;
end $$;
