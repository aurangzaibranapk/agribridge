-- =====================================================================
-- AgriBridge — Migration 325: Categories ki safai (merge)
-- =====================================================================
-- Testing par 42 categories hain aur un mein se kai ek hi cheez ke do do
-- naam hain:
--
--   "Cooking Oil & Ghee" (5)      aur  "Ghee & Cooking Oil" (4)
--   "Soap & Detergent" (4)        aur  "Soap, Detergent & Personal Care" (22)
--   "Spices & Masala" (6)         aur  "Spices, Masale & Grocery Items" (12)
--   "Pesticide" (0)               aur  "Pesticides" (1)
--   "Tea & Beverages" (4)         aur  "Tea & Health Products" (8)
--
-- Ye sirf badsoorti nahi. Jab ek hi cheez do jagah baithi ho to:
--   - dukan par banda dono jagah dhoondhta hai,
--   - stock ki qeemat do hisson mein bat jati hai,
--   - aur "is category mein kitna maal hai" ka jawab hamesha kam aata
--     hai -- bina kisi ko pata chale ke kam kyun hai.
--
-- =====================================================================
-- DO FAISLE
-- =====================================================================
--
-- 1. **AI faisla nahi karta -- tajweez deta hai.**
--    Kaunsi category kis mein milani hai, ye malik tay karte hain. Safha
--    sirf ye batata hai ke ye do naam mil-te julte hain aur har ek mein
--    kitna maal hai. Ye is project ka apna usool hai: AI khud kuch
--    mehfooz nahi karta, draft banata hai.
--
-- 2. **Mili hui category ka nishan rehta hai.**
--    Merge ke baad purani category mit jati hai. Agar us ka koi record
--    na rakha jaye to agle mahine ye sawal be-jawab reh jata hai ke
--    "Ghee & Cooking Oil kahan gayi -- kisi ne mita di, ya wo kabhi thi
--    hi nahi?" Is liye `category_merges` mein likha jata hai: kya kis
--    mein gaya, kitne product hile, kis ne kiya, aur kyun.
-- =====================================================================

create table if not exists public.category_merges (
  id             uuid primary key default gen_random_uuid(),
  -- Purani category ka NAAM (id nahi -- wo to mit chuki hogi).
  from_name      text not null,
  from_id        uuid not null,
  into_id        uuid not null references public.categories(id) on delete cascade,
  into_name      text not null,
  products_moved int not null default 0,
  children_moved int not null default 0,
  reason         text,
  merged_by      uuid references auth.users(id),
  merged_at      timestamptz not null default now()
);

create index if not exists idx_category_merges_at on public.category_merges (merged_at desc);

alter table public.category_merges enable row level security;

drop policy if exists staff_read_category_merges on public.category_merges;
create policy staff_read_category_merges on public.category_merges
  for select using (public.fn_is_any_staff());

grant select on public.category_merges to authenticated;

comment on table public.category_merges is
  'Kaunsi category kis mein mili. Purani category mit jati hai, is liye us ka naam yahan rakha jata hai -- warna "wo kahan gayi" ka jawab kabhi nahi milta.';


-- ---------------------------------------------------------------------
-- Merge ka function
-- ---------------------------------------------------------------------
-- Yahan teen rokein hain, aur teenon ki apni wajah hai:
--
--   a) Apne aap mein nahi mil sakti  -- warna category mit jati aur us
--      ke product kisi ke bhi nahi rehte.
--   b) Maa apni hi aulad mein nahi mil sakti -- warna aulad ka parent
--      khud aulad ban jata aur darakht mein halqa (cycle) ban jata,
--      jis se har fehrist jam jati.
--   c) Sirf Owner/Admin -- ye kaam ulta nahi hota. Product wapas
--      bhejne parte hain, ek ek kar ke.
create or replace function public.fn_merge_categories(
  p_from uuid,
  p_into uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_from  categories%rowtype;
  v_into  categories%rowtype;
  v_prod  int;
  v_kids  int;
  v_cycle boolean;
begin
  if not exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.is_active
       and p.role::text in ('owner','super_admin','admin')
  ) then
    raise exception 'Category milana sirf Malik ya Admin ka kaam hai.';
  end if;

  if coalesce(length(trim(p_reason)), 0) < 5 then
    raise exception 'Wajah likhna zaroori hai -- ye kaam ulta nahi hota.';
  end if;

  if p_from = p_into then
    raise exception 'Ek hi category ko apne aap mein nahi milaya ja sakta.';
  end if;

  select * into v_from from categories where id = p_from;
  if not found then raise exception 'Purani category nahi mili.'; end if;

  select * into v_into from categories where id = p_into;
  if not found then raise exception 'Jis mein milani hai wo category nahi mili.'; end if;

  -- Maa apni hi aulad mein na mile: warna darakht mein halqa ban jata hai.
  with recursive neeche as (
    select id from categories where id = p_from
    union all
    select c.id from categories c join neeche n on c.parent_category_id = n.id
  )
  select exists (select 1 from neeche where id = p_into) into v_cycle;

  if v_cycle then
    raise exception '"%" "%" ke andar hai -- maa ko apni hi aulad mein nahi milaya ja sakta.',
      v_into.name, v_from.name;
  end if;

  update products set category_id = p_into, updated_at = now() where category_id = p_from;
  get diagnostics v_prod = row_count;

  update categories set parent_category_id = p_into where parent_category_id = p_from;
  get diagnostics v_kids = row_count;

  insert into category_merges
    (from_name, from_id, into_id, into_name, products_moved, children_moved, reason, merged_by)
  values
    (v_from.name, p_from, p_into, v_into.name, v_prod, v_kids, trim(p_reason), auth.uid());

  delete from categories where id = p_from;

  return jsonb_build_object(
    'ok', true,
    'from', v_from.name,
    'into', v_into.name,
    'products_moved', v_prod,
    'children_moved', v_kids
  );
end;
$$;

comment on function public.fn_merge_categories(uuid, uuid, text) is
  'Ek category doosri mein milata hai: product aur aulad hilte hain, nishan category_merges mein rehta hai, phir purani mit jati hai. Sirf Owner/Admin, aur wajah ke baghair nahi.';


-- ---------------------------------------------------------------------
-- Safha, ijazat aur madad
-- ---------------------------------------------------------------------
insert into public.features
  (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'categories.merge',
  'Categories ki safai',
  'Merge categories',
  'کیٹیگری کی صفائی',
  '/admin/categories/merge',
  'Layers',
  true,
  'Ek hi cheez ke do naam — unhen mila kar ek karna.',
  'Two names for the same thing — merging them into one.',
  'ایک ہی چیز کے دو نام — انہیں ملا کر ایک کرنا۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('inventory', 'categories.merge', 30, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- Koi role ki qatar JAAN BOOJH KAR nahi: ye kaam ulta nahi hota, is liye
-- sirf un logon ko khulta hai jo pehle se har cheez dekh sakte hain
-- (Owner / Super Admin / Admin). Rok database ke function mein bhi hai,
-- sirf safhe par nahi.

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'categories.merge',
  'rm',
  'Jab ek hi cheez ki do categories ban jayein ("Cooking Oil & Ghee" aur "Ghee & Cooking Oil"), to unhen mila kar ek karna. Safha khud batata hai ke kaun se naam bohot milte hain aur har ek mein kitna maal hai.',
  'Sirf Malik aur Admin — kyunki ye kaam ulta nahi hota.',
  'Jab safhe par ek hi cheez do jagah nazar aaye, ya naye products charhane ke baad.',
  ARRAY[
    'Upar wali fehrist dekhein: har jodi ke saamne dono ka naam aur un mein product ki ginti hai.',
    '"Milayein" dabayein. Safha khud tajweez deta hai ke jis mein zyada maal hai wo bache — badla ja sakta hai.',
    'Wajah likhein (kam az kam paanch harf), phir "Mila dein".',
    'Jo jodi upar na aayi ho, us ke liye neeche "Koi bhi do categories" wala khana hai.'
  ],
  'Milane ke baad Grocery ya Stock ka safha khol kar dekh lein ke ginti theek aa rahi hai.',
  ARRAY[
    'YE KAAM ULTA NAHI HOTA. Product ek ek kar ke wapas bhejne parenge. Milane se pehle dono naam dhyan se parh lein.',
    'Milte julte naam ka matlab hamesha "ek hi cheez" nahi hota. "Poultry Feed" aur "Cattle/Dairy Feed" ke aadhe lafz ek hain magar wo do alag cheezein hain — unhen mila dena poultry ka stock hamesha ke liye cattle mein daal dega.',
    'Safha faisla nahi karta — sirf jodiyan saamne rakhta hai. Fehrist mein aa jane ka matlab ye nahi ke wo waqai ek hi cheez hain.',
    'Jis category mein product sifar hain us ko milana bhi be-zarar nahi: agar us ke neeche sub-categories hain to wo bhi hil jayengi.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
