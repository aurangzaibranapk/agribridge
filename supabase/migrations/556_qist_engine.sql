-- 556: Qist engine -- submit/manzoori (maker-checker), rok/chalu, dobara schedule,
-- write-off, aur adaigi par khud kattauti. Kami akhir mein EK jama qist mein.
-- Payroll (553) ko Qist se jorta hai. Additive.

create or replace function public.fn_qist_event(p_plan uuid, p_action text, p_reason text, p_amount numeric,
  p_before jsonb default null, p_after jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.qist_plan_events (plan_id, action, reason, amount, before_state, after_state)
  values (p_plan, p_action, p_reason, p_amount, p_before, p_after)
$$;

create or replace function public.fn_qist_outstanding(p_plan uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_due - amount_deducted - carried_out), 0)
    from public.qist_installments where plan_id = p_plan and status = 'due'
$$;

create or replace function public.fn_qist_submit(p_plan uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.qist_plans; v_sum numeric; v_n int;
begin
  if not public.fn_qist_is_maker() then raise exception 'Ijazat nahi.'; end if;
  select * into p from public.qist_plans where id = p_plan for update;
  if not found or p.status <> 'draft' then raise exception 'Sirf draft plan bheja ja sakta hai.'; end if;
  select coalesce(sum(amount_due),0), count(*) into v_sum, v_n from public.qist_installments where plan_id = p_plan;
  if v_n = 0 then raise exception 'Schedule khali hai.'; end if;
  if v_n <> p.installments_count then raise exception 'Qiston ki tadaad (%) schedule (%) se nahi milti.', p.installments_count, v_n; end if;
  if abs(v_sum - p.total) > 0.009 then raise exception 'Schedule ka jama (Rs %) kul raqam (Rs %) ke barabar nahi.', v_sum, p.total; end if;
  if exists (select 1 from public.qist_installments where plan_id = p_plan and amount_due <= 0) then raise exception 'Har qist sifar se zyada ho.'; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  update public.qist_plans set status = 'submitted', submitted_at = now() where id = p_plan;
  perform public.fn_qist_event(p_plan, 'submitted', null, p.total);
  perform set_config('agribridge.qist_fn', 'off', true);
end $$;

create or replace function public.fn_qist_decide(p_plan uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.qist_plans;
begin
  if not public.fn_qist_is_approver() then raise exception 'Qist plan sirf Admin ya Owner manzoor kar sakta hai.'; end if;
  select * into p from public.qist_plans where id = p_plan for update;
  if not found or p.status <> 'submitted' then raise exception 'Sirf bheja hua plan manzoor/rad ho sakta hai.'; end if;
  if p.created_by = auth.uid() then raise exception 'Banane wala khud manzoor nahi kar sakta.'; end if;
  if p.party_type = 'staff' and p.party_id = auth.uid() then raise exception 'Apna plan khud manzoor nahi kiya ja sakta.'; end if;
  if not p_approve and coalesce(btrim(p_reason),'') = '' then raise exception 'Rad karne ki wajah likhein.'; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  if p_approve then
    update public.qist_plans set status = 'active', approved_by = auth.uid(), approved_at = now() where id = p_plan;
    perform public.fn_qist_event(p_plan, 'approved', p_reason, p.total);
  else
    update public.qist_plans set status = 'draft', submitted_at = null where id = p_plan;
    perform public.fn_qist_event(p_plan, 'rejected', btrim(p_reason), p.total);
  end if;
  perform set_config('agribridge.qist_fn', 'off', true);
end $$;

-- Rok / chalu / cancel (wajah lazmi, Admin/Owner)
create or replace function public.fn_qist_set_status(p_plan uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.qist_plans; v_to text;
begin
  if not public.fn_qist_is_approver() then raise exception 'Ye kaam sirf Admin ya Owner kar sakta hai.'; end if;
  if coalesce(btrim(p_reason),'') = '' then raise exception 'Wajah likhna lazmi hai.'; end if;
  select * into p from public.qist_plans where id = p_plan for update;
  if not found then raise exception 'Plan nahi mila.'; end if;
  if p_action = 'pause' and p.status = 'active' then v_to := 'paused';
  elsif p_action = 'resume' and p.status = 'paused' then v_to := 'active';
  elsif p_action = 'cancel' and p.status in ('draft','submitted') then v_to := 'cancelled';
  else raise exception 'Ye plan % hai -- "%" nahi ho sakta.', p.status, p_action; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  update public.qist_plans set status = v_to where id = p_plan;
  perform public.fn_qist_event(p_plan, case p_action when 'pause' then 'paused' when 'resume' then 'resumed' else 'cancelled' end,
    btrim(p_reason), null, jsonb_build_object('status', p.status), jsonb_build_object('status', v_to));
  perform set_config('agribridge.qist_fn', 'off', true);
end $$;

-- Dobara schedule: baqi (abhi na kati) qistein nayi qatar se badalti hain.
-- p_rows = [{"due_date":"2026-11-07","amount":5000}, ...]; jama = baqaya.
create or replace function public.fn_qist_reschedule(p_plan uuid, p_rows jsonb, p_reason text,
  p_cap_pct numeric default null, p_cap_amount numeric default null, p_set_cap boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.qist_plans; v_out numeric; v_new numeric; v_seq int; v_before jsonb; x jsonb;
begin
  if not public.fn_qist_is_approver() then raise exception 'Dobara schedule sirf Admin ya Owner.'; end if;
  if coalesce(btrim(p_reason),'') = '' then raise exception 'Wajah likhna lazmi hai.'; end if;
  select * into p from public.qist_plans where id = p_plan for update;
  if not found or p.status not in ('active','paused') then raise exception 'Sirf chalu/ruka plan dobara schedule hota hai.'; end if;
  v_out := public.fn_qist_outstanding(p_plan);
  select coalesce(sum((r->>'amount')::numeric),0) into v_new from jsonb_array_elements(p_rows) r;
  if jsonb_array_length(p_rows) = 0 then raise exception 'Naya schedule khali hai.'; end if;
  if abs(v_new - v_out) > 0.009 then raise exception 'Naye schedule ka jama (Rs %) baqaya (Rs %) ke barabar ho.', v_new, v_out; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r where (r->>'amount')::numeric <= 0 or (r->>'due_date') is null) then
    raise exception 'Har qatar mein tareekh aur raqam (sifar se zyada) zaroori.';
  end if;
  select jsonb_agg(to_jsonb(i) order by seq) into v_before from public.qist_installments i where plan_id = p_plan and status = 'due';
  perform set_config('agribridge.qist_fn', 'on', true);
  -- adhi kati: kati hui raqam par band (paid), baqi naye schedule mein aa chuka
  update public.qist_installments set amount_due = amount_deducted, status = 'paid'
   where plan_id = p_plan and status = 'due' and amount_deducted > 0;
  update public.qist_installments set status = 'cancelled' where plan_id = p_plan and status = 'due';
  select coalesce(max(seq),0) into v_seq from public.qist_installments where plan_id = p_plan;
  for x in select * from jsonb_array_elements(p_rows) loop
    v_seq := v_seq + 1;
    insert into public.qist_installments (plan_id, seq, due_date, amount_due)
    values (p_plan, v_seq, (x->>'due_date')::date, (x->>'amount')::numeric);
  end loop;
  update public.qist_plans set version = version + 1,
    cap_pct = case when p_set_cap then p_cap_pct else cap_pct end,
    cap_amount = case when p_set_cap then p_cap_amount else cap_amount end
   where id = p_plan;
  perform public.fn_qist_event(p_plan, 'rescheduled', btrim(p_reason), v_out, v_before, p_rows);
  perform set_config('agribridge.qist_fn', 'off', true);
end $$;

-- Write-off (Admin ya Owner, wajah lazmi). Journal TS mein (6075 Dr / receivable Cr).
create or replace function public.fn_qist_write_off(p_plan uuid, p_reason text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare p public.qist_plans; v_out numeric;
begin
  if not public.fn_qist_is_approver() then raise exception 'Write-off sirf Admin ya Owner kar sakta hai.'; end if;
  if length(coalesce(btrim(p_reason),'')) < 5 then raise exception 'Write-off ki wajah tafseel se likhein.'; end if;
  select * into p from public.qist_plans where id = p_plan for update;
  if not found or p.status not in ('active','paused') then raise exception 'Sirf chalu/ruka plan write-off hota hai.'; end if;
  if p.party_type = 'staff' and p.party_id = auth.uid() then raise exception 'Apna qarz khud maaf nahi kiya ja sakta.'; end if;
  v_out := public.fn_qist_outstanding(p_plan);
  if v_out <= 0 then raise exception 'Kuch baqi nahi.'; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  update public.qist_installments set amount_due = amount_deducted, status = 'paid'
   where plan_id = p_plan and status = 'due' and amount_deducted > 0;
  update public.qist_installments set status = 'written_off' where plan_id = p_plan and status = 'due';
  update public.qist_plans set status = 'written_off', written_off_amount = v_out where id = p_plan;
  perform public.fn_qist_event(p_plan, 'written_off', btrim(p_reason), v_out);
  perform set_config('agribridge.qist_fn', 'off', true);
  return v_out;
end $$;

create or replace function public.fn_qist_set_event_journal(p_plan uuid, p_action text, p_journal uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.fn_qist_is_maker() then raise exception 'Ijazat nahi.'; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  update public.qist_plan_events set journal_entry_id = p_journal
   where id = (select id from public.qist_plan_events where plan_id = p_plan and action = p_action and journal_entry_id is null order by at desc limit 1);
  perform set_config('agribridge.qist_fn', 'off', true);
end $$;

-- Kitni qist wajib hai (had ke saath) -- likhta kuch nahi.
create or replace function public.fn_qist_preview(p_party_type text, p_party_id uuid, p_source text, p_as_of date, p_payout numeric)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p record; v_left numeric := greatest(coalesce(p_payout,0),0); v_due numeric; v_cap numeric; v_take numeric;
  v_items jsonb := '[]'::jsonb; v_total numeric := 0; v_total_due numeric := 0;
begin
  if not public.fn_qist_is_maker() then raise exception 'Ijazat nahi.'; end if;
  for p in select * from public.qist_plans where party_type = p_party_type and party_id = p_party_id
              and deduct_source = p_source and status = 'active' order by approved_at, created_at loop
    select coalesce(sum(amount_due - amount_deducted - carried_out),0) into v_due
      from public.qist_installments where plan_id = p.id and status = 'due' and due_date <= p_as_of;
    continue when v_due <= 0;
    v_cap := v_due;
    if p.cap_pct is not null then v_cap := least(v_cap, round(coalesce(p_payout,0) * p.cap_pct / 100, 0)); end if;
    if p.cap_amount is not null then v_cap := least(v_cap, p.cap_amount); end if;
    v_take := greatest(least(v_cap, v_left), 0);
    v_left := v_left - v_take; v_total := v_total + v_take; v_total_due := v_total_due + v_due;
    v_items := v_items || jsonb_build_object('plan_id', p.id, 'code', p.code, 'origin', p.origin, 'due', v_due, 'deduct', v_take,
      'shortfall', v_due - v_take, 'cap_pct', p.cap_pct, 'cap_amount', p.cap_amount);
  end loop;
  return jsonb_build_object('due', v_total_due, 'deduct', v_total, 'items', v_items);
end $$;

-- Asal kattauti. Ek source row par dobara nahi (idempotent).
create or replace function public.fn_qist_apply(p_party_type text, p_party_id uuid, p_source text, p_as_of date,
  p_payout numeric, p_source_table text, p_source_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_prev jsonb; v_prev_amt numeric; v_prev_n int; v_preview jsonb; it jsonb; i record; v_take_plan numeric; v_take numeric;
  v_rem numeric; v_short numeric; v_carry uuid; v_carry_due date; v_last date; v_seq int; p public.qist_plans; v_ded uuid;
begin
  if not public.fn_qist_is_maker() then raise exception 'Ijazat nahi.'; end if;
  select coalesce(sum(amount),0), count(*), coalesce(jsonb_agg(jsonb_build_object('plan_id', plan_id, 'deduct', amount)), '[]'::jsonb)
    into v_prev_amt, v_prev_n, v_prev from public.qist_deductions where source_table = p_source_table and source_id = p_source_id;
  if v_prev_n > 0 then return jsonb_build_object('deduct', v_prev_amt, 'items', v_prev, 'already', true); end if;

  v_preview := public.fn_qist_preview(p_party_type, p_party_id, p_source, p_as_of, p_payout);
  perform set_config('agribridge.qist_fn', 'on', true);
  for it in select * from jsonb_array_elements(v_preview->'items') loop
    select * into p from public.qist_plans where id = (it->>'plan_id')::uuid for update;
    v_take_plan := (it->>'deduct')::numeric;
    continue when v_take_plan <= 0;  -- adaigi hi nahi: qist wajib (overdue) rehti hai
    for i in select * from public.qist_installments where plan_id = p.id and status = 'due' and due_date <= p_as_of
              order by is_carry, due_date, seq for update loop
      exit when v_take_plan <= 0;   -- baqi qistein agli adaigi tak wajib
      v_rem := i.amount_due - i.amount_deducted - i.carried_out;
      v_take := least(v_rem, v_take_plan);
      v_short := v_rem - v_take;
      v_take_plan := v_take_plan - v_take;
      v_carry := null;
      if v_short > 0 and not i.is_carry then
        -- kami akhir wali EK jama qist mein
        select id into v_carry from public.qist_installments where plan_id = p.id and is_carry and status = 'due';
        if v_carry is null then
          select max(due_date), max(seq) into v_last, v_seq from public.qist_installments where plan_id = p.id;
          v_carry_due := case p.frequency when 'milk_weekly' then v_last + 7 else (v_last + interval '1 month')::date end;
          insert into public.qist_installments (plan_id, seq, due_date, amount_due, is_carry)
          values (p.id, v_seq + 1, greatest(v_carry_due, p_as_of + 1), v_short, true) returning id into v_carry;
        else
          update public.qist_installments set amount_due = amount_due + v_short where id = v_carry;
        end if;
        update public.qist_installments set amount_deducted = amount_deducted + v_take, carried_out = carried_out + v_short,
          status = 'partial' where id = i.id;
      else
        update public.qist_installments set amount_deducted = amount_deducted + v_take,
          status = case when amount_deducted + v_take + carried_out >= amount_due then 'paid' else 'due' end where id = i.id;
      end if;
      insert into public.qist_deductions (plan_id, installment_id, source_type, source_table, source_id, amount, carry_installment_id, carry_added)
      values (p.id, i.id, p_source, p_source_table, p_source_id, v_take, v_carry, case when v_carry is null then 0 else v_short end);
    end loop;
    perform public.fn_qist_event(p.id, 'deducted', p_source_table, (it->>'deduct')::numeric,
      null, jsonb_build_object('source_table', p_source_table, 'source_id', p_source_id));
    if not exists (select 1 from public.qist_installments where plan_id = p.id and status = 'due') then
      update public.qist_plans set status = 'completed' where id = p.id;
      perform public.fn_qist_event(p.id, 'completed', null, p.total);
    end if;
  end loop;
  perform set_config('agribridge.qist_fn', 'off', true);
  return jsonb_build_object('deduct', (v_preview->>'deduct')::numeric, 'items', v_preview->'items', 'already', false);
end $$;

-- Ulta (jab adaigi/journal nakaam ho). Sirf us source row ki kattautiyan.
create or replace function public.fn_qist_reverse_source(p_source_table text, p_source_id uuid, p_reason text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare d record; v_total numeric := 0; v_plan uuid;
begin
  if not public.fn_qist_is_maker() then raise exception 'Ijazat nahi.'; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  for d in select * from public.qist_deductions where source_table = p_source_table and source_id = p_source_id for update loop
    if d.journal_entry_id is not null then raise exception 'Kattauti ledger mein ja chuki -- journal reverse karein.'; end if;
    update public.qist_installments set amount_deducted = amount_deducted - d.amount,
      carried_out = carried_out - d.carry_added, status = 'due' where id = d.installment_id;
    if d.carry_installment_id is not null then
      update public.qist_installments set amount_due = amount_due - d.carry_added where id = d.carry_installment_id;
      delete from public.qist_installments where id = d.carry_installment_id and amount_due <= 0 and amount_deducted = 0;
    end if;
    update public.qist_plans set status = 'active' where id = d.plan_id and status = 'completed';
    perform public.fn_qist_event(d.plan_id, 'reversed', p_reason, d.amount);
    delete from public.qist_deductions where id = d.id;
    v_total := v_total + d.amount;
  end loop;
  perform set_config('agribridge.qist_fn', 'off', true);
  return v_total;
end $$;

create or replace function public.fn_qist_set_deduction_journal(p_source_table text, p_source_id uuid, p_journal uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.fn_qist_is_maker() then raise exception 'Ijazat nahi.'; end if;
  perform set_config('agribridge.qist_fn', 'on', true);
  update public.qist_deductions set journal_entry_id = p_journal where source_table = p_source_table and source_id = p_source_id;
  perform set_config('agribridge.qist_fn', 'off', true);
end $$;

-- ---------- Payroll se jor (553 ke stubs badle) ----------
create or replace function public.fn_payroll_advance_due(p_profile uuid, p_year int, p_month int, p_available numeric)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((public.fn_qist_preview('staff', p_profile, 'salary',
    (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date, p_available)->>'deduct')::numeric, 0)
$$;

create or replace function public.fn_payroll_on_approved(p_run uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.payroll_runs; l record; v jsonb; v_end date;
begin
  select * into r from public.payroll_runs where id = p_run;
  v_end := (make_date(r.pay_year, r.pay_month, 1) + interval '1 month - 1 day')::date;
  for l in select * from public.payroll_lines where run_id = p_run and advance_deduction > 0 loop
    v := public.fn_qist_apply('staff', l.profile_id, 'salary', v_end,
           greatest(l.gross - l.absent_deduction - l.other_deductions, 0), 'payroll_lines', l.id);
    if abs((v->>'deduct')::numeric - l.advance_deduction) > 0.009 then
      raise exception 'Advance qist badal gayi (Rs % bajaye Rs %) -- run wapas draft kar ke hisaab dobara chalayein.',
        (v->>'deduct')::numeric, l.advance_deduction;
    end if;
  end loop;
end $$;

create or replace function public.fn_payroll_on_unapproved(p_run uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare l record;
begin
  for l in select id from public.payroll_lines where run_id = p_run loop
    perform public.fn_qist_reverse_source('payroll_lines', l.id, 'Payroll journal nakaam -- wapas');
  end loop;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'public.fn_qist_event(uuid, text, text, numeric, jsonb, jsonb)',
    'public.fn_payroll_on_approved(uuid)', 'public.fn_payroll_on_unapproved(uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.fn_qist_outstanding(uuid)', 'public.fn_qist_submit(uuid)', 'public.fn_qist_decide(uuid, boolean, text)',
    'public.fn_qist_set_status(uuid, text, text)', 'public.fn_qist_reschedule(uuid, jsonb, text, numeric, numeric, boolean)',
    'public.fn_qist_write_off(uuid, text)', 'public.fn_qist_set_event_journal(uuid, text, uuid)',
    'public.fn_qist_preview(text, uuid, text, date, numeric)', 'public.fn_qist_apply(text, uuid, text, date, numeric, text, uuid)',
    'public.fn_qist_reverse_source(text, uuid, text)', 'public.fn_qist_set_deduction_journal(text, uuid, uuid)',
    'public.fn_payroll_advance_due(uuid, int, int, numeric)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
