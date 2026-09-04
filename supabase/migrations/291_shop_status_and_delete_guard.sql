-- =====================================================================
-- AgriBridge — Migration 291: Dukan ki halat, aur mitane par taala
-- =====================================================================
-- Malik ka kehna (4 September): dukanon ke safhe par delete, edit,
-- suspend aur active/inactive -- chaaron hone chahiyen.
--
-- Aur is kaam ke dauran ek asal khatra saamne aaya. Us raat malik ne
-- kaha "baqi sab dukanein khatam kar dein". Un mein se EK dukan wo thi
-- jis ke godam mein poore din ka maal para tha -- 2293 cheezein, 66
-- stock ki harkatein, aur us purchase ka rishta. Us ko mitane ka matlab
-- tha poore din ka kaam khatam. Wo haath se pakRa gaya, code se nahi:
-- `deleteShop` mein koi rok thi hi nahi.
--
-- Aisi rok sirf safhe par lagana kaafi nahi hota. Safha ek darwaza hai;
-- database har darwaze ke peeche hai. Is liye rok yahan hai.
--
-- TEEN HAALATEIN, aur is nizam mein in ka farq maayne rakhta hai:
--   active     -- chal rahi hai
--   inactive   -- filhal band (mausami, ya abhi khuli nahi)
--   suspended  -- ROKI GAYI hai (koi masla hai). Ye "band" se alag hai:
--                 band dukan apni marzi se band hai, roki hui dukan
--                 kisi faisle se ruki hai -- aur wo faisla kisi ke naam
--                 par likha hota hai.
--
-- `is_active` waise ka waisa rehta hai (purana code usay parhta hai),
-- magar ab wo halat se KHUD banta hai. Do jagah alag alag likhne se
-- kisi din wo do alag baat kehne lagte hain.
-- =====================================================================

alter table public.shops
  add column if not exists status text not null default 'active'
    check (status in ('active','inactive','suspended')),
  add column if not exists suspend_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null;

comment on column public.shops.status is
  'active / inactive (khud band) / suspended (faisle se roki gayi) -- 291.';

-- Purani qatarein: is_active se halat bana lein.
update public.shops set status = case when is_active then 'active' else 'inactive' end
 where status is null or status = 'active' and is_active = false;

-- is_active ab halat se khud banta hai.
create or replace function public.fn_shop_sync_active()
returns trigger language plpgsql as $$
begin
  new.is_active := (new.status = 'active');
  if new.status <> 'suspended' then
    new.suspend_reason := null;
    new.suspended_at := null;
    new.suspended_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shop_sync_active on public.shops;
create trigger trg_shop_sync_active
  before insert or update of status on public.shops
  for each row execute function public.fn_shop_sync_active();

-- =====================================================================
-- Mitane par taala
-- =====================================================================
-- Jis dukan ke peeche kaam khaRa hai wo nahi mitti. Rokne ke liye
-- "band" ya "roki gayi" ka raasta maujood hai -- wo record bhi rakhta
-- hai aur kaam bhi rok deta hai. Mitana us cheez ko khatam kar deta hai
-- jis se baad mein hisaab hota hai.
-- =====================================================================

create or replace function public.fn_shop_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_maal numeric;
  v_bikri int;
  v_staff int;
begin
  select coalesce(sum(i.quantity_on_hand), 0) into v_maal
    from inventory i join warehouses w on w.id = i.warehouse_id
   where w.shop_id = old.id;

  select count(*) into v_bikri from pos_sales where shop_id = old.id;
  select count(*) into v_staff from profiles where shop_id = old.id;

  if coalesce(v_maal, 0) <> 0 then
    raise exception 'Is dukan ke godam mein % maal para hai -- dukan nahi mit sakti. Pehle maal doosri jagah bhejein, ya dukan ko band/roki hui kar dein.', v_maal
      using errcode = 'raise_exception';
  end if;

  if v_bikri > 0 then
    raise exception 'Is dukan par % bikri ho chuki hai -- dukan nahi mit sakti. Us bikri ka hisaab isi dukan ke naam par hai. Dukan ko band kar dein.', v_bikri
      using errcode = 'raise_exception';
  end if;

  if v_staff > 0 then
    raise exception 'Is dukan par % mulazim lage hue hain -- pehle unhen doosri dukan par bhejein.', v_staff
      using errcode = 'raise_exception';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_shop_delete_guard on public.shops;
create trigger trg_shop_delete_guard
  before delete on public.shops
  for each row execute function public.fn_shop_delete_guard();

notify pgrst, 'reload schema';
