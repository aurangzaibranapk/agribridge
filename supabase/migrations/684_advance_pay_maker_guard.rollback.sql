create or replace function public.fn_staff_advance_mark_paid(p_id uuid, p_account uuid, p_txn uuid, p_journal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.staff_advances;
begin
  if not public.fn_payroll_is_approver() then raise exception 'Advance sirf Admin ya Owner ada kar sakta hai.'; end if;
  select * into a from public.staff_advances where id = p_id for update;
  if a.status <> 'approved' then raise exception 'Pehle manzoori zaroori hai.'; end if;
  if a.profile_id = auth.uid() then raise exception 'Apna advance khud ada nahi kiya ja sakta.'; end if;
  perform set_config('agribridge.advance_decide', 'on', true);
  update public.staff_advances set status = 'paid', paid_at = now(), paid_by = auth.uid(),
    paid_account_id = p_account, paid_txn_id = p_txn, journal_entry_id = p_journal where id = p_id;
  perform set_config('agribridge.advance_decide', 'off', true);
end $$;
