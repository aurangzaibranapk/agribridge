-- 569: Nasal-kashi (breeding) -- garmi, tukhm (AI/qudrati), hamal check (PD), byaana, dry-off, isqat.
-- Additive. Delete nahi -- void (wajah ke saath). Kisan sirf apna; staff parh sakta hai; anon kuch nahi.
-- Kharcha: P&L (577) sirf dairy_expenses parhta hai. Waqia ka kharcha ek hi dafa wahan jata hai:
--   (a) dukaan/pehle wala kharcha link (expense_id) -> naya row nahi; (b) warna 1 'vets' row (source breeding/health, source_ref = waqia id).

-- 575 ka source check (additive): 'breeding' aur 'health' bhi.
alter table public.dairy_expenses drop constraint if exists dairy_expenses_source_check;
alter table public.dairy_expenses add constraint dairy_expenses_source_check check (source in ('manual','erp_pos','breeding','health'));

-- 575 ka guard wahi, bas waqia wale rows sirf waqia se ban/badal sakte hain.
create or replace function public.fn_dairy_money_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare from_event boolean := current_setting('dairy.from_event', true) = '1';
begin
  if tg_op = 'DELETE' then raise exception 'Hisaab ka indraaj delete nahi hota -- void karein'; end if;
  if tg_op = 'UPDATE' then
    if new.farmer_id <> old.farmer_id then raise exception 'Maalik badla nahi ja sakta'; end if;
    if old.voided then raise exception 'Void indraaj badla nahi ja sakta'; end if;
    if tg_table_name = 'dairy_expenses' then  -- nested: dairy_income mein source column nahi
      if new.source is distinct from old.source or new.source_ref is distinct from old.source_ref then
        raise exception 'Source badla nahi ja sakta';
      end if;
      if old.source = 'erp_pos' and not new.voided then
        raise exception 'Dukaan wala indraaj badla nahi ja sakta -- sirf void';
      end if;
      if old.source in ('breeding','health') and not from_event then
        raise exception 'Ye kharcha nasal/sehat ke waqia se juRa hai -- wahan badlein';
      end if;
    end if;
  end if;
  if new.animal_id is not null and not exists (select 1 from dairy_animals a where a.id = new.animal_id and a.farmer_id = new.farmer_id) then
    raise exception 'Janwar isi kisan ka hona chahiye';
  end if;
  if tg_table_name = 'dairy_expenses' then
    if new.expense_date > current_date then raise exception 'Aage ki tareekh nahi'; end if;
    if tg_op = 'INSERT' and new.source = 'erp_pos' and current_setting('dairy.from_shop', true) is distinct from '1' then
      raise exception 'Dukaan wala kharcha sirf "Shamil" se aata hai';
    end if;
    if tg_op = 'INSERT' and new.source in ('breeding','health') and not from_event then
      raise exception 'Ye kharcha sirf nasal/sehat ke waqia se banta hai';
    end if;
  else
    if new.income_date > current_date then raise exception 'Aage ki tareekh nahi'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Hamal ke din: gaye 283, bhains 310, bakri 150.
create or replace function public.fn_dairy_gestation_days(p_species text)
returns int language sql immutable as $$
  select case p_species when 'buffalo' then 310 when 'goat' then 150 else 283 end;
$$;
grant execute on function public.fn_dairy_gestation_days(text) to authenticated;

create table if not exists public.dairy_breeding_events (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.dairy_animals(id),
  farmer_id uuid not null references public.farmers(id),
  event_type text not null check (event_type in ('heat','ai','natural','pd','calving','abortion','dry_off')),
  event_date date not null default current_date,
  event_time time,
  heat_signs text[] check (heat_signs is null or heat_signs <@ array['bellow','mucus','mounting','restless','milk_drop']::text[]),
  bull_name text check (bull_name is null or length(bull_name) <= 80),
  semen_breed text check (semen_breed is null or length(semen_breed) <= 40),
  semen_company text check (semen_company is null or length(semen_company) <= 80),
  straw_no text check (straw_no is null or length(straw_no) <= 40),
  sexed boolean not null default false,
  technician text check (technician is null or length(technician) <= 80),
  technician_phone text check (technician_phone is null or technician_phone ~ '^[0-9+ -]{7,16}$'),
  pd_result text check (pd_result is null or pd_result in ('positive','negative','doubtful')),
  pd_method text check (pd_method is null or pd_method in ('rectal','ultrasound','kit')),
  service_id uuid references public.dairy_breeding_events(id),
  calving_ease text check (calving_ease is null or calving_ease in ('easy','assisted','vet','c_section')),
  calf_animal_id uuid references public.dairy_animals(id),
  calf_sex text check (calf_sex is null or calf_sex in ('F','M')),
  calf_alive boolean,
  twins boolean not null default false,
  cost numeric(12,2) check (cost is null or (cost >= 0 and cost <= 1000000)),
  payment text not null default 'cash' check (payment in ('cash','udhaar','bank')),
  expense_id uuid references public.dairy_expenses(id),
  notes text check (notes is null or length(notes) <= 300),
  prev_lactation_no int,
  prev_last_calving_date date,
  voided boolean not null default false,
  void_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (event_type <> 'ai' or length(btrim(coalesce(bull_name,''))) >= 1),
  check (event_type <> 'pd' or (pd_result is not null and service_id is not null)),
  check (not voided or length(coalesce(void_reason,'')) >= 3)
);
create index if not exists ix_dairy_breeding_animal on public.dairy_breeding_events (animal_id, event_date desc);
create index if not exists ix_dairy_breeding_farmer on public.dairy_breeding_events (farmer_id, event_type, event_date);
create unique index if not exists ux_dairy_breeding_expense on public.dairy_breeding_events (expense_id) where expense_id is not null;

-- Waqia ka kharcha -> dairy_expenses (ek hi dafa). Dono tables (569/570) yahi istemal karti hain.
create or replace function public.fn_dairy_event_cost(p_source text, p_event uuid, p_farmer uuid, p_date date, p_cost numeric,
  p_payment text, p_note text, p_link uuid, p_voided boolean, p_animal uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select id, voided, amount, expense_date, payment into x from dairy_expenses where source_ref = p_event;
  perform set_config('dairy.from_event', '1', true);
  if p_link is not null then
    if not exists (select 1 from dairy_expenses e where e.id = p_link and e.farmer_id = p_farmer and not e.voided and e.source in ('erp_pos','manual')) then
      raise exception 'Ye kharcha aap ka nahi ya pehle se void hai';
    end if;
    if exists (select 1 from dairy_breeding_events b where b.expense_id = p_link and b.id <> p_event)
       or (to_regclass('public.dairy_health_events') is not null
           and exists (select 1 from dairy_health_events h where h.expense_id = p_link and h.id <> p_event)) then
      raise exception 'Ye kharcha pehle hi kisi aur waqia se juRa hai';
    end if;
    if x.id is not null and not x.voided then
      update dairy_expenses set voided = true, void_reason = 'Dukaan wale kharche se link kiya' where id = x.id;
    end if;
    perform set_config('dairy.from_event', '', true);
    return p_link;
  end if;
  if p_voided or coalesce(p_cost, 0) = 0 then
    if x.id is not null and not x.voided then
      update dairy_expenses set voided = true, void_reason = case when p_voided then 'Waqia void hua' else 'Waqia ka kharcha hataya' end where id = x.id;
    end if;
    perform set_config('dairy.from_event', '', true);
    return null;
  end if;
  if x.id is null then
    insert into dairy_expenses (farmer_id, expense_date, category, amount, animal_id, payment, note, source, source_ref)
    values (p_farmer, p_date, 'vets', round(p_cost, 2), p_animal, coalesce(p_payment, 'cash'), left(p_note, 300), p_source, p_event)
    returning id into x.id;
  elsif x.voided then
    raise exception 'Is waqia ka kharcha hat chuka -- naya waqia banayein';
  elsif x.amount <> round(p_cost, 2) or x.expense_date <> p_date or x.payment <> coalesce(p_payment, 'cash') then
    update dairy_expenses set amount = round(p_cost, 2), expense_date = p_date, payment = coalesce(p_payment, 'cash') where id = x.id;
  end if;
  perform set_config('dairy.from_event', '', true);
  return x.id;
end $$;
revoke all on function public.fn_dairy_event_cost(text, uuid, uuid, date, numeric, text, text, uuid, boolean, uuid) from public, anon, authenticated;

-- Khula hamal (positive PD jis ke baad byaana/isqat nahi) -- service id.
create or replace function public.fn_dairy_open_pregnancy(p_animal uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.service_id from dairy_breeding_events p
   where p.animal_id = p_animal and p.event_type = 'pd' and p.pd_result = 'positive' and not p.voided
     and not exists (select 1 from dairy_breeding_events c where c.animal_id = p_animal and not c.voided
                       and c.event_type in ('calving','abortion') and c.event_date >= p.event_date)
   order by p.event_date desc limit 1;
$$;
revoke all on function public.fn_dairy_open_pregnancy(uuid) from public, anon;
grant execute on function public.fn_dairy_open_pregnancy(uuid) to authenticated;

create or replace function public.fn_dairy_breeding_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; s record; link uuid; label text;
begin
  if tg_op = 'DELETE' then raise exception 'Nasal ka waqia delete nahi hota -- void karein'; end if;
  if tg_op = 'UPDATE' then
    if old.voided then raise exception 'Void waqia badla nahi ja sakta'; end if;
    if new.animal_id <> old.animal_id or new.farmer_id <> old.farmer_id or new.event_type <> old.event_type
       or new.service_id is distinct from old.service_id or new.calf_animal_id is distinct from old.calf_animal_id
       or new.event_date <> old.event_date then
      raise exception 'Janwar/qism/tareekh badli nahi ja sakti -- void kar ke naya likhein';
    end if;
    new.prev_lactation_no := old.prev_lactation_no; new.prev_last_calving_date := old.prev_last_calving_date;
  end if;
  select id, farmer_id, sex, status, dob, species into a from dairy_animals where id = new.animal_id;
  if not found then raise exception 'Janwar nahi mila'; end if;
  new.farmer_id := a.farmer_id;
  if tg_op = 'INSERT' then
    if a.status in ('sold','dead') then raise exception 'Bika/mara janwar -- naya waqia nahi'; end if;
    if a.sex <> 'F' and new.event_type <> 'natural' then raise exception 'Nasal ka record sirf maada (female) janwar ka'; end if;
    if new.event_date > current_date then raise exception 'Aage ki tareekh nahi'; end if;
    if a.dob is not null and new.event_date < a.dob then raise exception 'Paidaish se pehle ki tareekh nahi'; end if;
    if new.service_id is not null then
      select id, animal_id, event_type, event_date, voided into s from dairy_breeding_events where id = new.service_id;
      if not found or s.animal_id <> new.animal_id or s.event_type not in ('ai','natural') or s.voided or s.event_date > new.event_date then
        raise exception 'PD/byaana isi janwar ke tukhm (AI) se juRna chahiye';
      end if;
    end if;
    if new.event_type = 'pd' and new.pd_result = 'positive' then
      if public.fn_dairy_open_pregnancy(new.animal_id) is not null and public.fn_dairy_open_pregnancy(new.animal_id) <> new.service_id then
        raise exception 'Is janwar ka ek hamal pehle se khula hai';
      end if;
    end if;
    if new.event_type = 'calving' then
      new.prev_lactation_no := (select lactation_no from dairy_animals where id = new.animal_id);
      new.prev_last_calving_date := (select last_calving_date from dairy_animals where id = new.animal_id);
    end if;
  end if;
  label := case new.event_type when 'ai' then 'AI · ' || coalesce(new.bull_name,'') when 'natural' then 'Qudrati · ' || coalesce(new.bull_name,'')
           when 'pd' then 'PD check' when 'calving' then 'Byaana' else new.event_type end;
  link := case when new.expense_id is not null and not exists (select 1 from dairy_expenses e where e.id = new.expense_id and e.source_ref = new.id)
               then new.expense_id end;
  new.expense_id := public.fn_dairy_event_cost('breeding', new.id, new.farmer_id, new.event_date, new.cost, new.payment,
                      label || coalesce(' · ' || new.straw_no, ''), link, new.voided, new.animal_id);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_dairy_breeding_guard on public.dairy_breeding_events;
create trigger trg_dairy_breeding_guard before insert or update or delete on public.dairy_breeding_events
  for each row execute function public.fn_dairy_breeding_guard();

-- Janwar par asar (status / lactation). Void par byaana wapas.
create or replace function public.fn_dairy_breeding_effects()
returns trigger language plpgsql security definer set search_path = public as $$
declare st text; lac int;
begin
  select status, lactation_no into st, lac from dairy_animals where id = new.animal_id;
  if tg_op = 'INSERT' then
    if new.event_type = 'pd' and new.pd_result = 'positive' and st in ('milking','heifer') then
      update dairy_animals set status = 'pregnant', status_date = new.event_date where id = new.animal_id;
    elsif new.event_type = 'pd' and new.pd_result = 'negative' and st = 'pregnant' and public.fn_dairy_open_pregnancy(new.animal_id) is null then
      update dairy_animals set status = case when lac > 0 then 'milking' else 'heifer' end, status_date = new.event_date where id = new.animal_id;
    elsif new.event_type = 'dry_off' and st in ('milking','pregnant') then
      update dairy_animals set status = 'dry', status_date = new.event_date where id = new.animal_id;
    elsif new.event_type = 'abortion' and st = 'pregnant' then
      update dairy_animals set status = case when lac > 0 then 'milking' else 'heifer' end, status_date = new.event_date where id = new.animal_id;
    elsif new.event_type = 'calving' then
      update dairy_animals set lactation_no = lactation_no + 1,
             last_calving_date = greatest(coalesce(last_calving_date, new.event_date), new.event_date),
             status = 'milking', status_date = new.event_date
       where id = new.animal_id;
    end if;
  elsif tg_op = 'UPDATE' and new.voided and not old.voided and new.event_type = 'calving' then
    update dairy_animals set lactation_no = coalesce(new.prev_lactation_no, greatest(lactation_no - 1, 0)),
           last_calving_date = new.prev_last_calving_date
     where id = new.animal_id and last_calving_date = new.event_date;
  end if;
  return null;
end $$;
drop trigger if exists trg_dairy_breeding_effects on public.dairy_breeding_events;
create trigger trg_dairy_breeding_effects after insert or update on public.dairy_breeding_events
  for each row execute function public.fn_dairy_breeding_effects();

alter table public.dairy_breeding_events enable row level security;
revoke all on public.dairy_breeding_events from anon;
grant select, insert, update on public.dairy_breeding_events to authenticated;
revoke delete on public.dairy_breeding_events from authenticated;
drop policy if exists dairy_breeding_own_select on public.dairy_breeding_events;
create policy dairy_breeding_own_select on public.dairy_breeding_events for select to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id() or public.fn_is_staff(auth.uid()));
drop policy if exists dairy_breeding_own_insert on public.dairy_breeding_events;
create policy dairy_breeding_own_insert on public.dairy_breeding_events for insert to authenticated
  with check (farmer_id = public.fn_dairy_my_farmer_id()
              and exists (select 1 from dairy_animals d where d.id = animal_id and d.farmer_id = public.fn_dairy_my_farmer_id()));
drop policy if exists dairy_breeding_own_update on public.dairy_breeding_events;
create policy dairy_breeding_own_update on public.dairy_breeding_events for update to authenticated
  using (farmer_id = public.fn_dairy_my_farmer_id()) with check (farmer_id = public.fn_dairy_my_farmer_id());

-- Har janwar ki nasal ki haalat (RLS chalti rahe: security_invoker).
create or replace view public.v_dairy_repro_status with (security_invoker = true) as
with ev as (
  select * from public.dairy_breeding_events where not voided
), base as (
  select a.id as animal_id, a.farmer_id, a.tag_no, a.name, a.species, a.status, a.lactation_no, a.last_calving_date, a.dob,
         public.fn_dairy_gestation_days(a.species) as gestation_days,
         (select max(e.event_date) from ev e where e.animal_id = a.id and e.event_type = 'heat') as last_heat,
         (select e.id from ev e where e.animal_id = a.id and e.event_type in ('ai','natural') order by e.event_date desc, e.created_at desc limit 1) as last_service_id,
         (select max(e.event_date) from ev e where e.animal_id = a.id and e.event_type in ('ai','natural')) as last_service_date,
         (select max(e.event_date) from ev e where e.animal_id = a.id and e.event_type in ('calving','abortion')) as last_close,
         (select count(*)::int from ev e where e.animal_id = a.id and e.event_type in ('ai','natural')
             and e.event_date > coalesce(a.last_calving_date, date '1900-01-01')) as services_lactation,
         (select p.service_id from ev p where p.animal_id = a.id and p.event_type = 'pd' and p.pd_result = 'positive'
             and not exists (select 1 from ev c where c.animal_id = a.id and c.event_type in ('calving','abortion') and c.event_date >= p.event_date)
           order by p.event_date desc limit 1) as preg_service_id
    from public.dairy_animals a
   where a.sex = 'F' and a.status not in ('sold','dead')
)
select b.*,
       ps.event_date as preg_service_date,
       (b.preg_service_id is not null) as pregnant,
       case when b.preg_service_id is not null then current_date - ps.event_date end as days_pregnant,
       case when b.preg_service_id is not null then ps.event_date + b.gestation_days end as expected_calving,
       case when b.preg_service_id is not null then ps.event_date + b.gestation_days - 60 end as dry_off_due,
       (b.preg_service_id is not null and exists (select 1 from public.dairy_breeding_events d where d.animal_id = b.animal_id and not d.voided
            and d.event_type = 'dry_off' and d.event_date >= ps.event_date)) as dried,
       -- PD baqi: aakhri tukhm ke baad na PD na byaana
       (b.preg_service_id is null and b.last_service_id is not null
          and b.last_service_date > coalesce(b.last_close, date '1900-01-01')
          and not exists (select 1 from public.dairy_breeding_events p where p.service_id = b.last_service_id and not p.voided)) as pd_pending,
       case when b.last_service_id is not null then b.last_service_date + 35 end as pd_from,
       case when b.last_service_id is not null then b.last_service_date + 45 end as pd_to,
       case when b.preg_service_id is null and greatest(b.last_heat, b.last_service_date) is not null
            then greatest(b.last_heat, b.last_service_date) + 21 end as next_heat,
       case when b.last_calving_date is not null then current_date - b.last_calving_date end as dim,
       (b.preg_service_id is null and b.services_lactation >= 3) as repeat_breeder
  from base b
  left join public.dairy_breeding_events ps on ps.id = b.preg_service_id;
revoke all on public.v_dairy_repro_status from anon;
grant select on public.v_dairy_repro_status to authenticated;

-- Byaana: ek transaction -- waqia + (zinda bachha ho to) naya janwar (maa se juRa). Maa: lactation +1 (trigger).
create or replace function public.fn_dairy_record_calving(p_animal uuid, p_date date, p_service uuid, p_ease text, p_calf jsonb, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := public.fn_dairy_my_farmer_id(); m record; calf uuid; ev uuid; alive boolean; tag text;
begin
  if me is null then raise exception 'Sirf kisan'; end if;
  select * into m from dairy_animals where id = p_animal and farmer_id = me;
  if not found then raise exception 'Ye janwar aap ka nahi'; end if;
  alive := coalesce((p_calf->>'alive')::boolean, true);
  tag := nullif(btrim(coalesce(p_calf->>'tag_no', '')), '');
  if alive and tag is not null then
    insert into dairy_animals (farmer_id, farm_id, tag_no, name, species, breed, sex, dob, dam_id, sire_text, source, status)
    values (me, m.farm_id, tag, nullif(left(p_calf->>'name', 60), ''), m.species, coalesce(nullif(p_calf->>'breed',''), m.breed),
            case when p_calf->>'sex' = 'M' then 'M' else 'F' end, p_date, m.id,
            (select bull_name from dairy_breeding_events where id = p_service), 'born', 'calf')
    returning id into calf;
  end if;
  insert into dairy_breeding_events (animal_id, farmer_id, event_type, event_date, service_id, calving_ease, calf_animal_id, calf_sex, calf_alive, twins, notes)
  values (p_animal, me, 'calving', p_date, p_service, p_ease, calf, case when p_calf->>'sex' = 'M' then 'M' when p_calf->>'sex' = 'F' then 'F' end,
          alive, coalesce((p_calf->>'twins')::boolean, false), left(p_notes, 300))
  returning id into ev;
  return ev;
end $$;
revoke all on function public.fn_dairy_record_calving(uuid, date, uuid, text, jsonb, text) from public, anon;
grant execute on function public.fn_dairy_record_calving(uuid, date, uuid, text, jsonb, text) to authenticated;
