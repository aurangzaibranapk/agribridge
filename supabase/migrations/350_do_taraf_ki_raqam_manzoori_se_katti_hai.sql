-- =====================================================================
-- AgriBridge — Migration 350: Do taraf ki raqam manzoori se katti hai
-- =====================================================================
-- Malik (6 September):
--
--   *"Agar Muhammad Aslam ne aap se fertilizer bhi udhaar liya hua hai:
--   Fertilizer due -- Farmer se Rs 10,000 lena. Aur us ki mazdoori bani:
--   Labour -- Farmer ko Rs 3,000 dena. System silently balance overwrite
--   na kare. Dikhaye: Farmer se Lena Rs 10,000, Farmer ko Dena Rs 3,000,
--   Net Exposure Rs 7,000 Lena. Phir authorized settlement... Is
--   adjustment ka proper journal + audit trail hoga. Silent set-off
--   bilkul nahi."*
--
-- =====================================================================
-- YE KAAM KHUD KYUN NAHI HONA CHAHIYE
-- =====================================================================
--
-- Khud-ba-khud kaat dena aasan lagta hai aur teen jagah nuqsan karta
-- hai:
--
--   1. Wasooli karne wala nahi jaanta ke us bande ki mazdoori bhi baqi
--      thi -- usay sirf "7,000" nazar aata hai.
--   2. Kisi ko pata nahi chalta ke Rs 3,000 kis khaate se kis khaate
--      mein gaye, aur kis ke kehne par.
--   3. Sab se ahem: mazdoori ka paisa MAZDOOR ka haq hai. Usay khaad ke
--      udhaar mein kaat lena us bande se poochhe baghair -- wo faisla
--      software ka nahi.
--
-- Is liye yahan set-off ek QATAR hai: koi maangta hai, koi manzoor karta
-- hai, aur us ka apna journal banta hai. Jo hua wo dono taraf nazar
-- aata hai.
--
-- =====================================================================
-- SIRF DO KHATON KE DARMIYAN, AUR DONO US BANDE KE
-- =====================================================================
--
-- Ek taraf wo khata jahan se hamein LENA hai (asset -- 1100, 1145, 1150,
-- 1120...), doosri taraf wo jahan hamein DENA hai (liability -- 2000,
-- 2010, 2015...).
--
-- Raqam kisi bhi taraf ke baqi se ZYADA nahi ho sakti. Ye rok database
-- par hai, code par nahi -- kyunke ye wohi ghalti hai jo do bande ek hi
-- waqt adjust karne par ho jati hai.
-- =====================================================================


create table if not exists public.party_settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_number text unique not null,

  party_type text not null check (party_type in ('farmer', 'staff', 'customer', 'supplier')),
  party_id   uuid not null,

  -- Jahan se lena tha (asset) -- ye kam hoga.
  lena_khata text not null,
  -- Jahan dena tha (liability) -- ye bhi kam hoga.
  dena_khata text not null,

  amount numeric(14,2) not null check (amount > 0),

  -- Wajah lazmi hai. Malik ka usool har manzoori par yehi hai, aur yahan
  -- wo aur zaroori hai: chhe mahine baad koi poochhega ke ye Rs 3,000
  -- kahan gaye.
  wajah text not null check (length(trim(wajah)) > 0),

  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,

  journal_entry_id uuid references public.journal_entries(id),

  branch_id   uuid references public.branches(id),
  created_by  uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at  timestamptz not null default now(),

  -- Ek hi khata dono taraf nahi ho sakta -- wo adjustment nahi, khali
  -- qadam hai.
  constraint chk_settlement_do_khate check (lena_khata <> dena_khata)
);

comment on table public.party_settlements is
  'Ek bande ke "lena" aur "dena" ko manzoori se kaatna. Khud-ba-khud kabhi nahi -- malik ka usool: silent set-off bilkul nahi (350).';

create index if not exists idx_settlement_banda on public.party_settlements (party_type, party_id);
create index if not exists idx_settlement_halat on public.party_settlements (status, created_at);

alter table public.party_settlements enable row level security;

drop policy if exists settlement_staff_parh_sakta on public.party_settlements;
create policy settlement_staff_parh_sakta on public.party_settlements
  for select using (fn_is_any_staff());


-- ---------------------------------------------------------------------
-- Manzoori ke baad taala
-- ---------------------------------------------------------------------
create or replace function public.fn_settlement_taala()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    if new.amount is distinct from old.amount
       or new.lena_khata is distinct from old.lena_khata
       or new.dena_khata is distinct from old.dena_khata
       or new.party_id is distinct from old.party_id
       or new.party_type is distinct from old.party_type then
      raise exception 'Ye adjustment manzoor ho kar kitab mein ja chuka hai. Ab badla nahi ja sakta — ulti qatar banayein.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_settlement_taala on public.party_settlements;
create trigger trg_settlement_taala
  before update on public.party_settlements
  for each row execute function public.fn_settlement_taala();


-- ---------------------------------------------------------------------
-- Kisi ek khate par is bande ka kitna baqi hai
-- ---------------------------------------------------------------------
-- Ye function set-off ki hadd nikalne ke liye hai. `fn_bande_ka_khulasa`
-- poori fehrist deta hai; yahan ek khate ka seedha jawab chahiye.
--
-- NULL nahi lautata: khata maujood hai aur us par kuch nahi to 0 sach
-- hai. Ijazat ka masla `fn_is_any_staff()` pehle hi rok deta hai.
create or replace function public.fn_bande_ka_khate_par_baqi(
  p_party_type text,
  p_party_id   uuid,
  p_khata      text
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case
           when not fn_is_any_staff() then 0
           else greatest(
             coalesce((
               select case when a.account_type = 'liability'
                           then sum(coalesce(l.credit,0) - coalesce(l.debit,0))
                           else sum(coalesce(l.debit,0) - coalesce(l.credit,0)) end
                 from journal_lines l
                 join gl_accounts a on a.code = l.account_code
                where l.party_type = p_party_type
                  and l.party_id = p_party_id
                  and l.account_code = p_khata
                group by a.account_type
             ), 0), 0)
         end;
$$;

comment on function public.fn_bande_ka_khate_par_baqi(text, uuid, text) is
  'Is bande ka ek khate par baqi -- asset par lena, liability par dena. Set-off ki hadd isi se nikalti hai (350).';

revoke all on function public.fn_bande_ka_khate_par_baqi(text, uuid, text) from public;
grant execute on function public.fn_bande_ka_khate_par_baqi(text, uuid, text) to authenticated;


-- ---------------------------------------------------------------------
-- Safha aur ijazat
-- ---------------------------------------------------------------------
-- Ye kaam staff ka nahi. Malik ka jumla tha "authorized settlement" --
-- aur do taraf ki raqam kaatna wo faisla hai jo hisaab jaanne wale ke
-- haath mein rehna chahiye.
insert into public.features (key, label, route, is_active, is_sensitive, icon)
values ('settlements', 'Khaton ka Adjustment', '/admin/settlements', true, true, 'Scale')
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_active = true, is_sensitive = true;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'settlements', ARRAY['view','create'], 'own_branch'),
  ('finance', 'settlements', ARRAY['view','create','approve','reject'], 'all'),
  ('admin_assistant', 'settlements', ARRAY['view'], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'settlements', 'rm',
  'Ek hi bande se lena bhi ho aur us ko dena bhi — to dono ko manzoori ke sath kaatna. Ye kaam khud-ba-khud kabhi nahi hota.',
  'Manager darkhwast deta hai, Finance manzoori. Staff ke paas ye safha nahi.',
  'Jab ek bande ke dono taraf raqam khari ho aur us se baat ho chuki ho ke adjust kar dein.',
  ARRAY[
    'Banda chunein — us ke saare khate, lena aur dena alag alag, saamne aa jate hain.',
    'Do khate chunein: ek jahan se lena hai, ek jahan dena hai.',
    'Raqam likhein. Wo dono mein se chhoti raqam se zyada nahi ho sakti — system rok deta hai.',
    'Wajah likhein (lazmi). Chhe mahine baad yehi batati hai ke ye raqam kahan gayi.',
    'Finance ki manzoori par journal banti hai aur dono khate kam ho jate hain.'
  ],
  'Manzoori ke baad us bande ke khaate par dono adad kam nazar aate hain, aur adjustment ki apni qatar bhi.',
  ARRAY[
    'Bande se baat kiye baghair adjust na karein. Mazdoori ka paisa us ka haq hai; usay khaad ke udhaar mein kaat lena us se poochhe baghair software ka faisla nahi.',
    'Ye "wasooli" nahi hai — cash kahin nahi hila. Sirf do khate kam hue. Cash aaye to wo Paisa & Khata se darj hota hai.',
    'Manzoor shuda adjustment badla nahi ja sakta — ghalti par ulti qatar banayein.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
