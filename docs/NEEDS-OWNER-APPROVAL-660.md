# needs owner approval

Ye SQL **nahi chali**. Na testing (`hwaiuwxqldxsoukkfefn`) par, na live par.
Sirf owner ke kehne par, backup ke baad.

## 1. Website settings — teen hawalay wala JSON

Phone migration 660 ne `contact_phone` ko `+923126513294` kar diya hai (jab apply ho).
Baqi keys (`site_name`, seo, map) abhi bhi triple-quoted ho sakti hain. Code ab parhte waqt khol deta hai.
Neeche wali SQL **data badalti hai**. needs owner approval.

```sql
-- needs owner approval
-- Bar bar tab tak kholo jab tak string ke gird extra quotes na rahein.
-- contact_phone ko dobara mat chhero agar wo pehle se +923126513294 hai.
update public.website_settings s
   set value = to_jsonb(public.unwrap_setting_text(s.value)),
       updated_at = now()
 where s.key <> 'contact_phone'
   and jsonb_typeof(s.value) = 'string'
   and (s.value #>> '{}') like '"%';
```

`unwrap_setting_text` abhi database mein nahi hai. Jab owner kahe, pehle ye function banao, phir upar wali update. Function bina update ke be-nuqsan hai, lekin update data hai — is liye dono yahin hain.

```sql
-- needs owner approval
create or replace function public.unwrap_setting_text(p jsonb)
returns text language plpgsql immutable as $$
declare t text := p #>> '{}'; i int := 0;
begin
  while i < 8 and t is not null and left(t, 1) = '"' and right(t, 1) = '"' loop
    begin
      t := t::jsonb #>> '{}';
    exception when others then
      t := trim(both '"' from t);
      exit;
    end;
    i := i + 1;
  end loop;
  return t;
end $$;
```

## 2. Pata khali / "Pakistan"

Website `contact_address` aur shops 01–05 ka `address` khali hai.
**Yahan koi pata nahi likha gaya.** Admin settings par nishan hai: placeholder.
Jab owner asal pata de (Chak Mahabali, Dakkhana Shah Nikdar, waghera), tab:

```sql
-- needs owner approval — pata owner ke alfaaz se bharein, ye namoona hai
-- update public.website_settings
--    set value = to_jsonb('OWNER KA ASAL PATA'::text), updated_at = now()
--  where key = 'contact_address';
-- update public.shops set address = 'OWNER KA ASAL PATA' where code in ('01','02','03','04','05');
```

## 3. Grain rate — paisa mat badlo jab tak owner na kahe

`rate_per_kg` nayi bikri par fi mand hai. Nayi bikri `kg / 40 * rate` se banegi.
Purani 4 bikri ka `total_amount` **nahi badla**. Un ka label `per_kg` hai (665 / 675). Paisa jyon ka tyon.

Agar owner kahe ke purani bikri ka total bhi fi mand hona chahiye (abhi total = kg * rate hai):

```sql
-- needs owner approval — YE PAISA BADALTA HAI
-- update public.grain_sales
--    set total_amount = round(quantity_kg / 40.0 * rate_per_kg, 2),
--        profit = round(quantity_kg / 40.0 * rate_per_kg, 2) - coalesce(total_cogs, 0) - coalesce(bardana_cost, 0) - coalesce(mazdoori_cost, 0),
--        rate_unit = 'per_maund'
--  where rate_unit = 'per_kg';
```

## 4. Anaj zyada bika — sirf diagnostic

Bikri 45,905 kg, khareed 40,530 kg. 664 ki sold>bought rok galat thi (adjustments, transfer, wapsi shamil nahi). 675 us ki jagah godam ki locked `quantity_on_hand` dekhti hai. Purana farq yahan se nahi mitaya. Phantom opening (neeche §10) merge se pehle owner ke baghair mat chhoro — warna nayi rok khayali stock par bikri khol degi.

```sql
-- needs owner approval — sirf dekho, update mat karo
select grain_type,
       (select coalesce(sum(coalesce(stock_weight_kg, weight_kg)), 0)
          from public.grain_procurement_entries e
         where e.grain_type = g.grain_type and e.reclassified_as_sale_id is null) as bought_kg,
       (select coalesce(sum(quantity_kg), 0)
          from public.grain_sales s
         where s.grain_type = g.grain_type) as sold_kg
  from (select distinct grain_type from public.grain_sales) g;
```

## 5. 42 batches jahan remaining > initial

Migration 663 un qatarein ko **nahi** likhti. Check `NOT VALID` hai.
Jab tak ye theek na hon, un batches par aisi UPDATE jo remaining ko initial ke andar na laye, rukegi.
Bechne wala naya code inhein chhor kar doosri sehat-mand batch leta hai.

Do raaste — owner ek chune. Dono data badalte hain.

```sql
-- needs owner approval — pehle dekho
select id, batch_number, product_id, warehouse_id, initial_quantity, remaining_quantity,
       remaining_quantity - initial_quantity as over_kg
  from public.stock_batches
 where remaining_quantity > initial_quantity;

-- Raasta A: extra ko ghalat mano, remaining ko initial tak girao (stock kam dikhega)
-- update public.stock_batches
--    set remaining_quantity = initial_quantity
--  where remaining_quantity > initial_quantity;

-- Raasta B: extra ko asal mandi/maal mano, initial ko remaining tak barhao (stock waisa rahe)
-- update public.stock_batches
--    set initial_quantity = remaining_quantity
--  where remaining_quantity > initial_quantity;

-- Us ke baad, jab koi qatarein na bachein:
-- alter table public.stock_batches validate constraint stock_batches_remaining_within_initial;
-- alter table public.stock_batches validate constraint stock_batches_remaining_nonnegative;
```

## 6. Duplicate products — sirf tajweez

8 duplicate products ka merge **nahi** kiya. Pehle ye fehrist dekho.

```sql
-- needs owner approval — sirf dekho
select lower(regexp_replace(name, '\s+', ' ', 'g')) as naam,
       count(*) as kitne,
       array_agg(id order by created_at) as ids,
       array_agg(name order by created_at) as names
  from public.products
 where coalesce(is_deleted, false) = false
 group by 1
having count(*) > 1
 order by count(*) desc;
```

Merge tab, jab owner har jori ka **rakha hua id** likh de. Namuna (mat chalao):

```sql
-- needs owner approval
-- Purani id ki sales/stock nayi id par tabdeel, phir purani ko is_deleted.
-- Har product ka FK alag hai — andha update mat chalao.
-- update public.products set is_deleted = true where id = 'PURANI_ID' and id <> 'RAKHI_HUI_ID';
```

## 7. Batches inventory se 28,912 zyada — sirf diagnostic

```sql
-- needs owner approval — sirf dekho, stock mat likho
with inv as (
  select product_id, warehouse_id, sum(quantity_on_hand) as on_hand
    from public.inventory
   group by 1, 2
), bat as (
  select product_id, warehouse_id, sum(coalesce(remaining_quantity, 0)) as in_batches
    from public.stock_batches
   group by 1, 2
)
select coalesce(i.product_id, b.product_id) as product_id,
       coalesce(i.warehouse_id, b.warehouse_id) as warehouse_id,
       coalesce(i.on_hand, 0) as inventory_qty,
       coalesce(b.in_batches, 0) as batch_qty,
       coalesce(b.in_batches, 0) - coalesce(i.on_hand, 0) as batches_minus_inventory
  from inv i
  full join bat b using (product_id, warehouse_id)
 where coalesce(b.in_batches, 0) <> coalesce(i.on_hand, 0)
 order by abs(coalesce(b.in_batches, 0) - coalesce(i.on_hand, 0)) desc;

select coalesce(sum(remaining_quantity), 0) - coalesce((select sum(quantity_on_hand) from public.inventory), 0) as total_gap
  from public.stock_batches;
```

## 8. Batch shortfall — sirf diagnostic

16 product/godam joron par on-hand batch se aage hai (andaza 213 units, 11 par bechne layak batch nahi). Code shortfall likh kar bikri nahi rokta. 42 bigri hui batches (remaining > initial) yahan rewrite nahi hotin.

```sql
-- needs owner approval — sirf dekho, update mat karo
with sellable as (
  select product_id, warehouse_id,
         sum(remaining_quantity) filter (
           where remaining_quantity <= coalesce(initial_quantity, remaining_quantity)
             and (expiry_date is null or expiry_date >= (timezone('Asia/Karachi', now()))::date)
         ) as sellable_qty
    from public.stock_batches
   where coalesce(remaining_quantity, 0) > 0
   group by 1, 2
), inv as (
  select product_id, warehouse_id, sum(quantity_on_hand) as on_hand
    from public.inventory
   group by 1, 2
)
select i.product_id, i.warehouse_id, i.on_hand, coalesce(s.sellable_qty, 0) as sellable_qty,
       i.on_hand - coalesce(s.sellable_qty, 0) as short_qty
  from inv i
  left join sellable s using (product_id, warehouse_id)
 where i.on_hand > coalesce(s.sellable_qty, 0)
 order by short_qty desc;
```

## 9. Expire batch ka write-off — tajweez, mat chalao

Expire batch bikri se nahi nikalti. Malik ke kehne par alag write-off (expired_out) ho, yahan nahi.

```sql
-- needs owner approval — mat chalao
-- select id, batch_number, product_id, warehouse_id, remaining_quantity, expiry_date
--   from public.stock_batches
--  where coalesce(remaining_quantity, 0) > 0
--    and expiry_date is not null
--    and expiry_date < (timezone('Asia/Karachi', now()))::date;
-- Phir har tasdeeq-shuda batch par expired_out movement + fn_consume (allow expired),
-- owner ki alag approval ke baad. Yahan koi update nahi.
```

## 10. Phantom 24,500 kg wheat + OPENING-OWN-20261016

**Merge se pehle owner ye chalaye.** Is PR ne ye SQL nahi chalayi. Nayi on-hand rok is khayali stock par gandum ki bikri khol degi agar ye batch godam ki ginti mein hai.

```sql
-- needs owner approval — MERGE SE PEHLE sirf dekho
select id, batch_number, product_id, warehouse_id, initial_quantity, remaining_quantity, created_at
  from public.stock_batches
 where batch_number = 'OPENING-OWN-20261016'
    or batch_number ilike 'OPENING-OWN%'
    or initial_quantity = 24500
    or remaining_quantity = 24500;

select p.name, i.warehouse_id, i.quantity_on_hand
  from public.inventory i
  join public.products p on p.id = i.product_id
 where i.quantity_on_hand >= 24500
    or p.name ilike '%wheat%' or p.name ilike '%gandum%';
```

Jab owner tasdeeq kare ke ye batch asal maal nahi, tab — backup ke baad — movement se ginti ghatani hai (seedha quantity_on_hand mat likho; trigger 129 ginti movement se banata hai):

```sql
-- needs owner approval — MERGE SE PEHLE, backup ke baad, owner ke id se
-- Pehle upar wali SELECT se id tasdeeq karo. Andha update mat chalao.
-- update public.stock_batches
--    set remaining_quantity = 0
--  where batch_number = 'OPENING-OWN-20261016'
--    and remaining_quantity = 24500;
-- insert into public.stock_movements (inventory_id, movement_type, quantity, reference_type, notes)
-- select i.id, 'adjustment_decrease', 24500, 'opening_own_fix',
--        'Owner approval: phantom OPENING-OWN-20261016 24500 kg'
--   from public.inventory i
--   join public.stock_batches b on b.product_id = i.product_id and b.warehouse_id = i.warehouse_id
--  where b.batch_number = 'OPENING-OWN-20261016'
--    and i.quantity_on_hand >= 24500;
```

## 11. Dispatch duplicate order — agar unique index na bani

672 unique index tab nahi banati jab ek order par do dispatch pehle se hon. Sirf dekho.

```sql
-- needs owner approval — sirf dekho
select order_id, count(*) as kitne, array_agg(id) as ids, array_agg(dispatch_number) as numbers
  from public.agri_dispatches
 where order_id is not null
 group by order_id
having count(*) > 1;
```
