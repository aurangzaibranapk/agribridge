-- =====================================================================
-- AgriBridge — Migration 115: Machinery booking, ijazat ke mutabiq
-- =====================================================================
-- Masla: machinery booking par do alag fehristein lagi hui thin, aur wo
-- aapas mein mel nahi khati thin.
--
--   safha (menu + middleware)  ->  role_feature_permissions
--                                  'machinery-rental' sirf `machinery`
--                                  role ko diya gaya hai
--
--   database (RLS)             ->  fn_is_any_staff()
--                                  owner, super_admin, admin,
--                                  admin_assistant, manager, sales_staff,
--                                  finance, warehouse, hr, procurement,
--                                  milk_collection
--
-- `machinery` doosri fehrist mein hai hi nahi. Yani jis akelay role ko ye
-- safha diya gaya tha, wohi role database mein likh nahi sakta tha:
-- Vendor aur Machine ke dropdown khali aate, aur Save par RLS rok deti.
--
-- Ab tak pakRa is liye nahi gaya ke `machinery` role ka koi banda banaya
-- hi nahi gaya -- booking hamesha admin ne khud ki.
--
-- Asal faisla (malik ka): "jis ko main booking ki ijazat dun, wo kar sake
-- -- mumkin hai shop par baitha banda ho aur kisan us ke paas aa jaye."
-- Yani likhne ka haq roles ki pakki fehrist se nahi, Admin panel wali
-- ijazat se tay ho.
--
-- Is liye:
--   * PARHNA : pehle jaisa hi (fn_is_any_staff) + jise ijazat di gayi ho.
--              Kisi se kuch cheena nahi gaya -- department dashboard aur
--              live-board pehle ki tarah chalte rahenge.
--   * LIKHNA : sirf us ko jise `machinery-rental` ki ijazat di gayi ho.
--              Yehi wo aik fehrist hai jo Admin panel se badalti hai.
--
-- fn_is_any_staff() ko haath NAHI lagaya gaya: wo 92 policies mein lagi
-- hui hai. Us mein `machinery` daalne ka matlab hota machinery wale banday
-- ko poora daftar khol dena.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ijazat parhne wala helper.
--
-- Do raaste, wahi do jo app khud dekhti hai:
--
--   1. owner / super_admin / admin -- ye har jagah ja sakte hain aur
--      role_feature_permissions mein in ka row hota hi nahi (app ka
--      UNRESTRICTED_ROLES bhi bilkul yehi teen hain). Agar ye yahan na
--      likha jata to malik khud apni booking na bana pata.
--
--   2. v_user_feature_access -- role ki ijazat AUR kisi ek banday ko di
--      gayi waqti ijazat (waqt ki hadd samet), dono ek jagah. Yani jo
--      Admin panel mein nazar aata hai, hu-ba-hu wahi yahan lagta hai.
--
-- Teenon machinery feature ek hi darwaze ke naam hain -- kisi ko sirf
-- "list" di gayi ho to bhi wo bookings parh sake.
-- ---------------------------------------------------------------------
create or replace function public.fn_can_machinery(p_action text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and is_active
        and role in ('owner', 'super_admin', 'admin')
    )
    or exists (
      select 1
      from public.v_user_feature_access v
      join public.profiles p on p.id = v.profile_id
      where v.profile_id = auth.uid()
        and p.is_active
        and v.feature_key in ('machinery-rental', 'machinery-rental.list', 'machinery-rental.dashboard')
        and p_action = any(v.actions)
    );
$$;

revoke all on function public.fn_can_machinery(text) from public;
grant execute on function public.fn_can_machinery(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- machinery_bookings
-- ---------------------------------------------------------------------
drop policy if exists "Staff can manage machinery_bookings" on machinery_bookings;

create policy machinery_bookings_read on machinery_bookings for select
  using (fn_is_any_staff() or fn_can_machinery('view'));

create policy machinery_bookings_create on machinery_bookings for insert
  with check (fn_can_machinery('create'));

create policy machinery_bookings_edit on machinery_bookings for update
  using (fn_can_machinery('edit'))
  with check (fn_can_machinery('edit'));

create policy machinery_bookings_delete on machinery_bookings for delete
  using (fn_can_machinery('edit'));

-- ---------------------------------------------------------------------
-- machinery_vendors
-- ---------------------------------------------------------------------
drop policy if exists "Staff can manage machinery_vendors" on machinery_vendors;

create policy machinery_vendors_read on machinery_vendors for select
  using (fn_is_any_staff() or fn_can_machinery('view'));

create policy machinery_vendors_create on machinery_vendors for insert
  with check (fn_can_machinery('create'));

create policy machinery_vendors_edit on machinery_vendors for update
  using (fn_can_machinery('edit'))
  with check (fn_can_machinery('edit'));

create policy machinery_vendors_delete on machinery_vendors for delete
  using (fn_can_machinery('edit'));

-- ---------------------------------------------------------------------
-- machinery_vendor_machines
-- ---------------------------------------------------------------------
drop policy if exists "Staff can manage machinery_vendor_machines" on machinery_vendor_machines;

create policy machinery_vendor_machines_read on machinery_vendor_machines for select
  using (fn_is_any_staff() or fn_can_machinery('view'));

create policy machinery_vendor_machines_create on machinery_vendor_machines for insert
  with check (fn_can_machinery('create'));

create policy machinery_vendor_machines_edit on machinery_vendor_machines for update
  using (fn_can_machinery('edit'))
  with check (fn_can_machinery('edit'));

create policy machinery_vendor_machines_delete on machinery_vendor_machines for delete
  using (fn_can_machinery('edit'));

-- ---------------------------------------------------------------------
-- machinery_booking_counters
--
-- Ye booking number ka counter hai. generateBookingNumber() isay usi
-- banday ke apne connection se parhta AUR barhata hai -- to jo booking
-- bana sakta hai, usay yahan likhne ka haq bhi chahiye. Warna counter
-- aage nahi barhta aur agli booking wahi number maangti hai.
-- ---------------------------------------------------------------------
drop policy if exists "Staff can manage machinery_booking_counters" on machinery_booking_counters;

create policy machinery_counters_read on machinery_booking_counters for select
  using (fn_is_any_staff() or fn_can_machinery('view'));

create policy machinery_counters_create on machinery_booking_counters for insert
  with check (fn_can_machinery('create'));

create policy machinery_counters_edit on machinery_booking_counters for update
  using (fn_can_machinery('create'))
  with check (fn_can_machinery('create'));

-- ---------------------------------------------------------------------
-- machinery_requests
--
-- Kisan ki farmaish. Booking banate waqt code is ki status 'fulfilled'
-- kar deta hai. Purani policy mein roles haath se ginwaye gaye the aur
-- `machinery` un mein nahi tha -- to machinery wale ki banayi booking
-- farmaish ko khula chhoR jati (code us nakami ko parhta bhi nahi).
--
-- Purana staff wala haq bilkul waisa hi rakha gaya hai, sirf ijazat wala
-- raasta sath jorha gaya hai.
-- ---------------------------------------------------------------------
drop policy if exists "Staff can view all machinery requests" on machinery_requests;
drop policy if exists "Staff can update machinery requests" on machinery_requests;

create policy machinery_requests_staff_read on machinery_requests for select
  using (fn_is_any_staff() or fn_can_machinery('view'));

create policy machinery_requests_staff_write on machinery_requests for all
  using (fn_is_any_staff() or fn_can_machinery('edit'))
  with check (fn_is_any_staff() or fn_can_machinery('edit'));
