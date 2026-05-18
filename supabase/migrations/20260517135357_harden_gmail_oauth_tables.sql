-- Harden Gmail OAuth support tables flagged by Supabase Security Advisor.
-- These tables are only used by Edge Functions with the service role.

alter table public.gmail_oauth_states enable row level security;
alter table public.gmail_tokens enable row level security;

revoke all on table public.gmail_oauth_states from anon, authenticated, public;
revoke all on table public.gmail_tokens from anon, authenticated, public;

grant select, insert, update, delete on table public.gmail_oauth_states to service_role;
grant select, insert, update, delete on table public.gmail_tokens to service_role;
