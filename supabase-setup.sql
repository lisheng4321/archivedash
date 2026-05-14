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

revoke all on table public.app_data from anon;
grant select, insert, update, delete on table public.app_data to authenticated;
grant select, insert, update, delete on table public.app_data to service_role;

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

alter table ebay_oauth_states enable row level security;
alter table ebay_tokens enable row level security;

revoke all on table public.ebay_oauth_states from anon, authenticated;
revoke all on table public.ebay_tokens from anon, authenticated;
grant select, insert, update, delete on table public.ebay_oauth_states to service_role;
grant select, insert, update, delete on table public.ebay_tokens to service_role;

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
  buyer_full_name text,
  buyer_email text,
  buyer_phone text,
  buyer_company text,
  buyer_address_line1 text,
  buyer_address_line2 text,
  buyer_city text,
  buyer_state text,
  buyer_postcode text,
  buyer_country text,
  buyer_county text,
  buyer_contact_source text,
  shipping_carrier_code text,
  shipping_service_code text,
  ship_to_reference_id text,
  ebay_supported_fulfillment boolean default false,
  fulfillment_instruction_type text,
  sale_date date,
  raw jsonb,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, order_id, line_item_id)
);

alter table ebay_import_queue add column if not exists buyer_full_name text;
alter table ebay_import_queue add column if not exists buyer_email text;
alter table ebay_import_queue add column if not exists buyer_phone text;
alter table ebay_import_queue add column if not exists buyer_company text;
alter table ebay_import_queue add column if not exists buyer_address_line1 text;
alter table ebay_import_queue add column if not exists buyer_address_line2 text;
alter table ebay_import_queue add column if not exists buyer_city text;
alter table ebay_import_queue add column if not exists buyer_state text;
alter table ebay_import_queue add column if not exists buyer_postcode text;
alter table ebay_import_queue add column if not exists buyer_country text;
alter table ebay_import_queue add column if not exists buyer_county text;
alter table ebay_import_queue add column if not exists buyer_contact_source text;
alter table ebay_import_queue add column if not exists shipping_carrier_code text;
alter table ebay_import_queue add column if not exists shipping_service_code text;
alter table ebay_import_queue add column if not exists ship_to_reference_id text;
alter table ebay_import_queue add column if not exists ebay_supported_fulfillment boolean default false;
alter table ebay_import_queue add column if not exists fulfillment_instruction_type text;

alter table ebay_import_queue enable row level security;

revoke all on table public.ebay_import_queue from anon;
grant select, update on table public.ebay_import_queue to authenticated;
grant select, insert, update, delete on table public.ebay_import_queue to service_role;

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

alter table gmail_oauth_states enable row level security;
alter table gmail_tokens enable row level security;

revoke all on table public.gmail_oauth_states from anon, authenticated;
revoke all on table public.gmail_tokens from anon, authenticated;
grant select, insert, update, delete on table public.gmail_oauth_states to service_role;
grant select, insert, update, delete on table public.gmail_tokens to service_role;

create table if not exists gmail_import_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  message_id text not null,
  line_item_key text not null default 'single',
  thread_id text,
  subject text,
  sender text,
  email_date date,
  item_title text not null,
  vendor text,
  quantity integer default 1,
  unit_cost numeric default 0,
  total_cost numeric default 0,
  shipping_total numeric default 0,
  preorder_date date,
  order_reference text,
  raw jsonb,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, message_id, line_item_key)
);

alter table gmail_import_queue add column if not exists line_item_key text not null default 'single';
alter table gmail_import_queue add column if not exists shipping_total numeric default 0;
alter table gmail_import_queue add column if not exists preorder_date date;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'gmail_import_queue_user_id_message_id_key'
      and conrelid = 'public.gmail_import_queue'::regclass
  ) then
    alter table public.gmail_import_queue drop constraint gmail_import_queue_user_id_message_id_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'gmail_import_queue_user_id_message_id_line_item_key_key'
      and conrelid = 'public.gmail_import_queue'::regclass
  ) then
    alter table public.gmail_import_queue
      add constraint gmail_import_queue_user_id_message_id_line_item_key_key
      unique (user_id, message_id, line_item_key);
  end if;
end $$;

alter table gmail_import_queue enable row level security;

revoke all on table public.gmail_import_queue from anon;
grant select, update on table public.gmail_import_queue to authenticated;
grant select, insert, update, delete on table public.gmail_import_queue to service_role;

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
