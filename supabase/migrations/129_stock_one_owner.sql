-- =====================================================================
-- AgriBridge — Migration 129: Godam ka stock bhi ek hi malik ka
-- =====================================================================
-- 127 ne cash book ka balance ek malik ke neeche kiya, 128 ne POS ka
-- paisa. POS ki jaanch chalate waqt WOHI bimari stock mein bhi nikli --
-- aur ye us se baRi hai, kyunke maal ki ginti hi kharidari, bikri aur
-- nafe ki buniyad hai.
--
--     paanch bore bike       ->  das kam ho gaye
--
-- inventory.quantity_on_hand ke CHAR malik the:
--
--   1. fn_apply_stock_movement   -- sahi wala (stock_movements ka trigger)
--   2. create_pos_sale           -- khud bhi ghatata tha
--   3. fn_apply_stock_transfer   -- khud bhi hilata tha, dono taraf
--   4. aath TypeScript files     -- in mein src/lib/stock-movement.ts bhi,
--                                   wohi jo "ek markazi jagah" bana kar
--                                   rakhi gayi thi
--
-- Har jagah ka tareeqa ek hi tha: pehle apne haath se ginti badlo, phir
-- stock_movements mein qatar daalo -- aur us qatar par trigger dobara
-- badal deta.
--
-- ---------------------------------------------------------------------
-- Naya qanoon, ek hi jumle mein
-- ---------------------------------------------------------------------
--   quantity_on_hand = us godam ki apni harkaton ka jorh
--
-- Bas. Koi "khulne ki ginti" wala khana nahi rakha gaya (jaisa paise mein
-- opening_balance hai): maal aata bhi harkat se hai. Nayi qatar hamesha
-- SIFAR se shuru hoti hai, aur us mein maal purchase_in / transfer_in /
-- adjustment_increase se aata hai. Is tarah har bori ka koi na koi
-- kaghaz hota hai -- aur "ye sau bore yahan aaye kahan se" ka jawab
-- hamesha maujood rehta hai.
--
-- ---------------------------------------------------------------------
-- Trigger do hisson mein kyun
-- ---------------------------------------------------------------------
-- Purana trigger BEFORE INSERT tha aur wahin inventory badal deta tha.
-- Naye pehre ke sath wo chal hi nahi sakta: BEFORE ke waqt qatar abhi
-- daali nahi gayi hoti, is liye "harkaton ka jorh" us qatar ko ginta hi
-- nahi aur pehra apne hi trigger ko rok deta.
--
-- Is liye kaam bat gaya:
--   BEFORE  -- sirf balance_after likhta hai (qatar par nishani)
--   AFTER   -- inventory ko harkaton ke jorh ke barabar kar deta hai
--
-- AFTER wala jorh har baar naye sire se ginta hai, farq jorh kar nahi.
-- ThoRa sust hai, magar us ka faida ye ke wo kabhi bhatak nahi sakta --
-- aur mitane aur badalne par bhi khud theek rehta hai.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Ek lafz jo maujood hi nahi tha
-- ---------------------------------------------------------------------
-- Teen jagah stock ki harkat ke naam aise likhe the jo enum mein hain hi
-- nahi: "grain_procurement_in", "grain_sale_out", aur "loss_write_off".
-- Un teenon ki qatar HAMESHA nakaam hoti thi -- aur teenon jagah error
-- kabhi parha hi nahi jata tha. Yani anaj ka aana, anaj ka jaana, aur
-- nuqsan ka likha jana -- teenon kaghaz par kahin darj nahi hote the.
-- Ginti sirf hath ki likhai se badalti thi.
--
-- Pehle do ke liye pehle se maujood lafz theek hain (purchase_in aur
-- sale_out). Teesre ke liye naya lafz banaya ja raha hai: chori aur
-- shrinkage ko "damaged_out" keh dena record ko jhoota bana deta.
alter type stock_movement_type add value if not exists 'loss_write_off';

-- ---------------------------------------------------------------------
-- 1) Asal hisaab -- ek jagah likha hua
-- ---------------------------------------------------------------------
create or replace function fn_inventory_true_quantity(p_inventory_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(
    case when movement_type in ('purchase_in', 'transfer_in', 'adjustment_increase', 'return_in')
      then quantity else -quantity end
  ), 0)::numeric(14,3)
  from stock_movements
  where inventory_id = p_inventory_id;
$$;

-- ---------------------------------------------------------------------
-- 2) Purana trigger pehle hatana
-- ---------------------------------------------------------------------
-- Tarteeb yahan ahem hai. Neeche wali marammat stock_movements mein
-- qatarein daalti hai. Agar purana trigger us waqt laga hua ho to wo har
-- qatar par inventory bhi barha dega -- yani theek karne ki koshish mein
-- ginti wahin dugni ho jayegi. Is liye pehle hata dete hain; is darmiyan
-- inventory ko koi haath nahi lagata.
drop trigger if exists trg_stock_movement_apply on stock_movements;

-- ---------------------------------------------------------------------
-- 3) Purani qataron ko qanoon par lana
-- ---------------------------------------------------------------------
-- Jahan ginti harkaton se nahi milti, wahan farq MITAYA nahi jata --
-- us ka apna kaghaz banaya jata hai (adjustment ki harkat). Chup chaap
-- adad badal dena wohi kaam hota jis se bachne ke liye ye sab kiya ja
-- raha hai.
--
-- Ye un qataron par bhi lagta hai jo seedha ginti ke sath banai gayi
-- thin (jaise test ka stock): unhein ab apni pehli harkat mil jati hai.
do $$
declare
  r record;
  v_true numeric;
  v_diff numeric;
begin
  for r in select id, quantity_on_hand from inventory loop
    v_true := fn_inventory_true_quantity(r.id);
    v_diff := round(r.quantity_on_hand, 3) - v_true;

    if v_diff <> 0 then
      insert into stock_movements (inventory_id, movement_type, quantity, balance_after, reference_type, notes)
      values (
        r.id,
        case when v_diff > 0 then 'adjustment_increase' else 'adjustment_decrease' end::stock_movement_type,
        abs(v_diff),
        r.quantity_on_hand,
        'migration_129',
        'Migration 129: pehle se maujood ginti ka kaghaz -- is se pehle koi harkat darj nahi thi.'
      );
    end if;
  end loop;
end $$;

-- balance_after ab bulane wale ko nahi bharna paRta -- trigger us ko
-- likhta hai. Us se bheja gaya adad waise bhi purana ho chuka hota hai
-- jab do kaam ek sath ho rahe hon.
alter table stock_movements alter column balance_after drop not null;

-- ---------------------------------------------------------------------
-- 4) Trigger: nishani pehle, ginti baad mein
-- ---------------------------------------------------------------------
create or replace function fn_apply_stock_movement() returns trigger as $$
declare
  v_delta numeric(14,3);
begin
  v_delta := case
    when new.movement_type in ('purchase_in', 'transfer_in', 'adjustment_increase', 'return_in')
      then new.quantity else -new.quantity
  end;

  -- Sirf nishani. Ginti yahan NAHI badalti -- wo AFTER wala kaam hai.
  new.balance_after := fn_inventory_true_quantity(new.inventory_id) + v_delta;
  return new;
end;
$$ language plpgsql;

create or replace function fn_sync_inventory_quantity() returns trigger as $$
declare
  v_inventory uuid;
begin
  if tg_op = 'DELETE' then v_inventory := old.inventory_id; else v_inventory := new.inventory_id; end if;

  update inventory
     set quantity_on_hand = fn_inventory_true_quantity(v_inventory),
         updated_at = now()
   where id = v_inventory;

  -- Qatar doosri inventory par le jayi gayi ho to purani wali bhi theek
  -- karni paRti hai.
  if tg_op = 'UPDATE' and old.inventory_id is distinct from new.inventory_id then
    update inventory
       set quantity_on_hand = fn_inventory_true_quantity(old.inventory_id),
           updated_at = now()
     where id = old.inventory_id;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_stock_movement_apply on stock_movements;
create trigger trg_stock_movement_apply
  before insert on stock_movements
  for each row execute function fn_apply_stock_movement();

drop trigger if exists trg_stock_movement_sync on stock_movements;
create trigger trg_stock_movement_sync
  after insert or update or delete on stock_movements
  for each row execute function fn_sync_inventory_quantity();

-- ---------------------------------------------------------------------
-- 5) Rok
-- ---------------------------------------------------------------------
-- Paise wali rok ki tarah, ye bhi "kaun likh raha hai" par nahi, "KYA
-- likh raha hai" par hai: ginti sirf wohi ho sakti hai jo harkaton se
-- nikalti hai. Is liye ye us SQL par bhi chalti hai jo koi console se
-- maare.
create or replace function fn_guard_inventory_quantity() returns trigger as $$
declare
  v_true numeric(14,3);
begin
  if new.quantity_on_hand is distinct from old.quantity_on_hand then
    v_true := fn_inventory_true_quantity(new.id);
    if round(new.quantity_on_hand, 3) <> v_true then
      raise exception
        'Godam ki ginti seedha nahi likhi ja sakti. Wo khud stock_movements se nikalti hai. Likhi ja rahi thi: %, asal hisaab: %. Maal hilana ho to stock_movements mein harkat daalein.',
        round(new.quantity_on_hand, 3), v_true;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guard_inventory_quantity on inventory;
create trigger trg_guard_inventory_quantity
  before update on inventory
  for each row execute function fn_guard_inventory_quantity();

-- Nayi qatar hamesha sifar se. Maal us mein harkat se aata hai.
-- Ye rok nahi, khud theek kar dena hai: bulane wale ko ye yaad rakhne ki
-- zaroorat nahi, aur us ki ginti chup chaap dugni bhi nahi hoti.
create or replace function fn_init_inventory_quantity() returns trigger as $$
begin
  new.quantity_on_hand := 0;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_init_inventory_quantity on inventory;
create trigger trg_init_inventory_quantity
  before insert on inventory
  for each row execute function fn_init_inventory_quantity();

-- ---------------------------------------------------------------------
-- 6) Do jagah se hath ki likhai nikalna (database ke andar)
-- ---------------------------------------------------------------------
-- Ye dono ab rok se takrayenge, is liye inhein isi migration mein theek
-- karna zaroori hai -- warna POS ki bikri aur godam ka transfer dono
-- rukk jayen.
do $$
declare
  v_src text;
  v_patched text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_pos_sale'
    and pg_get_function_identity_arguments(p.oid) like '%p_payment_lines%';

  if v_src is null then raise exception 'create_pos_sale mila hi nahi.'; end if;

  v_patched := replace(
    v_src,
    'update inventory set quantity_on_hand = quantity_on_hand - v_deducted, updated_at = now() where id = v_inv_id;',
    '-- Ginti yahan se NAHI badalti. Neeche wali harkat daalte hi trigger khud kar deta hai (129).'
  );

  if v_patched = v_src then
    raise exception 'create_pos_sale mein wo satr nahi mili -- haath se dekhein.';
  end if;

  execute v_patched;
end $$;

create or replace function fn_apply_stock_transfer() returns trigger as $$
declare
  v_source_inventory_id uuid;
  v_dest_inventory_id uuid;
  v_source_balance numeric(14,3);
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select id, quantity_on_hand into v_source_inventory_id, v_source_balance
    from inventory
    where product_id = new.product_id
      and batch_id is not distinct from new.batch_id
      and warehouse_id = new.from_warehouse_id
    for update;

  if v_source_inventory_id is null or v_source_balance < new.quantity then
    raise exception 'Insufficient stock at source warehouse for this transfer';
  end if;

  -- Pehle yahan inventory khud bhi ghatai jati thi, aur neeche wali
  -- harkat use dobara ghata deti thi -- yani transfer par maal dugna
  -- nikalta tha. Ab sirf harkat.
  insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_source_inventory_id, 'transfer_out', new.quantity, 'stock_transfer', new.id, new.requested_by);

  select id into v_dest_inventory_id from inventory
    where product_id = new.product_id
      and batch_id is not distinct from new.batch_id
      and warehouse_id = new.to_warehouse_id
    for update;

  if v_dest_inventory_id is null then
    -- Nayi qatar hamesha sifar se banti hai (129 ka trigger), maal us
    -- mein neeche wali harkat se aata hai.
    insert into inventory (product_id, batch_id, warehouse_id)
      values (new.product_id, new.batch_id, new.to_warehouse_id)
      returning id into v_dest_inventory_id;
  end if;

  insert into stock_movements (inventory_id, movement_type, quantity, reference_type, reference_id, created_by)
    values (v_dest_inventory_id, 'transfer_in', new.quantity, 'stock_transfer', new.id, new.requested_by);

  new.completed_at := now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- 7) Nigrani
-- ---------------------------------------------------------------------
create or replace view v_inventory_balance_check as
select
  i.id as inventory_id,
  p.name as product_name,
  w.name as warehouse_name,
  i.quantity_on_hand as yaad_kiya_hua,
  fn_inventory_true_quantity(i.id) as asal_hisaab,
  i.quantity_on_hand - fn_inventory_true_quantity(i.id) as farq
from inventory i
left join products p on p.id = i.product_id
left join warehouses w on w.id = i.warehouse_id
where i.quantity_on_hand <> fn_inventory_true_quantity(i.id);

comment on view v_inventory_balance_check is
  'Khali honi chahiye. Koi qatar aaye to godam ki ginti us ki apni harkaton se hat chuki hai.';
