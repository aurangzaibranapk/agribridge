-- =====================================================================
-- AgriBridge — Migration 379: pos_sale_payment_details — RLS bohat khula tha
-- =====================================================================
-- Malik ka spec "Test 7: bina ijazat URL/API access" — isi audit mein
-- 378 ke sath mila.
--
-- `pos_sales` aur `pos_sale_items` (isi bikri ka baaqi hissa) par sirf
-- SELECT policy hai -- likhna hamesha `create_pos_sale` (SECURITY
-- DEFINER RPC) se hota hai, seedha client se kabhi nahi. Magar
-- `pos_sale_payment_details` (090) par `staff_manage_pos_payment_details`
-- naam ki ek policy thi jo **ALL** (select/insert/update/delete) ki
-- ijazat deti thi, aur shart sirf ye thi ke `profiles.is_active = true`
-- ho -- role tak nahi poochha jata tha. `profiles` mein `farmer` jaisi
-- non-staff role bhi hai, is liye koi bhi active account (staff ho ya
-- na ho) is table ki koi bhi qatar seedha UPDATE/DELETE/INSERT kar
-- sakta tha -- jis se har payment-method ka hisaab (Shop 360, Sales
-- Report, POS Shift, Cash Control -- sab isi table se ganwte hain)
-- ghalat ban sakta tha.
--
-- Poore codebase mein is table par koi INSERT/UPDATE/DELETE seedha
-- client se nahi hota (grep se confirm) -- sirf SELECT chahiye (Sales
-- Report `supabase.from(...)` istemal karta hai, session client se).
-- =====================================================================

drop policy if exists staff_manage_pos_payment_details on public.pos_sale_payment_details;

create policy staff_read_pos_payment_details on public.pos_sale_payment_details
  for select
  using (fn_is_any_staff());

-- Likhna sirf senior financial correction ke liye -- asal raasta
-- hamesha create_pos_sale (SECURITY DEFINER) hai, jo RLS se guzarta hi
-- nahi.
create policy staff_correct_pos_payment_details on public.pos_sale_payment_details
  for all
  using (fn_has_dept(array['owner','super_admin','admin','finance']::public.user_role[]))
  with check (fn_has_dept(array['owner','super_admin','admin','finance']::public.user_role[]));

comment on table public.pos_sale_payment_details is
  'POS bikri ki payment-method-wise tafseel. Likhna hamesha create_pos_sale (SECURITY DEFINER) se -- seedha client write sirf senior financial correction ke liye (379 se).';
