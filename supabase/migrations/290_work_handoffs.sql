-- =====================================================================
-- AgriBridge — Migration 290: Kaam ka haath badalna (work handoffs)
-- =====================================================================
-- Malik ka kehna (4 September): "jis page ka kaam complete ho neeche
-- green line aaye aur paighaam ke ab is page par is ka kaam hai; jis
-- jis ko kaam jaye us ki sidebar mein bhi aa jaye, dashboard par bhi,
-- aur notification mein bhi."
--
-- Asal masla ye hai: nizam mein kaam ek safhe par khatam ho kar doosre
-- par shuru hota hai -- purchase manzoor hui to ab Receiving ka kaam
-- hai; maal gina gaya to ab rate aur POS ka. Magar ye baat sirf us
-- bande ko maloom hoti thi jo pehla qadam kar raha tha. Agla banda
-- tab tak intezar karta hai jab tak koi usay phone na kare. Kaam ruka
-- nahi hota -- kisi ko pata hi nahi hota ke us ki baari aa gayi.
--
-- YE TABLE WOHI KHABAR HAI: kya poora hua, ab kya karna hai, aur KIS
-- KA kaam hai.
--
-- TEEN FAISLE, TEENON JAAN BOOJH KAR:
--
-- 1. KHABAR DO TARAH JATI HAI -- role ko aur naam ko. Sirf naam par
--    rakhne se wo banda chhutti par ho to kaam khaRa reh jata hai.
--    Sirf role par rakhne se koi zimmedari nahi banti. Malik ne dono
--    maange, aur dono theek hain: aam soorat mein role, aur us record
--    par kisi ka naam laga ho to us ko bhi.
--
-- 2. NOTIFICATION DATABASE SE BANTI HAI, safhe se nahi. Purchase kai
--    raaston se manzoor hoti hai -- safha, sheet ka import, aur AI ki
--    tajweez. Agar khabar bhejna har raaste ka apna kaam hota, to koi
--    ek raasta usay karna bhool jata aur wo soorat mahinon tak nazar
--    na aati (safha bilkul theek chalta rehta, bas khabar na jati).
--    Is liye khabar wahin banti hai jahan handoff banta hai.
--
-- 3. EK RECORD KA EK KAAM EK DAFA. Wohi purchase dobara manzoor ho to
--    nayi khabar nahi banti. Bar bar aane wali khabar ko log parhna
--    chhoR dete hain, aur us ke baad asal khabar bhi us ke sath dab
--    jati hai.
-- =====================================================================

create table if not exists public.work_handoffs (
  id uuid primary key default gen_random_uuid(),

  -- Kahan se aaya aur kahan jana hai. Dono features ki key.
  from_feature text references public.features(key) on delete set null,
  to_feature   text not null references public.features(key) on delete cascade,
  to_route     text not null,

  -- Kis cheez ka kaam. record_label wo naam hai jo banda pehchanta
  -- hai ("PO-1788537423737"), id nahi.
  record_table text,
  record_id    uuid,
  record_label text,

  -- Banday ki zaban mein: kya hua, aur ab kya karna hai.
  title   text not null,
  message text not null,

  -- Kis ka kaam: role ya naam, ya dono.
  to_roles      text[] not null default '{}',
  to_profile_id uuid references public.profiles(id) on delete set null,

  -- Kis shaakh/dukan ka kaam -- taake doosri shaakh wale ko na dikhe.
  branch_id uuid references public.branches(id) on delete set null,

  status     text not null default 'open' check (status in ('open','done','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  done_by    uuid references public.profiles(id) on delete set null,

  -- Khabar kis ke liye hai, ye khali nahi ho sakta. Bina kisi ke naam
  -- ya role ke khabar wo qatar hai jo kisi ko nazar nahi aati.
  constraint chk_handoff_has_recipient
    check (cardinality(to_roles) > 0 or to_profile_id is not null)
);

comment on table public.work_handoffs is
  'Kaam ek safhe par khatam ho kar doosre par shuru hota hai -- ye us haath badalne ka record (290).';

-- Ek record ka ek kaam ek dafa: khuli hui qatar dobara nahi banti.
create unique index if not exists ux_handoff_open_once
  on public.work_handoffs (to_feature, record_table, record_id)
  where status = 'open' and record_id is not null;

create index if not exists ix_handoff_open_feature
  on public.work_handoffs (to_feature, status) where status = 'open';
create index if not exists ix_handoff_open_person
  on public.work_handoffs (to_profile_id, status) where status = 'open';

alter table public.work_handoffs enable row level security;

drop policy if exists wh_read on public.work_handoffs;
create policy wh_read on public.work_handoffs
  for select to authenticated
  using (
    public.fn_is_any_staff()
    and (
      to_profile_id = auth.uid()
      -- Jis ne ye kaam poora kiya, wo bhi dekh sakta hai -- us ki sabz
      -- patti isi qatar se banti hai. Bina is ke banda apna hi bheja
      -- hua kaam nahi dekh pata aur usay yaqeen nahi hota ke khabar
      -- gayi bhi ya nahi; phir wo phone karta hai, aur nizam ka faida
      -- khatam ho jata hai.
      or created_by = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_active
          and (p.role::text = any (to_roles)
               or p.role::text in ('owner','super_admin','admin'))
      )
    )
  );

drop policy if exists wh_update on public.work_handoffs;
create policy wh_update on public.work_handoffs
  for update to authenticated
  using (
    public.fn_is_any_staff()
    and (
      to_profile_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_active
          and (p.role::text = any (to_roles)
               or p.role::text in ('owner','super_admin','admin'))
      )
    )
  );

-- =====================================================================
-- Khabar khud ba khud: handoff bana to notification bhi bani
-- =====================================================================
-- Ye trigger par is liye hai ke purchase kai raaston se manzoor hoti
-- hai -- safha, sheet ka import, aur AI ki tajweez. Agar khabar bhejna
-- har raaste ka apna kaam hota, to koi ek raasta usay bhool jata aur
-- wo soorat mahinon nazar na aati: safha bilkul theek chalta rehta,
-- bas khabar na jati. Yahan bhoolne ki gunjaish hi nahi.
-- =====================================================================

create or replace function public.fn_handoff_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text;
begin
  v_link := new.to_route;

  -- Naam wale bande ko, aur role walon ko. Jo dono mein aata ho us ko
  -- ek hi dafa -- do khabarein ek hi kaam ki bhejna khabar ki qeemat
  -- girata hai.
  insert into public.notifications (recipient_user_id, title, message, link_url)
  select distinct p.id, new.title, new.message, v_link
  from public.profiles p
  where p.is_active
    and (
      p.id = new.to_profile_id
      or (cardinality(new.to_roles) > 0 and p.role::text = any (new.to_roles))
    )
    -- Apne kiye hue kaam ki khabar khud ko nahi. Banda jaanta hai ke
    -- us ne abhi kya kiya; us ko dobara batana shor hai.
    and p.id is distinct from new.created_by
    -- Shaakh ka kaam usi shaakh walon ko. Jis ka koi branch na ho
    -- (owner, admin) us ko har soorat mein.
    and (
      new.branch_id is null
      or p.branch_id is null
      or p.branch_id = new.branch_id
      or p.role::text in ('owner','super_admin','admin')
    );

  return new;
end;
$$;

drop trigger if exists trg_handoff_notify on public.work_handoffs;
create trigger trg_handoff_notify
  after insert on public.work_handoffs
  for each row execute function public.fn_handoff_notify();

-- =====================================================================
-- "Mera kaam" -- jo is waqt is bande ke zimme khula hai
-- =====================================================================
-- security_invoker: view usi bande ke RLS par chalti hai jo poochh
-- raha hai. Warna har banda har kisi ka kaam dekh leta (279 ka sabaq).
-- =====================================================================

create or replace view public.v_my_handoffs
with (security_invoker = on) as
select
  h.id,
  h.to_feature,
  h.to_route,
  h.from_feature,
  h.record_table,
  h.record_id,
  h.record_label,
  h.title,
  h.message,
  h.branch_id,
  h.created_at,
  f.label as feature_label,
  -- Naam se aayi khabar zyada zaati hai: wo "kisi ka kaam" nahi,
  -- "MERA kaam" hai. Safha use upar rakh sakta hai.
  (h.to_profile_id = auth.uid()) as mere_naam
from public.work_handoffs h
left join public.features f on f.key = h.to_feature
where h.status = 'open';

comment on view public.v_my_handoffs is
  'Is bande ke zimme khula hua kaam -- sidebar ki ginti, dashboard aur ghanti, teenon isi se (290).';

grant select on public.v_my_handoffs to authenticated, service_role;
grant select, insert, update on public.work_handoffs to authenticated, service_role;

notify pgrst, 'reload schema';
