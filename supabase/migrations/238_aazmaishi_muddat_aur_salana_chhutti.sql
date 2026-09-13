-- =====================================================================
-- AgriBridge — Migration 238: Aazmaishi muddat aur saalana chhutti
-- =====================================================================
-- Naya banda aata hai to teen mahine ki AAZMAISHI MUDDAT (probation)
-- chalti hai. Us ke baad faisla: muddat baRhani hai, pakka karna hai,
-- ya alag karna hai. Pakka hone par usay saalana chhutti milti hai --
-- 20 din. Pakka hone se pehle tankhwah wali koi chhutti nahi.
--
-- ---------------------------------------------------------------------
-- Sab se ahem faisla: KHAMOSHI SE KOI PAKKA NAHI HOTA
-- ---------------------------------------------------------------------
-- Aasan raasta ye tha ke teen mahine guzarte hi banda khud ba khud
-- pakka ho jaye. Wo raasta ek din ye kar guzarta hai: kisi ne dekha hi
-- nahi, tareekh guzar gayi, aur banda pakka ho gaya -- us faisle ke
-- baghair jis ke liye ye poori muddat rakhi thi.
--
-- Is liye: tareekh guzarne par banda AAZMAISH PAR HI REHTA HAI, aur
-- board par "faisla baqi hai" likha aata hai. Bhoolna kabhi manzoori
-- nahi banta.
--
-- Us ka ulta bhi rakha hai: muddat hamesha ke liye baRhti bhi nahi.
-- Kul chhe mahine (qabil-e-tabdeeli) ke baad baRhane ka raasta band ho
-- jata hai -- faisla karna hi paRta hai. Baghair is hadd ke "abhi aur
-- dekh lete hain" ek aisi jagah ban jati jahan banda saalon aazmaish
-- par reh kar chhutti se mehroom rehta.
--
-- ---------------------------------------------------------------------
-- Do faisle jo main ne khud liye -- aap badal sakte hain
-- ---------------------------------------------------------------------
-- 1. MOJOODA staff sab "pakka" (confirmed) likhe ja rahe hain, aazmaish
--    par nahi. Ulta karne par un logon ki chhutti chup chaap khatam ho
--    jati jo saalon se kaam kar rahe hain. Jo waqai naya hai, HR us ko
--    haath se aazmaish par daal dega.
--
-- 2. PEHLE SAAL ki chhutti mahinon ke hisaab se banti hai. 20 December
--    ko pakka hone wale ko us saal ke poore 20 din dena us adad ko
--    bemani kar deta hai. (prorate_first_year band bhi ki ja sakti hai.)
--
-- Aage le jane (carry forward) ka koi usool aap ne nahi bataya, is liye
-- default SIFAR hai -- yani bachi hui chhutti agle saal nahi jati. Ye
-- ek KHANA hai, faisla nahi: aap kahenge to badal jayega.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Chhutti aur aazmaish ka usool -- ek hi jagah
-- ---------------------------------------------------------------------
create table if not exists hr_leave_policy (
  id boolean primary key default true,
  -- Ek hi qatar rahegi. Do qataron ka matlab do usool, aur phir har
  -- report ko yaad rakhna paRta ke kaun sa parhna hai.
  constraint chk_leave_policy_singleton check (id),

  annual_leave_days int not null default 20,
  probation_months int not null default 3,
  probation_max_total_months int not null default 6,

  -- Aazmaish par tankhwah wali chhutti milti hai ya nahi.
  probation_paid_leave boolean not null default false,

  prorate_first_year boolean not null default true,
  carry_forward_days int not null default 0,

  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),

  constraint chk_leave_policy_sane check (
    annual_leave_days between 0 and 60
    and probation_months between 0 and 24
    and probation_max_total_months >= probation_months
    and carry_forward_days between 0 and 60
  )
);

insert into hr_leave_policy (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) Mulazim ki haalat
-- ---------------------------------------------------------------------
alter table staff_details
  add column if not exists employment_status text not null default 'probation',
  add column if not exists probation_start_date date,
  add column if not exists probation_end_date date,
  add column if not exists confirmed_at date,
  add column if not exists confirmed_by uuid references profiles(id),
  add column if not exists exit_date date,
  add column if not exists exit_reason text;

alter table staff_details drop constraint if exists chk_employment_status;
alter table staff_details add constraint chk_employment_status
  check (employment_status in ('probation', 'confirmed', 'ended'));

-- Pakka hua banda bina tareekh ke pakka nahi ho sakta -- warna "kab se
-- pakka hai" ka jawab kahin nahi bachta, aur saalana chhutti ka hisaab
-- usi tareekh par khaRa hai.
alter table staff_details drop constraint if exists chk_confirmed_needs_date;
alter table staff_details add constraint chk_confirmed_needs_date
  check (employment_status <> 'confirmed' or confirmed_at is not null);

alter table staff_details drop constraint if exists chk_ended_needs_date;
alter table staff_details add constraint chk_ended_needs_date
  check (employment_status <> 'ended' or exit_date is not null);

-- MOJOODA staff sab pakka. Wajah oopar likhi hai.
update staff_details
   set employment_status = 'confirmed',
       confirmed_at = coalesce(confirmed_at, hire_date, created_at::date)
 where employment_status = 'probation'
   and confirmed_at is null
   and probation_start_date is null;

create index if not exists idx_staff_probation_end
  on staff_details (probation_end_date)
  where employment_status = 'probation';

-- ---------------------------------------------------------------------
-- 3) Har faisla ek qatar
-- ---------------------------------------------------------------------
create table if not exists staff_probation_reviews (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  decision text not null,
  extend_months int,
  comment text not null,
  old_end_date date,
  new_end_date date,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz not null default now(),

  constraint chk_prob_decision check (decision in ('extend', 'confirm', 'end')),
  -- Wajah lazmi. Kisi ko pakka karna ya alag karna wo faisla hai jis ka
  -- jawab saal baad bhi maanga ja sakta hai.
  constraint chk_prob_comment check (length(btrim(comment)) >= 5),
  constraint chk_prob_extend check (
    decision <> 'extend' or (extend_months is not null and extend_months between 1 and 12)
  )
);

create index if not exists idx_prob_reviews_person
  on staff_probation_reviews (profile_id, reviewed_at desc);

-- ---------------------------------------------------------------------
-- 4) Saalana chhutti ka hisaab
-- ---------------------------------------------------------------------
-- Ye function SECURITY DEFINER hai aur "mila nahi" ke liye NULL rakhta
-- hai, sifar nahi. Chhutti ka bacha hua adad sifar dikha dena us bande
-- ko chhutti se rok deta hai jis ka haq banta tha.
create or replace function fn_leave_entitlement(p_profile uuid, p_year int)
returns table (
  entitled_days numeric,
  used_days numeric,
  remaining_days numeric,
  is_confirmed boolean,
  confirmed_from date,
  reason text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_pol hr_leave_policy%rowtype;
  v_status text;
  v_confirmed date;
  v_entitled numeric;
  v_used numeric;
  v_months int;
begin
  if not coalesce(fn_hr_can_view_staff(p_profile), false) then
    raise exception 'Is bande ki chhutti ka hisaab dekhne ka haq nahi.';
  end if;

  select * into v_pol from hr_leave_policy where id;

  select sd.employment_status, sd.confirmed_at
    into v_status, v_confirmed
    from staff_details sd
   where sd.profile_id = p_profile;

  if v_status is null then
    -- Staff ka record hi nahi. Ye sifar nahi -- ye "pata nahi" hai.
    return query select null::numeric, null::numeric, null::numeric,
                        null::boolean, null::date,
                        'Is bande ka staff record maujood nahi.'::text;
    return;
  end if;

  -- Istemal shuda: sirf manzoor shuda saalana chhutti, usi saal ki.
  select coalesce(sum(
           case when lr.is_half_day then 0.5 else lr.days end
         ), 0)
    into v_used
    from leave_requests lr
   where lr.profile_id = p_profile
     and lr.status = 'approved'
     and lr.leave_type = 'annual'
     and extract(year from lr.from_date)::int = p_year;

  if v_status <> 'confirmed' or v_confirmed is null then
    return query select 0::numeric, v_used, 0::numeric, false, v_confirmed,
      case when v_status = 'probation'
        then 'Aazmaishi muddat jaari hai. Saalana chhutti pakka hone ke baad shuru hoti hai.'
        else 'Ye banda ab mulazim nahi.' end::text;
    return;
  end if;

  -- Pakka hone se pehle ka koi haq nahi banta.
  if extract(year from v_confirmed)::int > p_year then
    return query select 0::numeric, v_used, 0::numeric, true, v_confirmed,
      'Is saal tak ye banda pakka nahi hua tha.'::text;
    return;
  end if;

  if v_pol.prorate_first_year and extract(year from v_confirmed)::int = p_year then
    -- Jis mahine pakka hua, wo mahina poora ginte hain.
    v_months := 13 - extract(month from v_confirmed)::int;
    v_entitled := round((v_pol.annual_leave_days::numeric * v_months) / 12, 1);
  else
    v_entitled := v_pol.annual_leave_days::numeric;
  end if;

  return query select
    v_entitled,
    v_used,
    greatest(0, v_entitled - v_used),
    true,
    v_confirmed,
    null::text;
end;
$$;

-- ---------------------------------------------------------------------
-- 5) Kis ki aazmaish khatam ho rahi hai
-- ---------------------------------------------------------------------
-- din_baqi manfi ho to iska matlab tareekh GUZAR CHUKI hai aur faisla
-- abhi tak nahi hua. Wo banda aazmaish par hi hai -- khud ba khud pakka
-- nahi hua.
create or replace function fn_hr_probation_due(p_days_ahead int default 14)
returns table (
  profile_id uuid,
  full_name text,
  designation text,
  probation_start_date date,
  probation_end_date date,
  days_left int,
  is_overdue boolean,
  extensions int,
  can_extend boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_pol hr_leave_policy%rowtype;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Sirf staff ke liye.';
  end if;

  select * into v_pol from hr_leave_policy where id;

  return query
  select
    v.id, v.full_name, v.designation, v.p_start, v.p_end,
    (v.p_end - v_today)::int,
    (v.p_end < v_today),
    v.ext,
    -- Kul muddat ki hadd. Is se aage baRhane ka raasta band -- faisla
    -- karna hi paRega.
    ((v.p_end - v.p_start) < (v_pol.probation_max_total_months * 30))
  from (
    select pr.id, pr.full_name, sd.designation,
           coalesce(sd.probation_start_date, sd.hire_date) as p_start,
           sd.probation_end_date as p_end,
           (select count(*)::int from staff_probation_reviews r
             where r.profile_id = pr.id and r.decision = 'extend') as ext
    from profiles pr
    join staff_details sd on sd.profile_id = pr.id and sd.is_active
    where pr.is_active
      and sd.employment_status = 'probation'
      and sd.probation_end_date is not null
      and coalesce(fn_hr_can_view_staff(pr.id), false)
  ) v
  where v.p_end <= v_today + p_days_ahead
  order by v.p_end;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table hr_leave_policy enable row level security;
alter table staff_probation_reviews enable row level security;

drop policy if exists policy_read on hr_leave_policy;
create policy policy_read on hr_leave_policy for select to authenticated
  using (public.fn_is_any_staff());

drop policy if exists policy_write on hr_leave_policy;
create policy policy_write on hr_leave_policy for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_active
                   and p.role::text in ('hr','admin','owner','super_admin')));

drop policy if exists prob_read on staff_probation_reviews;
create policy prob_read on staff_probation_reviews for select to authenticated
  using (coalesce(public.fn_hr_can_view_staff(profile_id), false));

-- Likhna sirf HR/Admin. Aur apne aap par faisla koi nahi kar sakta.
drop policy if exists prob_write on staff_probation_reviews;
create policy prob_write on staff_probation_reviews for insert to authenticated
  with check (
    profile_id <> auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.is_active
                  and p.role::text in ('hr','admin','owner','super_admin'))
  );

comment on table hr_leave_policy is
  'Saalana chhutti aur aazmaishi muddat ka usool -- ek hi qatar (238).';
comment on table staff_probation_reviews is
  'Aazmaish ka har faisla, comment ke sath. Khamoshi se koi pakka nahi hota (238).';
comment on column staff_details.employment_status is
  'probation / confirmed / ended. Tareekh guzarne par khud ba khud confirmed NAHI hota (238).';
