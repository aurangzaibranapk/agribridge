-- 538: Udhaar rok -- har gahak ki apni din ki hadd / chhoot, Promise-to-Pay
-- ke sath. Additive: naye columns + naye functions; purana trigger wohi naam,
-- naya hisaab (effective din + khula waada).

alter table public.customers
  add column if not exists overdue_block_days integer check (overdue_block_days is null or overdue_block_days between 1 and 365),
  add column if not exists overdue_block_exempt boolean not null default false,
  add column if not exists overdue_block_reason text,
  add column if not exists overdue_block_until date,
  add column if not exists overdue_block_set_by uuid references public.profiles(id),
  add column if not exists overdue_block_set_at timestamptz;
comment on column public.customers.overdue_block_days is 'Is gahak ki udhaar rok ki din ki hadd. NULL = aam setting (receivable_recovery_settings.due_days).';
comment on column public.customers.overdue_block_exempt is 'true = is gahak par purane baqaye ki rok nahi (overdue_block_until tak, agar diya ho).';

alter table public.receivable_recovery_settings
  add column if not exists override_reasons text[] not null default array[
    'Purana bharosemand gahak','Adaigi ka wada (tareekh)','Rishtedar / Owner ki ijazat','Fasal ki raqam aani hai','Doosri wajah'];

-- Promise to Pay: raqam ikhtiyari, din, admin manzoori.
alter table public.payment_promises alter column promised_amount drop not null;
alter table public.payment_promises drop constraint if exists payment_promises_promised_amount_check;
alter table public.payment_promises add constraint payment_promises_promised_amount_check
  check (promised_amount is null or promised_amount > 0);
alter table public.payment_promises
  add column if not exists promised_days integer check (promised_days is null or promised_days between 1 and 365),
  add column if not exists allows_credit boolean not null default true,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists broken_at timestamptz;
create index if not exists idx_payment_promises_party on public.payment_promises(party_type, party_id, created_at desc);

-- Gahak ki udhaar halat: teen adad + waada + rok.
create or replace function public.fn_customer_credit_position(p_customer uuid)
returns table(customer_id uuid, kul_baqaya numeric, late_amount numeric, bahali_amount numeric,
  oldest_days integer, limit_days integer, limit_source text, exempt boolean,
  promise_id uuid, promise_date date, promise_amount numeric, promise_state text, blocked boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  s public.receivable_recovery_settings%rowtype;
  c record; today date := (now() at time zone 'Asia/Karachi')::date;
  v_bal numeric := 0; v_late numeric := 0; v_oldest date; v_limit int; v_src text; v_ex boolean;
  pr record; v_state text := null; v_pid uuid; v_pdate date; v_pamt numeric;
begin
  if not (fn_is_any_staff() or auth.role() = 'service_role') then return; end if;
  select * into s from receivable_recovery_settings where id;
  select id, overdue_block_days, overdue_block_exempt, overdue_block_until into c from customers where id = p_customer;
  if not found then return; end if;
  v_ex := coalesce(c.overdue_block_exempt,false) and (c.overdue_block_until is null or c.overdue_block_until >= today);
  v_limit := coalesce(c.overdue_block_days, s.due_days, 30);
  v_src := case when v_ex then 'exempt' when c.overdue_block_days is not null then 'party' else 'global' end;

  with lines as (
    select e.entry_date, e.entry_number, coalesce(l.debit,0) dr, coalesce(l.credit,0) cr
      from journal_lines l join journal_entries e on e.id = l.entry_id
     where l.account_code = '1100' and l.party_type = 'customer' and l.party_id = p_customer and e.entry_date <= today),
  tot as (select coalesce(sum(cr),0) tcr, coalesce(sum(dr-cr),0) bal from lines),
  deb as (select entry_date, dr, sum(dr) over (order by entry_date, entry_number rows between unbounded preceding and current row) cum from lines where dr > 0),
  od as (select d.entry_date, greatest(0, least(d.dr, d.cum - t.tcr)) amt from deb d cross join tot t)
  select round((select bal from tot),2),
         round(coalesce(sum(amt) filter (where today - entry_date >= v_limit),0),2),
         min(entry_date) filter (where amt > 0.009)
    into v_bal, v_late, v_oldest from od;
  v_bal := coalesce(v_bal,0);
  if v_bal <= 0.009 then v_bal := greatest(v_bal,0); v_late := 0; end if;

  select p.* into pr from payment_promises p
   where p.party_type = 'customer' and p.party_id = p_customer and p.status in ('open','broken')
   order by p.created_at desc limit 1;
  if found then
    v_pid := pr.id; v_pdate := pr.promise_date; v_pamt := pr.promised_amount;
    if v_bal <= 0.009 or (pr.promised_amount is not null and pr.fulfilled_amount >= pr.promised_amount) then v_state := 'fulfilled';
    elsif pr.promise_date >= today and pr.allows_credit and pr.status = 'open' then v_state := 'open';
    else v_state := 'broken';
      v_late := greatest(v_late, least(v_bal, coalesce(pr.promised_amount, v_bal)));
    end if;
  end if;

  customer_id := p_customer; kul_baqaya := v_bal; late_amount := v_late;
  oldest_days := case when v_oldest is null then null else today - v_oldest end;
  limit_days := v_limit; limit_source := v_src; exempt := v_ex;
  promise_id := v_pid; promise_date := v_pdate; promise_amount := v_pamt; promise_state := v_state;
  blocked := coalesce(s.block_overdue_credit,false) and today >= s.effective_from and not v_ex
             and v_late > 0.009 and v_late >= coalesce(s.min_amount,0.01) and coalesce(v_state,'') <> 'open';
  bahali_amount := case when blocked then v_late else 0 end;
  return next;
end $$;
revoke all on function public.fn_customer_credit_position(uuid) from public, anon;
grant execute on function public.fn_customer_credit_position(uuid) to authenticated, service_role;

-- Admin-only: gahak ki hadd / chhoot badalna (audit columns ke sath).
create or replace function public.set_customer_overdue_policy(p_customer uuid, p_days integer, p_exempt boolean, p_reason text, p_until date default null)
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select role::text into r from profiles where id = auth.uid() and is_active;
  if r is null or r not in ('owner','super_admin','admin') then raise exception 'Sirf Admin/Owner udhaar hadd badal sakta hai.'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Wajah likhna lazmi hai.'; end if;
  if p_days is not null and (p_days < 1 or p_days > 365) then raise exception 'Din 1 se 365 ke darmiyan.'; end if;
  update customers set overdue_block_days = case when coalesce(p_exempt,false) then null else p_days end,
    overdue_block_exempt = coalesce(p_exempt,false), overdue_block_reason = trim(p_reason),
    overdue_block_until = p_until, overdue_block_set_by = auth.uid(), overdue_block_set_at = now()
   where id = p_customer;
  if not found then raise exception 'Gahak nahi mila.'; end if;
end $$;
revoke all on function public.set_customer_overdue_policy(uuid,integer,boolean,text,date) from public, anon;
grant execute on function public.set_customer_overdue_policy(uuid,integer,boolean,text,date) to authenticated;

-- POS trigger: wohi naam, ab effective din + waada.
create or replace function private.enforce_pos_recovery_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.receivable_recovery_settings%rowtype;
  p record; reason text; actor_role text;
begin
  if coalesce(new.khata_amount,0) <= 0 then return new; end if;
  if tg_op = 'UPDATE' then
    if new.crm_customer_id is not distinct from old.crm_customer_id
       and new.customer_id is not distinct from old.customer_id
       and new.khata_amount <= old.khata_amount then return new; end if;
  end if;
  select * into s from public.receivable_recovery_settings where id;
  if not found then raise exception 'Udhaar policy verify nahi ho saki.'; end if;
  if (now() at time zone 'Asia/Karachi')::date < s.effective_from or not s.block_overdue_credit then return new; end if;
  if auth.uid() is null then raise exception 'Udhaar ke liye login zaroori hai.'; end if;
  if new.crm_customer_id is null then return new; end if;
  perform 1 from public.customers where id = new.crm_customer_id for update;
  if not found then raise exception 'Gahak ka khata verify nahi ho saka.'; end if;
  select * into p from public.fn_customer_credit_position(new.crm_customer_id);
  if not found or not p.blocked then return new; end if;
  reason := trim(coalesce(current_setting('agribridge.credit_override_reason',true),''));
  select role::text into actor_role from public.profiles where id = auth.uid() and is_active;
  if actor_role is null or actor_role not in ('owner','super_admin','admin') or length(reason) < 3 then
    raise exception 'Rs % udhaar % din se purana hai (% din ki hadd); naya udhaar band hai. Sirf Admin/Owner wajah likh kar ijazat de sakta hai.',
      round(p.late_amount), coalesce(p.oldest_days,0), p.limit_days;
  end if;
  insert into public.credit_block_overrides
    (customer_id,context,amount,overdue_amount,oldest_days,reason,overridden_by,overridden_role)
  values (new.crm_customer_id,'pos',new.khata_amount,p.late_amount,p.oldest_days,reason,auth.uid(),actor_role);
  return new;
end $$;
revoke all on function private.enforce_pos_recovery_credit() from public,anon,authenticated;

notify pgrst, 'reload schema';
