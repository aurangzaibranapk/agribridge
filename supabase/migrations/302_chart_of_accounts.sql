-- =====================================================================
-- AgriBridge — Migration 302: Khaton ki fehrist (Chart of Accounts)
-- =====================================================================
-- `gl_accounts` pehle din se maujood hai -- poora nizam usi par khaRa
-- hai. Magar us ka koi safha nahi tha: naya khata banane ke liye SQL
-- likhni parti thi, aur ye dekhne ka koi raasta nahi tha ke kis khate
-- mein kitna para hai.
--
-- Ye migration us safhe ko nizam mein darj karti hai. Do rokein saath
-- aati hain, aur dono database mein hain -- safhe mein nahi:
--
--   1. JIS KHATE MEIN ENTRY JA CHUKI, US KI QISM YA RUKH NAHI BADALTA.
--      "1200 Stock" ko baad mein kharcha bana dene ka matlab hai ke
--      pichhle saal ka har goshara chup chaap badal gaya -- aur kisi ko
--      pata bhi nahi chala.
--
--   2. JIS KHATE MEIN RAQAM PARI HAI WO BAND NAHI HOTA. Band khate ka
--      paisa kisi goshare mein nazar nahi aata, magar hota wahin hai.
--
-- Khata MITAYA bhi nahi ja sakta -- us par journal_lines ki foreign key
-- pehle se hai, aur wohi theek hai: khata mitane ka matlab us mein
-- likhi hui har entry ka bemani ho jana hai.
-- =====================================================================

create or replace function public.fn_gl_account_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lines int;
  v_debit numeric;
  v_credit numeric;
begin
  select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_lines, v_debit, v_credit
  from public.journal_lines where account_code = old.code;

  if v_lines > 0 and (new.account_type is distinct from old.account_type
                      or new.normal_side is distinct from old.normal_side
                      or new.is_contra is distinct from old.is_contra) then
    raise exception 'Is khate (% —%) mein % entry ja chuki hain. Ab is ki qism ya rukh nahi badalta — warna pichhle saal ka har goshara chup chaap badal jayega. Naya khata banayein.',
      old.code, old.name, v_lines;
  end if;

  if old.is_active and not new.is_active and round(v_debit - v_credit, 2) <> 0 then
    raise exception 'Is khate (% — %) mein Rs % pare hue hain. Pehle wo raqam kisi doosre khate mein le jayein, phir band karein — band khate ka paisa kisi goshare mein nazar nahi aata.',
      old.code, old.name, abs(round(v_debit - v_credit, 2));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_gl_account_guard on public.gl_accounts;
create trigger trg_gl_account_guard
  before update on public.gl_accounts
  for each row execute function public.fn_gl_account_guard();

-- Khata code chaar hindson ka: 1xxx asaasa, 2xxx zimma, 3xxx sarmaya,
-- 4xxx aamdani, 5xxx-6xxx kharcha. Ye tarteeb poore nizam mein maani
-- rakhti hai (misal ke taur par gosharay isi se chhantte hain), is liye
-- naya khata bhi isi shakl ka hona chahiye.
alter table public.gl_accounts drop constraint if exists chk_gl_code_shape;
alter table public.gl_accounts add constraint chk_gl_code_shape
  check (code ~ '^[0-9]{4}$');

insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.accounts', 'Khaton ki Fehrist', 'Chart of Accounts', 'کھاتوں کی فہرست',
   '/admin/finance/accounts', true, true,
   'Poore nizam ke khate ek jagah -- kis khate mein kitna para hai, aur naya khata banane ka raasta.')
on conflict (key) do update set
  label        = excluded.label,
  label_en     = excluded.label_en,
  label_ur     = excluded.label_ur,
  route        = excluded.route,
  is_active    = true,
  is_sensitive = excluded.is_sensitive,
  description  = excluded.description;

insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager', 'finance.accounts', array['view'], 'all'),
  ('finance', 'finance.accounts', array['view','create','edit'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.accounts', 4, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.accounts', 'rm',
  'Poore nizam ke khate ek jagah: kaunsa khata kis qism ka hai aur us mein aaj kitna para hai.',
  'Owner, Admin aur Finance; Manager dekh sakta hai.',
  'Jab koi naya khata chahiye ho, ya ye dekhna ho ke kisi khate mein kitna para hai.',
  array[
    'Khate qism ke hisaab se bante hain: asaasa, zimma, sarmaya, aamdani, kharcha.',
    'Naya khata banate waqt chaar hindson ka code chunein -- 1xxx asaasa, 2xxx zimma, 3xxx sarmaya, 4xxx aamdani, 5xxx aur 6xxx kharche.',
    'Rukh (debit ya credit) wo taraf hai jis par is khate ka baqi aam tor par hota hai.',
    'Jo khata ab istemal nahi hota usay "band" kar dein -- mitaya nahi ja sakta.'
  ],
  'Naya khata bante hi Journal Entry aur asaason ki qismon mein chunne ke liye aa jata hai.',
  array[
    'Jis khate mein entry ja chuki ho us ki qism ya rukh badalna. Nizam mana kar dega -- aur yehi theek hai: qism badalne se pichhle saal ka har goshara chup chaap badal jata hai aur kisi ko pata nahi chalta. Aisi surat mein naya khata banayein.',
    'Har chhoti cheez ka apna khata bana lena. Sau khate ka matlab hai ke koi bhi goshara padhne ke qabil nahi rehta; kharche ki tafseel kharche ke apne safhe par hoti hai, khate mein nahi.',
    'Jis khate mein raqam pari ho usay band karne ki koshish. Wo paisa kahin ghayab nahi hota -- bas nazar aana band ho jata hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose    = excluded.purpose,
  who_uses   = excluded.who_uses,
  when_use   = excluded.when_use,
  how_steps  = excluded.how_steps,
  next_step  = excluded.next_step,
  mistakes   = excluded.mistakes,
  updated_at = now();
