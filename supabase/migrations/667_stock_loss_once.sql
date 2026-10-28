-- 667: Stock loss ek dafa. Banane wala khud manzoor nahi karta.
-- Claim table khali shuru hoti hai — purani qatarein nahi mit-tin.

create table if not exists public.stock_loss_ledger_claims (
  loss_id uuid primary key references public.stock_loss_records(id),
  claimed_by uuid not null,
  claimed_at timestamptz not null default now(),
  decision text not null
);

alter table public.stock_loss_ledger_claims enable row level security;
drop policy if exists stock_loss_claims_staff on public.stock_loss_ledger_claims;
create policy stock_loss_claims_staff on public.stock_loss_ledger_claims
  for select to authenticated using (public.fn_is_any_staff());

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
begin
  if not public.fn_is_any_staff() then
    raise exception 'Ijazat nahi.';
  end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.is_active and p.role::text in ('owner', 'super_admin', 'admin')
  ) and not exists (
    select 1 from public.loss_verifiers v where v.profile_id = auth.uid()
  ) then
    raise exception 'Aapko is nuqsan ko manzoor karne ki ijazat nahi.';
  end if;
  if p_decision not in ('approve', 'reject', 'reduced_rate') then
    raise exception 'Sahi decision select karein.';
  end if;
  select * into r from public.stock_loss_records where id = p_loss for update;
  if not found then
    raise exception 'Loss record nahi mila.';
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
  if not public.fn_is_any_staff() then
    raise exception 'Ijazat nahi.';
  end if;
  if exists (
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

revoke all on function public.fn_decide_stock_loss(uuid, text, text) from public, anon;
revoke all on function public.fn_release_stock_loss_claim(uuid) from public, anon;
grant execute on function public.fn_decide_stock_loss(uuid, text, text) to authenticated;
grant execute on function public.fn_release_stock_loss_claim(uuid) to authenticated;

create or replace function public.fn_guard_stock_loss_maker()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status in ('approved', 'rejected') and new.approved_by = old.reported_by then
    raise exception 'Jis ne nuqsan darj kiya wo khud manzoor nahi kar sakta.';
  end if;
  if old.status in ('approved', 'rejected')
     and new.status is distinct from old.status
     and current_setting('agribridge.stock_loss_release', true) is distinct from 'on' then
    raise exception 'Ye nuqsan pehle hi process ho chuka hai.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_stock_loss_maker on public.stock_loss_records;
create trigger trg_guard_stock_loss_maker
  before update on public.stock_loss_records
  for each row execute function public.fn_guard_stock_loss_maker();
