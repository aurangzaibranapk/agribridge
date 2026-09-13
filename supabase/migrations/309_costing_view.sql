-- =====================================================================
-- AgriBridge — Migration 309: Cheez ki lagat (weighted average)
-- =====================================================================
-- `products.purchase_price` "aaj ka reference rate" hai -- yani AAKHRI
-- manzoor shuda kharid ka rate (293). Wo bill banate waqt aur nafa
-- dekhte waqt kaam aata hai.
--
-- Magar ek doosra sawal bhi hota hai, aur us ka jawab kahin nahi tha:
-- "is cheez ka asal AUSAT kya para hai?" Ek hi cheez saal bhar mein
-- kai rate par aati hai; aakhri rate poore saal ki lagat nahi batata.
-- Jahan aakhri rate ausat se bahut upar ya neeche ho, wahan ya to koi
-- rate ghalat charha hai, ya rate waqai badal chuka hai -- dono soorat
-- mein wo qatar dekhne wali hai.
--
-- Ye view sirf DIKHATA hai. Koi rate khud nahi badalta -- rate badalna
-- hamesha insaan ka faisla rehta hai (aur us par 293 wali fehrist aur
-- ittila pehle se lagi hui hai).
--
-- Ausat SIRF wo maal ginta hai jo waqai aaya (`received_qty`). Order
-- ki hui magar na aayi cheez ki koi lagat nahi hoti.
-- =====================================================================

create or replace view public.v_product_costing as
  select
    p.id as product_id,
    p.name,
    p.pack_size,
    p.purchase_price as reference_rate,
    p.selling_price,
    sum(pi.received_qty) as total_qty,
    sum(pi.received_qty * pi.unit_cost) as total_cost,
    round(sum(pi.received_qty * pi.unit_cost) / nullif(sum(pi.received_qty), 0), 2) as weighted_avg,
    count(distinct pi.purchase_id) as purchase_count,
    max(pu.purchase_date) as last_purchase_date
  from public.products p
  join public.purchase_items pi on pi.product_id = p.id
  join public.purchases pu on pu.id = pi.purchase_id
  where p.is_deleted = false
    and coalesce(pi.received_qty, 0) > 0
    and pu.status = 'received'
  group by p.id, p.name, p.pack_size, p.purchase_price, p.selling_price;

insert into public.features (key, label, label_en, label_ur, route, is_active, is_sensitive, description)
values
  ('finance.costing', 'Cheez ki Lagat', 'Item Costing', 'چیز کی لاگت',
   '/admin/finance/costing', true, true,
   'Har cheez ka AUSAT kharid rate (jo maal waqai aaya us par), aur us ke saamne aaj ka reference rate.')
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
  ('manager', 'finance.costing', array['view'], 'all'),
  ('finance', 'finance.costing', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('finance', 'finance.costing', 11, 'Maali Hisaab', 0)
on conflict (dashboard_key, feature_key) do update set
  sort_order    = excluded.sort_order,
  section       = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'finance.costing', 'rm',
  'Har cheez ka ausat kharid rate -- us maal par jo waqai aaya -- aur us ke saamne aaj ka reference rate.',
  'Owner, Admin, Manager aur Finance.',
  'Rate par shak ho, ya mahine ke aakhir mein lagat dekhni ho.',
  array[
    'Fehrist us farq ke hisaab se lagi hai jo ausat aur aaj ke rate mein hai -- sab se bara farq sab se upar.',
    'Bara farq do baaton mein se ek kehta hai: ya to koi rate ghalat charha hai, ya rate waqai badal chuka hai.',
    'Cheez ki poori kahani us ke apne safhe (Product) par hai.',
    'Ye safha koi rate KHUD nahi badalta.'
  ],
  'Rate ghalat lage to us cheez ke safhe se durust karein -- wahan har tabdeeli apne nishaan ke sath darj hoti hai.',
  array[
    'Ausat ko "aaj ka rate" samajh lena. Ausat guzre hue saal ka hai; bill hamesha aaj ke rate par banta hai.',
    'Us cheez ka ausat dekhna jo sirf ek dafa aayi ho. Ek kharid ka ausat wohi ek rate hota hai — us mein koi maloomat nahi.',
    'Ye samajhna ke ausat mein order ki hui cheezein bhi shamil hain. Sirf wo maal ginta hai jo waqai aaya.'
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
