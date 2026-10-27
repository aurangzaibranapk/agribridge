-- Rollback 718 — ginti wapas snapshot par.
-- stock_batches ko is rollback se haath nahi lagta.
--
-- Pehle 718 ki adjustment movements mitao. trg_stock_movement_sync
-- quantity_on_hand ko baaqi harkaton ke jorh par le aata hai.
-- Phir jo row ab bhi snapshot se alag ho, us par snapshot ka adad likho.
-- Guard laga rehta hai: wo likhai tabhi manzoor hai jab harkaton ka
-- jorh snapshot ke barabar ho. Baad ki harkat ho to rollback ruk jati
-- hai. Ginti adhoori nahi badalti.
--
-- Snapshot table rehti hai, taake pehli ginti ka record rahe.
-- Dobara chalane par miti hui movements phir se nahi miltin; ginti
-- pehle hi snapshot par ho to no-op.
--
-- Ek transaction mein chalao:
--   psql "$URL" -v ON_ERROR_STOP=1 -1 -f supabase/migrations/718_batch_ginti_align.rollback.sql

do $$
declare
  v_deleted integer := 0;
  v_rewritten integer := 0;
  v_dropped integer := 0;
begin
  if to_regclass('public.backup_718_inventory_ginti') is null then
    raise exception '718 rollback: public.backup_718_inventory_ginti maujood nahi.';
  end if;

  delete from public.stock_movements sm
   using public.backup_718_inventory_ginti b
   where sm.id = any (b.movement_ids);

  get diagnostics v_deleted = row_count;

  -- Baad ki harkat ho to snapshot se overwrite guard bhi rokega.
  -- Pehle saaf error, taake adhoori ginti na likhi jaye.
  if exists (
    select 1
      from public.backup_718_inventory_ginti b
      join public.inventory i on i.id = b.inventory_id
     where not b.created_row
       and public.fn_inventory_true_quantity(i.id) is distinct from b.quantity_on_hand
  ) then
    raise exception
      '718 rollback: kuch ginti snapshot se alag hai. Is migration ke baad usi row par aur harkat aa chuki hai — overwrite commit nahi hoga.';
  end if;

  update public.inventory i
     set quantity_on_hand = b.quantity_on_hand,
         updated_at = now()
    from public.backup_718_inventory_ginti b
   where i.id = b.inventory_id
     and not b.created_row
     and i.quantity_on_hand is distinct from b.quantity_on_hand;

  get diagnostics v_rewritten = row_count;

  if exists (
    select 1
      from public.backup_718_inventory_ginti b
      join public.inventory i on i.id = b.inventory_id
     where not b.created_row
       and i.quantity_on_hand is distinct from b.quantity_on_hand
  ) then
    raise exception
      '718 rollback: snapshot likhne ke baad bhi ginti wapas nahi aayi.';
  end if;

  delete from public.inventory i
   using public.backup_718_inventory_ginti b
   where i.id = b.inventory_id
     and b.created_row
     and i.quantity_on_hand = 0
     and public.fn_inventory_true_quantity(i.id) = 0
     and not exists (
       select 1 from public.stock_movements sm where sm.inventory_id = i.id
     )
     and not exists (
       select 1 from public.stock_count_lines scl where scl.inventory_id = i.id
     );

  get diagnostics v_dropped = row_count;

  raise notice
    '718 rollback: movements miti %, snapshot se ginti likhi %, nayi khali rows hatin %',
    v_deleted, v_rewritten, v_dropped;
end $$;
