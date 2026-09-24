-- =====================================================================
-- AgriBridge — Migration 428: sales_staff ka cash-handover 'send' wapas
-- =====================================================================
-- Malik (16 September): "sale staff ne ye cash jama karwana hai to
-- kaise karwaye ... is ko fix karein" -- screenshot mein Anwar (sales_
-- staff) Shift Close ke baad apna counted cash Manager ko bhejne ki
-- koshish kar raha tha, "Aapko is kaam ki ijazat nahi hai" mil raha
-- tha.
--
-- Migration 371 (9 September) ne yehi cheez theek karni thi:
-- `role_feature_permissions` mein `sales_staff` + `cash-handover` ki
-- qatar, aur maujooda sales_staff profiles ke liye ek resync. Dono DB
-- (Testing, Live) par check karne se pata chala ke wo qatar kabhi bani
-- hi nahi -- sirf manager/finance ki purani (28 August ki) qatarein
-- maujood hain. 371 apply ho chuka (`schema_migrations` mein maujood),
-- magar ye do statement kisi wajah se asar nahi kar sake.
--
-- Ye migration wahi do statement dobara, is dafa alag naam se aur
-- tasdeeq ke sath ke ab qatar waqai ban rahi hai.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
  ('sales_staff', 'cash-handover', array['send']::text[], 'own_records')
on conflict (role, feature_key) do update set actions = excluded.actions, data_scope = excluded.data_scope;

insert into user_feature_permissions (profile_id, feature_key, actions, data_scope, reason)
select p.id, 'cash-handover', array['send']::text[], 'own_records', 'Migration 428: 371 ki resync asar nahi kar saki thi'
  from profiles p
 where p.role::text = 'sales_staff'
   and not exists (
     select 1 from user_feature_permissions u where u.profile_id = p.id and u.feature_key = 'cash-handover'
   );

-- Jin sales_staff ke paas pehle se koi (adhoori) qatar thi, us mein
-- 'send' zaroor shamil ho.
update user_feature_permissions
   set actions = array(select distinct unnest(actions || array['send']::text[]))
 where feature_key = 'cash-handover'
   and profile_id in (select id from profiles where role::text = 'sales_staff')
   and not ('send' = any(actions));
