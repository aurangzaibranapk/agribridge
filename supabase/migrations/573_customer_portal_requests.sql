-- 573: Customer Portal (Phase 5) -- gahak ki darkhwastein, maker-checker ke saath.
--
-- Additive: 4 nayi tables + functions + private bucket. Purani tables ka
-- dhancha nahi badalta. Data sirf in RPCs se likha jata hai:
--   gahak:  fn_my_submit_payment_claim, fn_my_request_change, fn_my_open_dispute, fn_my_request_promise
--   staff:  fn_cp_check (maker), fn_cp_approve (checker), fn_cp_reject, fn_cp_dispute_update
--
-- Qaide (database khud lagata hai, sirf screen nahi):
--   * Koi delete nahi -- kisi ke liye bhi (trigger). Rad / band qatar bhi record hai.
--   * Maker-checker: check karne wala != darj karne wala; approve karne wala
--     != check karne wala != darj karne wala (CHECK constraint + RPC).
--   * Khata (baqaya) SIRF tab badalta hai jab checker adaigi approve kare --
--     wo bhi 535 ke fn_record_recovery_money ke zariye (wohi raseed jo staff
--     Recovery se banata hai). Gahak ki darkhwast se kuch khud-ba-khud credit nahi hota.
--   * Koi WhatsApp / SMS / email nahi bhejta.
--
-- Dependency: 572 (fn_cp_my_customers / fn_cp_staff_can / fn_cp_is_admin),
-- 535 (fn_record_recovery_money), 541 (payment_promises sharaait columns).

-- ---------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------
create table if not exists public.customer_payment_claims (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  amount numeric(14,2) not null check (amount > 0 and amount <= 10000000),
  method text not null check (method in ('cash','bank','jazzcash','easypaisa','cheque')),
  reference text check (reference is null or length(reference) <= 80),
  paid_on date not null,
  proof_path text check (proof_path is null or length(proof_path) <= 300),
  note text check (note is null or length(note) <= 300),
  status text not null default 'submitted' check (status in ('submitted','checked','approved','rejected')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  checked_by uuid, checked_at timestamptz, check_note text,
  approved_by uuid, approved_at timestamptz,
  rejected_by uuid, rejected_at timestamptz, reject_reason text,
  finance_account_id uuid,
  movement_id uuid, journal_entry_id uuid,
  constraint cpc_maker_not_entrant check (checked_by is null or checked_by <> created_by),
  constraint cpc_checker_not_maker check (approved_by is null or (approved_by <> created_by and approved_by <> checked_by)),
  constraint cpc_rejecter_not_entrant check (rejected_by is null or rejected_by <> created_by),
  constraint cpc_approved_complete check (status <> 'approved' or (checked_by is not null and approved_by is not null and journal_entry_id is not null)),
  constraint cpc_rejected_reason check (status <> 'rejected' or (rejected_by is not null and length(coalesce(reject_reason, '')) >= 3))
);
create index if not exists cpc_customer_idx on public.customer_payment_claims (customer_id, created_at desc);
create index if not exists cpc_status_idx on public.customer_payment_claims (status) where status in ('submitted','checked');

create table if not exists public.customer_change_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  field text not null check (field in ('address','business_name','email','phone','cnic','contact_person')),
  old_value text,
  new_value text not null check (length(new_value) between 1 and 300),
  status text not null default 'submitted' check (status in ('submitted','checked','approved','rejected')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  checked_by uuid, checked_at timestamptz, check_note text,
  approved_by uuid, approved_at timestamptz,
  rejected_by uuid, rejected_at timestamptz, reject_reason text,
  constraint ccr_maker_not_entrant check (checked_by is null or checked_by <> created_by),
  constraint ccr_checker_not_maker check (approved_by is null or (approved_by <> created_by and approved_by <> checked_by)),
  constraint ccr_rejecter_not_entrant check (rejected_by is null or rejected_by <> created_by),
  constraint ccr_approved_complete check (status <> 'approved' or (checked_by is not null and approved_by is not null)),
  constraint ccr_rejected_reason check (status <> 'rejected' or (rejected_by is not null and length(coalesce(reject_reason, '')) >= 3))
);
create index if not exists ccr_customer_idx on public.customer_change_requests (customer_id, created_at desc);

create table if not exists public.customer_khata_disputes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  ref text check (ref is null or length(ref) <= 60),
  message text not null check (length(message) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewed','closed')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  handled_by uuid, handled_at timestamptz, staff_note text check (staff_note is null or length(staff_note) <= 500),
  constraint ckd_handler_not_entrant check (handled_by is null or handled_by <> created_by)
);
create index if not exists ckd_customer_idx on public.customer_khata_disputes (customer_id, created_at desc);

create table if not exists public.customer_promise_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  amount numeric(14,2) not null check (amount > 0 and amount <= 10000000),
  promise_date date not null,
  terms_version text not null check (length(terms_version) between 1 and 20),
  terms_accepted_at timestamptz not null,
  status text not null default 'submitted' check (status in ('submitted','checked','approved','rejected')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  checked_by uuid, checked_at timestamptz, check_note text,
  approved_by uuid, approved_at timestamptz,
  rejected_by uuid, rejected_at timestamptz, reject_reason text,
  promise_id uuid,
  constraint cpr_maker_not_entrant check (checked_by is null or checked_by <> created_by),
  constraint cpr_checker_not_maker check (approved_by is null or (approved_by <> created_by and approved_by <> checked_by)),
  constraint cpr_rejecter_not_entrant check (rejected_by is null or rejected_by <> created_by),
  constraint cpr_approved_complete check (status <> 'approved' or (checked_by is not null and approved_by is not null and promise_id is not null)),
  constraint cpr_rejected_reason check (status <> 'rejected' or (rejected_by is not null and length(coalesce(reject_reason, '')) >= 3))
);
create index if not exists cpr_customer_idx on public.customer_promise_requests (customer_id, created_at desc);

-- ---------------------------------------------------------------
-- Koi delete nahi; faisla ho chuki qatar band (kisi ke liye bhi)
-- ---------------------------------------------------------------
create or replace function public.fn_cp_no_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Darkhwast mitayi nahi ja sakti -- rad (reject) karein';
end $$;
create or replace function public.fn_cp_locked()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('approved','rejected','closed') then
    raise exception 'Faisla ho chuka -- ye darkhwast ab nahi badal sakti';
  end if;
  if new.customer_id <> old.customer_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Gahak / darj karne wala nahi badal sakta';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['customer_payment_claims','customer_change_requests','customer_khata_disputes','customer_promise_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop trigger if exists trg_%s_no_delete on public.%I', t, t);
    execute format('create trigger trg_%s_no_delete before delete on public.%I for each row execute function public.fn_cp_no_delete()', t, t);
    execute format('drop trigger if exists trg_%s_locked on public.%I', t, t);
    execute format('create trigger trg_%s_locked before update on public.%I for each row execute function public.fn_cp_locked()', t, t);
    -- Likhna sirf functions se: seedha insert/update/delete band
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %s_read on public.%I', t, t);
    execute format('create policy %s_read on public.%I for select to authenticated using (customer_id = any(public.fn_cp_my_customers()) or public.fn_cp_staff_can(customer_id))', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Adaigi ka saboot: private bucket, path <customer_id>/<uuid>.<ext>
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-proofs', 'customer-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.fn_cp_folder_customer(p_name text)
returns uuid language plpgsql immutable set search_path = public as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then return null;
end $$;

drop policy if exists customer_proofs_own_insert on storage.objects;
create policy customer_proofs_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'customer-proofs' and public.fn_cp_folder_customer(name) = any(public.fn_cp_my_customers()));
drop policy if exists customer_proofs_read on storage.objects;
create policy customer_proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'customer-proofs' and (public.fn_cp_folder_customer(name) = any(public.fn_cp_my_customers())
         or public.fn_cp_staff_can(public.fn_cp_folder_customer(name))));
-- update/delete policy jaan boojh kar nahi.

-- ---------------------------------------------------------------
-- Gahak ke functions
-- ---------------------------------------------------------------
create or replace function public.fn_cp_pick_customer(p_customer uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[] := public.fn_cp_my_customers();
begin
  if auth.uid() is null or coalesce(cardinality(v_ids), 0) = 0 then raise exception 'Sirf apna khata -- gahak ka record nahi mila'; end if;
  if p_customer is null then return v_ids[1]; end if;
  if not (p_customer = any(v_ids)) then raise exception 'Sirf apna khata'; end if;
  return p_customer;
end $$;
revoke all on function public.fn_cp_pick_customer(uuid) from public, anon, authenticated;

create or replace function public.fn_cp_rate_ok(p_table text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from public.%I where created_by = $1 and created_at > now() - interval ''1 day''', p_table) into n using auth.uid();
  if n >= 10 then raise exception 'Aaj ki had poori (10 darkhwastein) -- kal dobara koshish karein'; end if;
end $$;
revoke all on function public.fn_cp_rate_ok(text) from public, anon, authenticated;

create or replace function public.fn_my_submit_payment_claim(p_amount numeric, p_method text, p_paid_on date,
  p_reference text default null, p_proof_path text default null, p_note text default null, p_customer uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.fn_cp_pick_customer(p_customer); v_id uuid;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  perform public.fn_cp_rate_ok('customer_payment_claims');
  if p_amount is null or p_amount <= 0 then raise exception 'Raqam zero se zyada'; end if;
  if p_paid_on is null or p_paid_on > v_today or p_paid_on < v_today - 90 then raise exception 'Tareekh: aaj ya pichhle 90 din'; end if;
  if p_proof_path is not null and public.fn_cp_folder_customer(p_proof_path) is distinct from v_c then raise exception 'Saboot sirf apne folder ka'; end if;
  insert into customer_payment_claims (customer_id, amount, method, reference, paid_on, proof_path, note, created_by)
  values (v_c, round(p_amount, 2), p_method, nullif(trim(coalesce(p_reference, '')), ''), p_paid_on, p_proof_path,
          nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.fn_my_request_change(p_field text, p_new_value text, p_customer uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.fn_cp_pick_customer(p_customer); v_id uuid; v_old text; v_new text := trim(coalesce(p_new_value, ''));
begin
  perform public.fn_cp_rate_ok('customer_change_requests');
  if v_new = '' then raise exception 'Nayi maloomat likhein'; end if;
  if p_field = 'phone' and v_new !~ '^\+?[0-9 -]{10,16}$' then raise exception 'Phone number sahi likhein'; end if;
  if p_field = 'cnic' and regexp_replace(v_new, '\D', '', 'g') !~ '^[0-9]{13}$' then raise exception 'CNIC 13 hindse'; end if;
  if p_field = 'email' and v_new !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email sahi likhein'; end if;
  if exists (select 1 from customer_change_requests r where r.customer_id = v_c and r.field = p_field and r.status in ('submitted','checked')) then
    raise exception 'Is cheez ki ek darkhwast pehle se zer-e-ghor hai';
  end if;
  select case p_field when 'address' then c.address when 'business_name' then c.business_name when 'email' then c.email
           when 'phone' then public.fn_cp_mask_phone(c.phone_number) when 'cnic' then public.fn_cp_mask_cnic(c.cnic)
           when 'contact_person' then c.contact_person end
    into v_old from customers c where c.id = v_c;
  insert into customer_change_requests (customer_id, field, old_value, new_value, created_by)
  values (v_c, p_field, v_old, v_new, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.fn_my_open_dispute(p_message text, p_ref text default null, p_customer uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.fn_cp_pick_customer(p_customer); v_id uuid;
begin
  perform public.fn_cp_rate_ok('customer_khata_disputes');
  insert into customer_khata_disputes (customer_id, ref, message, created_by)
  values (v_c, nullif(trim(coalesce(p_ref, '')), ''), trim(coalesce(p_message, '')), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.fn_my_request_promise(p_amount numeric, p_promise_date date, p_terms_version text, p_accept boolean,
  p_customer uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_c uuid := public.fn_cp_pick_customer(p_customer); v_id uuid;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  perform public.fn_cp_rate_ok('customer_promise_requests');
  if not coalesce(p_accept, false) then raise exception 'Sharaait maanna zaroori hai'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Raqam zero se zyada'; end if;
  if p_promise_date is null or p_promise_date < v_today or p_promise_date > v_today + 30 then raise exception 'Wade ki tareekh: aaj se 30 din tak'; end if;
  insert into customer_promise_requests (customer_id, amount, promise_date, terms_version, terms_accepted_at, created_by)
  values (v_c, round(p_amount, 2), p_promise_date, p_terms_version, now(), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.fn_my_requests()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ids uuid[] := public.fn_cp_my_customers();
begin
  if coalesce(cardinality(v_ids), 0) = 0 then return null; end if;
  return jsonb_build_object(
    'claims', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'amount', r.amount, 'method', r.method, 'reference', r.reference,
                'paid_on', r.paid_on, 'status', r.status, 'created_at', r.created_at, 'has_proof', r.proof_path is not null,
                'reject_reason', r.reject_reason) order by r.created_at desc) from customer_payment_claims r where r.customer_id = any(v_ids)), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'field', r.field, 'new_value', r.new_value, 'status', r.status,
                'created_at', r.created_at, 'reject_reason', r.reject_reason) order by r.created_at desc) from customer_change_requests r where r.customer_id = any(v_ids)), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'ref', r.ref, 'message', r.message, 'status', r.status,
                'created_at', r.created_at, 'staff_note', r.staff_note) order by r.created_at desc) from customer_khata_disputes r where r.customer_id = any(v_ids)), '[]'::jsonb),
    'promises', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'amount', r.amount, 'promise_date', r.promise_date, 'status', r.status,
                'created_at', r.created_at, 'reject_reason', r.reject_reason) order by r.created_at desc) from customer_promise_requests r where r.customer_id = any(v_ids)), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------
-- Staff: maker (check), checker (approve), reject, dispute
-- ---------------------------------------------------------------
create or replace function public.fn_cp_row(p_kind text, p_id uuid, out customer_id uuid, out status text, out created_by uuid, out checked_by uuid)
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'claim' then select r.customer_id, r.status, r.created_by, r.checked_by into customer_id, status, created_by, checked_by from customer_payment_claims r where r.id = p_id for update;
  elsif p_kind = 'change' then select r.customer_id, r.status, r.created_by, r.checked_by into customer_id, status, created_by, checked_by from customer_change_requests r where r.id = p_id for update;
  elsif p_kind = 'promise' then select r.customer_id, r.status, r.created_by, r.checked_by into customer_id, status, created_by, checked_by from customer_promise_requests r where r.id = p_id for update;
  else raise exception 'Ghalat qism';
  end if;
  if customer_id is null then raise exception 'Darkhwast nahi mili'; end if;
  if not public.fn_cp_staff_can(customer_id) then raise exception 'Is gahak ki ijazat nahi'; end if;
  if created_by = auth.uid() then raise exception 'Apni darkhwast khud check/approve nahi kar sakte'; end if;
end $$;
revoke all on function public.fn_cp_row(text, uuid) from public, anon, authenticated;

create or replace function public.fn_cp_check(p_kind text, p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.fn_cp_row(p_kind, p_id);
  if r.status <> 'submitted' then raise exception 'Sirf nayi darkhwast check hoti hai'; end if;
  if p_kind = 'claim' then update customer_payment_claims set status = 'checked', checked_by = auth.uid(), checked_at = now(), check_note = left(p_note, 300) where id = p_id;
  elsif p_kind = 'change' then update customer_change_requests set status = 'checked', checked_by = auth.uid(), checked_at = now(), check_note = left(p_note, 300) where id = p_id;
  else update customer_promise_requests set status = 'checked', checked_by = auth.uid(), checked_at = now(), check_note = left(p_note, 300) where id = p_id;
  end if;
end $$;

create or replace function public.fn_cp_approve(p_kind text, p_id uuid, p_finance_account uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; c record; v_res jsonb; v_today date := (now() at time zone 'Asia/Karachi')::date; v_pid uuid;
begin
  select * into r from public.fn_cp_row(p_kind, p_id);
  if r.status <> 'checked' then raise exception 'Pehle doosra banda check kare (maker), phir approve'; end if;
  if r.checked_by = auth.uid() then raise exception 'Check karne wala khud approve nahi kar sakta (maker-checker)'; end if;
  if not public.fn_cp_is_admin() then raise exception 'Approve sirf Owner / Admin / Finance'; end if;
  select * into c from customers where id = r.customer_id;

  if p_kind = 'claim' then
    declare cl record;
    begin
      select * into cl from customer_payment_claims where id = p_id;
      if p_finance_account is null then raise exception 'Cash/bank account chunein'; end if;
      -- Baqaya yahin (aur sirf yahin) badalta hai: wohi raseed jo Recovery banata hai.
      v_res := public.fn_record_recovery_money(jsonb_build_object(
        'direction', 'receive', 'partyType', 'customer', 'partyId', c.id, 'partyName', coalesce(c.name, 'Customer'),
        'amount', cl.amount, 'paymentDate', cl.paid_on, 'financeAccountId', p_finance_account, 'againstAccountCode', '1100',
        'purpose', 'Customer portal payment (' || cl.method || ')', 'billReference', cl.reference,
        'proofUrl', cl.proof_path, 'clientActionId', cl.id,
        'backdateReason', case when cl.paid_on < v_today then 'Gahak ne ' || cl.paid_on || ' ko adaigi ki (portal claim, saboot check)' end));
      update customer_payment_claims set status = 'approved', approved_by = auth.uid(), approved_at = now(), finance_account_id = p_finance_account,
             movement_id = nullif(v_res->>'id', '')::uuid, journal_entry_id = nullif(v_res->>'entryId', '')::uuid where id = p_id;
    end;
  elsif p_kind = 'change' then
    declare ch record;
    begin
      select * into ch from customer_change_requests where id = p_id;
      update customers set
        address = case when ch.field = 'address' then ch.new_value else address end,
        business_name = case when ch.field = 'business_name' then ch.new_value else business_name end,
        email = case when ch.field = 'email' then ch.new_value else email end,
        phone_number = case when ch.field = 'phone' then ch.new_value else phone_number end,
        cnic = case when ch.field = 'cnic' then ch.new_value else cnic end,
        contact_person = case when ch.field = 'contact_person' then ch.new_value else contact_person end
      where id = ch.customer_id;
      update customer_change_requests set status = 'approved', approved_by = auth.uid(), approved_at = now() where id = p_id;
    end;
  else
    declare pr record;
    begin
      select * into pr from customer_promise_requests where id = p_id;
      if pr.promise_date < v_today then raise exception 'Wade ki tareekh guzar gayi -- rad karein'; end if;
      insert into payment_promises (branch_id, party_type, party_id, promised_amount, promise_date, status, notes, created_by,
                                    approved_by, promised_days, terms_version, terms_accepted_at, terms_accepted_by, terms_channel, signature_ref)
      values (c.branch_id, 'customer', c.id, pr.amount, pr.promise_date, 'open', 'Customer portal darkhwast', auth.uid(),
              auth.uid(), case when pr.promise_date - v_today between 1 and 365 then pr.promise_date - v_today end, pr.terms_version, pr.terms_accepted_at, pr.created_by, 'verbal', 'portal:' || pr.id)
      returning id into v_pid;
      update customer_promise_requests set status = 'approved', approved_by = auth.uid(), approved_at = now(), promise_id = v_pid where id = p_id;
    end;
  end if;
  return jsonb_build_object('ok', true, 'kind', p_kind, 'id', p_id, 'entry', v_res);
end $$;

create or replace function public.fn_cp_reject(p_kind text, p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from public.fn_cp_row(p_kind, p_id);
  if r.status not in ('submitted','checked') then raise exception 'Faisla ho chuka'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Wajah likhein'; end if;
  if p_kind = 'claim' then update customer_payment_claims set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), reject_reason = left(trim(p_reason), 300) where id = p_id;
  elsif p_kind = 'change' then update customer_change_requests set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), reject_reason = left(trim(p_reason), 300) where id = p_id;
  else update customer_promise_requests set status = 'rejected', rejected_by = auth.uid(), rejected_at = now(), reject_reason = left(trim(p_reason), 300) where id = p_id;
  end if;
end $$;

create or replace function public.fn_cp_dispute_update(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare d record;
begin
  select * into d from customer_khata_disputes where id = p_id for update;
  if d.id is null then raise exception 'Darkhwast nahi mili'; end if;
  if not public.fn_cp_staff_can(d.customer_id) then raise exception 'Is gahak ki ijazat nahi'; end if;
  if d.created_by = auth.uid() then raise exception 'Apni darkhwast khud band nahi kar sakte'; end if;
  if p_status not in ('reviewed','closed') then raise exception 'Ghalat haalat'; end if;
  if length(trim(coalesce(p_note, ''))) < 3 then raise exception 'Note likhein'; end if;
  -- Sirf note -- khata kabhi yahan se nahi badalta (durusti staff ka alag, manzoor shuda tareeqa hai).
  update customer_khata_disputes set status = p_status, handled_by = auth.uid(), handled_at = now(), staff_note = left(trim(p_note), 500) where id = p_id;
end $$;

-- ---------------------------------------------------------------
-- Admin: sab gahak (scope ke andar) + checker ki line
-- ---------------------------------------------------------------
create or replace function public.fn_admin_customer_portal()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if auth.uid() is null or not (public.fn_cp_is_admin() or exists (
      select 1 from profiles p where p.id = auth.uid() and coalesce(p.is_active, false) and p.branch_id is not null
        and p.role in ('manager','sales_staff','cashier','accountant'))) then
    raise exception 'Is safhe ki ijazat nahi';
  end if;
  return coalesce((select jsonb_agg(x order by x->>'name') from (
    select jsonb_build_object('id', c.id, 'code', public.fn_cp_code(c.id), 'name', c.name, 'business_name', c.business_name,
      'farmer_code', (select f.farmer_code from farmers f where f.id = c.farmer_id),
      'branch', (select b.name from branches b where b.id = c.branch_id),
      'balance', coalesce(c.current_balance, 0), 'credit_limit', coalesce(c.credit_limit, 0),
      'has_phone', c.phone_number is not null and length(trim(c.phone_number)) > 0,
      'portal', case when c.user_id is null then 'none'
                     when exists (select 1 from auth.users u where u.id = c.user_id and u.banned_until > now())
                       or exists (select 1 from profiles p where p.id = c.user_id and not coalesce(p.is_active, true)) then 'suspended'
                     else 'active' end,
      'last_seen', (select u.last_sign_in_at from auth.users u where u.id = c.user_id),
      'pending', (select count(*) from customer_payment_claims r where r.customer_id = c.id and r.status in ('submitted','checked'))
               + (select count(*) from customer_change_requests r where r.customer_id = c.id and r.status in ('submitted','checked'))
               + (select count(*) from customer_promise_requests r where r.customer_id = c.id and r.status in ('submitted','checked'))
               + (select count(*) from customer_khata_disputes r where r.customer_id = c.id and r.status = 'open')
    ) x
    from customers c where not coalesce(c.is_deleted, false) and public.fn_cp_staff_can(c.id)) z), '[]'::jsonb);
end $$;

create or replace function public.fn_cp_queue()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Login zaroori'; end if;
  return coalesce((select jsonb_agg(q order by q->>'created_at') from (
    select jsonb_build_object('kind', 'claim', 'id', r.id, 'customer_id', r.customer_id, 'customer', c.name, 'code', public.fn_cp_code(c.id),
      'amount', r.amount, 'detail', r.method || coalesce(' · ' || r.reference, ''), 'date', r.paid_on, 'status', r.status, 'created_at', r.created_at,
      'has_proof', r.proof_path is not null, 'proof_path', r.proof_path,
      'can_check', r.status = 'submitted' and r.created_by <> v_uid,
      'can_approve', r.status = 'checked' and r.created_by <> v_uid and r.checked_by <> v_uid and public.fn_cp_is_admin()) q
      from customer_payment_claims r join customers c on c.id = r.customer_id
     where r.status in ('submitted','checked') and public.fn_cp_staff_can(r.customer_id)
    union all
    select jsonb_build_object('kind', 'change', 'id', r.id, 'customer_id', r.customer_id, 'customer', c.name, 'code', public.fn_cp_code(c.id),
      'amount', null, 'detail', r.field || ': ' || coalesce(r.old_value, '—') || ' → ' || r.new_value, 'date', (r.created_at at time zone 'Asia/Karachi')::date,
      'status', r.status, 'created_at', r.created_at, 'has_proof', false, 'proof_path', null,
      'can_check', r.status = 'submitted' and r.created_by <> v_uid,
      'can_approve', r.status = 'checked' and r.created_by <> v_uid and r.checked_by <> v_uid and public.fn_cp_is_admin())
      from customer_change_requests r join customers c on c.id = r.customer_id
     where r.status in ('submitted','checked') and public.fn_cp_staff_can(r.customer_id)
    union all
    select jsonb_build_object('kind', 'promise', 'id', r.id, 'customer_id', r.customer_id, 'customer', c.name, 'code', public.fn_cp_code(c.id),
      'amount', r.amount, 'detail', 'terms ' || r.terms_version, 'date', r.promise_date, 'status', r.status, 'created_at', r.created_at,
      'has_proof', false, 'proof_path', null,
      'can_check', r.status = 'submitted' and r.created_by <> v_uid,
      'can_approve', r.status = 'checked' and r.created_by <> v_uid and r.checked_by <> v_uid and public.fn_cp_is_admin())
      from customer_promise_requests r join customers c on c.id = r.customer_id
     where r.status in ('submitted','checked') and public.fn_cp_staff_can(r.customer_id)
    union all
    select jsonb_build_object('kind', 'dispute', 'id', r.id, 'customer_id', r.customer_id, 'customer', c.name, 'code', public.fn_cp_code(c.id),
      'amount', null, 'detail', coalesce(r.ref || ' · ', '') || r.message, 'date', (r.created_at at time zone 'Asia/Karachi')::date,
      'status', r.status, 'created_at', r.created_at, 'has_proof', false, 'proof_path', null,
      'can_check', r.created_by <> v_uid, 'can_approve', false)
      from customer_khata_disputes r join customers c on c.id = r.customer_id
     where r.status = 'open' and public.fn_cp_staff_can(r.customer_id)
  ) z), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------
-- Ijazatein: anon kuch nahi; andar ke madadgar kisi ko nahi
-- ---------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'fn_my_submit_payment_claim(numeric, text, date, text, text, text, uuid)',
    'fn_my_request_change(text, text, uuid)',
    'fn_my_open_dispute(text, text, uuid)',
    'fn_my_request_promise(numeric, date, text, boolean, uuid)',
    'fn_my_requests()',
    'fn_cp_check(text, uuid, text)',
    'fn_cp_approve(text, uuid, uuid)',
    'fn_cp_reject(text, uuid, text)',
    'fn_cp_dispute_update(uuid, text, text)',
    'fn_admin_customer_portal()',
    'fn_cp_queue()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.fn_cp_no_delete() from public, anon, authenticated;
revoke all on function public.fn_cp_locked() from public, anon, authenticated;
