-- 685: Qist / advance self-approval.
-- N3: banane wala khud manzoor, rok, schedule, ya maafi nahi karta.
-- N5: staff apna draft / schedule khud nahi badalta.
-- N6: apni qist ki kattauti khud nahi lagata.
-- N9: apni kattauti khud wapas nahi leta.
-- Cancel (wapis lena) banane wale ko chhoRa hai — wo manzoori nahi.

create or replace function public.fn_qist_self_guard_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.party_type = 'staff' and old.party_id = auth.uid() then
      raise exception 'Apni qist khud nahi mitayi ja sakti.';
    end if;
    return old;
  end if;
  if new.party_type = 'staff' and new.party_id = auth.uid() then
    raise exception 'Apni qist khud nahi likhi ya manzoor ki ja sakti.';
  end if;
  if tg_op = 'UPDATE' and new.created_by = auth.uid() then
    if new.status in ('active','paused','written_off') and new.status is distinct from old.status then
      raise exception 'Banane wala khud manzoor, rok, ya maafi nahi kar sakta.';
    end if;
    if new.version is distinct from old.version
       or new.written_off_amount is distinct from old.written_off_amount
       or new.cap_pct is distinct from old.cap_pct
       or new.cap_amount is distinct from old.cap_amount then
      raise exception 'Banane wala khud schedule ya had nahi badal sakta.';
    end if;
  end if;
  return new;
end $$;

create or replace function public.fn_qist_self_guard_installment()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_type text; v_party uuid;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  select party_type, party_id into v_type, v_party
    from public.qist_plans
   where id = coalesce(new.plan_id, old.plan_id);
  if v_type = 'staff' and v_party = auth.uid() then
    raise exception 'Apni qist ki schedule khud nahi badli ja sakti.';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_qist_self_guard_plan on public.qist_plans;
create trigger trg_qist_self_guard_plan
  before insert or update or delete on public.qist_plans
  for each row execute function public.fn_qist_self_guard_plan();

drop trigger if exists trg_qist_self_guard_installment on public.qist_installments;
create trigger trg_qist_self_guard_installment
  before insert or update or delete on public.qist_installments
  for each row execute function public.fn_qist_self_guard_installment();

drop policy if exists qist_plans_update on public.qist_plans;
create policy qist_plans_update on public.qist_plans
  for update to authenticated
  using (
    public.fn_qist_is_maker() and status = 'draft'
    and not (party_type = 'staff' and party_id = auth.uid()))
  with check (
    public.fn_qist_is_maker()
    and not (party_type = 'staff' and party_id = auth.uid()));

drop policy if exists qist_installments_write on public.qist_installments;
create policy qist_installments_write on public.qist_installments
  for all to authenticated
  using (
    public.fn_qist_is_maker()
    and not exists (
      select 1 from public.qist_plans p
       where p.id = plan_id and p.party_type = 'staff' and p.party_id = auth.uid()))
  with check (
    public.fn_qist_is_maker()
    and not exists (
      select 1 from public.qist_plans p
       where p.id = plan_id and p.party_type = 'staff' and p.party_id = auth.uid()));
