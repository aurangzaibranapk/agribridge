-- =====================================================================
-- AgriBridge — Migration 237: Chhutti bhi usi zanjeer par
-- =====================================================================
-- Hazri ke liye 231-236 mein reporting ki zanjeer bani: manager sirf
-- apni team ka faisla karta hai, aur apni cheez koi khud manzoor nahi
-- kar sakta. Chhutti (134) us se pehle ki hai, is liye us par purana
-- qanoon chal raha tha:
--
--   * faisla koi bhi hr/manager/admin/owner kar sakta tha -- chahe wo
--     banda us ki team mein ho ya na ho. Ek branch ka manager doosri
--     branch ke bande ki chhutti manzoor kar sakta tha, aur us branch
--     ke afsar ko pata bhi na chalta.
--
--   * chhutti ki darkhwast har staff parh sakta tha. Chhutti ki wajah
--     mein bimari likhi hoti hai. Wo har kisi ke parhne ki cheez nahi.
--
-- Ab dono qanoon wahi hain jo hazri ke hain -- aur ek hi jagah se aate
-- hain (fn_hr_can_view_staff / fn_hr_can_decide_for). Do jagah do alag
-- qanoon rakhna wohi soorat banata hai jahan ek raasta band hota hai
-- aur doosra khula reh jata hai.
-- =====================================================================

drop policy if exists leave_own_read on leave_requests;
create policy leave_own_read on leave_requests for select to authenticated
  using (
    coalesce(public.fn_hr_can_view_staff(profile_id), false)
    or manager_id = auth.uid()
  );

drop policy if exists leave_decide on leave_requests;
create policy leave_decide on leave_requests for update to authenticated
  using (coalesce(public.fn_hr_can_decide_for(profile_id), false))
  with check (coalesce(public.fn_hr_can_decide_for(profile_id), false));

-- Apni darkhwast wapas lena FAISLA nahi hai -- wo banda khud karta hai.
-- Upar wali policy us ka raasta band kar deti (kyunke fn_hr_can_decide_for
-- apne aap par hamesha false hai), is liye ye alag policy chahiye.
drop policy if exists leave_own_cancel on leave_requests;
create policy leave_own_cancel on leave_requests for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

comment on policy leave_decide on leave_requests is
  'Faisla sirf apni reporting team ka, aur apni chhutti khud kabhi nahi (237).';
