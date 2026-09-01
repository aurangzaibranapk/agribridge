-- =====================================================================
-- Migration 214: Saye wala safha menu mein
-- =====================================================================
-- Naya koi nizam nahi -- wohi features aur dashboard_features jo 104 se
-- chal rahi hain.
--
-- role_feature_permissions mein is ki KOI QATAR NAHI DAALI JA RAHI, aur
-- ye jaan boojh kar hai. Us ka matlab ye hai ke ye safha sirf un logon
-- ko khulega jo UNRESTRICTED_ROLES mein hain -- owner, super_admin,
-- admin. Kisi doosre role ko ye ijazat di hi nahi ja sakti jab tak koi
-- us ke liye qatar na banaye.
--
-- Yani "saye mein" hona sirf safhe ke andar likhi hui baat nahi -- wo
-- ijazat ke nizam se bhi bandha hua hai.

insert into features (key, label, route, icon, is_sensitive, is_active) values
  ('trust_intelligence', 'Trust & Performance', '/admin/trust', 'ShieldCheck', true, true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, icon = excluded.icon,
  is_sensitive = excluded.is_sensitive, is_active = excluded.is_active;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
  ('master', 'trust_intelligence', 15)
on conflict (dashboard_key, feature_key) do nothing;
