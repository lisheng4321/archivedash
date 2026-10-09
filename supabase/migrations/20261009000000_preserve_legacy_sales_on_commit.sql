-- Historical imports can contain repeated sale IDs. Preserve those records
-- exactly, including their copy counts, while requiring unique IDs for new sales.
-- Receipts live under an account-scoped app_data key and make lost-response
-- retries idempotent even when later inventory edits have already committed.
create or replace function public.commit_inventory_sale(
  p_operation_id uuid,
  p_inventory jsonb,
  p_sales jsonb,
  p_inventory_revision timestamptz,
  p_sales_revision timestamptz
) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare
  account_id uuid := auth.uid();
  current_inventory jsonb;
  current_sales jsonb;
  inventory_revision timestamptz;
  sales_revision timestamptz;
  receipt jsonb;
  fingerprint text := md5(jsonb_build_object('inventory', p_inventory, 'sales', p_sales)::text);
  sold jsonb;
  additions jsonb;
  stamp timestamptz;
begin
  if account_id is null then raise exception 'Sign in before recording a sale.'; end if;
  if p_operation_id is null or jsonb_typeof(p_inventory) is distinct from 'array' or jsonb_typeof(p_sales) is distinct from 'array' then
    raise exception 'Invalid sale operation.';
  end if;
  -- Serialize cooperating operations for this user, including an absent first-run row.
  perform pg_advisory_xact_lock(hashtextextended(account_id::text, 0));
  -- Stable lock order also coordinates with existing revision-checked writes.
  perform 1 from public.app_data where user_id = account_id and key in ('arch-inv2', 'arch-sales2') order by key for update;
  select value, updated_at into current_inventory, inventory_revision from public.app_data where user_id = account_id and key = 'arch-inv2';
  select value, updated_at into current_sales, sales_revision from public.app_data where user_id = account_id and key = 'arch-sales2';
  current_inventory := coalesce(current_inventory, '[]'::jsonb);
  current_sales := coalesce(current_sales, '[]'::jsonb);
  select value into receipt from public.app_data where user_id = account_id and key = 'arch-sale-op:' || p_operation_id;
  if receipt is not null then
    if receipt->>'fingerprint' is distinct from fingerprint then raise exception 'This operation ID already belongs to a different sale.'; end if;
    return jsonb_build_object('ok', true, 'inventory', current_inventory, 'sales', current_sales, 'inventoryRevision', inventory_revision, 'salesRevision', sales_revision);
  end if;
  if inventory_revision is distinct from p_inventory_revision or sales_revision is distinct from p_sales_revision then
    raise exception 'Stock or sales changed in another tab. Your order is kept; refresh stock and review it before retrying.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_inventory) x group by x->>'id' having count(*) > 1) then
    raise exception 'Duplicate record IDs in sale operation.';
  end if;
  select coalesce(jsonb_agg(i), '[]'::jsonb) into sold from jsonb_array_elements(current_inventory) i
    where not exists (select 1 from jsonb_array_elements(p_inventory) n where n->>'id' = i->>'id');
  select coalesce(jsonb_agg(s), '[]'::jsonb) into additions from jsonb_array_elements(p_sales) s
    where not exists (select 1 from jsonb_array_elements(current_sales) o where o->>'id' is not distinct from s->>'id');
  if exists (select 1 from jsonb_array_elements(additions) s where coalesce(s->>'id', '') = '')
     or exists (select 1 from jsonb_array_elements(additions) s group by s->>'id' having count(*) > 1) then
    raise exception 'Duplicate or missing IDs in new sale records.';
  end if;
  if jsonb_array_length(sold) = 0 or jsonb_array_length(sold) <> jsonb_array_length(additions) then raise exception 'Selected stock no longer matches this order.'; end if;
  -- Compare existing sales as a multiset: a sale cannot edit, remove or add
  -- copies of historical rows, even when an imported ID was already repeated.
  if exists (
       select o from jsonb_array_elements(current_sales) o
       except all
       select n from jsonb_array_elements(p_sales) n
       where exists (select 1 from jsonb_array_elements(current_sales) o where o->>'id' is not distinct from n->>'id')
     ) or exists (
       select n from jsonb_array_elements(p_sales) n
       where exists (select 1 from jsonb_array_elements(current_sales) o where o->>'id' is not distinct from n->>'id')
       except all
       select o from jsonb_array_elements(current_sales) o
     )
     or exists (select 1 from jsonb_array_elements(p_inventory) n where not exists (select 1 from jsonb_array_elements(current_inventory) o where n = o)) then
    raise exception 'Existing records changed in this sale operation.';
  end if;
  if exists (select 1 from jsonb_array_elements(sold) i where
    coalesce(i->>'stockIssue', '') <> '' or
    (coalesce(i->>'availability', '') <> 'available' and (
      coalesce(i->>'availability', '') in ('preorder', 'in_transit') or
      coalesce(i->>'preorderOrigin', 'false') = 'true' or
      coalesce(i->>'releaseExpectedDate', '') <> '' or coalesce(i->>'preorderDate', '') <> ''
    ))) then raise exception 'This stock is unavailable or damaged. Mark it ready before selling.'; end if;
  if exists (select 1 from jsonb_array_elements(additions) s where
    not exists (select 1 from jsonb_array_elements(sold) i where i->>'id' = s->>'inventoryUnitId' and (i->>'price')::numeric = (s->>'costPrice')::numeric)
    or coalesce(s->>'saleDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
    or (s->>'saleDate')::date > (now() at time zone 'Australia/Sydney')::date
    or (coalesce(s->>'fulfilmentDate', '') <> '' and ((s->>'fulfilmentDate') !~ '^\d{4}-\d{2}-\d{2}$' or (s->>'fulfilmentDate')::date > (now() at time zone 'Australia/Sydney')::date))
    or coalesce(s->>'salePrice', '') !~ '^\d+(\.\d+)?$'
    or coalesce(s->>'shippingPrice', '') !~ '^\d+(\.\d+)?$'
    or coalesce(s->>'platformFees', '') !~ '^\d+(\.\d+)?$')
    or exists (select 1 from jsonb_array_elements(additions) s group by s->>'inventoryUnitId' having count(*) > 1) then
    raise exception 'Check the stock, dates and amounts for this order.';
  end if;
  stamp := greatest(clock_timestamp(), coalesce(inventory_revision, '-infinity'::timestamptz) + interval '1 microsecond', coalesce(sales_revision, '-infinity'::timestamptz) + interval '1 microsecond');
  insert into public.app_data(user_id, key, value, updated_at) values
    (account_id, 'arch-inv2', p_inventory, stamp), (account_id, 'arch-sales2', p_sales, stamp)
    on conflict(user_id, key) do update set value = excluded.value, updated_at = excluded.updated_at;
  insert into public.app_data(user_id, key, value, updated_at) values
    (account_id, 'arch-sale-op:' || p_operation_id, jsonb_build_object('fingerprint', fingerprint), stamp);
  return jsonb_build_object('ok', true, 'inventory', p_inventory, 'sales', p_sales, 'inventoryRevision', stamp, 'salesRevision', stamp);
end;
$$;
revoke all on function public.commit_inventory_sale(uuid, jsonb, jsonb, timestamptz, timestamptz) from public, anon;
grant execute on function public.commit_inventory_sale(uuid, jsonb, jsonb, timestamptz, timestamptz) to authenticated;
