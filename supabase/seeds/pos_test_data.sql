-- =====================================================================
-- AgriBridge — POS ke liye control shuda test stock
-- =====================================================================
-- Testing wale nizaam par stock BILKUL khali tha: 205 products, aur
-- inventory mein sifar qatarein. Us halat mein POS ka koi hissa jaancha
-- hi nahi ja sakta -- bikri par stock kata ya nahi, paisa cash book tak
-- pahuncha ya nahi, khata barha ya nahi. Sab kuch "shayad theek hoga"
-- par chhoR dena paRta hai.
--
-- Is liye chhe cheezein, har ek ki SAU adad, aur qeemat maloom -- taake
-- har jaanch ka jawab pehle se likha ja sake:
--
--   ZZTEST Urea 50kg        lagat 4,000   bikri 4,600
--   ZZTEST DAP 50kg         lagat 11,000  bikri 12,500
--   ZZTEST Sona Urea 50kg   lagat 3,800   bikri 4,400
--   ZZTEST Weedicide 1L     lagat 900     bikri 1,200
--   ZZTEST Wheat Seed 40kg  lagat 3,200   bikri 3,800
--   ZZTEST Spray Pump       lagat 6,500   bikri 8,000
--
-- Har naam "ZZTEST" se shuru hota hai. Ye jaan boojh kar hai: har
-- fehrist naam se tarteeb paati hai, is liye test ka saara samaan hamesha
-- sab se AAKHIR mein rehta hai aur asli maal ke beech mein nahi ghustaa.
-- Aur us se saaf karna bhi ek shart ka kaam ho jata hai (neeche wali
-- file).
--
-- LIVE PAR MAT CHALAYEIN.
--
-- Chalane ka tareeqa: Supabase ke SQL editor mein poori file paste karein.
-- Dobara chalane par kuch kharab nahi hota -- pehle purana test samaan
-- hataya jata hai, phir naya banta hai.
-- =====================================================================

do $$
declare
  v_branch uuid;
  v_warehouse uuid;
  v_org uuid;
  v_product uuid;
  r record;
begin
  -- Shakh wo chuni jati hai jis se koi staff juRa hua ho. Wajah:
  -- create_pos_sale bikri karne wale ki shakh se hi chalta hai, aur bina
  -- staff wali shakh par jaanch pehle qadam par hi rukk jati.
  select b.id, b.organization_id into v_branch, v_org
  from branches b
  where b.is_active
    and exists (select 1 from profiles p where p.branch_id = b.id)
    and exists (select 1 from warehouses w where w.branch_id = b.id and w.code = 'MAIN')
  order by b.name
  limit 1;

  if v_branch is null then
    raise exception 'Koi aisi shakh nahi mili jis mein staff bhi ho aur MAIN godam bhi. Pehle kisi staff ko shakh se joRein (Admin -> HR).';
  end if;

  select id into v_warehouse from warehouses where branch_id = v_branch and code = 'MAIN' limit 1;

  -- Purana test samaan pehle saaf, taake dobara chalane par ginti dugni
  -- na ho jaye.
  delete from stock_batches where product_id in (select id from products where name like 'ZZTEST %');
  delete from stock_movements where inventory_id in (
    select i.id from inventory i join products p on p.id = i.product_id where p.name like 'ZZTEST %'
  );
  delete from inventory where product_id in (select id from products where name like 'ZZTEST %');
  delete from pos_sale_items where product_id in (select id from products where name like 'ZZTEST %');
  delete from products where name like 'ZZTEST %';

  for r in
    select * from (values
      ('ZZTEST Urea 50kg',        4000, 4600, 'bag'),
      ('ZZTEST DAP 50kg',        11000, 12500, 'bag'),
      ('ZZTEST Sona Urea 50kg',   3800, 4400, 'bag'),
      ('ZZTEST Weedicide 1L',      900, 1200, 'bottle'),
      ('ZZTEST Wheat Seed 40kg',  3200, 3800, 'bag'),
      ('ZZTEST Spray Pump',       6500, 8000, 'piece')
    ) as v(name, cost, price, unit)
  loop
    insert into products (name, purchase_price, selling_price, unit, organization_id, branch_id, is_available, is_verified)
    values (r.name, r.cost, r.price, r.unit, v_org, v_branch, true, true)
    returning id into v_product;

    -- Godam ka stock. Sau adad, har cheez ki -- ek gol adad is liye ke
    -- jaanch ka jawab zehen mein bhi nikala ja sake.
    insert into inventory (product_id, warehouse_id, quantity_on_hand)
    values (v_product, v_warehouse, 100);

    -- Batch alag se: POS ki LAGAT isi se nikalti hai, inventory se nahi.
    -- Batch na ho to lagat product ki purchase_price se li jati hai --
    -- jawab wohi aata hai, magar phir ye jaanch nahi hoti ke batch wala
    -- raasta chal bhi raha hai ya nahi.
    insert into stock_batches (product_id, warehouse_id, batch_number, initial_quantity, remaining_quantity, unit_cost)
    values (v_product, v_warehouse, 'ZZTEST-B1', 100, 100, r.cost);
  end loop;

  -- Khata ki jaanch ke liye ek gahak.
  if not exists (select 1 from customers where name = 'ZZTEST Gahak') then
    insert into customers (name, phone_number, branch_id, organization_id, credit_limit)
    values ('ZZTEST Gahak', '03009990001', v_branch, v_org, 500000);
  end if;

  raise notice 'Test stock ban gaya. Shakh: %, Godam: %', v_branch, v_warehouse;
end $$;

select p.name, i.quantity_on_hand as stock, p.purchase_price as lagat, p.selling_price as bikri,
       b.remaining_quantity as batch_stock, b.unit_cost as batch_lagat
from products p
join inventory i on i.product_id = p.id
left join stock_batches b on b.product_id = p.id
where p.name like 'ZZTEST %'
order by p.name;
