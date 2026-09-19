-- 186: "Reset Test Data" ko sach mein reset karna.
--
-- Malik testing ka data mita kar sab kuch dobara banana chahte the.
-- Button dabate to teen cheezen ghalat hotin:
--
-- 1. GINTI KE KHANE saaf hi nahi hote. Wo tables `year` par khare hain,
--    `id` par nahi -- aur reset un mein `id` dhoondta tha. Screen par
--    yehi error aata tha ("column ... .id does not exist"). Nateeja:
--    data mit jata magar agli booking phir bhi MB-2026-00003 se shuru
--    hoti.
--
-- 2. MACHINERY KA DATA MITTA HI NAHI. Fehrist mein sirf
--    machinery_requests tha. Booking, bill, vendor, machine, diesel,
--    kaam -- kuch bhi us mein nahi. Malik "vendor sab kuch dobara
--    banaunga" keh rahe the, aur wohi cheez reh jati.
--
-- 3. AUR SAB SE BURI: LEDGER REH JATA. Ledger par mitane ki rok lagi
--    hui hai (jaan boojh kar). Reset finance_transactions mita deta
--    magar journal_entries wahin rehte -- yani kitabein aisi booking
--    ka Rs 28,000 udhaar aur Rs 3,360 aamdani dikhati rehtin jo ab
--    maujood hi nahi. Ye adhoore reset se bhi bura hai: adhoora reset
--    khali data chhorta hai, ye JHOOTI kitabein chhorta.
--
-- Ledger ki rok apni jagah bilkul theek hai. Magar "live hone se pehle
-- test ka data mitana" us rok ka jaiz istisna hai -- aur us ke liye
-- taala pehle se maujood hai: platform_settings.is_live. Ek dafa LIVE
-- lock lag gaya to ye function bhi hamesha ke liye band.

-- ---- 1. Rok ab jaanti hai ke test reset kya hota hai ----

create or replace function public.fn_no_financial_delete()
returns trigger
language plpgsql
as $function$
begin
  -- Sirf us lamhe khulti hai jab fn_reset_test_financials() ne apne
  -- andar ye nishan lagaya ho. Nishan sirf usi transaction ka hota
  -- hai (set_config ka teesra hissa `true`), is liye kisi aur raaste
  -- se koi ise laga kar chhorh nahi sakta.
  if coalesce(current_setting('agribridge.test_reset', true), '') = 'on' then
    return old;
  end if;
  raise exception 'Financial record mitaya nahi ja sakta. Ghalti theek karne ke liye reversal entry banayein.';
end;
$function$;

-- ---- 2. Test ka maali data ek hi transaction mein ----

create or replace function public.fn_reset_test_financials()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_live boolean;
  v_out  text := '';
  v_n    bigint;
begin
  select coalesce((value #>> '{}') = 'true', false) into v_live
    from platform_settings where key = 'is_live';
  if coalesce(v_live, false) then
    raise exception 'System LIVE lock ho chuka hai -- test data ka reset hamesha ke liye band hai.';
  end if;

  -- Rok is transaction ke liye khul jati hai, aur transaction khatam
  -- hote hi khud band ho jati hai.
  perform set_config('agribridge.test_reset', 'on', true);

  -- Machinery: bachche pehle, walid baad mein.
  delete from machinery_payment_reminders;  get diagnostics v_n = row_count; v_out := v_out || 'reminders ' || v_n || ', ';
  delete from machinery_booking_events;     get diagnostics v_n = row_count; v_out := v_out || 'events ' || v_n || ', ';
  delete from machinery_dispatches;         get diagnostics v_n = row_count; v_out := v_out || 'dispatches ' || v_n || ', ';
  delete from machinery_work_records;       get diagnostics v_n = row_count; v_out := v_out || 'kaam ' || v_n || ', ';
  delete from machinery_fuel_logs;          get diagnostics v_n = row_count; v_out := v_out || 'diesel ' || v_n || ', ';
  delete from machinery_payments;           get diagnostics v_n = row_count; v_out := v_out || 'adaigiyan ' || v_n || ', ';
  delete from machinery_bills;              get diagnostics v_n = row_count; v_out := v_out || 'bill ' || v_n || ', ';
  delete from machinery_booking_drafts;
  delete from machinery_bookings;           get diagnostics v_n = row_count; v_out := v_out || 'bookings ' || v_n || ', ';
  delete from machinery_vendor_machines;    get diagnostics v_n = row_count; v_out := v_out || 'machinein ' || v_n || ', ';
  delete from machinery_vendors;            get diagnostics v_n = row_count; v_out := v_out || 'vendor ' || v_n || ', ';

  -- Ledger. Bachche pehle.
  delete from journal_entry_sources;
  delete from journal_lines;
  delete from journal_entries;              get diagnostics v_n = row_count; v_out := v_out || 'ledger entries ' || v_n || ', ';
  delete from cash_closings;

  -- Ginti ke khane: ye `year` par khare hain, `id` par nahi.
  delete from machinery_booking_counters;
  delete from machinery_bill_counters;
  delete from machinery_receipt_counters;
  delete from machinery_machine_counters;
  delete from journal_entry_counters;

  return v_out || 'ho gaya';
end;
$function$;

comment on function public.fn_reset_test_financials() is
  'Test ka maali data mitata hai -- machinery, ledger aur ginti ke khane -- ek hi transaction mein. Mitane ki rok sirf isi ke andar khulti hai aur transaction ke sath band ho jati hai. LIVE lock lagne ke baad ye function chalta hi nahi.';

revoke all on function public.fn_reset_test_financials() from public;
grant execute on function public.fn_reset_test_financials() to service_role;


-- ---- 3. Baqi rokein bhi wohi nishan jaanti hain ----
--
-- Test se pata chala ke ledger akela nahi hai: booking ki timeline,
-- cash closing, aur vendor ka delete guard bhi mitane se rokte hain.
-- Sab ko wohi nishan sikhaya gaya. Nishan sirf DELETE par khulta hai
-- -- badalne ki rok har haal mein qaim rehti hai.

create or replace function public.fn_no_machinery_event_change()
returns trigger language plpgsql as $function$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('agribridge.test_reset', true), '') = 'on' then
    return old;
  end if;
  raise exception 'Booking ki timeline badli ya mitayi nahi ja sakti.';
end;
$function$;

create or replace function public.fn_no_cash_close_change()
returns trigger language plpgsql as $function$
begin
  if tg_op = 'DELETE'
     and coalesce(current_setting('agribridge.test_reset', true), '') = 'on' then
    return old;
  end if;
  raise exception 'Cash closing badli ya mitayi nahi ja sakti. Ghalti ho to dobara ginein -- purani ginti apni jagah rahegi aur nayi us ke sath nazar aayegi.';
end;
$function$;

create or replace function public.fn_guard_vendor_delete()
returns trigger language plpgsql as $function$
declare
  v_machines int;
  v_bookings int;
begin
  -- Test reset ke andar sab kuch ek sath mit-ta hai, is liye "us ke
  -- sath kuch juda hua hai" wali rok wahan bemani hai.
  if coalesce(current_setting('agribridge.test_reset', true), '') = 'on' then
    return old;
  end if;

  select count(*) into v_machines
    from public.machinery_vendor_machines m where m.vendor_id = old.id;
  select count(*) into v_bookings
    from public.machinery_bookings b where b.vendor_id = old.id;

  if v_bookings > 0 then
    raise exception
      'Is vendor ki % booking maujood hain -- mitaya nahi ja sakta. Kaam aur paisa us se juda hua hai. Us ko BAND kar dein: record khara rahega aur nayi booking us par nahi jayegi.', v_bookings;
  end if;
  if v_machines > 0 then
    raise exception
      'Is vendor ki % machine darj hai -- pehle wo machine kisi aur vendor par le jayein ya band karein, phir ye vendor mitayein.', v_machines;
  end if;
  if old.user_id is not null then
    raise exception
      'Is vendor ka login bana hua hai -- mitane se pehle wo login khatam karna hoga. Filhaal us ko BAND kar dena behtar hai.';
  end if;

  return old;
end $function$;
