-- 686: Har dukan ko HQ godam ka sirf apni qism ka stock (malik, 20 Oct).
-- ADDITIVE. Nayi table + helper + fn_shop_linked_godam_stock mein filter.
--  * Top category chunein -> us ki sub-categories khud shamil.
--  * Sub-category override: include=false (parent chuna, ye nahi) ya
--    include=true (parent nahi chuna, sirf ye) -- e.g. Rice & Grains.
--  * Dukan ki list KHALI = HQ ka sab stock (purana tareeqa).
--  * Sirf HQ godam (fn_hq_godam_id) filter hota hai. Dukan ka apna shelf
--    is function mein aata hi nahi, wo POS par hamesha poora rehta hai.
-- Kisi business row ko delete/badla nahi jata.

create table if not exists public.shop_allowed_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  include boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (shop_id, category_id)
);

comment on table public.shop_allowed_categories is
  'Dukan ko HQ godam ki kaunsi qism dikhe (686). Khali = sab. include=false sirf sub-category override.';

create index if not exists shop_allowed_categories_shop_idx on public.shop_allowed_categories (shop_id);

create or replace function public.fn_shop_allowed_categories_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_org uuid;
begin
  select s.organization_id into v_org from public.shops s where s.id = new.shop_id;
  if v_org is null then
    raise exception 'Dukan nahi mili.';
  end if;
  if not exists (select 1 from public.categories c where c.id = new.category_id) then
    raise exception 'Qism nahi mili.';
  end if;
  new.organization_id := v_org;
  return new;
end;
$$;

drop trigger if exists trg_shop_allowed_categories_guard on public.shop_allowed_categories;
create trigger trg_shop_allowed_categories_guard
  before insert or update on public.shop_allowed_categories
  for each row execute function public.fn_shop_allowed_categories_guard();

-- Audit: har tabdeeli DB mein bhi likhi jaye (app ka logAudit alag).
create table if not exists public.shop_allowed_categories_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  category_id uuid not null,
  action text not null,
  include boolean,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create or replace function public.fn_shop_allowed_categories_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.shop_allowed_categories_log (shop_id, category_id, action, include, changed_by)
    values (old.shop_id, old.category_id, 'delete', old.include, auth.uid());
    return old;
  end if;
  insert into public.shop_allowed_categories_log (shop_id, category_id, action, include, changed_by)
  values (new.shop_id, new.category_id, lower(tg_op), new.include, coalesce(auth.uid(), new.created_by));
  return new;
end;
$$;
revoke all on function public.fn_shop_allowed_categories_log() from public, anon, authenticated;

drop trigger if exists trg_shop_allowed_categories_log on public.shop_allowed_categories;
create trigger trg_shop_allowed_categories_log
  after insert or update or delete on public.shop_allowed_categories
  for each row execute function public.fn_shop_allowed_categories_log();

alter table public.shop_allowed_categories enable row level security;
alter table public.shop_allowed_categories force row level security;
alter table public.shop_allowed_categories_log enable row level security;

drop policy if exists shop_allowed_categories_select on public.shop_allowed_categories;
create policy shop_allowed_categories_select on public.shop_allowed_categories
  for select to authenticated
  using (organization_id = public.fn_current_user_organization_id() and public.fn_is_any_staff());

drop policy if exists shop_allowed_categories_write on public.shop_allowed_categories;
create policy shop_allowed_categories_write on public.shop_allowed_categories
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
        and p.role in ('owner', 'super_admin', 'admin')
        and p.organization_id = shop_allowed_categories.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
        and p.role in ('owner', 'super_admin', 'admin')
        and p.organization_id = public.fn_current_user_organization_id()
    )
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.organization_id = public.fn_current_user_organization_id()
    )
  );

drop policy if exists shop_allowed_categories_log_read on public.shop_allowed_categories_log;
create policy shop_allowed_categories_log_read on public.shop_allowed_categories_log
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active
        and p.role in ('owner', 'super_admin', 'admin')
    )
    and exists (
      select 1 from public.shops s
      where s.id = shop_allowed_categories_log.shop_id
        and s.organization_id = public.fn_current_user_organization_id()
    )
  );

revoke all on public.shop_allowed_categories, public.shop_allowed_categories_log from public, anon;
grant select, insert, update, delete on public.shop_allowed_categories to authenticated;
grant select on public.shop_allowed_categories_log to authenticated;
grant all on public.shop_allowed_categories, public.shop_allowed_categories_log to service_role;

-- Kya ye qism is dukan ko HQ se dikhe? Khali list = haan.
-- Pehle category ki apni row, phir us ke parent ki row.
create or replace function public.fn_shop_category_allowed(p_shop_id uuid, p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when not exists (select 1 from public.shop_allowed_categories a where a.shop_id = p_shop_id and a.include) then true
    when p_category_id is null then false
    else coalesce(
      (select a.include from public.shop_allowed_categories a where a.shop_id = p_shop_id and a.category_id = p_category_id),
      (select a.include from public.shop_allowed_categories a
         join public.categories c on c.parent_category_id = a.category_id
        where a.shop_id = p_shop_id and c.id = p_category_id),
      false
    )
  end
$$;
revoke all on function public.fn_shop_category_allowed(uuid, uuid) from public, anon;
grant execute on function public.fn_shop_category_allowed(uuid, uuid) to authenticated, service_role;

-- 675 wala function, sirf HQ godam par qism ka filter mazeed.
create or replace function public.fn_shop_linked_godam_stock(p_shop_id uuid, p_product_ids uuid[])
returns table (product_id uuid, warehouse_id uuid, warehouse_name text, qty numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ok boolean;
  v_org uuid;
  v_hq uuid;
begin
  if auth.uid() is null or not public.fn_is_any_staff() then
    raise exception 'Sirf staff is dukan ka godam dekh sakta hai.';
  end if;
  if p_shop_id is null or p_product_ids is null or cardinality(p_product_ids) = 0 then
    return;
  end if;
  if cardinality(p_product_ids) > 500 then
    raise exception 'Ek dafa mein 500 se zyada cheezein nahi.';
  end if;
  select s.organization_id into v_org
  from public.shops s
  where s.id = p_shop_id
    and s.organization_id = public.fn_current_user_organization_id();
  if v_org is null then
    raise exception 'Dukan nahi mili.';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active;

  v_ok := v_role in ('owner', 'super_admin', 'admin')
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active and p.shop_id = p_shop_id
    )
    or exists (
      select 1
      from public.pos_counter_staff pcs
      join public.pos_counters c on c.id = pcs.counter_id
      where pcs.profile_id = auth.uid()
        and pcs.is_active
        and c.is_active
        and c.shop_id = p_shop_id
    );
  if not v_ok then
    raise exception 'Is dukan ka godam aap nahi dekh sakte.';
  end if;

  v_hq := public.fn_hq_godam_id(v_org);

  return query
  select i.product_id, w.id, w.name, sum(greatest(coalesce(i.quantity_on_hand, 0), 0))::numeric
  from public.shop_godams sg
  join public.warehouses w on w.id = sg.warehouse_id
  join public.inventory i on i.warehouse_id = w.id
  left join public.products pr on pr.id = i.product_id
  where sg.shop_id = p_shop_id
    and w.shop_id is null
    and coalesce(w.is_quarantine, false) = false
    and i.product_id = any(p_product_ids)
    and (
      v_hq is null
      or w.id <> v_hq
      or public.fn_shop_category_allowed(p_shop_id, pr.category_id)
    )
  group by i.product_id, w.id, w.name;
end;
$$;

revoke all on function public.fn_shop_linked_godam_stock(uuid, uuid[]) from public, anon;
grant execute on function public.fn_shop_linked_godam_stock(uuid, uuid[]) to authenticated, service_role;

comment on function public.fn_shop_linked_godam_stock(uuid, uuid[]) is
  'POS: sirf is dukan se jude godam ka stock. HQ godam par dukan ki qismon ka filter (686). Link na ho to koi qatar nahi.';

-- Malik ki default list (20 Oct). Sirf un dukanon par jin ki list abhi khali hai.
do $$
declare
  r record;
  v_names text[];
  v_n int;
begin
  for r in
    select s.id, s.name, s.business_type
    from public.shops s
    where s.organization_id is not null
      and not exists (select 1 from public.shop_allowed_categories a where a.shop_id = s.id)
  loop
    v_names := case r.business_type
      when 'agri_inputs' then array['Fertilizer', 'Pesticide', 'Seeds', 'Agricultural Products', 'Animal Feed (Wanda)', 'Cattle/Dairy Feed', 'Poultry Feed']
      when 'vet' then array['Veterinary Medicines']
      when 'dairy' then array['Dairy Products', 'Milk & Dairy']
      when 'grain_procurement' then array['Raw Grain (Procurement)']
      when 'karyana' then array['Grocery']
      else null
    end;
    if v_names is null then
      raise notice '686: % (%) ki koi default list nahi -- sab dikhega.', r.name, r.business_type;
      continue;
    end if;
    insert into public.shop_allowed_categories (shop_id, category_id, include)
    select r.id, c.id, true
    from public.categories c
    where (
        c.name = any(v_names)
        or (r.business_type = 'karyana' and c.category_kind = 'karyana' and c.parent_category_id is null)
      )
      -- Feed ki sub-categories parent ke sath khud aati hain; parent ho to alag row nahi.
      and not (
        c.parent_category_id is not null
        and exists (select 1 from public.categories p where p.id = c.parent_category_id and p.name = any(v_names))
      )
    on conflict (shop_id, category_id) do nothing;
    get diagnostics v_n = row_count;
    raise notice '686: % -> % qismein.', r.name, v_n;
  end loop;
end
$$;
