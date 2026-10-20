-- 675: Dukan ke jude hue godam.
-- 670 PR #182 ne le liya, is liye ye 675 hai.
--
-- warehouses.shop_id dukan ka APNA shelf hai, godam ka assignment nahi.
-- POS par godam tabhi dikhe jab yahan link ho. Link na ho to card "—".
-- Doosri dukan ka shelf, ya juda na hua central godam, is raaste se nahi aata.
-- Live / Testing par tab tak nahi jab tak backup verify na ho.

create table if not exists public.shop_godams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  shop_id uuid not null references public.shops(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (shop_id, warehouse_id)
);

comment on table public.shop_godams is
  'Kaunsa godam kis dukan ke POS par dikhe. Link na ho to godam "—" (675).';

create index if not exists shop_godams_shop_idx on public.shop_godams (shop_id);
create index if not exists shop_godams_warehouse_idx on public.shop_godams (warehouse_id);

create or replace function public.fn_shop_godams_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_wh_shop uuid;
  v_wh_org uuid;
  v_wh_q boolean;
  v_shop_org uuid;
begin
  select w.shop_id, w.organization_id, coalesce(w.is_quarantine, false)
    into v_wh_shop, v_wh_org, v_wh_q
  from public.warehouses w
  where w.id = new.warehouse_id;
  if not found then
    raise exception 'Godam nahi mila.';
  end if;
  if v_wh_shop is not null then
    raise exception 'Dukan ka shelf godam ke tor par nahi judta.';
  end if;
  if v_wh_q then
    raise exception 'Quarantine godam dukan se nahi judta.';
  end if;
  select s.organization_id into v_shop_org from public.shops s where s.id = new.shop_id;
  if v_shop_org is null then
    raise exception 'Dukan nahi mili.';
  end if;
  if v_wh_org is distinct from v_shop_org then
    raise exception 'Godam aur dukan ek hi karobar ke hone chahiye.';
  end if;
  new.organization_id := v_shop_org;
  return new;
end;
$$;

drop trigger if exists trg_shop_godams_guard on public.shop_godams;
create trigger trg_shop_godams_guard
  before insert or update on public.shop_godams
  for each row execute function public.fn_shop_godams_guard();

alter table public.shop_godams enable row level security;
alter table public.shop_godams force row level security;

drop policy if exists shop_godams_select on public.shop_godams;
create policy shop_godams_select on public.shop_godams
  for select to authenticated
  using (
    organization_id = public.fn_current_user_organization_id()
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.role in ('owner', 'super_admin', 'admin')
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_active and p.shop_id = shop_godams.shop_id
      )
      or exists (
        select 1
        from public.pos_counter_staff pcs
        join public.pos_counters c on c.id = pcs.counter_id
        where pcs.profile_id = auth.uid()
          and pcs.is_active
          and c.is_active
          and c.shop_id = shop_godams.shop_id
      )
    )
  );

drop policy if exists shop_godams_write on public.shop_godams;
create policy shop_godams_write on public.shop_godams
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role in ('owner', 'super_admin', 'admin')
        and p.organization_id = shop_godams.organization_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role in ('owner', 'super_admin', 'admin')
        and p.organization_id = public.fn_current_user_organization_id()
    )
    and exists (
      select 1 from public.shops s
      where s.id = shop_id
        and s.organization_id = public.fn_current_user_organization_id()
    )
  );

revoke all on public.shop_godams from public, anon;
grant select, insert, update, delete on public.shop_godams to authenticated;
grant all on public.shop_godams to service_role;

-- POS ka godam sirf isi function se. Client warehouse id nahi bhejta.
-- Juda na hua godam, doosri dukan ka shelf, aur quarantine yahan se nahi nikalte.
create or replace function public.fn_shop_linked_godam_stock(p_shop_id uuid, p_product_ids uuid[])
returns table (product_id uuid, warehouse_id uuid, warehouse_name text, qty numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ok boolean;
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
  if not exists (
    select 1 from public.shops s
    where s.id = p_shop_id
      and s.organization_id = public.fn_current_user_organization_id()
  ) then
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

  return query
  select i.product_id, w.id, w.name, sum(greatest(coalesce(i.quantity_on_hand, 0), 0))::numeric
  from public.shop_godams sg
  join public.warehouses w on w.id = sg.warehouse_id
  join public.inventory i on i.warehouse_id = w.id
  where sg.shop_id = p_shop_id
    and w.shop_id is null
    and coalesce(w.is_quarantine, false) = false
    and i.product_id = any(p_product_ids)
  group by i.product_id, w.id, w.name;
end;
$$;

revoke all on function public.fn_shop_linked_godam_stock(uuid, uuid[]) from public, anon;
grant execute on function public.fn_shop_linked_godam_stock(uuid, uuid[]) to authenticated, service_role;

comment on function public.fn_shop_linked_godam_stock(uuid, uuid[]) is
  'POS: sirf is dukan se jude godam ka stock. Link na ho to koi qatar nahi (675).';

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, is_active)
values (
  'shops.godam',
  'Dukan ke godam',
  'Shop godams',
  'دکان کے گودام',
  '/admin/shops/godam',
  'Boxes',
  false,
  'Kaunsa godam kis dukan ke POS card par dikhe. Link ke baghair Godam —.',
  true
)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  route = excluded.route,
  description = excluded.description,
  is_active = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('owner', 'shops.godam', array['view','edit']::text[], 'all'),
  ('super_admin', 'shops.godam', array['view','edit']::text[], 'all'),
  ('admin', 'shops.godam', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'shops.godam', 'rm',
  'Har dukan ke POS card par sirf wahi godam dikhe jo us dukan se juda ho. Doosri dukan ka maal aur juda na hua godam nahi dikhta.',
  'Owner aur Admin.',
  'Jab nayi dukan khule, ya godam badle, yahan link lagayein. Link se pehle POS par Godam — rehta hai.',
  array[
    'Dukan chunein.',
    'Jo godam us dukan ko maal dete hain un par nishaan lagayein.',
    'Save karein. Dukan ka apna shelf yahan nahi judta.',
    'POS card par ab sirf in godamon ki ginti aati hai.'
  ],
  'POS khol kar us dukan ke card par Godam ka adad dekhein. Link hata dein to wapas — aa jata hai.',
  array[
    'Branch ka saara central godam khud nahi judta. Jo nishaan na laga, wo POS par nahi aata.',
    'Doosri dukan ka shelf godam nahi ban sakta.',
    '— ka matlab link ya sawal nahi, khali godam nahi. Khali godam 0 dikhta hai, lekin sirf link ke baad.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'shops.godam', 'en',
  'A shop POS card shows only the godams linked to that shop. Other shops and unlinked godams stay off the card.',
  'Owner and Admin.',
  'When a shop opens or its godam changes. Until a link exists the card shows —.',
  array[
    'Pick the shop.',
    'Tick the godams that supply it.',
    'Save. A shop shelf cannot be linked as a godam.',
    'The POS card then shows only those godams.'
  ],
  'Open POS for that shop and read the Godam figure. Remove the link and it returns to —.',
  array[
    'Branch-wide godams are not linked automatically.',
    'Another shop shelf cannot be a godam.',
    '— means not linked or not known. Zero means linked and empty.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('shops', 'shops.godam', 40, null, 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;
