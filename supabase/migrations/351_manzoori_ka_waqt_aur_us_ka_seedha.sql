-- =====================================================================
-- AgriBridge — Migration 351: Manzoori ka waqt, aur us ka seedha
-- =====================================================================
-- Malik (6 September):
--
--   *"Main is mein proper Verification SLA rakhunga. For example
--   default: Manager 12 hours... 12 hours cross: OVERDUE — Manager
--   Verification. Phir configurable escalation: 0–12 Hours -> Manager,
--   12–24 Hours -> Manager + Department Head/Admin, 24+ Hours -> CEO /
--   Owner Dashboard."*
--
--   *"CEO ko 100 normal entries nahi dikhani. Sirf exception."*
--
-- =====================================================================
-- WAQT KAHIN LIKHA HI NAHI THA
-- =====================================================================
--
-- Ab tak "manzoori ka intezar" ki koi umar nahi thi. Qatar pending par
-- baithi rehti thi aur kisi ko pata nahi chalta tha ke wo teen ghante
-- purani hai ya teen din. Nateeja hamesha ek hi nikalta hai: jo qatar
-- kisi ki nazar se guzar jaye, wo hamesha ke liye wahin reh jati hai.
--
-- =====================================================================
-- CEO KO GINTI NAHI, EXCEPTION
-- =====================================================================
--
-- Malik ka ye jumla poore design ka rukh badal deta hai. Owner ke safhe
-- par pending qatarein daal dena wohi shor paida karta hai jise koi
-- nahi parhta. Is liye yahan do alag jawab bante hain:
--
--   * Manager ko: us ki apni qatarein, umar ke sath.
--   * Owner ko: SIRF wo jo hadd se guzar chuki hain -- ginti, sab se
--     purani ki umar, aur us mein phansi hui raqam.
--
-- =====================================================================
-- TEEN JAGAH KI QATAREIN, EK HI FEHRIST
-- =====================================================================
--
-- Paisa & Khata, Mazdoori, aur Khaton ka Adjustment -- teenon mein
-- manzoori ka intezar hota hai. Manager ke liye teen safhe kholna wohi
-- baat hai jo ek safha na hone ke barabar hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Waqt ki hadd -- badli ja sakne wali
-- ---------------------------------------------------------------------
-- Malik ne "for example" kaha tha, yani ye adad pathar par nahi. Is liye
-- table mein hain, code mein nahi.
create table if not exists public.verification_sla (
  id boolean primary key default true check (id),
  manager_hours integer not null default 12 check (manager_hours > 0),
  head_hours    integer not null default 24 check (head_hours > 0),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.profiles(id),
  constraint chk_sla_tarteeb check (head_hours > manager_hours)
);

comment on table public.verification_sla is
  'Manzoori ka waqt: kitne ghante baad manager overdue, aur kitne baad ooper jata hai. Ek hi qatar (351).';

insert into public.verification_sla (id) values (true) on conflict (id) do nothing;

alter table public.verification_sla enable row level security;
drop policy if exists sla_staff_parh_sakta on public.verification_sla;
create policy sla_staff_parh_sakta on public.verification_sla
  for select using (fn_is_any_staff());


-- ---------------------------------------------------------------------
-- 2) Teenon jagah ki intezar wali qatarein, ek fehrist mein
-- ---------------------------------------------------------------------
create or replace view public.v_manzoori_ki_qatar as
with hadd as (select manager_hours, head_hours from public.verification_sla where id)
select 'kharche'::text as kahan,
       'Paisa & Khata'::text as kahan_ka_naam,
       e.id,
       e.expense_number as number,
       e.amount,
       e.description as tafseel,
       e.branch_id,
       e.requested_by as bheja,
       e.created_at,
       extract(epoch from (now() - e.created_at)) / 3600.0 as ghante,
       h.manager_hours,
       h.head_hours
  from public.company_expense_requests e
  cross join hadd h
 where e.status = 'pending'

union all

select 'mazdoori',
       'Mazdoori',
       m.id,
       m.entry_number,
       m.amount,
       m.work_detail,
       m.branch_id,
       m.created_by,
       m.created_at,
       extract(epoch from (now() - m.created_at)) / 3600.0,
       h.manager_hours,
       h.head_hours
  from public.labour_work_entries m
  cross join hadd h
 where m.status = 'pending'

union all

select 'settlements',
       'Khaton ka Adjustment',
       s.id,
       s.settlement_number,
       s.amount,
       s.wajah,
       s.branch_id,
       s.created_by,
       s.created_at,
       extract(epoch from (now() - s.created_at)) / 3600.0,
       h.manager_hours,
       h.head_hours
  from public.party_settlements s
  cross join hadd h
 where s.status = 'pending';

comment on view public.v_manzoori_ki_qatar is
  'Teenon jagah ki intezar wali qatarein, umar ke sath. Manager ke liye teen safhe kholna ek safha na hone ke barabar hai (351).';


-- ---------------------------------------------------------------------
-- 3) Owner ke liye khulasa -- ginti nahi, exception
-- ---------------------------------------------------------------------
-- Malik: *"Sirf exception: 3 Financial Entries Overdue, oldest
-- verification pending: 31 hours, amount involved: Rs 47,500."*
--
-- Is liye ye function wohi teen adad deta hai, aur SIRF un qataron ka jo
-- hadd se guzar chuki hain.
--
-- NULL aur SIFAR ka farq yahan bhi qayam hai: qatarein na hone par ginti
-- 0 hai (sach), magar "sab se purani ki umar" NULL rehti hai -- kyunke
-- koi qatar hi nahi, aur "0 ghante" likhna jhoot hota.
create or replace function public.fn_manzoori_ka_khulasa()
returns table (
  darja        text,     -- 'manager' | 'head' | 'malik'
  ginti        bigint,
  purani_umar  numeric,  -- ghante -- NULL agar koi qatar hi nahi
  phansi_raqam numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select d.darja,
         count(q.id),
         max(q.ghante),
         coalesce(sum(q.amount), 0)
    from (values ('manager'), ('head'), ('malik')) as d(darja)
    left join public.v_manzoori_ki_qatar q
      on case
           when q.ghante < q.manager_hours then 'manager'
           when q.ghante < q.head_hours    then 'head'
           else 'malik'
         end = d.darja
   where fn_is_any_staff()
   group by d.darja;
$$;

comment on function public.fn_manzoori_ka_khulasa() is
  'Manzoori ka intezar -- darje ke hisaab se ginti, sab se purani umar aur phansi hui raqam. Owner ko ginti nahi, exception dikhana hai (351).';

revoke all on function public.fn_manzoori_ka_khulasa() from public;
grant execute on function public.fn_manzoori_ka_khulasa() to authenticated;


-- ---------------------------------------------------------------------
-- 4) Is ka apna safha NAHI hai
-- ---------------------------------------------------------------------
-- Pehle yahan `verification` ke naam se ek naya safha banaya gaya tha.
-- Malik ne wo mana kiya:
--
--   *"Agar already bana hai to theek hai... Ek hi kaam baar baar naye
--   tag naye naam ke sath nahi hone chahiye."*
--
-- Aur wo theek the: "Approval Inbox" (`/admin/submissions`) pehle se
-- maujood tha, aur Command Center par us ka apna department bhi bana
-- hua tha. Ek hi kaam ke do naam ban gaye the.
--
-- Ye view aur function apni jagah hain -- unhen Approval Inbox aur
-- Command Center DONO parhte hain (`lib/manzoori-qatar.ts` se), taake
-- ek hi hisaab do jagah alag alag na lage.
