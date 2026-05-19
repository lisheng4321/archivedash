-- Harden eBay OAuth state/token tables so only Edge Functions using the
-- service role can read or mutate sensitive OAuth material.

alter table public.ebay_oauth_states enable row level security;
alter table public.ebay_tokens enable row level security;

revoke all on table public.ebay_oauth_states from anon, authenticated, public;
revoke all on table public.ebay_tokens from anon, authenticated, public;

grant select, insert, update, delete on table public.ebay_oauth_states to service_role;
grant select, insert, update, delete on table public.ebay_tokens to service_role;
