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

`rate_per_kg` fi mand hai. Nayi bikri `kg / 40 * rate` se banegi.
Purani bikri ka `total_amount` **nahi badla** (`rate_unit = legacy_as_stored`).

Agar owner kahe ke purani bikri ka total bhi fi mand hona chahiye (abhi total = kg * rate hai, jo 40 guna ho sakta hai):

```sql
-- needs owner approval — YE PAISA BADALTA HAI
-- update public.grain_sales
--    set total_amount = round(quantity_kg / 40.0 * rate_per_kg, 2),
--        profit = round(quantity_kg / 40.0 * rate_per_kg, 2) - coalesce(total_cogs, 0) - coalesce(bardana_cost, 0) - coalesce(mazdoori_cost, 0),
--        rate_unit = 'per_maund'
--  where rate_unit = 'legacy_as_stored';
```

## 4. Anaj zyada bika — sirf diagnostic

Bikri 45,905 kg, khareed 40,530 kg. Nayi bikri rok di gayi hai. Purana farq nahi mitaya.

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
