-- =====================================================================
-- AgriBridge — Migration 717: POS cash custody chain
-- =====================================================================
-- Har dukan, shift band hote hi:
--   (a) Staff copy — jama karne wala rakhta hai, dastakhat + system
--       mein raqam confirm.
--   (b) Jama copy — cash ke sath jati hai.
--
-- Sales ke baad har qadam (bheja, wasoli, bank jama, Finance verify)
-- zimmedar aur waqt ke sath. 1 din mein jama + verify na ho to Admin,
-- Super Admin aur Owner ko in-app alert, timeline ke sath.
--
-- Wasoli ka qanoon (cash_handovers receive) yahan NAHI badla. Ye
-- sirf us qadam ko packet ki timeline par likhta hai.
--
-- Live par tab tak mat chalayein jab tak backup verify na ho.
-- Pehle Testing. Rollback: 717_pos_cash_custody_chain.rollback.sql

alter table public.pos_collection_deposits
  add column if not exists submitted_by uuid references public.profiles(id);

comment on column public.pos_collection_deposits.submitted_by is
  'Jis login ne deposit darj ki. staff_id outstanding kis sales staff ka hai — manager kisi aur ki shift jama karaye to dono alag rehte hain.';

update public.pos_collection_deposits
   set submitted_by = staff_id
 where submitted_by is null;

-- ---------------------------------------------------------------------
-- Packet: ek band shift ki physical cash, jab tak bank verify na ho
-- ---------------------------------------------------------------------
create table if not exists public.cash_custody_slip_counters (
  year int primary key,
  last_number int not null default 0
);

create table if not exists public.cash_custody_packets (
  id uuid primary key default uuid_generate_v4(),
  shift_id uuid not null unique references public.pos_shifts(id),
  shop_id uuid references public.shops(id),
  branch_id uuid references public.branches(id),
  counter_id uuid references public.pos_counters(id),
  origin_profile_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  opened_at timestamptz not null,
  status text not null default 'with_sales'
    check (status in ('with_sales', 'in_transit', 'with_holder', 'deposit_pending', 'verified')),
  current_holder_id uuid references public.profiles(id),
  holder_since timestamptz not null,
  staff_copy_number text not null unique,
  deposit_copy_number text not null unique,
  staff_confirmed_at timestamptz,
  staff_confirmed_by uuid references public.profiles(id),
  staff_signature text,
  staff_confirmed_amount numeric(14,2),
  staff_confirm_note text,
  latest_handover_id uuid references public.cash_handovers(id),
  deposit_id uuid references public.pos_collection_deposits(id),
  verified_at timestamptz,
  alerted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_custody_packet_verified check (status <> 'verified' or verified_at is not null)
);

comment on table public.cash_custody_packets is
  'POS band hone ke baad cash kis silsile mein hai: kahan se aayi, ab kis ke paas, kab verify hui. Ledger ka balance nahi — wo v_cash_custody hai.';

create table if not exists public.cash_custody_hops (
  id uuid primary key default uuid_generate_v4(),
  packet_id uuid not null references public.cash_custody_packets(id),
  seq int not null,
  kind text not null check (kind in (
    'pos_close', 'sent', 'carrier_confirmed', 'wasoli', 'staff_copy_confirmed',
    'deposit_submitted', 'deposit_verified', 'deposit_rejected', 'returned'
  )),
  holder_id uuid references public.profiles(id),
  from_profile_id uuid references public.profiles(id),
  to_profile_id uuid references public.profiles(id),
  handover_id uuid references public.cash_handovers(id),
  deposit_id uuid references public.pos_collection_deposits(id),
  amount numeric(14,2),
  note text,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  unique (packet_id, seq)
);

create index if not exists idx_custody_packets_open
  on public.cash_custody_packets (opened_at)
  where verified_at is null;

create index if not exists idx_custody_hops_packet
  on public.cash_custody_hops (packet_id, seq);

create unique index if not exists uq_custody_hop_handover_kind
  on public.cash_custody_hops (handover_id, kind)
  where handover_id is not null;

create unique index if not exists uq_custody_hop_deposit_kind
  on public.cash_custody_hops (deposit_id, kind)
  where deposit_id is not null;

create unique index if not exists uq_custody_staff_confirm_hop
  on public.cash_custody_hops (packet_id)
  where kind = 'staff_copy_confirmed';

create unique index if not exists uq_custody_pos_close_hop
  on public.cash_custody_hops (packet_id)
  where kind = 'pos_close';

alter table public.cash_handovers
  add column if not exists custody_packet_id uuid references public.cash_custody_packets(id);

comment on column public.cash_handovers.custody_packet_id is
  'Manager ke wasoli ke baad agli handover isi packet se judi hai. Pehli bhejne wali shift.cash_handover_id se bhi milti hai.';

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.fn_cash_custody_span(p_start timestamptz, p_end timestamptz)
returns text
language plpgsql
stable
as $$
declare
  secs numeric;
  mins int;
  hours int;
  days int;
begin
  if p_start is null then
    return '—';
  end if;
  secs := extract(epoch from (coalesce(p_end, now()) - p_start));
  if secs < 0 then
    return '—';
  end if;
  mins := floor(secs / 60)::int;
  if mins < 1 then
    return '1 minute se kam';
  end if;
  if mins < 60 then
    return mins::text || ' minute';
  end if;
  hours := floor(mins / 60)::int;
  mins := mins % 60;
  if hours < 48 then
    if mins = 0 then
      return hours::text || ' ghante';
    end if;
    return hours::text || ' ghante ' || mins::text || ' minute';
  end if;
  days := floor(hours / 24)::int;
  hours := hours % 24;
  if hours = 0 then
    return days::text || ' din';
  end if;
  return days::text || ' din ' || hours::text || ' ghante';
end $$;

create or replace function public.fn_cash_custody_kind_label(p_kind text)
returns text
language sql
immutable
as $$
  select case p_kind
    when 'pos_close' then 'POS band'
    when 'sent' then 'raaste mein'
    when 'carrier_confirmed' then 'carrier tasdeeq'
    when 'wasoli' then 'wasoli'
    when 'staff_copy_confirmed' then 'staff copy confirm'
    when 'deposit_submitted' then 'bank jama, tasdeeq baqi'
    when 'deposit_verified' then 'Finance ne verify kiya'
    when 'deposit_rejected' then 'jama radd'
    when 'returned' then 'jama radd ke baad wapas'
    else p_kind
  end
$$;

create or replace function public.fn_cash_custody_hop(
  p_packet uuid,
  p_kind text,
  p_holder uuid,
  p_from uuid,
  p_to uuid,
  p_handover uuid,
  p_deposit uuid,
  p_amount numeric,
  p_note text,
  p_at timestamptz,
  p_close_previous boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  perform 1 from public.cash_custody_packets where id = p_packet for update;
  if p_close_previous then
    update public.cash_custody_hops
       set ended_at = p_at
     where packet_id = p_packet
       and ended_at is null
       and kind in ('pos_close', 'sent', 'wasoli', 'deposit_submitted', 'returned');
  end if;
  select coalesce(max(seq), 0) + 1 into v_seq
    from public.cash_custody_hops
   where packet_id = p_packet;
  insert into public.cash_custody_hops (
    packet_id, seq, kind, holder_id, from_profile_id, to_profile_id,
    handover_id, deposit_id, amount, note, started_at
  ) values (
    p_packet, v_seq, p_kind, p_holder, p_from, p_to,
    p_handover, p_deposit, p_amount, p_note, p_at
  );
end $$;

create or replace function public.fn_cash_custody_open_shift(p_shift uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_year int;
  v_next int;
  v_num text;
  v_id uuid;
  v_at timestamptz;
begin
  select id into v_id from public.cash_custody_packets where shift_id = p_shift;
  if v_id is not null then
    return v_id;
  end if;

  select sh.id, sh.staff_id, sh.counted_cash, sh.closed_at, sh.counter_id, sh.status,
         c.shop_id, c.branch_id
    into s
    from public.pos_shifts sh
    join public.pos_counters c on c.id = sh.counter_id
   where sh.id = p_shift;

  if not found or s.status <> 'closed' or coalesce(s.counted_cash, 0) <= 0 or s.staff_id is null then
    return null;
  end if;

  v_at := coalesce(s.closed_at, now());
  v_year := extract(year from v_at at time zone 'Asia/Karachi')::int % 100;

  insert into public.cash_custody_slip_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update
    set last_number = public.cash_custody_slip_counters.last_number + 1
  returning last_number into v_next;

  v_num := lpad(v_next::text, 5, '0');

  insert into public.cash_custody_packets (
    shift_id, shop_id, branch_id, counter_id, origin_profile_id, amount,
    opened_at, status, current_holder_id, holder_since,
    staff_copy_number, deposit_copy_number
  ) values (
    s.id, s.shop_id, s.branch_id, s.counter_id, s.staff_id, s.counted_cash,
    v_at, 'with_sales', s.staff_id, v_at,
    'CS-' || v_year::text || '-' || v_num,
    'CD-' || v_year::text || '-' || v_num
  ) returning id into v_id;

  perform public.fn_cash_custody_hop(
    v_id, 'pos_close', s.staff_id, null, s.staff_id, null, null,
    s.counted_cash, 'POS band — cash sales se nikal kar staff ke paas', v_at, false
  );

  return v_id;
end $$;

-- Shift dubara khul jaye (journal fail) to khali packet hatao.
-- Wasoli, jama ya staff confirm ho chuka ho to mat chhedo.
create or replace function public.fn_cash_custody_drop_fresh(p_shift uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.cash_custody_packets where shift_id = p_shift;
  if v_id is null then
    return;
  end if;
  if exists (
    select 1 from public.cash_custody_packets
     where id = v_id
       and (staff_confirmed_at is not null or verified_at is not null
            or deposit_id is not null or latest_handover_id is not null)
  ) then
    return;
  end if;
  if exists (
    select 1 from public.cash_custody_hops
     where packet_id = v_id and kind <> 'pos_close'
  ) then
    return;
  end if;
  delete from public.cash_custody_hops where packet_id = v_id;
  delete from public.cash_custody_packets where id = v_id;
end $$;

create or replace function public.fn_cash_custody_mark_sent(p_packet uuid, p_handover uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  v_holder uuid;
  v_at timestamptz;
  v_note text;
  v_to text;
begin
  if p_packet is null or p_handover is null then
    return;
  end if;
  if exists (
    select 1 from public.cash_custody_packets where id = p_packet and status = 'verified'
  ) then
    return;
  end if;
  if exists (
    select 1 from public.cash_custody_hops where handover_id = p_handover and kind = 'sent'
  ) then
    update public.cash_custody_packets
       set latest_handover_id = p_handover
     where id = p_packet and latest_handover_id is distinct from p_handover and status <> 'verified';
    return;
  end if;

  select * into h from public.cash_handovers where id = p_handover;
  if not found then
    return;
  end if;

  v_holder := coalesce(h.carrier_profile_id, h.from_profile_id);
  v_at := coalesce(h.sent_at, now());
  select full_name into v_to from public.profiles where id = h.to_profile_id;
  v_note := 'Cash chhodi — pane wala ' || coalesce(v_to, '—');
  if h.carrier_profile_id is not null then
    v_note := v_note || ' (carrier ke sath)';
  end if;

  perform set_config('cash_custody.writing', '1', true);
  perform public.fn_cash_custody_hop(
    p_packet, 'sent', v_holder, h.from_profile_id, h.to_profile_id, h.id, null,
    h.amount_sent, v_note, v_at, true
  );
  -- Mukammal handover par guard koi update nahi hone deta. Packet
  -- latest_handover_id aur shift link se mil jati hai.
  if h.status = 'sent' then
    update public.cash_handovers
       set custody_packet_id = p_packet
     where id = h.id and custody_packet_id is null and status = 'sent';
  end if;
  perform set_config('cash_custody.writing', '', true);

  update public.cash_custody_packets
     set latest_handover_id = h.id,
         status = 'in_transit',
         current_holder_id = v_holder,
         holder_since = v_at
   where id = p_packet and status <> 'verified';
end $$;

create or replace function public.fn_cash_custody_mark_wasoli(p_handover uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  v_packet uuid;
  v_status text;
  v_holder uuid;
  v_at timestamptz;
begin
  select * into h from public.cash_handovers where id = p_handover;
  if not found or h.status not in ('received', 'short') then
    return;
  end if;
  if exists (
    select 1 from public.cash_custody_hops where handover_id = p_handover and kind = 'wasoli'
  ) then
    return;
  end if;

  select p.id, p.status into v_packet, v_status
    from public.cash_custody_packets p
   where p.id = h.custody_packet_id
      or p.latest_handover_id = h.id
      or p.shift_id = h.shift_id
      or p.shift_id in (select ps.id from public.pos_shifts ps where ps.cash_handover_id = h.id)
   order by case when p.id = h.custody_packet_id then 0 else 1 end
   limit 1;

  if v_packet is null or v_status = 'verified' then
    return;
  end if;

  v_holder := coalesce(h.received_by, h.to_profile_id);
  v_at := coalesce(h.received_at, now());

  perform public.fn_cash_custody_hop(
    v_packet, 'wasoli', v_holder, h.from_profile_id, h.to_profile_id, h.id, null,
    coalesce(h.amount_received, h.amount_sent),
    case when h.status = 'short' then 'Wasoli — raqam farq ke sath' else 'Wasoli — poori raqam' end,
    v_at, true
  );

  if v_status <> 'deposit_pending' then
    update public.cash_custody_packets
       set status = 'with_holder',
           current_holder_id = v_holder,
           holder_since = v_at,
           latest_handover_id = h.id
     where id = v_packet;
  else
    update public.cash_custody_packets
       set latest_handover_id = h.id
     where id = v_packet and latest_handover_id is distinct from h.id;
  end if;
end $$;

create or replace function public.fn_cash_custody_apply_deposit(p_deposit uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d record;
  v_packet uuid;
  v_status text;
  v_who uuid;
begin
  select * into d from public.pos_collection_deposits where id = p_deposit;
  if not found or d.shift_id is null then
    return;
  end if;

  v_packet := public.fn_cash_custody_open_shift(d.shift_id);
  if v_packet is null then
    return;
  end if;

  select status into v_status from public.cash_custody_packets where id = v_packet;
  v_who := coalesce(d.submitted_by, d.staff_id);

  if d.status = 'rejected' then
    if v_status = 'verified' then
      return;
    end if;
    if not exists (
      select 1 from public.cash_custody_hops where deposit_id = d.id and kind = 'deposit_rejected'
    ) then
      perform public.fn_cash_custody_hop(
        v_packet, 'deposit_rejected', v_who, null, null, null, d.id,
        d.amount, 'Jama radd — cash abhi zimmedar ke paas', coalesce(d.verified_at, now()), true
      );
      perform public.fn_cash_custody_hop(
        v_packet, 'returned', v_who, null, null, null, d.id,
        d.amount, 'Jama radd ke baad wapas isi bande ke paas', coalesce(d.verified_at, now()), false
      );
    end if;
    update public.cash_custody_packets
       set status = 'with_holder',
           current_holder_id = v_who,
           holder_since = coalesce(d.verified_at, now()),
           deposit_id = d.id
     where id = v_packet and status <> 'verified';
    return;
  end if;

  if d.status in ('pending', 'approved') and not exists (
    select 1 from public.cash_custody_hops where deposit_id = d.id and kind = 'deposit_submitted'
  ) then
    if v_status <> 'verified' then
      perform public.fn_cash_custody_hop(
        v_packet, 'deposit_submitted', v_who, null, null, null, d.id,
        d.amount, 'Bank jama darj — Finance ki tasdeeq baqi', coalesce(d.submitted_at, now()), true
      );
      update public.cash_custody_packets
         set status = 'deposit_pending',
             current_holder_id = v_who,
             holder_since = coalesce(d.submitted_at, now()),
             deposit_id = d.id
       where id = v_packet and status <> 'verified';
    end if;
  end if;

  if d.status = 'approved' and not exists (
    select 1 from public.cash_custody_hops where deposit_id = d.id and kind = 'deposit_verified'
  ) then
    perform public.fn_cash_custody_hop(
      v_packet, 'deposit_verified', d.verified_by, null, null, null, d.id,
      d.amount, 'Finance ne jama verify kar di', coalesce(d.verified_at, now()), true
    );
    update public.cash_custody_packets
       set status = 'verified',
           verified_at = coalesce(d.verified_at, now()),
           current_holder_id = null,
           deposit_id = d.id
     where id = v_packet;
  end if;
end $$;

create or replace function public.fn_cash_custody_staff_confirm(
  p_packet uuid,
  p_user uuid,
  p_amount numeric,
  p_signature text,
  p_note text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  v_note text;
begin
  select * into p from public.cash_custody_packets where id = p_packet for update;
  if not found then
    return 'Slip nahi mili.';
  end if;
  if p.origin_profile_id <> p_user then
    return 'Staff copy sirf usi bande ki hai jis ne shift band ki.';
  end if;
  if p.staff_confirmed_at is not null then
    return '';
  end if;
  if p_signature is null or length(btrim(p_signature)) < 2 then
    return 'Apna naam dastakhat ki tarah likhein.';
  end if;
  if p_amount is null or p_amount < 0 then
    return 'Raqam sahi likhein.';
  end if;
  if abs(p_amount - p.amount) > 0.01 and (p_note is null or length(btrim(p_note)) < 5) then
    return 'Ginti se farq hai — wajah kam az kam 5 harf.';
  end if;

  v_note := case
    when abs(p_amount - p.amount) > 0.01 then btrim(p_note)
    else null
  end;

  update public.cash_custody_packets
     set staff_confirmed_at = now(),
         staff_confirmed_by = p_user,
         staff_signature = btrim(p_signature),
         staff_confirmed_amount = p_amount,
         staff_confirm_note = v_note
   where id = p_packet;

  perform public.fn_cash_custody_hop(
    p_packet, 'staff_copy_confirmed', p_user, null, null, null, null,
    p_amount,
    'Staff copy confirm — ' || btrim(p_signature),
    now(), false
  );
  return '';
end $$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.trg_pos_shift_cash_custody()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_packet uuid;
begin
  if tg_op = 'UPDATE' and old.status = 'closed' and new.status is distinct from 'closed' then
    perform public.fn_cash_custody_drop_fresh(new.id);
    return new;
  end if;

  if new.status = 'closed' and coalesce(new.counted_cash, 0) > 0
     and (tg_op = 'INSERT' or old.status is distinct from 'closed') then
    perform public.fn_cash_custody_open_shift(new.id);
  end if;

  if new.cash_handover_id is not null
     and (tg_op = 'INSERT' or old.cash_handover_id is distinct from new.cash_handover_id) then
    v_packet := public.fn_cash_custody_open_shift(new.id);
    if v_packet is not null then
      perform public.fn_cash_custody_mark_sent(v_packet, new.cash_handover_id);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_shift_cash_custody on public.pos_shifts;
create trigger trg_pos_shift_cash_custody
  after insert or update of status, counted_cash, cash_handover_id, closed_at
  on public.pos_shifts
  for each row execute function public.trg_pos_shift_cash_custody();

create or replace function public.trg_cash_handover_custody()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_packet uuid;
begin
  if coalesce(current_setting('cash_custody.writing', true), '') = '1' then
    return new;
  end if;

  if new.custody_packet_id is not null
     and (tg_op = 'INSERT' or old.custody_packet_id is distinct from new.custody_packet_id) then
    perform public.fn_cash_custody_mark_sent(new.custody_packet_id, new.id);
  end if;

  if new.carrier_confirmed_at is not null
     and (tg_op = 'INSERT' or old.carrier_confirmed_at is null) then
    select p.id into v_packet
      from public.cash_custody_packets p
     where p.id = new.custody_packet_id
        or p.latest_handover_id = new.id
        or p.shift_id = new.shift_id
        or p.shift_id in (select ps.id from public.pos_shifts ps where ps.cash_handover_id = new.id)
     limit 1;
    if v_packet is not null and not exists (
      select 1 from public.cash_custody_hops where handover_id = new.id and kind = 'carrier_confirmed'
    ) then
      perform public.fn_cash_custody_hop(
        v_packet, 'carrier_confirmed', new.carrier_confirmed_by, null, null, new.id, null,
        new.amount_sent, 'Carrier ne tasdeeq ki', new.carrier_confirmed_at, false
      );
    end if;
  end if;

  if new.status in ('received', 'short')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.fn_cash_custody_mark_wasoli(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_cash_handover_custody on public.cash_handovers;
create trigger trg_cash_handover_custody
  after insert or update of status, custody_packet_id, carrier_confirmed_at, received_at, received_by
  on public.cash_handovers
  for each row execute function public.trg_cash_handover_custody();

create or replace function public.trg_pos_deposit_custody()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shift_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.shift_id is distinct from new.shift_id then
    perform public.fn_cash_custody_apply_deposit(new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_pos_deposit_custody on public.pos_collection_deposits;
create trigger trg_pos_deposit_custody
  after insert or update of status, shift_id, verified_at, submitted_by
  on public.pos_collection_deposits
  for each row execute function public.trg_pos_deposit_custody();

-- ---------------------------------------------------------------------
-- Backfill: pichhle 14 din, aur jo abhi bhi raaste / jama-pending hain
-- 3 din se purani atki cash dashboard par rahegi, pehli notification
-- sirf un par jo 3 din ke andar hain — warna Admin purani qatarein
-- se dab jata.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  d record;
  v_packet uuid;
  v_hstatus text;
begin
  for r in
    select s.id, s.cash_handover_id, s.closed_at
      from public.pos_shifts s
     where s.status = 'closed'
       and coalesce(s.counted_cash, 0) > 0
       and (
         s.closed_at >= now() - interval '14 days'
         or exists (
           select 1 from public.cash_handovers ch
            where ch.id = s.cash_handover_id and ch.status = 'sent'
         )
         or exists (
           select 1 from public.pos_collection_deposits dep
            where dep.shift_id = s.id and dep.status = 'pending'
         )
       )
  loop
    v_packet := public.fn_cash_custody_open_shift(r.id);
    if v_packet is null then
      continue;
    end if;
    if r.cash_handover_id is not null then
      perform public.fn_cash_custody_mark_sent(v_packet, r.cash_handover_id);
      select ch.status into v_hstatus from public.cash_handovers ch where ch.id = r.cash_handover_id;
      if v_hstatus in ('received', 'short') then
        perform public.fn_cash_custody_mark_wasoli(r.cash_handover_id);
      end if;
    end if;
    for d in
      select dep.id
        from public.pos_collection_deposits dep
       where dep.shift_id = r.id
         and dep.status in ('rejected', 'pending', 'approved')
       order by case dep.status when 'rejected' then 0 when 'pending' then 1 else 2 end, dep.submitted_at
    loop
      perform public.fn_cash_custody_apply_deposit(d.id);
    end loop;
  end loop;

  update public.cash_custody_packets
     set alerted_at = now()
   where verified_at is null
     and opened_at < now() - interval '3 days'
     and alerted_at is null;
end $$;

-- ---------------------------------------------------------------------
-- 1 din: jama verify na ho to Admin + Owner
-- ---------------------------------------------------------------------
create or replace function public.fn_cash_custody_overdue_notify()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_timeline text;
  v_msg text;
  v_admins uuid[];
  n int := 0;
begin
  select array_agg(p.id) into v_admins
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.is_active
     and p.role::text in ('admin', 'super_admin', 'owner');

  if v_admins is null then
    return 0;
  end if;

  for r in
    select p.id, p.amount, p.holder_since, p.staff_copy_number, p.deposit_copy_number,
           sh.shift_number,
           coalesce(shop.name, br.name, 'Shop') as shop_name,
           holder.full_name as holder_name
      from public.cash_custody_packets p
      join public.pos_shifts sh on sh.id = p.shift_id
      left join public.shops shop on shop.id = p.shop_id
      left join public.branches br on br.id = p.branch_id
      left join public.profiles holder on holder.id = p.current_holder_id
     where p.verified_at is null
       and p.status <> 'verified'
       and p.opened_at < now() - interval '1 day'
       and (p.alerted_at is null or p.alerted_at < now() - interval '1 day')
     order by p.opened_at
     limit 20
  loop
    select string_agg(
             coalesce(pr.full_name, '—')
             || ' ne '
             || public.fn_cash_custody_span(h.started_at, h.ended_at)
             || ' rakha ('
             || public.fn_cash_custody_kind_label(h.kind)
             || ')',
             ' → ' order by h.seq
           )
      into v_timeline
      from public.cash_custody_hops h
      left join public.profiles pr on pr.id = h.holder_id
     where h.packet_id = r.id
       and h.kind in ('pos_close', 'sent', 'wasoli', 'deposit_submitted', 'returned');

    v_msg := r.shop_name || ' · ' || coalesce(r.shift_number, '')
      || ' · Rs ' || trim(to_char(r.amount, 'FM999,999,990.00'))
      || E'\nAbhi: ' || coalesce(r.holder_name, 'koi zimmedar darj nahi')
      || ' · ' || public.fn_cash_custody_span(r.holder_since, null)
      || E'\nTimeline: ' || coalesce(v_timeline, '—')
      || E'\nStaff slip ' || r.staff_copy_number
      || ' · Jama slip ' || r.deposit_copy_number;

    insert into public.notifications (recipient_user_id, title, message, link_url)
    select u, 'POS cash 1 din se jama nahi', v_msg, '/admin/cash-custody/packet/' || r.id::text
      from unnest(v_admins) as u;

    update public.cash_custody_packets set alerted_at = now() where id = r.id;
    n := n + 1;
  end loop;

  return n;
end $$;

-- ---------------------------------------------------------------------
-- RLS — desk / apni branch / jo is packet mein shamil ho. Likhna
-- sirf service role ya trigger. fn_is_any_staff() akela har staff ko
-- har dukan ki raqam dikha deta.
-- ---------------------------------------------------------------------
create or replace function public.fn_cash_custody_visible(p_packet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.cash_custody_packets pkt
      join public.profiles me on me.id = auth.uid()
     where pkt.id = p_packet
       and me.is_active
       and (
         me.role::text in ('owner', 'super_admin', 'admin', 'finance')
         or (me.role::text = 'manager' and me.branch_id is not null and me.branch_id = pkt.branch_id)
         or me.id = pkt.origin_profile_id
         or me.id = pkt.current_holder_id
         or me.id = pkt.staff_confirmed_by
         or exists (
           select 1
             from public.cash_custody_hops h
            where h.packet_id = pkt.id
              and me.id in (h.holder_id, h.from_profile_id, h.to_profile_id)
         )
       )
  );
$$;

alter table public.cash_custody_packets enable row level security;
alter table public.cash_custody_hops enable row level security;
alter table public.cash_custody_slip_counters enable row level security;

drop policy if exists staff_read_cash_custody_packets on public.cash_custody_packets;
create policy staff_read_cash_custody_packets on public.cash_custody_packets
  for select to authenticated using (public.fn_cash_custody_visible(id));

drop policy if exists staff_read_cash_custody_hops on public.cash_custody_hops;
create policy staff_read_cash_custody_hops on public.cash_custody_hops
  for select to authenticated using (public.fn_cash_custody_visible(packet_id));

revoke all on public.cash_custody_packets from anon, authenticated;
revoke all on public.cash_custody_hops from anon, authenticated;
revoke all on public.cash_custody_slip_counters from anon, authenticated;
grant select on public.cash_custody_packets to authenticated;
grant select on public.cash_custody_hops to authenticated;
grant all on public.cash_custody_packets to service_role;
grant all on public.cash_custody_hops to service_role;
grant all on public.cash_custody_slip_counters to service_role;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'fn_cash_custody_span(timestamptz, timestamptz)',
    'fn_cash_custody_kind_label(text)',
    'fn_cash_custody_hop(uuid, text, uuid, uuid, uuid, uuid, uuid, numeric, text, timestamptz, boolean)',
    'fn_cash_custody_open_shift(uuid)',
    'fn_cash_custody_drop_fresh(uuid)',
    'fn_cash_custody_mark_sent(uuid, uuid)',
    'fn_cash_custody_mark_wasoli(uuid)',
    'fn_cash_custody_apply_deposit(uuid)',
    'fn_cash_custody_staff_confirm(uuid, uuid, numeric, text, text)',
    'fn_cash_custody_overdue_notify()',
    'trg_pos_shift_cash_custody()',
    'trg_cash_handover_custody()',
    'trg_pos_deposit_custody()'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end $$;

revoke all on function public.fn_cash_custody_visible(uuid) from public, anon;
grant execute on function public.fn_cash_custody_visible(uuid) to authenticated, service_role;

-- Span/label dashboard ke ilawa alert mein hain. Authenticated ko
-- execute nahi — Data API se na chalein. Trigger service role se chalti hai.

-- ---------------------------------------------------------------------
-- Safha: Manager apni branch, Finance sab. Admin/Owner pehle se khula.
-- ---------------------------------------------------------------------
insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('finance', 'cash-custody', array['view']::text[], 'all')
on conflict (role, feature_key) do nothing;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope) values
  ('manager', 'cash-custody', array['view']::text[], 'own_branch')
on conflict (role, feature_key) do update
  set actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order) values
  ('admin', 'cash-custody', 18),
  ('master', 'cash-custody', 6)
on conflict do nothing;

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('cash-custody', 'rm',
 'POS band hote hi har dukan ki cash ka silsila: staff copy (jama karne wala rakhta hai, dastakhat aur system mein raqam) aur jama copy (cash ke sath). Manager wasoli ke baad Finance ya bank tak har qadam par zimmedar aur waqt. 1 din mein jama aur tasdeeq na ho to Admin ko timeline ke sath alert.',
 'Admin aur Owner hamesha. Manager apni branch. Finance sab. Sales staff sirf apni do slips.',
 'Shift band hote hi, aur jab cash 1 din se verify na ho.',
 array[
   'Shift band karein — staff copy aur jama copy dono kholein.',
   'Staff copy par raqam likh kar apna naam confirm karein. Jama copy cash ke sath rakhein.',
   'Manager wasoli Cash Handover par kare, phir Finance ko bheje ya bank jama karaye.',
   'Finance deposit verify kare — tab silsila band hota hai.'
 ],
 'Jo atki hai us ki timeline kholein: kis ke paas kitni der.',
 array[
   'Sirf ek slip chhapna.',
   'Wasoli ke baghair jama ho gayi maan lena.',
   '1 din ka alert khol kar chhor dena.'
 ]),
('cash-custody', 'en',
 'When a POS shift closes, every shop gets two slips: a staff copy the depositor keeps (signature and an in-system amount confirm) and a deposit copy that travels with the cash. After sales, each hop records who holds it and when. If it is not bank-deposited and verified within one day, Admin is alerted with that timeline.',
 'Admin and Owner always. Manager for their branch. Finance for all. Sales staff only their own two slips.',
 'As soon as the shift closes, and again if cash is still unverified after one day.',
 array[
   'Close the shift and open both slips.',
   'On the staff copy, enter the amount and confirm your name. Keep the deposit copy with the cash.',
   'Manager records wasoli on Cash Handover, then forwards to Finance or submits the bank deposit.',
   'Finance verifies the deposit. That closes the chain.'
 ],
 'Open the timeline of anything stuck: who held it, and for how long.',
 array[
   'Printing only one slip.',
   'Treating wasoli as a finished bank deposit.',
   'Ignoring the one-day alert.'
 ]),
('cash-custody', 'ur',
 'شفٹ بند ہوتے ہی ہر دکان پر دو سلپ: سٹاف کاپی (جمع کرانے والا رکھتا ہے، دستخط اور سسٹم میں رقم) اور جمع کاپی (کیش کے ساتھ). ایک دن میں تصدیق نہ ہو تو ایڈمن کو ٹائم لائن کے ساتھ الرٹ.',
 'ایڈمن اور اونر ہمیشہ. مینیجر اپنی برانچ. فنانس سب. سیلز صرف اپنی سلپس.',
 'شفٹ بند ہوتے ہی، اور جب کیش ایک دن سے تصدیق نہ ہو.',
 array[
   'دونوں سلپس کھولیں.',
   'سٹاف کاپی پر رقم اور نام کنفرم کریں.',
   'مینیجر وصولی کرے، پھر فنانس یا بینک جمع.',
   'فنانس تصدیق کرے.'
 ],
 'اٹکی ہوئی کیش کی ٹائم لائن کھولیں.',
 array['صرف ایک سلپ.', 'وصولی کو جمع سمجھ لینا.', 'الرٹ چھوڑ دینا.'])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'agribridge_cash_custody_overdue') then
      perform cron.schedule(
        'agribridge_cash_custody_overdue',
        '15 * * * *',
        $job$select public.fn_cash_custody_overdue_notify();$job$
      );
    end if;
  end if;
exception when others then
  raise notice 'cash custody cron skip: %', sqlerrm;
end $$;
