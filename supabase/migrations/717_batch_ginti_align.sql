-- =====================================================================
-- AgriBridge — Migration 717: Ginti = batch remaining (product + godam)
-- =====================================================================
-- Malik ka faisla (27 October 2026): batch sach hai.
-- fn_data_health_scan section 3b yahi jorh dekhti hai:
--   sum(inventory.quantity_on_hand) <> sum(stock_batches.remaining_quantity)
--   join: product_id, aur warehouse_id IS NOT DISTINCT FROM
-- Un joron par ginti ko batch remaining ke jorh ke barabar karo.
-- stock_batches ki remaining_quantity NAHI kat-ti, NAHI badalti.
-- Ledger (ticket #12, godam value ~Rs 161k) is migration ka hissa nahi.
--
-- quantity_on_hand seedha UPDATE nahi ho sakta. trg_guard_inventory_quantity
-- rokta hai, aur agla stock movement fn_sync_inventory_quantity se ginti
-- ko harkaton ke jorh par wapas le aata. Farq is liye stock_movements
-- mein adjustment_increase / adjustment_decrease se likha jata hai.
-- reference_type = 'migration_717'. AFTER trigger khud ginti likh deta hai.
--
-- Ginti numeric(14,3) hai. remaining_quantity bina scale ke numeric hai.
-- Jo farq is scale par sifar ho (maslan ginti 0 aur batch 0.000232) us
-- par koi movement nahi — column itna barik adad rakh hi nahi sakta.
-- 3b ki raw <> us ek jore par reh sakti hai. Baqi joron par raw <> bhi
-- khatam ho jati hai, kyunke un ka batch jorh pehle se numeric(14,3) hai.
--
-- Idempotent: scale par jorh pehle se barabar ho to koi movement nahi.
-- Dobara chalao to matched pairs par no-op. Snapshot pehli dafa ka
-- rehta hai (ON CONFLICT DO NOTHING).
--
-- Rollback: 717_batch_ginti_align.rollback.sql
-- Snapshot: public.backup_717_inventory_ginti
-- Live par mat chalayein jab tak backup verify na ho. Pehle Testing.

create table if not exists public.backup_717_inventory_ginti (
  inventory_id uuid primary key,
  product_id uuid not null,
  warehouse_id uuid not null,
  batch_id uuid,
  quantity_on_hand numeric(14,3) not null,
  movement_ids uuid[] not null default '{}',
  created_row boolean not null default false,
  snapped_at timestamptz not null default now()
);

comment on table public.backup_717_inventory_ginti is
  '717 se pehle inventory.quantity_on_hand. Rollback isi se ginti wapas lata hai. stock_batches is table mein nahi — unhein chhua hi nahi.';

comment on column public.backup_717_inventory_ginti.quantity_on_hand is
  'Pehli snapshot. Dobara migration chalane par ye adad overwrite nahi hota.';

comment on column public.backup_717_inventory_ginti.movement_ids is
  'Is row par 717 ne jo adjustment movements likhi hain. Rollback unhein mitata hai.';

alter table public.backup_717_inventory_ginti enable row level security;

revoke all on table public.backup_717_inventory_ginti from public, anon, authenticated;
grant select, insert, update, delete on table public.backup_717_inventory_ginti to service_role;

do $$
declare
  v_pair record;
  v_row record;
  v_target numeric(14,3);
  v_current numeric(14,3);
  v_rem numeric;
  v_delta numeric(14,3);
  v_left numeric(14,3);
  v_take numeric(14,3);
  v_anchor uuid;
  v_movement uuid;
  v_rem_before numeric;
  v_rem_after numeric;
  v_pairs integer := 0;
  v_movements integer := 0;
  v_raised numeric(14,3) := 0;
  v_lowered numeric(14,3) := 0;
  v_raw_left integer := 0;
begin
  drop table if exists _717_pair;
  create temp table _717_pair (
    product_id uuid not null,
    warehouse_id uuid
  ) on commit drop;

  insert into _717_pair (product_id, warehouse_id)
  select coalesce(i.product_id, b.product_id),
         coalesce(i.warehouse_id, b.warehouse_id)
    from (
      select product_id, warehouse_id, sum(quantity_on_hand) as oh
        from public.inventory
       group by 1, 2
    ) i
    full join (
      select product_id, warehouse_id, sum(remaining_quantity) as rem
        from public.stock_batches
       group by 1, 2
    ) b
      on b.product_id = i.product_id
     and b.warehouse_id is not distinct from i.warehouse_id
   where coalesce(i.oh, 0)::numeric(14,3) <> coalesce(b.rem, 0)::numeric(14,3);

  -- Lock order: inventory id, phir batch id. Deadlock se bachne ke liye.
  perform i.id
    from public.inventory i
    join _717_pair p
      on p.product_id = i.product_id
     and p.warehouse_id is not distinct from i.warehouse_id
   order by i.id
     for update of i;

  perform sb.id
    from public.stock_batches sb
    join _717_pair p
      on p.product_id = sb.product_id
     and p.warehouse_id is not distinct from sb.warehouse_id
   order by sb.id
     for update of sb;

  select coalesce(sum(sb.remaining_quantity), 0)
    into v_rem_before
    from public.stock_batches sb
    join _717_pair p
      on p.product_id = sb.product_id
     and p.warehouse_id is not distinct from sb.warehouse_id;

  for v_pair in
    select product_id, warehouse_id
      from _717_pair
     order by product_id, warehouse_id nulls first
  loop
    select coalesce(sum(quantity_on_hand), 0)
      into v_current
      from public.inventory
     where product_id = v_pair.product_id
       and warehouse_id is not distinct from v_pair.warehouse_id;

    select coalesce(sum(remaining_quantity), 0)
      into v_rem
      from public.stock_batches
     where product_id = v_pair.product_id
       and warehouse_id is not distinct from v_pair.warehouse_id;

    v_target := v_rem::numeric(14,3);
    v_current := v_current::numeric(14,3);
    v_delta := v_target - v_current;

    if v_delta = 0 then
      continue;
    end if;

    if v_target < 0 then
      raise exception
        '717: batch remaining manfi hai, ginti nahi likhi. product %, warehouse %, remaining %',
        v_pair.product_id, v_pair.warehouse_id, v_rem;
    end if;

    insert into public.backup_717_inventory_ginti (
      inventory_id, product_id, warehouse_id, batch_id, quantity_on_hand
    )
    select id, product_id, warehouse_id, batch_id, quantity_on_hand
      from public.inventory
     where product_id = v_pair.product_id
       and warehouse_id is not distinct from v_pair.warehouse_id
    on conflict (inventory_id) do nothing;

    if not exists (
      select 1
        from public.inventory
       where product_id = v_pair.product_id
         and warehouse_id is not distinct from v_pair.warehouse_id
    ) then
      if v_pair.warehouse_id is null then
        raise exception
          '717: batch ka godam khali hai aur inventory row nahi. product %',
          v_pair.product_id;
      end if;

      insert into public.inventory (product_id, warehouse_id)
      values (v_pair.product_id, v_pair.warehouse_id)
      returning id into v_anchor;

      insert into public.backup_717_inventory_ginti (
        inventory_id, product_id, warehouse_id, batch_id, quantity_on_hand, created_row
      )
      values (v_anchor, v_pair.product_id, v_pair.warehouse_id, null, 0, true);
    end if;

    if v_delta > 0 then
      select id
        into v_anchor
        from public.inventory
       where product_id = v_pair.product_id
         and warehouse_id is not distinct from v_pair.warehouse_id
       order by (batch_id is null) desc, quantity_on_hand desc, id
       limit 1;

      if v_anchor is null then
        raise exception
          '717: inventory row nahi mili. product %, warehouse %',
          v_pair.product_id, v_pair.warehouse_id;
      end if;

      insert into public.stock_movements (
        inventory_id, movement_type, quantity, reference_type, notes
      )
      values (
        v_anchor,
        'adjustment_increase',
        v_delta,
        'migration_717',
        '717: ginti ko stock_batches.remaining ke jorh ke barabar kiya. Batch nahi kata.'
      )
      returning id into v_movement;

      update public.backup_717_inventory_ginti
         set movement_ids = movement_ids || v_movement
       where inventory_id = v_anchor;

      if not found then
        raise exception '717: snapshot row nahi mili, inventory %', v_anchor;
      end if;

      v_movements := v_movements + 1;
      v_raised := v_raised + v_delta;
    else
      v_left := -v_delta;

      for v_row in
        select id, quantity_on_hand
          from public.inventory
         where product_id = v_pair.product_id
           and warehouse_id is not distinct from v_pair.warehouse_id
         order by quantity_on_hand desc, id
      loop
        exit when v_left = 0;
        v_take := least(v_left, v_row.quantity_on_hand);
        if v_take <= 0 then
          continue;
        end if;

        insert into public.stock_movements (
          inventory_id, movement_type, quantity, reference_type, notes
        )
        values (
          v_row.id,
          'adjustment_decrease',
          v_take,
          'migration_717',
          '717: ginti ko stock_batches.remaining ke jorh ke barabar kiya. Batch nahi kata.'
        )
        returning id into v_movement;

        update public.backup_717_inventory_ginti
           set movement_ids = movement_ids || v_movement
         where inventory_id = v_row.id;

        if not found then
          raise exception '717: snapshot row nahi mili, inventory %', v_row.id;
        end if;

        v_left := v_left - v_take;
        v_movements := v_movements + 1;
        v_lowered := v_lowered + v_take;
      end loop;

      if v_left <> 0 then
        raise exception
          '717: ginti batch se zyada hai magar rows par itni ginti nahi. product %, warehouse %, baqi %',
          v_pair.product_id, v_pair.warehouse_id, v_left;
      end if;
    end if;

    v_pairs := v_pairs + 1;
  end loop;

  select coalesce(sum(sb.remaining_quantity), 0)
    into v_rem_after
    from public.stock_batches sb
    join _717_pair p
      on p.product_id = sb.product_id
     and p.warehouse_id is not distinct from sb.warehouse_id;

  if v_rem_after is distinct from v_rem_before then
    raise exception
      '717: stock_batches.remaining badal gayi (% -> %). Ye migration batch nahi cherti.',
      v_rem_before, v_rem_after;
  end if;

  if exists (
    select 1
      from (
        select product_id, warehouse_id, sum(quantity_on_hand) as oh
          from public.inventory
         group by 1, 2
      ) i
      full join (
        select product_id, warehouse_id, sum(remaining_quantity) as rem
          from public.stock_batches
         group by 1, 2
      ) b
        on b.product_id = i.product_id
       and b.warehouse_id is not distinct from i.warehouse_id
     where coalesce(i.oh, 0)::numeric(14,3) <> coalesce(b.rem, 0)::numeric(14,3)
  ) then
    raise exception '717: alignment ke baad bhi numeric(14,3) par 3b farq bacha.';
  end if;

  select count(*)
    into v_raw_left
    from (
      select 1
        from (
          select product_id, warehouse_id, sum(quantity_on_hand) as oh
            from public.inventory
           group by 1, 2
        ) i
        full join (
          select product_id, warehouse_id, sum(remaining_quantity) as rem
            from public.stock_batches
           group by 1, 2
        ) b
          on b.product_id = i.product_id
         and b.warehouse_id is not distinct from i.warehouse_id
       where coalesce(i.oh, 0) <> coalesce(b.rem, 0)
    ) leftover;

  raise notice
    '717: pairs %, movements %, ginti barhi %, ginti ghati %, raw 3b baqi % (sirf woh jo numeric(14,3) mein sama nahi aate)',
    v_pairs, v_movements, v_raised, v_lowered, v_raw_left;
end $$;
