-- =====================================================================
-- AgriBridge — Migration 116: Machinery, booking se paisay tak ek zanjeer
-- =====================================================================
-- Ab tak machinery_bookings ek hi qatar thi: rate, total, aur "kitna
-- mila". Us mein teen bilkul alag cheezein ek hi khane mein pari thin --
-- booking ke waqt ka andaza, kattai se pehle tay hua rate, aur kattai ke
-- baad ka asal kaam. Teenon ek hi jagah likhne ka nateeja ye hai ke agar
-- booking par 10 acre likhe the aur nikle 9.5, to bill 10 ka ban jata
-- hai -- aur ye ghalti kabhi pakRi nahi jati, kyunki 10 hi to likha tha.
--
-- Is liye teen alag khane:
--
--   BOOKING   -> estimated_rate + harvest_area     (andaza)
--   CONFIRM   -> final_rate, kisan ki tasdeeq ke baad  (mu'aahida)
--   KAAM      -> machinery_work_records ka actual area (haqeeqat)
--   BILL      -> actual area x final rate             (sirf tab bane)
--
-- Zanjeer:
--   Booking -> Advance -> Kisan ki Tasdeeq -> Machine Rawangi ->
--   Asal Kaam -> Final Bill -> Advance Adjustment -> Final Payment
--
-- Har kari apni qatar mein likhi jati hai. Ek hi qatar mein sab kuch
-- rakhne ka matlab hota ke pichli haalat mit jaye -- aur mit jane wali
-- cheez par sawal nahi poochha ja sakta.
--
-- Advance ke bare mein ek usool jo yahan nahi, ledger mein lagta hai:
-- advance AAMDANI NAHI hai. Jab tak kaam nahi hua, wo kisan ka paisa
-- hamare paas amanat hai (khata 2030). Aamdani us din banti hai jis din
-- bill banta hai. Ye farq na rakhein to mahine ka munafa us paise se
-- barh jata hai jo abhi kamaya hi nahi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Booking ki qatar -- lifecycle ke liye
-- ---------------------------------------------------------------------

-- Booking ke waqt machine tay karna lazmi nahi (spec ka faisla): us waqt
-- pata hi nahi hota kaunsi machine faarigh hogi. Pehle ye teenon NOT NULL
-- the, yani booking banane ke liye machine aur rate dono ka hona zaroori
-- tha -- aur wahin se log jhoote andaze bharne lagte hain.
alter table machinery_bookings alter column vendor_id drop not null;
alter table machinery_bookings alter column machine_id drop not null;
alter table machinery_bookings alter column rate_amount drop not null;
alter table machinery_bookings alter column total_amount drop not null;

-- Kisan / farm
alter table machinery_bookings
  add column if not exists village text,
  add column if not exists location_lat numeric(10,7),
  add column if not exists location_lng numeric(10,7),
  add column if not exists field_access text,
  add column if not exists expected_harvest_date date,
  add column if not exists preferred_date date,
  add column if not exists preferred_time text,
  add column if not exists special_instructions text;

-- Raqba: staff acre AUR kanal dono likhta hai (yahan aise hi bola jata
-- hai). Hisaab hamesha ek hi generated column se hota hai, taake koi
-- jagah kanal bhoolne par 8 guna kam bill na bana de. 1 acre = 8 kanal.
alter table machinery_bookings
  add column if not exists total_area_acres numeric(10,2),
  add column if not exists total_area_kanal numeric(10,2),
  add column if not exists harvest_area_acres numeric(10,2),
  add column if not exists harvest_area_kanal numeric(10,2);

alter table machinery_bookings
  add column if not exists total_area numeric(12,4)
    generated always as (coalesce(total_area_acres, 0) + coalesce(total_area_kanal, 0) / 8) stored,
  add column if not exists harvest_area numeric(12,4)
    generated always as (coalesce(harvest_area_acres, 0) + coalesce(harvest_area_kanal, 0) / 8) stored;

-- Machinery ki zaroorat (booking ke waqt)
alter table machinery_bookings
  add column if not exists machine_type_requested text,
  add column if not exists required_units integer not null default 1,
  add column if not exists trolley_required boolean not null default false,
  add column if not exists other_service text;

-- Rate: teen darje. 'estimated' ko kabhi bill ki bunyad na banaya jaye.
alter table machinery_bookings
  add column if not exists rate_status text not null default 'estimated',
  add column if not exists estimated_rate numeric(12,2),
  add column if not exists final_rate numeric(12,2);

-- Kisan ki tasdeeq -- aur us ka asal jawab, jaisa aaya waisa.
alter table machinery_bookings
  add column if not exists rate_confirmation_sent_at timestamptz,
  add column if not exists rate_confirmation_sent_by uuid references auth.users(id),
  add column if not exists rate_confirmation_rate numeric(12,2),
  add column if not exists farmer_confirmed_at timestamptz,
  add column if not exists farmer_confirmation_channel text,
  add column if not exists farmer_confirmation_response text,
  add column if not exists confirmation_override_by uuid references auth.users(id),
  add column if not exists confirmation_override_reason text,
  add column if not exists confirmation_override_evidence_url text;

alter table machinery_bookings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id),
  add column if not exists cancellation_reason text,
  add column if not exists closed_at timestamptz;

update machinery_bookings set status = 'new' where status = 'pending';
alter table machinery_bookings alter column status set default 'new';

-- Purani rok jo table ke sath hi bani thi: sirf pending/confirmed/
-- in_progress/completed/cancelled. Naye darje isi par atak jate hain.
-- Ise hataye baghair upar wali nayi rok bekaar hai -- Postgres saari
-- checks lagata hai, sab se narm wali nahi.
alter table machinery_bookings drop constraint if exists machinery_bookings_status_check;

alter table machinery_bookings drop constraint if exists chk_machinery_status;
alter table machinery_bookings add constraint chk_machinery_status check (
  status in ('new', 'confirmed', 'scheduled', 'machine_assigned', 'ready_for_harvest',
             'in_progress', 'completed', 'bill_pending', 'payment_pending', 'closed', 'cancelled')
);

alter table machinery_bookings drop constraint if exists chk_machinery_rate_status;
alter table machinery_bookings add constraint chk_machinery_rate_status check (
  rate_status in ('estimated', 'agreed', 'final')
);

alter table machinery_bookings drop constraint if exists chk_machinery_field_access;
alter table machinery_bookings add constraint chk_machinery_field_access check (
  field_access is null or field_access in ('easy', 'medium', 'difficult')
);

alter table machinery_bookings drop constraint if exists chk_machinery_preferred_time;
alter table machinery_bookings add constraint chk_machinery_preferred_time check (
  preferred_time is null or preferred_time in ('morning', 'afternoon', 'evening', 'any')
);

alter table machinery_bookings drop constraint if exists chk_machinery_units;
alter table machinery_bookings add constraint chk_machinery_units check (required_units >= 1);

-- Override adhoora nahi ho sakta. "Manager ne keh diya tha" koi record
-- nahi hai; kaun, kyun, aur saboot -- teenon ek sath ya bilkul nahi.
alter table machinery_bookings drop constraint if exists chk_machinery_override;
alter table machinery_bookings add constraint chk_machinery_override check (
  (confirmation_override_by is null and confirmation_override_reason is null and confirmation_override_evidence_url is null)
  or (confirmation_override_by is not null
      and length(btrim(coalesce(confirmation_override_reason, ''))) >= 10
      and length(btrim(coalesce(confirmation_override_evidence_url, ''))) > 0)
);

-- Cancel bhi ek alag, likha hua faisla hai -- chup chaap ghayab hona
-- nahi.
alter table machinery_bookings drop constraint if exists chk_machinery_cancel;
alter table machinery_bookings add constraint chk_machinery_cancel check (
  status <> 'cancelled'
  or (cancelled_at is not null and length(btrim(coalesce(cancellation_reason, ''))) >= 5)
);

create index if not exists idx_machinery_bookings_status on machinery_bookings(status);
create index if not exists idx_machinery_bookings_farmer on machinery_bookings(farmer_id, booking_date desc);

-- ---------------------------------------------------------------------
-- 2) Booking ki timeline -- kis ne kya kiya, kab
-- ---------------------------------------------------------------------
create table if not exists machinery_booking_events (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references machinery_bookings(id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  note text,
  evidence_url text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_machinery_events_booking on machinery_booking_events(booking_id, created_at);

-- ---------------------------------------------------------------------
-- 3) Paise -- advance aur final, dono yahan
-- ---------------------------------------------------------------------
-- Ek hi qatar dono ke liye, kyunki dono ek hi cheez hain: kisan se aaya
-- hua paisa. Farq sirf waqt ka hai (kaam se pehle ya baad), aur wo `kind`
-- batata hai. Split payment ke liye ek hi booking par kai qataren.
create table if not exists machinery_payments (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references machinery_bookings(id) on delete restrict,
  kind text not null,
  amount numeric(14,2) not null,
  method text not null,
  finance_account_id uuid references finance_accounts(id),
  payment_date date not null default current_date,
  reference text,
  evidence_url text,
  received_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_machinery_payments_booking on machinery_payments(booking_id, created_at);

alter table machinery_payments drop constraint if exists chk_machinery_payment_kind;
alter table machinery_payments add constraint chk_machinery_payment_kind check (kind in ('advance', 'final'));

alter table machinery_payments drop constraint if exists chk_machinery_payment_amount;
alter table machinery_payments add constraint chk_machinery_payment_amount check (amount > 0);

alter table machinery_payments drop constraint if exists chk_machinery_payment_method;
alter table machinery_payments add constraint chk_machinery_payment_method check (
  method in ('cash', 'bank', 'wallet', 'khata', 'other')
);

-- Khata ke ilawa har paisay ka koi na koi khata hona chahiye, warna wo
-- paisa aa to gaya magar kahin pahuncha nahi. Khata udhaar hai -- us ka
-- rukh kisan ke apne khate ki taraf hai, kisi cash box ki taraf nahi.
alter table machinery_payments drop constraint if exists chk_machinery_payment_account;
alter table machinery_payments add constraint chk_machinery_payment_account check (
  method = 'khata' or finance_account_id is not null
);

-- ---------------------------------------------------------------------
-- 4) Machine ki rawangi
-- ---------------------------------------------------------------------
create table if not exists machinery_dispatches (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references machinery_bookings(id) on delete restrict,
  machine_id uuid references machinery_vendor_machines(id),
  operator_name text,
  driver_phone text,
  departure_at timestamptz not null default now(),
  opening_meter numeric(12,2),
  closing_meter numeric(12,2),
  fuel_litres numeric(10,2),
  fuel_amount numeric(12,2),
  destination_address text,
  destination_lat numeric(10,7),
  destination_lng numeric(10,7),
  returned_at timestamptz,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_machinery_dispatch_booking on machinery_dispatches(booking_id);
create index if not exists idx_machinery_dispatch_machine on machinery_dispatches(machine_id, departure_at desc);

alter table machinery_dispatches drop constraint if exists chk_machinery_meter;
alter table machinery_dispatches add constraint chk_machinery_meter check (
  closing_meter is null or opening_meter is null or closing_meter >= opening_meter
);

-- ---------------------------------------------------------------------
-- 5) Asal kaam -- kattai ke baad
-- ---------------------------------------------------------------------
-- Bill isi qatar se banta hai, booking se nahi. Yehi wo jagah hai jahan
-- 10 acre ka andaza 9.5 acre ki haqeeqat ban jata hai.
create table if not exists machinery_work_records (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references machinery_bookings(id) on delete restrict,
  actual_area_acres numeric(10,2),
  actual_area_kanal numeric(10,2),
  actual_area numeric(12,4)
    generated always as (coalesce(actual_area_acres, 0) + coalesce(actual_area_kanal, 0) / 8) stored,
  started_at timestamptz,
  finished_at timestamptz,
  meter_reading numeric(12,2),
  completion_photo_url text,
  location_lat numeric(10,7),
  location_lng numeric(10,7),
  farmer_confirmed boolean not null default false,
  farmer_confirmation_note text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_machinery_work_booking on machinery_work_records(booking_id);

alter table machinery_work_records drop constraint if exists chk_machinery_work_area;
alter table machinery_work_records add constraint chk_machinery_work_area check (
  coalesce(actual_area_acres, 0) + coalesce(actual_area_kanal, 0) / 8 > 0
);

alter table machinery_work_records drop constraint if exists chk_machinery_work_time;
alter table machinery_work_records add constraint chk_machinery_work_time check (
  started_at is null or finished_at is null or finished_at >= started_at
);

-- ---------------------------------------------------------------------
-- 6) Final bill
-- ---------------------------------------------------------------------
create table if not exists machinery_bill_counters (
  year integer primary key,
  last_number integer not null default 0
);

create table if not exists machinery_bills (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references machinery_bookings(id) on delete restrict,
  bill_number text not null unique,
  bill_date date not null default current_date,
  actual_area numeric(12,4) not null,
  rate_amount numeric(12,2) not null,
  gross_amount numeric(14,2) not null,
  advance_adjusted numeric(14,2) not null default 0,
  previous_payment numeric(14,2) not null default 0,
  balance_payable numeric(14,2) not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_machinery_bill_booking on machinery_bills(booking_id);

alter table machinery_bills drop constraint if exists chk_machinery_bill_gross;
alter table machinery_bills add constraint chk_machinery_bill_gross check (
  round(gross_amount, 2) = round(actual_area * rate_amount, 2)
);

-- Balance hisaab se nikalta hai, haath se nahi. Ye wahi jagah hai jahan
-- "adjust kar dete hain" shuru hota: bill mein Rs 20,000 ka advance likh
-- kar balance mein na ghatana kisi ko nazar nahi aata.
alter table machinery_bills drop constraint if exists chk_machinery_bill_balance;
alter table machinery_bills add constraint chk_machinery_bill_balance check (
  round(balance_payable, 2) = round(gross_amount - advance_adjusted - previous_payment, 2)
);

alter table machinery_bills drop constraint if exists chk_machinery_bill_positive;
alter table machinery_bills add constraint chk_machinery_bill_positive check (
  actual_area > 0 and rate_amount > 0 and advance_adjusted >= 0 and previous_payment >= 0
);

-- ---------------------------------------------------------------------
-- 7) Taale
-- ---------------------------------------------------------------------

-- Maali record mitaya nahi jata (106 ka wahi usool, wahi function).
drop trigger if exists trg_no_delete_machinery_payments on machinery_payments;
create trigger trg_no_delete_machinery_payments
  before delete on machinery_payments
  for each row execute function fn_no_financial_delete();

drop trigger if exists trg_no_delete_machinery_bills on machinery_bills;
create trigger trg_no_delete_machinery_bills
  before delete on machinery_bills
  for each row execute function fn_no_financial_delete();

-- Timeline gawah hai. Gawah ka bayan badla ja sake to wo gawah nahi raha.
create or replace function fn_no_machinery_event_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Booking ki timeline badli ya mitayi nahi ja sakti.';
end;
$$;

drop trigger if exists trg_no_change_machinery_events on machinery_booking_events;
create trigger trg_no_change_machinery_events
  before update or delete on machinery_booking_events
  for each row execute function fn_no_machinery_event_change();

-- ---------------------------------------------------------------------
-- Sunehri usool, database mein.
--
-- Code mein rakhne ka matlab hota: jis din koi doosra raasta banega
-- (script, dashboard, seedha SQL), us din rok saath nahi jayegi.
-- ---------------------------------------------------------------------
create or replace function fn_machinery_booking_guard()
returns trigger
language plpgsql
as $$
declare
  v_confirmed boolean;
  v_balance numeric(14,2);
begin
  -- Kisan ki tasdeeq -- ya us ki jagah likha hua, saboot wala override.
  v_confirmed := new.farmer_confirmed_at is not null or new.confirmation_override_by is not null;

  -- 1) Final rate sirf tasdeeq ke baad.
  if new.rate_status = 'final' and not v_confirmed then
    raise exception 'Rate "final" tab tak nahi ho sakta jab tak kisan tasdeeq na kare. Manager override ke liye wajah aur saboot dena hoga.';
  end if;

  -- 2) Kattai ki taraf koi qadam bhi tasdeeq ke baghair nahi.
  if new.status in ('ready_for_harvest', 'in_progress', 'completed', 'bill_pending', 'payment_pending', 'closed')
     and not v_confirmed then
    raise exception 'Kisan ki tasdeeq ke baghair booking "%" tak nahi ja sakti.', new.status;
  end if;

  if tg_op = 'UPDATE' then
    -- 3) Tasdeeq ke baad rate wahi rehta hai jis par kisan raazi hua.
    --    Badalna ho to tasdeeq dobara leni paRegi -- yani pehle wo saaf
    --    ho, phir naya rate, phir naya jawab.
    if old.farmer_confirmed_at is not null
       and new.farmer_confirmed_at is not null
       and new.final_rate is distinct from old.final_rate then
      raise exception 'Kisan ki tasdeeq ke baad rate nahi badla ja sakta. Naya rate bhejna ho to tasdeeq dobara leni hogi.';
    end if;

    -- 4) Balance baqi ho to booking band nahi hoti. Band ho jaye to wo
    --    raqam kisi report mein nahi aati -- aur jo nazar na aaye, wo
    --    kabhi wasool nahi hoti.
    if new.status = 'closed' and old.status is distinct from 'closed' then
      select b.balance_payable
             - coalesce((select sum(p.amount) from machinery_payments p
                          where p.booking_id = new.id and p.kind = 'final'), 0)
        into v_balance
        from machinery_bills b where b.booking_id = new.id;

      if v_balance is null then
        raise exception 'Bill banaye baghair booking band nahi ki ja sakti.';
      end if;
      if round(v_balance, 2) > 0 then
        raise exception 'Booking band nahi ho sakti: Rs % abhi baqi hai.', round(v_balance, 2);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_machinery_booking_guard on machinery_bookings;
create trigger trg_machinery_booking_guard
  before insert or update on machinery_bookings
  for each row execute function fn_machinery_booking_guard();

-- Bill sirf asal kaam par banta hai -- andaze par nahi.
create or replace function fn_machinery_bill_guard()
returns trigger
language plpgsql
as $$
declare
  v_actual numeric(12,4);
  v_advance numeric(14,2);
begin
  select w.actual_area into v_actual from machinery_work_records w where w.booking_id = new.booking_id;
  if v_actual is null then
    raise exception 'Bill se pehle asal kaam darj karein (kitne acre waqai kaate gaye).';
  end if;
  if round(new.actual_area, 4) <> round(v_actual, 4) then
    raise exception 'Bill ka raqba asal kaam se mel nahi khata (% ke muqable %).', new.actual_area, v_actual;
  end if;

  -- Advance jitna aaya, utna hi bill mein katna chahiye. Kam katna
  -- matlab kisan se dobara wasooli; ziyada katna matlab apna nuqsan.
  select coalesce(sum(p.amount), 0) into v_advance
    from machinery_payments p where p.booking_id = new.booking_id and p.kind = 'advance';

  if round(new.advance_adjusted, 2) <> round(least(v_advance, new.gross_amount), 2) then
    raise exception 'Advance ka adjustment ghalat hai: advance Rs % mila tha, bill mein Rs % kata gaya.',
      round(v_advance, 2), round(new.advance_adjusted, 2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_machinery_bill_guard on machinery_bills;
create trigger trg_machinery_bill_guard
  before insert or update on machinery_bills
  for each row execute function fn_machinery_bill_guard();

-- ---------------------------------------------------------------------
-- 8) RLS -- 115 wali hi fehrist, wahi ek fehrist
-- ---------------------------------------------------------------------
alter table machinery_booking_events enable row level security;
alter table machinery_payments enable row level security;
alter table machinery_dispatches enable row level security;
alter table machinery_work_records enable row level security;
alter table machinery_bills enable row level security;
alter table machinery_bill_counters enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['machinery_booking_events', 'machinery_payments', 'machinery_dispatches',
                               'machinery_work_records', 'machinery_bills', 'machinery_bill_counters'])
  loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_create', t);
    execute format('drop policy if exists %I on %I', t || '_edit', t);
    execute format('create policy %I on %I for select using (fn_is_any_staff() or fn_can_machinery(''view''))',
                   t || '_read', t);
    execute format('create policy %I on %I for insert with check (fn_can_machinery(''create''))',
                   t || '_create', t);
    execute format('create policy %I on %I for update using (fn_can_machinery(''edit'')) with check (fn_can_machinery(''edit''))',
                   t || '_edit', t);
  end loop;
end $$;

-- Vendor apni rawangi aur apni booking ka kaam dekh sake.
drop policy if exists machinery_dispatches_vendor_read on machinery_dispatches;
create policy machinery_dispatches_vendor_read on machinery_dispatches for select using (
  machine_id in (
    select m.id from machinery_vendor_machines m
    join machinery_vendors v on v.id = m.vendor_id
    where v.user_id = auth.uid()
  )
);
