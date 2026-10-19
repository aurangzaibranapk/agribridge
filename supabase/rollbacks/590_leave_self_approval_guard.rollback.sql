-- Rollback 590: purani (134/237) policies wapas, trigger hatao.
drop trigger if exists trg_leave_self_guard on public.leave_requests;
drop function if exists public.fn_leave_self_guard();
drop policy if exists leave_own_insert on public.leave_requests;
create policy leave_own_insert on public.leave_requests for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists leave_own_cancel on public.leave_requests;
create policy leave_own_cancel on public.leave_requests for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
