-- =====================================================================
-- AgriBridge — Migration 385: Access khatam karwane ki darkhwast
-- =====================================================================
-- Malik (10 September): "my access se wo new access ki request bhi kar
-- sake or jo existing mili howi hy wo khatam karwani ho to wo kaam bhi ho
-- sake" -- ab tak access_requests sirf NAYI ijazat maangne ke liye thi
-- (feature_access / department_assign). Maujooda ijazat khatam karwane ka
-- koi raasta nahi tha.
--
-- Teesra kind: 'feature_revoke'. Isi purani table, isi manzoori ke
-- raaste se -- Owner/Admin/Manager/department head wahi jaga se faisla
-- karte hain jahan naye access ka faisla karte hain.
-- =====================================================================

alter table public.access_requests
  drop constraint if exists chk_ar_kind;
alter table public.access_requests
  add constraint chk_ar_kind check (kind in ('feature_access', 'department_assign', 'feature_revoke'));

alter table public.access_requests
  drop constraint if exists chk_ar_target;
alter table public.access_requests
  add constraint chk_ar_target check (
    (kind = 'feature_access' and feature_key is not null)
    or (kind = 'department_assign' and department_key is not null)
    or (kind = 'feature_revoke' and feature_key is not null)
  );
