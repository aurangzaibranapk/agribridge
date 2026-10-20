-- 674: Stock loss verifier sirf us shop ka. Release sirf service_role.
-- Journal fail par movement + batch wapas (fn_undo_reference_stock).

create or replace function public.fn_decide_stock_loss(
  p_loss uuid,
  p_decision text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.stock_loss_records;
  v_shop uuid;
begin
  if not public.fn_is_any_staff() then
    raise exception 'Ijazat nahi.';
  end if;
  if p_decision not in ('approve', 'reject', 'reduced_rate') then
    raise exception 'Sahi decision select karein.';
  end if;
  select * into r from public.stock_loss_records where id = p_loss for update;
  if not found then
    raise exception 'Loss record nahi mila.';
  end if;
  select w.shop_id into v_shop from public.warehouses w where w.id = r.warehouse_id;
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and coalesce(p.is_active, true)
       and p.role::text in ('owner', 'super_admin', 'admin')
  ) and not exists (
    select 1 from public.loss_verifiers v
     where v.profile_id = auth.uid()
       and (v.shop_id is null or v.shop_id = v_shop)
  ) then
    raise exception 'Aapko is shop ke nuqsan ko manzoor karne ki ijazat nahi.';
  end if;
  if r.reported_by = auth.uid() then
    raise exception 'Jis ne nuqsan darj kiya wo khud manzoor nahi kar sakta.';
  end if;
  if r.status <> 'pending' then
    return 'already';
  end if;
  insert into public.stock_loss_ledger_claims (loss_id, claimed_by, decision)
  values (p_loss, auth.uid(), p_decision);
  update public.stock_loss_records
     set status = case when p_decision = 'reject' then 'rejected' else 'approved' end,
         rejection_reason = p_reason,
         approved_by = auth.uid(),
         approved_at = now()
   where id = p_loss
     and status = 'pending';
  return 'ok';
end $$;

create or replace function public.fn_release_stock_loss_claim(p_loss uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_jwt_is_service() then
    raise exception 'Ijazat nahi.';
  end if;
  if to_regclass('public.journal_entry_sources') is not null and exists (
    select 1 from public.journal_entry_sources
    where source_table = 'stock_loss_records' and source_row_id = p_loss
  ) then
    return;
  end if;
  perform set_config('agribridge.stock_loss_release', 'on', true);
  delete from public.stock_loss_ledger_claims where loss_id = p_loss;
  update public.stock_loss_records
     set status = 'pending', approved_by = null, approved_at = null, rejection_reason = null
   where id = p_loss
     and status = 'approved';
  perform set_config('agribridge.stock_loss_release', 'off', true);
end $$;

revoke all on function public.fn_release_stock_loss_claim(uuid) from public, anon, authenticated;
grant execute on function public.fn_release_stock_loss_claim(uuid) to service_role;

create or replace function public.fn_undo_reference_stock(p_reference_type text, p_reference_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.fn_jwt_is_service() then
    raise exception 'Ijazat nahi.';
  end if;
  for r in
    select batch_id, taken
      from public.stock_batch_consumptions
     where reference_type = p_reference_type
       and reference_id = p_reference_id
     for update
  loop
    update public.stock_batches
       set remaining_quantity = coalesce(remaining_quantity, 0) + r.taken
     where id = r.batch_id;
  end loop;
  delete from public.stock_batch_consumptions
   where reference_type = p_reference_type and reference_id = p_reference_id;
  delete from public.stock_movements
   where reference_type = p_reference_type and reference_id = p_reference_id;
end $$;

revoke all on function public.fn_undo_reference_stock(text, uuid) from public, anon, authenticated;
grant execute on function public.fn_undo_reference_stock(text, uuid) to service_role;
