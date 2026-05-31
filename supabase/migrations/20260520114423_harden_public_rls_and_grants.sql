-- Resolve Supabase Advisor findings:
-- - rls_disabled_in_public
-- - sensitive_columns_exposed
--
-- Public is an exposed schema in Supabase by default. Keep every public table
-- behind RLS, then grant only the roles ArchiveDash actually needs.

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- App data: browser access is authenticated-only and scoped to the signed-in
-- user. The service role is reserved for trusted server-side maintenance.
revoke all on table public.app_data from anon, public;
grant select, insert, update, delete on table public.app_data to authenticated;
grant select, insert, update, delete on table public.app_data to service_role;

drop policy if exists "Users can read own data" on public.app_data;
drop policy if exists "Users can insert own data" on public.app_data;
drop policy if exists "Users can update own data" on public.app_data;
drop policy if exists "Users can delete own data" on public.app_data;

create policy "Users can read own data"
  on public.app_data
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.app_data
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.app_data
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.app_data
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- OAuth state/token tables contain sensitive integration tokens. They should
-- never be reachable from browser roles; Edge Functions use the service role.
alter table public.ebay_oauth_states enable row level security;
alter table public.ebay_tokens enable row level security;
alter table public.gmail_oauth_states enable row level security;
alter table public.gmail_tokens enable row level security;

revoke all on table public.ebay_oauth_states from anon, authenticated, public;
revoke all on table public.ebay_tokens from anon, authenticated, public;
revoke all on table public.gmail_oauth_states from anon, authenticated, public;
revoke all on table public.gmail_tokens from anon, authenticated, public;

grant select, insert, update, delete on table public.ebay_oauth_states to service_role;
grant select, insert, update, delete on table public.ebay_tokens to service_role;
grant select, insert, update, delete on table public.gmail_oauth_states to service_role;
grant select, insert, update, delete on table public.gmail_tokens to service_role;

-- Import queues: authenticated users can read/update only their own drafts.
revoke all on table public.ebay_import_queue from anon, public;
revoke all on table public.gmail_import_queue from anon, public;
grant select, update on table public.ebay_import_queue to authenticated;
grant select, update on table public.gmail_import_queue to authenticated;
grant select, insert, update, delete on table public.ebay_import_queue to service_role;
grant select, insert, update, delete on table public.gmail_import_queue to service_role;

drop policy if exists "Users can read own ebay imports" on public.ebay_import_queue;
drop policy if exists "Users can update own ebay imports" on public.ebay_import_queue;
drop policy if exists "Users can read own gmail imports" on public.gmail_import_queue;
drop policy if exists "Users can update own gmail imports" on public.gmail_import_queue;

create policy "Users can read own ebay imports"
  on public.ebay_import_queue
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own ebay imports"
  on public.ebay_import_queue
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can read own gmail imports"
  on public.gmail_import_queue
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own gmail imports"
  on public.gmail_import_queue
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
