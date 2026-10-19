-- =====================================================================
-- AgriBridge — Migration 590: Apni chhutti khud manzoor nahi (S1)
-- =====================================================================
-- HR audit (S1): leave_own_insert (134) aur leave_own_cancel (237) ki
-- policies sirf ye dekhti thin ke qatar apni hai -- status nahi. Yani
-- banda seedha API se apni chhutti 'approved' likh kar daal sakta tha,
-- ya apni pending darkhwast ko khud 'approved' bana sakta tha. App mein
-- rok thi, database mein nahi.
--
-- Ab:
--   * apni darkhwast sirf 'pending' ban kar aati hai, faisle ke khane
--     (decided_by / decided_at) khali.
--   * apni darkhwast par sirf ek kaam: pending/sent_back -> cancelled.
--   * Trigger bhi wahi rok lagata hai (policy ke ilawa) -- taake koi
--     doosri update policy kabhi ye raasta na khol de.
-- Faisla (leave_decide, 237) waisa hi hai -- wahan apni cheez par
-- fn_hr_can_decide_for pehle se false hai.
-- Additive: koi data nahi badalta. Rollback: supabase/rollbacks/590_*.sql
-- =====================================================================

drop policy if exists leave_own_insert on public.leave_requests;
create policy leave_own_insert on public.leave_requests for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'pending'
    and decided_by is null
    and decided_at is null
  );

drop policy if exists leave_own_cancel on public.leave_requests;
create policy leave_own_cancel on public.leave_requests for update to authenticated
  using (profile_id = auth.uid() and status in ('pending', 'sent_back'))
  with check (profile_id = auth.uid() and status = 'cancelled');

create or replace function public.fn_leave_self_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid;
begin
  begin
    v_actor := auth.uid();
  exception when others then
    v_actor := null;
  end;
  -- Server (service role) ya andar ka trigger -- us par ye rok nahi.
  if v_actor is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.profile_id = v_actor then
      if new.status is distinct from 'pending' or new.decided_by is not null or new.decided_at is not null then
        raise exception 'Apni chhutti sirf darkhwast (pending) ban kar di ja sakti hai. Faisla aap ka afsar ya HR karega.';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE
  if old.profile_id = v_actor or new.profile_id = v_actor then
    if new.profile_id is distinct from old.profile_id then
      raise exception 'Darkhwast kisi aur ke naam nahi ki ja sakti.';
    end if;
    if new.status is distinct from old.status then
      if not (old.status in ('pending', 'sent_back') and new.status = 'cancelled') then
        raise exception 'Apni chhutti ka faisla khud nahi ho sakta. Aap sirf apni darkhwast wapas (cancel) le sakte hain.';
      end if;
    elsif old.status not in ('pending', 'sent_back') then
      raise exception 'Faisla shuda chhutti badli nahi ja sakti.';
    end if;
    if new.decided_by is distinct from old.decided_by
       or new.decided_at is distinct from old.decided_at
       or new.decision_note is distinct from old.decision_note then
      raise exception 'Faisle ke khane khud nahi bhare ja sakte.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.fn_leave_self_guard() from public, anon;
grant execute on function public.fn_leave_self_guard() to authenticated, service_role;

drop trigger if exists trg_leave_self_guard on public.leave_requests;
create trigger trg_leave_self_guard
  before insert or update on public.leave_requests
  for each row execute function public.fn_leave_self_guard();

comment on policy leave_own_insert on public.leave_requests is
  'Apni darkhwast sirf pending, faisla khali (590).';
comment on policy leave_own_cancel on public.leave_requests is
  'Apni darkhwast par sirf pending/sent_back -> cancelled (590).';
