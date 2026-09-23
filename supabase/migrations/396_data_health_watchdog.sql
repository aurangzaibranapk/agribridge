-- Data Health Watchdog (Stage 1) -- malik ka apna "secretary" jo poore
-- business ko dekhta hai aur masla khud dhoondh kar batata hai.
--
-- 13 September ki session mein jitni bhi ghaltiyan mili (machinery ka
-- dobara payout, gum shuda purchase qatar, stock ka farq, Faysal Bank ka
-- gum shuda jama) -- in sab ka ek jaisa qaida tha: koi bhi khud check
-- nahi kar raha tha jab tak malik khud na poochta. Ye watchdog wahi
-- checks khud, roz, chalata hai.
--
-- USOOL: koi bhi cheez khud theek NAHI hoti. Ye sirf DHOONDH kar batata
-- hai -- fix hamesha ek insaan ki "haan" ke baad, alag se hota hai.

create table if not exists data_health_findings (
  id uuid primary key default gen_random_uuid(),
  finding_type text not null,
  department text not null check (department in ('finance', 'inventory', 'machinery', 'hr', 'farmers', 'milk', 'admin')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  title text not null,
  description text not null,
  related_table text,
  related_id uuid,
  related_label text,
  amount numeric(14, 2),
  status text not null default 'open' check (status in ('open', 'sent_to_claude', 'dismissed', 'resolved')),
  -- Ek hi masla dobara na bane -- roz scan chalta hai, isi masle ko
  -- dobara insert karne ke bajaye ye check karta hai ke pehle se khula
  -- hua hai ya nahi.
  dedupe_key text not null unique,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  resolution_note text
);

create index if not exists idx_data_health_findings_status on data_health_findings(status);
create index if not exists idx_data_health_findings_department on data_health_findings(department);

alter table data_health_findings enable row level security;

drop policy if exists "Staff can view data health findings" on data_health_findings;
create policy "Staff can view data health findings"
  on data_health_findings for select
  using (fn_is_any_staff());

drop policy if exists "Staff can update data health findings" on data_health_findings;
create policy "Staff can update data health findings"
  on data_health_findings for update
  using (fn_is_any_staff())
  with check (fn_is_any_staff());

-- Yehi qaida jo anomaly_findings (114) mein hai: masla mitaya nahi ja
-- sakta, sirf dekh kar band kiya ja sakta hai, aur "dekh liya" likhne ke
-- liye wajah zaroori hai -- warna "dekh liya" aur "kabhi dekha hi nahi"
-- ek jaisi qatarein reh jatin.
create or replace function fn_data_health_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Ye masla mitaya nahi ja sakta — dekh kar band kiya ja sakta hai.';
  end if;
  if old.status <> 'open' and new.status = old.status
     and new.resolution_note is not distinct from old.resolution_note then
    -- koi tabdeeli nahi -- rok ki zaroorat nahi
    return new;
  end if;
  if new.status <> 'open' and (new.resolution_note is null or length(btrim(new.resolution_note)) < 5 or new.resolved_by is null) then
    raise exception 'Band karne ki wajah likhna zaroori hai (kam az kam 5 harf).';
  end if;
  if new.dedupe_key is distinct from old.dedupe_key
     or new.amount is distinct from old.amount
     or new.finding_type is distinct from old.finding_type then
    raise exception 'Saboot badla nahi ja sakta — sirf faisla likha ja sakta hai.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_data_health_guard on data_health_findings;
create trigger trg_data_health_guard
  before update or delete on data_health_findings
  for each row execute function fn_data_health_guard();

-- =====================================================================
-- Scan function -- yahan naye checks aage jorte jayenge
-- =====================================================================
create or replace function fn_data_health_scan()
returns table(inserted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  -- 1) Machinery: vendor ne farmer se seedha collect kiya HO aur usi
  --    booking par company ne bhi alag se cash/bank payout diya ho --
  --    yehi wo ghalati thi jo MB-2026-00008 mein 32000 dobara nikal
  --    gaye.
  for r in
    select mb.id as booking_id, mb.booking_number, je.entry_number, jl.debit as amount
    from machinery_payments mp
    join machinery_bookings mb on mb.id = mp.booking_id
    join journal_entries je on je.source_module = 'machinery_vendor_payout' and je.source_id = mb.id
    join journal_lines jl on jl.entry_id = je.id and jl.account_code in ('1000', '1010', '1011', '1012', '1013', '1014')
    where mp.method = 'vendor_collected'
      and coalesce(je.is_reversal, false) = false
      and not exists (
        select 1 from journal_entries r2
        where r2.reversal_of = je.id
      )
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, related_table, related_id, related_label, amount, dedupe_key)
    values (
      'machinery_double_payout', 'machinery', 'high',
      'Vendor ko dobara payout ho sakta hai',
      format('Booking %s mein farmer ne vendor ko seedha paisa diya tha, magar isi booking par cash/bank se bhi alag payout (%s) darj hai -- dobara adaigi ho sakti hai.', r.booking_number, r.entry_number),
      'machinery_bookings', r.booking_id, r.booking_number, r.amount,
      'machinery_double_payout:' || r.booking_id::text
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  -- 2) Machinery: booking table ka apna total us ki bill se mel nahi
  --    khata -- jaisa MB-2026-00005 mein rakba theek hua magar booking
  --    ki purani raqam reh gayi thi.
  for r in
    select mb.id as booking_id, mb.booking_number, mb.total_amount, (bl.gross_amount - bl.discount_amount) as bill_net
    from machinery_bookings mb
    join machinery_bills bl on bl.booking_id = mb.id and bl.cancelled_at is null
    where round(coalesce(mb.total_amount, 0)::numeric, 2) <> round((bl.gross_amount - bl.discount_amount)::numeric, 2)
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, related_table, related_id, related_label, amount, dedupe_key)
    values (
      'machinery_booking_bill_mismatch', 'machinery', 'medium',
      'Booking ka total bill se mel nahi khata',
      format('Booking %s ka apna total Rs %s hai, magar us ki bill Rs %s dikhati hai.', r.booking_number, r.total_amount, round(r.bill_net, 2)),
      'machinery_bookings', r.booking_id, r.booking_number, r.bill_net - coalesce(r.total_amount, 0),
      'machinery_booking_bill_mismatch:' || r.booking_id::text
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  -- 3) Stock: godam ki ginti (batch ki asal qeemat par) aur ledger ka
  --    khata 1200/1210/1220 -- Rs5 se zyada farq.
  declare
    v_stock_ledger numeric;
    v_stock_batches numeric;
    v_diff numeric;
  begin
    select coalesce(sum(debit) - sum(credit), 0) into v_stock_ledger
    from journal_lines where account_code in ('1200', '1210', '1220');

    select coalesce(sum(remaining_quantity * unit_cost), 0) into v_stock_batches
    from stock_batches;

    v_diff := round(v_stock_batches - v_stock_ledger, 2);
    if abs(v_diff) > 5 then
      insert into data_health_findings (finding_type, department, severity, title, description, amount, dedupe_key)
      values (
        'stock_ledger_mismatch', 'inventory', 'high',
        'Godam ki ginti aur ledger ka khata barabar nahi',
        format('Godam ki ginti (batch qeemat par): Rs %s. Ledger ka khata 1200: Rs %s. Farq: Rs %s.', round(v_stock_batches, 2), round(v_stock_ledger, 2), v_diff),
        v_diff,
        'stock_ledger_mismatch:' || to_char(current_date, 'YYYY-MM-DD')
      )
      on conflict (dedupe_key) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end;

  -- 4) Koi bhi cash/bank khata manfi ho gaya ho.
  for r in
    select g.code, g.name, round(sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)), 2) as balance
    from journal_lines jl
    join gl_accounts g on g.code = jl.account_code
    where g.code in ('1000', '1010', '1011', '1012', '1013', '1014', '1018')
    group by g.code, g.name
    having sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)) < -1
  loop
    insert into data_health_findings (finding_type, department, severity, title, description, amount, dedupe_key)
    values (
      'negative_cash_account', 'finance', 'high',
      format('%s ka balance manfi hai', r.name),
      format('%s (khata %s) ka balance Rs %s hai -- manfi.', r.name, r.code, r.balance),
      r.balance,
      'negative_cash_account:' || r.code || ':' || to_char(current_date, 'YYYY-MM-DD')
    )
    on conflict (dedupe_key) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return query select v_count;
end;
$$;

-- =====================================================================
-- Feature registration -- data-driven sidebar/dashboard
-- =====================================================================
insert into features (key, label, label_en, label_ur, route, icon, is_sensitive, description, is_active)
values (
  'system.data_health', 'Data Health', 'Data Health', 'Data Health',
  '/admin/data-health', 'ShieldAlert', true,
  'Poore business ka khud-kaar jaanch -- ghaltiyan khud dhoondh kar dikhata hai, koi bhi khud theek nahi karta.',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, description = excluded.description, is_active = true;

-- Har department ke apne dashboard mein bhi -- malik ka kehna: "sab
-- departments ko ye dikhega". Ek hi safha, sab jagah se pahunch.
insert into dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('master', 'system.data_health', 1, 'OVERVIEW', 1),
  ('finance', 'system.data_health', 1, 'OVERVIEW', 1),
  ('machinery', 'system.data_health', 1, 'OVERVIEW', 1),
  ('inventory', 'system.data_health', 1, 'OVERVIEW', 1),
  ('hr', 'system.data_health', 1, 'OVERVIEW', 1),
  ('admin', 'system.data_health', 1, 'OVERVIEW', 1)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order;

-- Har department ka apna role is safhe ko dekh sake -- fix karna abhi
-- bhi hamesha alag manzoori maangta hai, ye sirf DEKHNE ki ijazat hai.
insert into role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('finance', 'system.data_health', array['view']::text[], 'all'),
  ('machinery', 'system.data_health', array['view']::text[], 'all'),
  ('hr', 'system.data_health', array['view']::text[], 'all'),
  ('milk_collection', 'system.data_health', array['view']::text[], 'all'),
  ('warehouse', 'system.data_health', array['view']::text[], 'all'),
  ('procurement', 'system.data_health', array['view']::text[], 'all'),
  ('manager', 'system.data_health', array['view']::text[], 'all'),
  ('admin', 'system.data_health', array['view','edit']::text[], 'all'),
  ('owner', 'system.data_health', array['view','edit']::text[], 'all'),
  ('super_admin', 'system.data_health', array['view','edit']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

-- =====================================================================
-- Feature help -- "Feature poora hai" ka usool: koi bhi naya safha
-- apni feature_help ke bagair adhoora hai.
-- =====================================================================
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'system.data_health', 'rm',
  'Poore business ki roz khud-kaar jaanch -- dobara payment, gum shuda stock qatar, ledger ka farq waghera khud dhoondh kar batata hai. Koi bhi cheez khud theek nahi hoti, sirf DHOONDH kar batata hai.',
  'Har department apna hissa dekh sakta hai (Finance, Machinery, Inventory, HR waghera). Faisla (Claude ko bhejna / theek ho gaya / chhoड़ dena) sirf Admin, Owner, ya Super Admin kar sakte hain.',
  'Roz subah check karein, ya jab bhi kisi hisaab mein shak ho ke kuch farq hai.',
  array[
    '"Abhi dekhein" dabayein -- naye masle turant dhoondh kar dikha dega.',
    'Har masle ka department, tafseel aur (agar hai to) raqam dikhti hai.',
    'Teen faisle: "Claude ko bhej do check karne" (agli Claude Code session mein utha kar theek karwayein), "Theek ho gaya" (khud fix kar chuke hain), ya "Theek hai, chhoड़ do" (jaan boojh kar aisa hai, masla nahi).',
    'Har faisle ke sath wajah likhna zaroori hai -- "dekh liya" likh dena aur kuch na dekhna, dono ek jaise nazar aate hain.'
  ],
  'Jo masle "Claude ko bhej do" mark hue hon, unhein agli Claude Code session ki shuruaat mein khud bata dein -- ye khud kisi ko notify nahi karta.',
  array[
    'Ye safha khud kuch theek nahi karta -- agar koi soche ke "dikha diya matlab theek ho gaya", to asal ghalati waisi hi reh jati hai.',
    'Bina wajah likhe "chhoड़ do" dabana -- agli baar koi nahi bata sakega ke ye jaan boojh kar chhoड़a tha ya bhool gaye.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;
