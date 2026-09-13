-- =====================================================================
-- Migration 096: baqi "staff" naam wale rules + vendor ka daira
-- =====================================================================

-- 1) Likhne ka haq sirf staff ko. In teenon par parhne wala alag rule
--    ("authenticated read ...") maujood hai, is liye har koi pehle ki
--    tarah parh sakega — sirf badalna staff tak mehdood ho raha hai.
drop policy if exists "staff manage announcements" on public.announcements;
create policy "staff manage announcements" on public.announcements
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists "staff manage mandi rates" on public.mandi_rates;
create policy "staff manage mandi rates" on public.mandi_rates
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists "staff manage subscription settings" on public.subscription_settings;
create policy "staff manage subscription settings" on public.subscription_settings
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

-- 2) "Sab ka data parhne" wale staff rules. Kisan ka apna data alag rule
--    se milta rahega ("farmers manage own dismissals" / "farmers manage
--    own vote"), jo pehle se maujood hai.
drop policy if exists "staff read all dismissals" on public.announcement_dismissals;
create policy "staff read all dismissals" on public.announcement_dismissals
  for select using (public.fn_is_any_staff());

drop policy if exists "staff read all votes" on public.subscription_votes;
create policy "staff read all votes" on public.subscription_votes
  for select using (public.fn_is_any_staff());

drop policy if exists "Staff can view grain_cut_presets" on public.grain_cut_presets;
create policy "Staff can view grain_cut_presets" on public.grain_cut_presets
  for select using (public.fn_is_any_staff());

drop policy if exists "Staff can view grain_type_products" on public.grain_type_products;
create policy "Staff can view grain_type_products" on public.grain_type_products
  for select using (public.fn_is_any_staff());

-- 3) Machinery: staff ko poora haq, vendor ko sirf APNA data parhne ka.
--    Vendor portal (/vendor) machinery_vendors se user_id par apni pehchan
--    karta hai aur machinery_bookings ko vendor_id par filter karta hai —
--    sirf parhta hai, kuch badalta nahi. Is liye SELECT kaafi hai.
drop policy if exists "Staff can manage machinery_vendors" on public.machinery_vendors;
create policy "Staff can manage machinery_vendors" on public.machinery_vendors
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists "vendor reads own record" on public.machinery_vendors;
create policy "vendor reads own record" on public.machinery_vendors
  for select using (user_id = auth.uid());

drop policy if exists "Staff can manage machinery_bookings" on public.machinery_bookings;
create policy "Staff can manage machinery_bookings" on public.machinery_bookings
  for all using (public.fn_is_any_staff()) with check (public.fn_is_any_staff());

drop policy if exists "vendor reads own bookings" on public.machinery_bookings;
create policy "vendor reads own bookings" on public.machinery_bookings
  for select using (
    vendor_id in (select id from public.machinery_vendors where user_id = auth.uid())
  );
