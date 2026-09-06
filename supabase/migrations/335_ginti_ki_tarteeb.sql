-- =====================================================================
-- AgriBridge — Migration 335: Har dukan ki apni ginti ki tarteeb
-- =====================================================================
-- Malik (6 September):
--
--   *"stock count wala jo option hai na, use aisa rakhein ke hum jis
--   shop ki chahein kar sakein. Example: Main Branch har 15 din mein ek
--   dafa stock count report de, doosri branch har month 30 din baad ya
--   month end par stock count de. Ya hum kisi ko bhi access dein ke
--   stock count karwa sakein. Hamein pata ho ga audit hua, kya farq
--   aaya hai. Hum marzi se din set kar sakein — kis din kis ka stock
--   count chahiye. Daily stock count ke liye bohat time lagta hai."*
--
-- =====================================================================
-- JO MASLA THA
-- =====================================================================
--
-- 110 ne ginti ka poora amal bana diya tha -- andhi ginti, wajah lazmi,
-- ledger tak entry -- magar us mein **ek hi qanoon** tha, saari dunya ke
-- liye: `v_stock_count_overdue` har godam ko 30 din par surkh kar deta
-- tha. Us mein do kharabiyan thin:
--
--   1. Jis godam ki ginti har 15 din chahiye, wo 29 din tak hara rehta
--      tha -- yani do haftay ki ghaflat nazar hi nahi aati thi.
--   2. Jis godam ki ginti waqai mahine mein ek dafa kaafi hai, wo 31
--      din par surkh ho jata tha -- aur roz surkh dikhne wali cheez ko
--      log dekhna chhoR dete hain.
--
-- Dono ka nateeja ek hi hai: nishan par se aitbaar uth jata hai.
--
-- Aur doosra masla: ginti sirf godam ke role wale kar sakte the. Malik
-- kisi bhi bande ko ye kaam de nahi sakte the, chahe wo us dukan par
-- baitha ho.
--
-- =====================================================================
-- CHAAR FAISLE
-- =====================================================================
--
-- 1. **Tarteeb GODAM ki hai, poore nizam ki nahi.** Har godam apna din
--    rakhta hai: har N din, mahine ki ek tareekh, ya mahine ka aakhir.
--
-- 2. **Tarteeb na ho to godam ANDHERE mein nahi jata.** Jis ka koi
--    khana darj na ho, us par purana 30 din wala qanoon hi chalta hai --
--    magar safha saaf likhta hai ke ye "aap ki chuni hui" nahi, "default"
--    hai. Bina is ke ek naya godam banta aur chup chaap ginti se bahar
--    ho jata: koi tarteeb nahi, is liye kabhi late bhi nahi.
--
-- 3. **`band` ek asal faisla hai, khali khana nahi.** Kisi godam ki
--    ginti waqai nahi karni to wo `band` likha jata hai, aur us ki wajah
--    lazmi hai. Farq ye hai: khali khana kehta hai "kisi ne socha hi
--    nahi"; `band` kehta hai "socha, aur ye tay kiya".
--
-- 4. **Zimmedar ko ginti ka darwaza khulta hai -- aur SIRF us ke godam
--    ka.** Ijazat role se nahi, is qatar se aati hai. Kisi ko poore
--    nizam ka warehouse role dene ki zarurat nahi rehti sirf is liye ke
--    wo apni dukan gin sake.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Tarteeb
-- ---------------------------------------------------------------------
create table if not exists stock_count_schedules (
  warehouse_id      uuid primary key references warehouses(id) on delete cascade,
  -- har_n_din | mahine_ki_tareekh | mahine_ke_aakhir | band
  cycle_kind        text not null default 'har_n_din',
  -- 'har_n_din' ke liye: kitne din baad
  har_n_din         int,
  -- 'mahine_ki_tareekh' ke liye: mahine ka kaun sa din (1-28)
  mahine_ki_tareekh int,
  -- Ginti ka kaam kis ke zimme. NULL = kisi ke naam nahi (godam wale
  -- role ka koi bhi banda kar sakta hai).
  zimmedar          uuid references profiles(id),
  -- Pehli ginti kab se gini jaye -- jab tak koi ginti hui hi na ho.
  -- Is ke baghair naya godam pehle hi din late nazar aata.
  shuru_se          date not null default current_date,
  -- 'band' ke liye lazmi. Ginti band karna ek faisla hai; faisle ki
  -- wajah likhi jati hai.
  band_ki_wajah     text,
  updated_by        uuid references profiles(id),
  updated_at        timestamptz not null default now(),

  constraint stock_count_schedule_kind_check
    check (cycle_kind in ('har_n_din','mahine_ki_tareekh','mahine_ke_aakhir','band')),
  -- Har qism ka apna khana bhara hona chahiye. Bina is rok ke
  -- "har_n_din" likha hota aur din khali -- aur wo qatar kabhi kisi ko
  -- late na dikhati.
  constraint stock_count_schedule_din_check
    check (cycle_kind <> 'har_n_din' or (har_n_din is not null and har_n_din between 1 and 365)),
  constraint stock_count_schedule_tareekh_check
    check (cycle_kind <> 'mahine_ki_tareekh' or (mahine_ki_tareekh is not null and mahine_ki_tareekh between 1 and 28)),
  constraint stock_count_schedule_band_check
    check (cycle_kind <> 'band' or (band_ki_wajah is not null and length(btrim(band_ki_wajah)) >= 5))
);

comment on table stock_count_schedules is
  'Har godam ki apni ginti ki tarteeb (335). Qatar na ho to purana 30 din wala default chalta hai -- godam kabhi nigrani se bahar nahi jata.';
comment on column stock_count_schedules.band_ki_wajah is
  'band karne ki wajah -- lazmi. Khali khana "kisi ne socha nahi" kehta hai; band + wajah "socha aur tay kiya" kehta hai.';
comment on column stock_count_schedules.zimmedar is
  'Ginti kis ke zimme. Is qatar se us bande ko SIRF is godam ki ginti ka darwaza khulta hai -- poore nizam ka role dene ki zarurat nahi.';

create index if not exists idx_stock_count_schedule_zimmedar
  on stock_count_schedules(zimmedar) where zimmedar is not null;

alter table stock_count_schedules enable row level security;

drop policy if exists scs_read on stock_count_schedules;
create policy scs_read on stock_count_schedules
  for select using (public.fn_is_any_staff());

-- Tarteeb badalna faisle ka kaam hai, ginne ka nahi. Zimmedar apni
-- tareekh khud aage nahi kar sakta -- warna ginti hamesha "kal" hoti
-- rehti.
drop policy if exists scs_write on stock_count_schedules;
create policy scs_write on stock_count_schedules
  for all using (public.fn_is_admin_level()) with check (public.fn_is_admin_level());


-- ---------------------------------------------------------------------
-- 2) Agli ginti kab -- aur kitni late
-- ---------------------------------------------------------------------
-- `aakhri_moqa` = wo aakhri din jab is godam ki ginti honi CHAHIYE THI.
-- Us ke baad se aaj tak koi ginti na hui ho to godam late hai.
--
-- Ye tareeqa "last count + N" se behtar hai un tarteebon ke liye jo
-- calendar par lagti hain (mahine ka aakhir): agar koi ek mahina chhoR
-- de to agla moqa aage nahi khisakta -- wo apni jagah par khara rehta
-- hai aur din barhte jate hain.
create or replace view v_stock_count_due
with (security_invoker = true) as
  with aakhri as (
    select sc.warehouse_id,
           max(sc.posted_at) as posted_at
    from stock_counts sc
    where sc.status = 'posted'
    group by sc.warehouse_id
  ),
  pichhli as (
    -- Aakhri poori hui ginti ka farq -- "audit hua, kya farq aaya".
    select distinct on (sc.warehouse_id)
           sc.warehouse_id, sc.posted_at, sc.total_difference_value
    from stock_counts sc
    where sc.status = 'posted'
    order by sc.warehouse_id, sc.posted_at desc
  ),
  bunyad as (
    select
      w.id   as warehouse_id,
      w.name as warehouse_name,
      w.branch_id,
      s.cycle_kind,
      s.har_n_din,
      s.mahine_ki_tareekh,
      s.zimmedar,
      s.band_ki_wajah,
      coalesce(s.shuru_se, current_date) as shuru_se,
      (s.warehouse_id is not null) as tarteeb_darj,
      a.posted_at::date as aakhri_ginti,
      p.total_difference_value as pichhla_farq
    from warehouses w
    left join stock_count_schedules s on s.warehouse_id = w.id
    left join aakhri a on a.warehouse_id = w.id
    left join pichhli p on p.warehouse_id = w.id
    where w.is_active
  )
  select
    b.warehouse_id,
    b.warehouse_name,
    b.branch_id,
    -- Tarteeb darj na ho to `har_n_din 30` -- purana qanoon. Safha ye
    -- batata hai ke ye default hai, malik ki chuni hui nahi.
    coalesce(b.cycle_kind, 'har_n_din') as cycle_kind,
    b.tarteeb_darj,
    coalesce(b.har_n_din, case when b.cycle_kind is null then 30 end) as har_n_din,
    b.mahine_ki_tareekh,
    b.zimmedar,
    z.full_name as zimmedar_naam,
    b.band_ki_wajah,
    b.aakhri_ginti,
    b.pichhla_farq,
    aakhri_moqa.d as aakhri_moqa,
    case
      when coalesce(b.cycle_kind, 'har_n_din') = 'band' then null
      when aakhri_moqa.d is null then null
      when b.aakhri_ginti is not null and b.aakhri_ginti >= aakhri_moqa.d then 0
      else greatest(0, current_date - aakhri_moqa.d)
    end as din_late
  from bunyad b
  left join profiles z on z.id = b.zimmedar
  left join lateral (
    select case coalesce(b.cycle_kind, 'har_n_din')
      when 'band' then null
      when 'mahine_ke_aakhir' then
        case
          when current_date = (date_trunc('month', current_date) + interval '1 month - 1 day')::date
            then current_date
          else (date_trunc('month', current_date) - interval '1 day')::date
        end
      when 'mahine_ki_tareekh' then
        case
          when extract(day from current_date) >= b.mahine_ki_tareekh
            then (date_trunc('month', current_date) + make_interval(days => b.mahine_ki_tareekh - 1))::date
          else (date_trunc('month', current_date) - interval '1 month'
                 + make_interval(days => b.mahine_ki_tareekh - 1))::date
        end
      else
        -- har_n_din: aakhri ginti (ya shuru_se) se N din baad
        (coalesce(b.aakhri_ginti, b.shuru_se)
           + make_interval(days => coalesce(b.har_n_din, 30)))::date
    end as d
  ) aakhri_moqa on true;

comment on view v_stock_count_due is
  'Har godam: us ki tarteeb, aakhri ginti, agla moqa, kitne din late, kis ke zimme, aur pichhli ginti ka farq. Tarteeb darj na ho to 30 din ka default lagta hai aur tarteeb_darj = false hota hai (335).';


-- ---------------------------------------------------------------------
-- 3) Purana surkh nishan -- ab tarteeb ke mutabiq
-- ---------------------------------------------------------------------
-- `v_stock_count_overdue` ke khane wohi hain jo 110 mein the, taake
-- purana code chalta rahe. Sirf faisla badla hai: 30 din ka ek qanoon
-- nahi, har godam ka apna.
--
-- `band` wale godam yahan nahi aate -- un ki ginti jaan boojh kar band
-- ki gayi hai, aur us faisle ko roz surkh dikhana usi nishan ko bekaar
-- kar deta hai jo asal ghaflat ke liye rakha gaya tha.
create or replace view v_stock_count_overdue
with (security_invoker = true) as
  select
    d.warehouse_id,
    d.warehouse_name,
    d.aakhri_ginti::timestamptz as aakhri_ginti,
    case when d.aakhri_ginti is null then 9999 else coalesce(d.din_late, 0) end as din_guzray
  from v_stock_count_due d
  where d.cycle_kind <> 'band'
    and coalesce(d.din_late, 0) > 0;


-- ---------------------------------------------------------------------
-- 4) Zimmedar ko us ke godam ki ginti ka darwaza
-- ---------------------------------------------------------------------
-- Malik: *"hum kisi ko bhi access de sakte hain ke stock count karwa
-- sakein."*
--
-- Us ke liye poore nizam ka `warehouse` role de dena bohat bara darwaza
-- kholta hai -- wo banda phir har godam ka maal hila sakta hai. Yahan
-- ijazat TANG hai: sirf ginti, aur sirf us godam ki jis ka wo zimmedar
-- likha gaya hai.
create or replace function fn_stock_count_mere_godam()
returns table (warehouse_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.warehouse_id
  from stock_count_schedules s
  where s.zimmedar = auth.uid()
    and s.cycle_kind <> 'band'
$$;

comment on function fn_stock_count_mere_godam() is
  'Jin godamon ki ginti is bande ke zimme hai. Ijazat role se nahi, tarteeb ki qatar se (335).';

revoke all on function fn_stock_count_mere_godam() from public;
grant execute on function fn_stock_count_mere_godam() to authenticated;


-- ---------------------------------------------------------------------
-- 5) Safhe ki madad
-- ---------------------------------------------------------------------
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'stock-count', 'rm',
  'Godam ka maal gin kar hisaab se milana — aur har godam ki apni tarteeb: kaun sa godam kitne din baad ginna hai, aur kis ke zimme.',
  'Malik, Manager, Finance aur godam wale. Tarteeb sirf Admin darje ka shakhs badal sakta hai; ginti wo bhi kar sakta hai jis ke zimme wo godam likha ho.',
  'Har godam ki apni tareekh par. Daily ginti ki zarurat nahi — is liye har godam ka apna cycle hai.',
  ARRAY[
    'Tarteeb ek dafa lagayein: har godam ke saamne "har N din", "mahine ki tareekh" ya "mahine ka aakhir" chunein.',
    'Zimmedar chunein — us ko us godam ki ginti ka darwaza khud khul jayega.',
    'Jis din ginti due ho, safhe par wo godam saamne aa jata hai.',
    'Ginti shuru karein: system ka adad us waqt mahfooz ho kar CHHUP jata hai — jo aap ginein wohi likhein.',
    'Sab qatarein bhar jayen to milaan karein: wahan farq saamne aata hai aur har farq ki wajah likhni parti hai.'
  ],
  'Ginti post hote hi farq ledger tak jata hai aur is safhe par "pichhla farq" ban jata hai — agli dafa wohi adad milane ke kaam aata hai.',
  ARRAY[
    'Ginte waqt system ka adad dekhne ki koshish na karein — wo jaan boojh kar chhupa hai. Adad dikh jaye to ginti ginti nahi rehti, tasdeeq ban jati hai.',
    'Jis godam ki tarteeb darj na ho, us par 30 din ka DEFAULT chalta hai — wo aap ka chuna hua nahi. Safha us par "default" likh kar batata hai.',
    'Ginti waqai nahi karni to "band" chunein aur wajah likhein — khana khali chhoRne se wo godam chup chaap nigrani se bahar nahi hota, magar tarteeb ka faisla kabhi darj hi nahi hota.',
    'Zimmedar bana dene se us bande ko poore nizam ka ikhtiyar NAHI milta — sirf usi godam ki ginti ka darwaza khulta hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
