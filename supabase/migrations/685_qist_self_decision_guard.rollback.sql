drop trigger if exists trg_qist_self_guard_installment on public.qist_installments;
drop trigger if exists trg_qist_self_guard_plan on public.qist_plans;
drop function if exists public.fn_qist_self_guard_installment();
drop function if exists public.fn_qist_self_guard_plan();

drop policy if exists qist_plans_update on public.qist_plans;
create policy qist_plans_update on public.qist_plans for update to authenticated
  using (public.fn_qist_is_maker() and status = 'draft') with check (public.fn_qist_is_maker());

drop policy if exists qist_installments_write on public.qist_installments;
create policy qist_installments_write on public.qist_installments for all to authenticated
  using (public.fn_qist_is_maker()) with check (public.fn_qist_is_maker());
