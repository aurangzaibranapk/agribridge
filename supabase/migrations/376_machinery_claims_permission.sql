-- =====================================================================
-- AgriBridge — Migration 376: Machinery Claims — koi permission check hi nahi thi
-- =====================================================================
-- Poore `machinery-lifecycle.ts` mein CHAAR verify functions
-- (`verifyAdvanceClaim`, `verifyWorkClaim`, `verifyVendorCollection`,
-- `verifyFuelClaim`) `requireAction` bulate hi nahi thay -- sirf
-- `currentUserId()` lete thay. `/admin/machinery-rental/advance-claims`
-- aur `/admin/machinery-rental/work-claims` (page.tsx dono) par bhi koi
-- role check nahi tha. Yani koi bhi LOGGED-IN banda (HR, warehouse, milk
-- collection, procurement -- machinery se koi taalluq na ho) kisan ke
-- advance ke dawe, vendor ke kaam/fuel/cash ke dawe accept/reject kar
-- sakta tha -- asal paisa/bill par asar (5g, 5k mein isi module ke do
-- bug pehle bhi pakre ja chuke hain).
--
-- Yehi bug jo `bridge-orders`/`produce-orders` mein aaj hi (8 September)
-- mila tha, isi jagah bhi tha. Sirf permission gate -- verify→approve
-- do marhalon mein baatna (POS Return/Machinery ki fehrist mein pehle
-- se likha "bara structural kaam") is se ALAG hai aur is migration mein
-- nahi hai.
--
-- `data_scope = 'all'` jaan boojh kar -- `machinery_bookings` par
-- `branch_id` column hi nahi hai (poora module company-wide hai, kisi
-- aur branch-scoped module ki tarah nahi). 'own_branch' likhna yahan
-- jhoothi rok hoti -- koi column filter karne ke liye maujood nahi,
-- is liye rok sirf WHO (kaunsi role) tak mehdood hai, WHICH ROWS tak
-- nahi.
-- =====================================================================

-- Ek 'machinery' role template pehle se maujood hai (dashboard/list par
-- view/create/edit) magar abhi kisi bande ko diya hua nahi -- us ko bhi
-- yahan shamil kiya, taake owner jab is role kisi ko de to wo apna kaam
-- foran kar sake, dobara migration ki zaroorat na ho. `machinery_vendor`
-- (bahar wale vendor ka login) jaan boojh kar SHAMIL NAHI -- wo apne
-- hi bheje hue dawe "verify" kar sakta, jo self-approval hota.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
  ('manager', 'machinery-rental.advance-claims', array['view','verify']::text[], 'all'),
  ('finance', 'machinery-rental.advance-claims', array['view','verify']::text[], 'all'),
  ('machinery', 'machinery-rental.advance-claims', array['view','verify']::text[], 'all'),
  ('manager', 'machinery-rental.work-claims', array['view','verify']::text[], 'all'),
  ('finance', 'machinery-rental.work-claims', array['view','verify']::text[], 'all'),
  ('machinery', 'machinery-rental.work-claims', array['view','verify']::text[], 'all')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

-- Role ki ijazat (upar) khud ba khud har manager/finance tak nahi
-- pahunchti -- 370/371/372 mein yehi bug mila tha, wajah wohi hai:
-- `fn_apply_role_template` sirf UN features ke liye row banata hai jin
-- ka us bande ke paas ABHI koi row nahi. Yahan gap sirf INSERT hai (koi
-- purana row hi nahi tha), is liye "not exists" se bharna kisi
-- customization ko nahi chhuta.
insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, f.feature_key, f.actions, f.data_scope, 'Template resync (376): Machinery claims verify'
  from profiles p
  cross join (values
    ('manager', 'machinery-rental.advance-claims', array['view','verify']::text[], 'all'),
    ('finance', 'machinery-rental.advance-claims', array['view','verify']::text[], 'all'),
    ('machinery', 'machinery-rental.advance-claims', array['view','verify']::text[], 'all'),
    ('manager', 'machinery-rental.work-claims', array['view','verify']::text[], 'all'),
    ('finance', 'machinery-rental.work-claims', array['view','verify']::text[], 'all'),
    ('machinery', 'machinery-rental.work-claims', array['view','verify']::text[], 'all')
  ) as f(role, feature_key, actions, data_scope)
 where p.role::text = f.role
   and not exists (
     select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = f.feature_key
   );
