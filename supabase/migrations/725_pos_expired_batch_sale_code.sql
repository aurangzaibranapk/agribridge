-- 725: Expire batch ki bikri ab hamesha band nahi.
--
-- Stock mein show ho sakti hai, physically side-line hai, aur bikri se
-- nuqsan ho sakta hai. Code ke baghair checkout nahi hota.
--
-- Code NAYA nahi. Wahi staff_auth_codes (crypt) jo POS wapsi par lagta
-- hai: manager / admin / owner, shaakh ka manager ya koi bhi admin.
-- Ghalat koshish alag table mein rehti hai (rollback usay mita nahi
-- deti, kyunke function exception nahi phenkta). Sahi code par is bill
-- ka override pos_expired_sale_overrides mein authorized_by ke sath.
--
-- create_pos_sale_base_504 yahan REPLACE nahi hoti. Doosra kaam qty ki
-- rok hai — ye file us stock-qty logic ko nahi cherti.
-- Flag sirf isi transaction ke liye: agla bill phir se code mangta hai.
--
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 725_pos_expired_batch_sale_code.rollback.sql

create schema if not exists private;

create or replace function public.fn_expired_batch_sale_block_message(p_batches text)
returns text
language sql
immutable
as $$
  select 'Ye batch (' || coalesce(nullif(btrim(p_batches), ''), 'expire')
    || ') stock mein show ho rahi hai, lekin physically side-line kar di gayi hai. Is se nuqsan ho sakta hai. Sale ke liye admin ka code lagayein.';
$$;

-- Wapsi wala milaan. Apna code bhi chalega (return ki tarah). Discount
-- wala "doosra manager" yahan nahi — ye wapsi ka gate hai.
create or replace function private.fn_match_staff_auth_code(p_code text, p_branch uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_manager uuid;
begin
  if coalesce(btrim(p_code), '') = '' then
    return null;
  end if;
  select sac.profile_id into v_manager
    from public.staff_auth_codes sac
    join public.profiles p on p.id = sac.profile_id
   where p.is_active
     and p.role::text in ('manager', 'admin', 'owner', 'super_admin')
     and (p.branch_id = p_branch or p.role::text in ('admin', 'owner', 'super_admin'))
     and sac.code_hash = extensions.crypt(btrim(p_code), sac.code_hash)
   limit 1;
  return v_manager;
end;
$$;

revoke all on function private.fn_match_staff_auth_code(text, uuid) from public, anon, authenticated;

-- Jo batch is bill ki FIFO (created_at, wahi jo create_pos_sale_base_504
-- use karti hai) mein aa kar expire ho, un ke number. Khali = ye miqdar
-- expire batch nahi chhuegi.
create or replace function private.fn_pos_expired_batch_numbers(p_items jsonb, p_warehouse uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_left numeric;
  v_take numeric;
  v_today date := (timezone('Asia/Karachi', now()))::date;
  v_hit text[] := array[]::text[];
  r record;
begin
  if p_warehouse is null then
    return v_hit;
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_left := coalesce(
      public.pos_line_stock_units(
        (v_item->>'product_id')::uuid,
        coalesce((v_item->>'quantity')::numeric, 0),
        coalesce((v_item->>'unit_price')::numeric, 0),
        nullif(v_item->>'sale_unit', '')
      ),
      coalesce((v_item->>'quantity')::numeric, 0)
    );
    if v_left is null or v_left <= 0 then
      continue;
    end if;
    for r in
      select sb.batch_number, sb.expiry_date, sb.remaining_quantity
        from public.stock_batches sb
       where sb.warehouse_id = p_warehouse
         and sb.product_id = (v_item->>'product_id')::uuid
         and coalesce(sb.remaining_quantity, 0) > 0
       order by sb.created_at asc, sb.id
    loop
      exit when v_left <= 0;
      v_take := least(v_left, r.remaining_quantity);
      if r.expiry_date is not null and r.expiry_date < v_today then
        v_hit := v_hit || coalesce(nullif(btrim(r.batch_number), ''), 'bina number');
      end if;
      v_left := v_left - v_take;
    end loop;
  end loop;
  return v_hit;
end;
$$;

revoke all on function private.fn_pos_expired_batch_numbers(jsonb, uuid) from public, anon, authenticated;

create table if not exists public.pos_expired_sale_code_attempts (
  id uuid primary key default gen_random_uuid(),
  attempted_by uuid references public.profiles(id),
  branch_id uuid references public.branches(id),
  counter_id uuid,
  batch_numbers text[] not null default '{}',
  product_ids uuid[] not null default '{}',
  attempted_at timestamptz not null default now()
);

create index if not exists idx_expired_sale_attempts_by
  on public.pos_expired_sale_code_attempts (attempted_by, attempted_at desc);

comment on table public.pos_expired_sale_code_attempts is
  'Expire-batch sale par ghalat admin code. Kamyab bikri yahan nahi.';

create table if not exists public.pos_expired_sale_overrides (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.pos_sales(id),
  attempted_by uuid references public.profiles(id),
  authorized_by uuid not null references public.profiles(id),
  branch_id uuid references public.branches(id),
  counter_id uuid,
  batch_numbers text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_expired_sale_overrides_sale
  on public.pos_expired_sale_overrides (sale_id);

comment on table public.pos_expired_sale_overrides is
  'Kis bill par expire batch biki, kis ne code lagaya, kis ka code tha.';

alter table public.pos_expired_sale_code_attempts enable row level security;
alter table public.pos_expired_sale_overrides enable row level security;

revoke all on public.pos_expired_sale_code_attempts from public, anon, authenticated;
revoke all on public.pos_expired_sale_overrides from public, anon, authenticated;
grant select on public.pos_expired_sale_code_attempts to authenticated, service_role;
grant select on public.pos_expired_sale_overrides to authenticated, service_role;

drop policy if exists pos_expired_sale_attempts_read on public.pos_expired_sale_code_attempts;
create policy pos_expired_sale_attempts_read on public.pos_expired_sale_code_attempts
  for select to authenticated using (public.fn_is_any_staff());

drop policy if exists pos_expired_sale_overrides_read on public.pos_expired_sale_overrides;
create policy pos_expired_sale_overrides_read on public.pos_expired_sale_overrides
  for select to authenticated using (public.fn_is_any_staff());

-- 668 ka trigger. allow_expired_out (write-off) pehle jaisa. Naya flag
-- sirf is bill ki transaction mein, code milne ke baad.
create or replace function public.fn_guard_expired_batch_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.remaining_quantity is not null
     and old.remaining_quantity is not null
     and new.remaining_quantity < old.remaining_quantity
     and old.expiry_date is not null
     and old.expiry_date < (timezone('Asia/Karachi', now()))::date
     and current_setting('agribridge.allow_expired_out', true) is distinct from 'on'
     and current_setting('agribridge.expired_sale_override', true) is distinct from 'on' then
    raise exception '%', public.fn_expired_batch_sale_block_message(coalesce(nullif(btrim(old.batch_number), ''), 'bina number'));
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_expired_batch_sale on public.stock_batches;
create trigger trg_guard_expired_batch_sale
  before update on public.stock_batches
  for each row execute function public.fn_guard_expired_batch_sale();

-- Checkout ka bahari darwaza. Andar wahi create_pos_sale_with_credit_approval
-- hai — rate, discount, udhaar ki rok wahan hi rehti hai.
create or replace function public.fn_pos_sale_with_expired_code(
  p_items jsonb,
  p_payment_mode text,
  p_cash_paid numeric default 0,
  p_khata_amount numeric default 0,
  p_customer_id uuid default null,
  p_counter_id uuid default null,
  p_payment_lines jsonb default null,
  p_discount numeric default null,
  p_discount_reason text default null,
  p_client_action_id uuid default null,
  p_credit_override_reason text default null,
  p_manager_code text default null,
  p_expired_sale_code text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dealer uuid;
  v_warehouse uuid;
  v_branch uuid;
  v_hits text[] := array[]::text[];
  v_products uuid[] := array[]::uuid[];
  v_code text := btrim(coalesce(p_expired_sale_code, ''));
  v_manager uuid;
  v_sale uuid;
  v_existing uuid;
begin
  if auth.uid() is null then
    raise exception 'Login zaroori hai.';
  end if;

  if p_client_action_id is not null then
    select id into v_existing
      from public.pos_sales
     where client_action_id = p_client_action_id
     limit 1;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  v_dealer := public.current_dealer_id();
  if v_dealer is null then
    if p_counter_id is not null then
      select c.warehouse_id, c.branch_id into v_warehouse, v_branch
        from public.pos_counters c
       where c.id = p_counter_id;
    end if;
    if v_warehouse is null then
      v_warehouse := public.fn_current_user_warehouse_id();
    end if;
    if v_branch is null then
      v_branch := public.fn_current_user_branch_id();
    end if;
    select coalesce(array_agg(distinct b), array[]::text[])
      into v_hits
      from unnest(private.fn_pos_expired_batch_numbers(p_items, v_warehouse)) as u(b);
  end if;
  v_hits := coalesce(v_hits, array[]::text[]);

  select coalesce(array_agg((value->>'product_id')::uuid), array[]::uuid[])
    into v_products
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
   where coalesce(value->>'product_id', '') <> '';
  v_products := coalesce(v_products, array[]::uuid[]);

  if v_code <> '' then
    v_manager := private.fn_match_staff_auth_code(v_code, v_branch);
    if v_manager is null then
      insert into public.pos_expired_sale_code_attempts (
        attempted_by, branch_id, counter_id, batch_numbers, product_ids
      ) values (
        auth.uid(), v_branch, p_counter_id, coalesce(v_hits, array[]::text[]), coalesce(v_products, array[]::uuid[])
      );
      return null;
    end if;
    perform set_config('agribridge.expired_sale_override', 'on', true);
  elsif coalesce(cardinality(v_hits), 0) > 0 then
    raise exception '%', public.fn_expired_batch_sale_block_message(array_to_string(v_hits, ', '));
  end if;

  v_sale := public.create_pos_sale_with_credit_approval(
    p_items => p_items,
    p_payment_mode => p_payment_mode,
    p_cash_paid => p_cash_paid,
    p_khata_amount => p_khata_amount,
    p_customer_id => p_customer_id,
    p_counter_id => p_counter_id,
    p_payment_lines => p_payment_lines,
    p_discount => p_discount,
    p_discount_reason => p_discount_reason,
    p_client_action_id => p_client_action_id,
    p_credit_override_reason => p_credit_override_reason,
    p_manager_code => p_manager_code
  );

  if v_manager is not null and v_sale is not null then
    insert into public.pos_expired_sale_overrides (
      sale_id, attempted_by, authorized_by, branch_id, counter_id, batch_numbers
    ) values (
      v_sale, auth.uid(), v_manager, v_branch, p_counter_id, coalesce(v_hits, array[]::text[])
    );
  end if;

  return v_sale;
end;
$$;

revoke all on function public.fn_pos_sale_with_expired_code(
  jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text, text, text
) from public, anon;
grant execute on function public.fn_pos_sale_with_expired_code(
  jsonb, text, numeric, numeric, uuid, uuid, jsonb, numeric, text, uuid, text, text, text
) to authenticated, service_role;

update public.feature_help
   set purpose = purpose || ' Expire batch stock mein show ho sakti hai, physically side-line hoti hai, aur bikri se nuqsan ho sakta hai. Sale ke liye wahi admin code chahiye jo POS wapsi par lagta hai.',
       how_steps = case
         when how_steps @> array['Expire batch par admin ka code likhein — wahi code jo wapsi par lagta hai.']::text[]
           then how_steps
         else coalesce(how_steps, array[]::text[]) || array['Expire batch par admin ka code likhein — wahi code jo wapsi par lagta hai.']
       end,
       mistakes = case
         when mistakes @> array['Expire batch bina code bechna.']::text[]
           then mistakes
         else coalesce(mistakes, array[]::text[]) || array['Expire batch bina code bechna.']
       end
 where feature_key = 'pos'
   and lang = 'rm'
   and coalesce(purpose, '') not like '%side-line%';
