-- =====================================================================
-- AgriBridge — Migration 317: AI ka apna khata
-- =====================================================================
-- Malik ka sawal (5 September): *"jo maine apne ERP mein itna AI involve
-- kiya hai, kya is ka mujhe bill aayega?"*
--
-- Jawab: haan, magar sirf Google ki taraf se aur sirf AI wale hisse par.
-- Magar us waqt asal ginti KAHIN NAHI THI. Sirf `bridge_ai_activity_log`
-- tha, aur wo bhi sirf chat panel ka -- bill reader, qism ki tajweez,
-- tasveer, tasveer se maloomat nikalna: in mein se koi bhi darj nahi
-- hota tha.
--
-- Yani sawal ka theek jawab dena mumkin hi nahi tha. "Shayad zyada nahi"
-- kehna is project mein wohi ghalti hoti jo bar bar mehngi paRi hai:
-- jis cheez ka hisaab na rakha jata ho, us ke saamne adad likh dena.
--
-- Ab har AI call yahan darj hoti hai -- kis feature se, kaunsa model,
-- kamyab hui ya nahi, aur kitne token lage. Token ki ginti Google apne
-- jawab mein khud bhejta hai (`usageMetadata`); wohi rakhi jati hai,
-- koi andaza nahi lagaya jata. Jo na mile wo NULL rehta hai, sifar
-- nahi -- kyunki "sifar token" aur "ginti nahi mili" ek cheez nahi.
--
-- Ye khata paisa nahi ginta. Qeemat Google tay karta hai aur badalti
-- rehti hai; yahan sirf ISTEMAL likha jata hai. Bill Google ke apne
-- safhe par dekha jata hai -- ye khata us se pehle bata deta hai ke
-- kitna kaam hua.
-- =====================================================================

create table if not exists public.ai_usage_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Kis feature ne bulaya: 'chat', 'qism-tajweez', 'tasveer',
  -- 'bill-reader', 'product-parhna'...
  feature       text not null,

  -- 'likhai' (text) | 'tasveer' (banayi) | 'tasveer-parhna' (photo se
  -- maloomat). Teenon ki qeemat alag hoti hai, is liye alag ginti.
  kind          text not null,

  model         text,
  ok            boolean not null,
  error         text,

  -- Google ke jawab se. Na mile to NULL -- sifar nahi.
  prompt_tokens int,
  output_tokens int,
  total_tokens  int,

  -- Kitni tasveerein bani. Likhai wali call par sifar.
  images        int not null default 0,

  ms            int,
  actor_id      uuid references auth.users(id),
  note          text,

  constraint chk_ai_usage_kind check (kind = any (array['likhai','tasveer','tasveer-parhna']))
);

create index if not exists idx_ai_usage_created on public.ai_usage_log (created_at desc);
create index if not exists idx_ai_usage_feature on public.ai_usage_log (feature, created_at desc);

alter table public.ai_usage_log enable row level security;

-- Parhna: staff. Likhna sirf service client se (koi policy nahi -- yani
-- kisi bande ke haath se qatar nahi banti).
drop policy if exists ai_usage_read on public.ai_usage_log;
create policy ai_usage_read on public.ai_usage_log
  for select using (public.fn_is_any_staff());

grant select on public.ai_usage_log to authenticated;

comment on table public.ai_usage_log is
  'Har AI call ka indraj -- kis feature se, kaunsa model, kitne token. Paisa yahan nahi ginta jata; qeemat Google tay karta hai.';

-- ---------------------------------------------------------------------
-- Mahine ka hisaab -- ek hi jagah se
-- ---------------------------------------------------------------------
-- Do jagah ginne se do adad ban jate hain aur phir koi nahi bata sakta
-- ke sahi kaunsa hai.
create or replace view public.v_ai_usage_monthly as
  select
    date_trunc('month', created_at)::date as mahina,
    feature,
    kind,
    count(*)                                   as kul,
    count(*) filter (where ok)                 as kamyab,
    count(*) filter (where not ok)             as nakaam,
    sum(images)                                as tasveerein,
    -- Sab NULL hon to jama bhi NULL rehta hai -- wohi sach hai.
    sum(total_tokens)                          as token,
    count(*) filter (where total_tokens is null) as token_na_mile
  from public.ai_usage_log
  group by 1, 2, 3;

grant select on public.v_ai_usage_monthly to authenticated;

-- ---------------------------------------------------------------------
-- Safha: menu, ijazat aur Help
-- ---------------------------------------------------------------------
-- AI Command ke neeche. Ye safha kuch badalta nahi, sirf batata hai --
-- magar us mein poore idare ka istemal dikhta hai, is liye "sensitive"
-- hai aur sirf Owner/Admin par khulta hai (rok safhe par bhi lagi hai).

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'ai-usage',
  'AI ka khata',
  'AI usage',
  'اے آئی کا کھاتہ',
  '/admin/ai-usage',
  'Sparkles',
  true,
  'Is mahine kitna AI istemal hua — kis feature se, kitni tasveerein, kitne token.',
  'How much AI was used this month — by feature, images and tokens.',
  'اِس مہینے کتنا اے آئی استعمال ہوا — کس فیچر سے، کتنی تصویریں، کتنے ٹوکن۔',
  true
)
on conflict (key) do update set
  label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  route = excluded.route, icon = excluded.icon, is_sensitive = excluded.is_sensitive,
  description = excluded.description, description_en = excluded.description_en,
  description_ur = excluded.description_ur, is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('ai', 'ai-usage', 90, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'ai-usage',
  'rm',
  'Is mahine AgriBridge ne AI ko kitni dafa bulaya — kis feature se, kitni tasveerein banayin, aur kitne token lage. Ye safha PAISA NAHI GINTA; sirf istemal batata hai.',
  'Owner aur Admin. Is mein poore idare ka istemal dikhta hai, is liye baqi staff par nahi khulta.',
  'Mahine mein ek dafa, ya jab tasveerein ya AI ka koi bara kaam karwana ho -- pehle aur baad mein.',
  ARRAY[
    'Upar char khane dekhein: kitni dafa AI se baat hui, kitni tasveerein banin, kitne token lage, aur kitni koshishein nakaam hui.',
    'Neeche har feature ka apna hisaab hai -- kaun sa hissa sab se zyada AI istemal kar raha hai.',
    'Asal bill Google Cloud Console -> Billing par dekhein.',
    'Wahin Budgets & alerts mein ek hadd laga dein, taake hadd se aage barhne par Google khud email kar de.'
  ],
  'Tasveerein banwani hon to Products -> Images par jayein -- ek dafa mein zyada se zyada 15.',
  ARRAY[
    'Yahan likhe adad ko rupya na samjhein -- ye istemal hai, qeemat nahi. Qeemat Google tay karta hai aur wo badalti rehti hai.',
    'Token ka jama sirf un qataron ka hai jin par ginti mili. Jin par nahi mili un ki alag ginti neeche likhi hoti hai -- "sifar token" aur "ginti nahi mili" ek cheez nahi.',
    'Likhai sasti hai, tasveer mehngi. Sab se zyada dhyan tasveer ke adad par dena chahiye.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
