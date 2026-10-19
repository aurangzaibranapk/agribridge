-- =====================================================================
-- 606: Mobile app -- staff ki nayi entry (recovery/milk/cash sale/wada/
-- demand/visit note) sirf PENDING jati hai. Koi ledger posting nahi.
-- Checker (owner/super_admin/admin/finance, ya usi branch ka manager)
-- approve/reject karta hai -- apni entry khud approve NAHI ho sakti
-- (function + table constraint dono). Approve ke baad ERP desk asal
-- posting apne purane tareeqe se karta hai.
-- client_uuid se dobara bhejne par dobara entry nahi banti (offline queue).
-- Har submit/decide mobile_staff_action_log (605) mein.
-- Depends on 605. Additive. Dobara chalana mehfooz.
-- Wapas: supabase/rollbacks/606_mobile_staff_entries.rollback.sql
-- =====================================================================

create table if not exists public.mobile_staff_entries (
  id uuid primary key default gen_random_uuid(),
  client_uuid uuid not null unique,
  kind text not null check (kind in ('recovery','milk','cash_sale','promise','demand','visit_note')),
  party_id uuid not null,
  branch_id uuid,
  amount numeric check (amount is null or amount >= 0),
  method text check (method is null or method in ('cash','bank','jazzcash','easypaisa')),
  note text check (note is null or length(note) <= 1000),
  photo_path text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  constraint mobile_staff_entries_no_self_approval check (decided_by is null or decided_by <> created_by)
);
create index if not exists mobile_staff_entries_branch_status_idx on public.mobile_staff_entries (branch_id, status, created_at desc);
alter table public.mobile_staff_entries enable row level security;
revoke all on public.mobile_staff_entries from anon, authenticated;
grant select on public.mobile_staff_entries to authenticated;
drop policy if exists mobile_staff_entries_read on public.mobile_staff_entries;
create policy mobile_staff_entries_read on public.mobile_staff_entries
  for select to authenticated
  using (created_by = auth.uid() or public.fn_staff_can_see_branch(branch_id));

create or replace function public.fn_staff_submit_entry(
  p_client_uuid uuid, p_kind text, p_party uuid, p_amount numeric default null,
  p_method text default null, p_note text default null, p_photo_path text default null,
  p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch uuid; v_id uuid; v_existing record;
begin
  if auth.uid() is null or not public.fn_mobile_is_staff() then raise exception 'Sirf staff ke liye.'; end if;
  if p_client_uuid is null then raise exception 'client_uuid zaroori'; end if;
  select * into v_existing from mobile_staff_entries where client_uuid = p_client_uuid;
  if found then
    if v_existing.created_by <> auth.uid() then raise exception 'client_uuid pehle se istemal hua'; end if;
    return jsonb_build_object('id', v_existing.id, 'status', v_existing.status, 'duplicate', true);
  end if;
  select branch_id into v_branch from customers where id = p_party and coalesce(is_deleted,false) = false;
  if not found or not public.fn_staff_can_see_branch(v_branch) then raise exception 'Party nahi mili ya aap ki branch ki nahi.'; end if;
  if p_kind in ('recovery','cash_sale','promise','milk') and coalesce(p_amount,0) <= 0 then raise exception 'Raqam zaroori'; end if;
  insert into mobile_staff_entries (client_uuid, kind, party_id, branch_id, amount, method, note, photo_path, payload, created_by)
  values (p_client_uuid, p_kind, p_party, v_branch, p_amount, p_method, p_note, p_photo_path, coalesce(p_payload,'{}'::jsonb), auth.uid())
  on conflict (client_uuid) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from mobile_staff_entries where client_uuid = p_client_uuid;
    return jsonb_build_object('id', v_id, 'status', 'pending', 'duplicate', true);
  end if;
  perform public.fn_mobile_log('entry_submit', p_party, v_branch, jsonb_build_object('entry', v_id, 'kind', p_kind, 'amount', p_amount));
  return jsonb_build_object('id', v_id, 'status', 'pending', 'duplicate', false);
end $$;

create or replace function public.fn_staff_decide_entry(p_entry uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare e record; v_my_branch uuid;
begin
  if auth.uid() is null or not public.fn_mobile_is_staff() then raise exception 'Sirf staff ke liye.'; end if;
  select * into e from mobile_staff_entries where id = p_entry for update;
  if not found then raise exception 'Entry nahi mili'; end if;
  if e.created_by = auth.uid() then raise exception 'Apni entry khud approve/reject nahi kar sakte (maker-checker).'; end if;
  if e.status <> 'pending' then raise exception 'Entry pehle hi faisla shuda hai'; end if;
  select branch_id into v_my_branch from profiles where id = auth.uid();
  if not (public.fn_has_dept(array['owner','super_admin','admin','finance']::public.user_role[])
          or (public.fn_has_dept(array['manager']::public.user_role[]) and e.branch_id is not null and e.branch_id = v_my_branch)) then
    raise exception 'Approve ki ijazat nahi';
  end if;
  update mobile_staff_entries set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = p_entry;
  perform public.fn_mobile_log(case when p_approve then 'entry_approve' else 'entry_reject' end, e.party_id, e.branch_id, jsonb_build_object('entry', p_entry));
  return jsonb_build_object('id', p_entry, 'status', case when p_approve then 'approved' else 'rejected' end);
end $$;

create or replace function public.fn_staff_my_entries(p_limit int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'party_id', e.party_id, 'party', c.name,
           'amount', e.amount, 'status', e.status, 'created_at', e.created_at) order by e.created_at desc), '[]'::jsonb)
    from (select * from mobile_staff_entries where created_by = auth.uid() order by created_at desc limit least(greatest(p_limit,1),100)) e
    left join customers c on c.id = e.party_id
   where public.fn_mobile_is_staff()
$$;

revoke all on function public.fn_staff_submit_entry(uuid, text, uuid, numeric, text, text, text, jsonb) from public, anon;
revoke all on function public.fn_staff_decide_entry(uuid, boolean, text) from public, anon;
revoke all on function public.fn_staff_my_entries(int) from public, anon;
grant execute on function public.fn_staff_submit_entry(uuid, text, uuid, numeric, text, text, text, jsonb) to authenticated;
grant execute on function public.fn_staff_decide_entry(uuid, boolean, text) to authenticated;
grant execute on function public.fn_staff_my_entries(int) to authenticated;

notify pgrst, 'reload schema';
