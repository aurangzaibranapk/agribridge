-- 676: HQ godam har fa'al dukan se juda.
--
-- Ek hi markazi godam hai. Dukan ka shelf (shop_id bhara) aur quarantine
-- is mein nahi aate. Ek hi central godam ho to wahi HQ hai.
-- Kai hon to naam ya code mein HQ, phir Main, phir Markaz — notice mein
-- likha jata hai ke kaun sa chuna. Naam na mile to koi link nahi, taake
-- galat godam na jud jaye.
--
-- Nayi dukan banate hi wahi HQ judta hai. Admin baad mein hata ya badal
-- sakta hai (/admin/shops/godam). Dobara chalane par ON CONFLICT DO NOTHING.

create or replace function public.fn_hq_godam_id(p_org uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_code text;
  v_n int;
  v_named int;
begin
  if p_org is null then
    return null;
  end if;

  select count(*) into v_n
  from public.warehouses w
  where w.organization_id = p_org
    and w.shop_id is null
    and coalesce(w.is_quarantine, false) = false;

  if v_n = 0 then
    raise notice '676: is karobar ka koi central godam nahi (org %).', p_org;
    return null;
  end if;

  if v_n > 1 then
    select count(*) into v_named
    from public.warehouses w
    where w.organization_id = p_org
      and w.shop_id is null
      and coalesce(w.is_quarantine, false) = false
      and (
        coalesce(w.name, '') ~* '(hq|main|markaz)'
        or coalesce(w.code, '') ~* '(hq|main|markaz)'
      );
    if v_named = 0 then
      raise notice '676: % central godam hain, kisi ke naam/code mein HQ, Main ya Markaz nahi. Link nahi (org %).', v_n, p_org;
      return null;
    end if;
  end if;

  select w.id, w.name, w.code
    into v_id, v_name, v_code
  from public.warehouses w
  where w.organization_id = p_org
    and w.shop_id is null
    and coalesce(w.is_quarantine, false) = false
    and (
      v_n = 1
      or coalesce(w.name, '') ~* '(hq|main|markaz)'
      or coalesce(w.code, '') ~* '(hq|main|markaz)'
    )
  order by
    case
      when coalesce(w.name, '') ~* 'hq' or coalesce(w.code, '') ~* 'hq' then 0
      when coalesce(w.name, '') ~* 'main' or coalesce(w.code, '') ~* 'main' then 1
      when coalesce(w.name, '') ~* 'markaz' or coalesce(w.code, '') ~* 'markaz' then 2
      else 3
    end,
    case when coalesce(w.is_active, true) then 0 else 1 end,
    w.created_at asc nulls last,
    w.id
  limit 1;

  if v_id is null then
    raise notice '676: HQ godam chun nahi saka (org %).', p_org;
    return null;
  end if;

  if v_n = 1 then
    raise notice '676: HQ godam ek hi central hai — % / % (id %).', v_name, v_code, v_id;
  else
    raise notice '676: % central godam mein se HQ chuna — % / % (id %).', v_n, v_name, v_code, v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.fn_hq_godam_id(uuid) from public, anon;
grant execute on function public.fn_hq_godam_id(uuid) to service_role;

comment on function public.fn_hq_godam_id(uuid) is
  'Is karobar ka ek HQ godam: shop_id khali, quarantine nahi. Kai hon to HQ/Main/Markaz (676).';

-- Pehle se maujood fa'al dukanein.
do $$
declare
  r record;
  v_hq uuid;
  v_n int;
begin
  for r in
    select distinct s.organization_id as organization_id
    from public.shops s
    where s.is_active
      and s.organization_id is not null
  loop
    v_hq := public.fn_hq_godam_id(r.organization_id);
    if v_hq is null then
      continue;
    end if;
    insert into public.shop_godams (shop_id, warehouse_id)
    select s.id, v_hq
    from public.shops s
    where s.organization_id = r.organization_id
      and s.is_active
    on conflict (shop_id, warehouse_id) do nothing;
    get diagnostics v_n = row_count;
    raise notice '676: fa''al dukanon par HQ link — org %, naye %, godam %.', r.organization_id, v_n, v_hq;
  end loop;
end
$$;

create or replace function public.fn_shop_link_hq_godam()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hq uuid;
begin
  v_hq := public.fn_hq_godam_id(new.organization_id);
  if v_hq is null then
    raise notice '676: nayi dukan % — HQ godam nahi mila, link nahi.', new.id;
    return new;
  end if;
  insert into public.shop_godams (shop_id, warehouse_id)
  values (new.id, v_hq)
  on conflict (shop_id, warehouse_id) do nothing;
  raise notice '676: nayi dukan % HQ godam % se judi.', new.id, v_hq;
  return new;
end;
$$;

revoke all on function public.fn_shop_link_hq_godam() from public, anon;

drop trigger if exists trg_shop_link_hq_godam on public.shops;
create trigger trg_shop_link_hq_godam
  after insert on public.shops
  for each row execute function public.fn_shop_link_hq_godam();

update public.feature_help set
  purpose = 'Har dukan ke POS card par sirf jude godam. HQ godam har fa''al dukan se khud juda hota hai. Doosri dukan ka maal nahi dikhta.',
  when_use = 'HQ pehle se juda hota hai. Yahan tab aayein jab godam badalna ho ya HQ hataana ho. HQ hataane par POS par Godam —.',
  mistakes = array[
    'Sirf HQ khud judta hai. Doosra central godam tabhi aata hai jab yahan nishaan lagayein.',
    'Doosri dukan ka shelf godam nahi ban sakta.',
    '— ka matlab link hata diya gaya ya HQ mila hi nahi. Khali godam 0 hai, link ke baad.'
  ]
where feature_key = 'shops.godam' and lang = 'rm';

update public.feature_help set
  purpose = 'A shop POS card shows only linked godams. The HQ godam is linked to every active shop. Other shops stay off the card.',
  when_use = 'HQ is already linked. Come here to change it or remove HQ. Removing HQ makes the card show —.',
  mistakes = array[
    'Only the HQ godam is linked on its own. Another central godam appears only if you tick it here.',
    'Another shop shelf cannot be a godam.',
    '— means the link was removed or no HQ was found. Zero means linked and empty.'
  ]
where feature_key = 'shops.godam' and lang = 'en';
