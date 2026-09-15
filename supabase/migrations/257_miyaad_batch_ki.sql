-- =====================================================================
-- AgriBridge — Migration 257: Miyaad batch ki hoti hai, product ki nahi
-- =====================================================================
-- Naqshe (docs/AI-PURCHASE-PIPELINE.md) ka qadam D.
--
-- Ab tak sheet aur Maal Andar dono products.expiry_date likhte the --
-- ek product, ek miyaad. Doosra batch aate hi ye jhoot ho jata hai:
-- purana maal March ka, naya September ka, aur product par ek hi
-- tareekh. Miyaad asal mein batch ki hoti hai (stock_batches mein
-- pehle se khana hai, purchase ke raaste bharta bhi tha).
--
-- Ab teen baatein:
--
-- 1. Har raaste se aaya maal apna batch banata hai -- purchase (pehle
--    se), sheet ka shuru ka stock, Maal Andar. Code mein.
--
-- 2. products.expiry_date SIRF DIKHANE KE LIYE hai: jab product ka koi
--    batch maal ke sath aur miyaad ke sath maujood ho, ye un mein se
--    sab se qareeb wali miyaad hai. Trigger rakhta hai. Haath se likhi
--    tareekh us waqt nahi tikti.
--
-- 3. Jis product ka aisa koi batch nahi (sirf rate charha, ya batch
--    par miyaad likhi hi nahi), us par haath se likhi miyaad rehti
--    hai. Ye jaan boojh kar hai: batch ki miyaad na hone par product
--    ki miyaad mita dena maloomat ka nuqsan hai, aur "nahi maloom" ko
--    "nahi hai" bana deta hai. Is ka ek natija hai: batch bik jaye to
--    purani tareekh product par reh sakti hai jab tak naya batch na
--    aaye. Wo tareekh ghalat nahi, sirf purani hai.
-- =====================================================================

create or replace function fn_refresh_product_expiry(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exp date;
  v_mfg date;
begin
  select sb.expiry_date, sb.manufacture_date
    into v_exp, v_mfg
  from stock_batches sb
  where sb.product_id = p_product_id
    and coalesce(sb.remaining_quantity, 0) > 0
    and sb.expiry_date is not null
  order by sb.expiry_date asc, sb.created_at asc
  limit 1;

  -- Koi batch maal aur miyaad ke sath nahi: product ko haath nahi lagate.
  if v_exp is null then
    return;
  end if;

  update products
     set expiry_date = v_exp,
         manufacture_date = coalesce(v_mfg, manufacture_date)
   where id = p_product_id
     and (expiry_date is distinct from v_exp
          or (v_mfg is not null and manufacture_date is distinct from v_mfg));
end;
$$;

comment on function fn_refresh_product_expiry(uuid) is
  'products.expiry_date ko sab se qareeb wale (maal wale) batch ki miyaad par rakhta hai. Aisa batch na ho to kuch nahi karta (257).';

create or replace function fn_trg_batch_refresh_expiry()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform fn_refresh_product_expiry(old.product_id);
    return old;
  end if;
  perform fn_refresh_product_expiry(new.product_id);
  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform fn_refresh_product_expiry(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_batch_refresh_expiry on stock_batches;
create trigger trg_batch_refresh_expiry
  after insert or update of remaining_quantity, expiry_date, manufacture_date, product_id or delete
  on stock_batches
  for each row execute function fn_trg_batch_refresh_expiry();

-- Product par haath se likhi miyaad tab nahi tikti jab batch ki miyaad
-- maujood ho. Warna form se ek tareekh likhi jati aur agle batch tak
-- wahi jhoot dikhti rehti.
create or replace function fn_trg_product_expiry_guard()
returns trigger
language plpgsql
as $$
declare
  v_exp date;
begin
  select min(sb.expiry_date) into v_exp
  from stock_batches sb
  where sb.product_id = new.id
    and coalesce(sb.remaining_quantity, 0) > 0
    and sb.expiry_date is not null;
  if v_exp is not null then
    new.expiry_date := v_exp;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_expiry_guard on products;
create trigger trg_product_expiry_guard
  before update of expiry_date on products
  for each row execute function fn_trg_product_expiry_guard();

comment on column products.expiry_date is
  'Sirf dikhane ke liye: maal wale batches mein sab se qareeb miyaad (257). Aisa batch na ho to haath se likhi tareekh rehti hai.';

-- Maal wale batches ek nazar mein: kis godam mein, kitna, kab tak.
drop view if exists v_product_batches;
create view v_product_batches as
select
  sb.id as batch_id,
  sb.product_id,
  p.name as product_name,
  p.pack_size,
  sb.warehouse_id,
  w.name as warehouse_name,
  sb.batch_number,
  sb.expiry_date,
  sb.manufacture_date,
  sb.remaining_quantity,
  sb.unit_cost,
  (sb.expiry_date - current_date) as days_left,
  sb.created_at
from stock_batches sb
join products p on p.id = sb.product_id
left join warehouses w on w.id = sb.warehouse_id
where coalesce(sb.remaining_quantity, 0) > 0
  and p.is_deleted = false
  and fn_is_any_staff();

comment on view v_product_batches is
  'Jin batches mein maal para hai: godam, tadad, miyaad aur kitne din baqi (257).';

-- Purane products: jin ka koi maal wala batch miyaad ke sath hai, un ki
-- tareekh abhi seedhi kar do. Baqi ko haath nahi lagta.
select fn_refresh_product_expiry(p.id)
from products p
where exists (
  select 1 from stock_batches sb
  where sb.product_id = p.id
    and coalesce(sb.remaining_quantity, 0) > 0
    and sb.expiry_date is not null
);
