-- 532: Business 360 owner dashboard -- feature registry row only. ADDITIVE.
-- The page itself allows only owner/super_admin/admin. Reads existing data;
-- P&L section uses migration 526 views (v_pnl_lines) when applied.
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active)
values ('business-360.owner', 'Business 360 (Owner)', 'Business 360 (Owner)', 'بزنس 360 (مالک)',
  'Poora karobar ek safhe par -- har total ledger tak', 'Whole business on one page -- every total to its ledger', 'پورا کاروبار ایک صفحے پر',
  '/admin/business-360/owner', 'Scale', true, true)
on conflict (key) do nothing;
-- Only owner/admin roles get it; no role_feature_permissions rows are added for other roles.
