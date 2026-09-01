-- 187: Reset ke har DELETE par `where true`.
--
-- App se reset chalane par jawab mila: "DELETE requires a WHERE clause".
--
-- Wajah Supabase ki apni hifazti rok hai: API wale roles par
-- pg-safeupdate laga hota hai, jo bina WHERE ke DELETE aur UPDATE rok
-- deta hai -- taake koi ek nadaan query poori table na uRa de. Wo rok
-- SESSION par lagti hai, is liye function ke andar ke DELETE bhi usi ke
-- neeche aate hain.
--
-- Migration chalate waqt raasta doosra tha (rok nahi thi), is liye
-- testing par sab chal gaya aur ye baat chhup gayi. Sabaq: jaanch us
-- raaste se honi chahiye jis se cheez asal mein chalti hai, us se nahi
-- jo hamare haath mein aasan ho.
--
-- `where true` us rok ko mutmain kar deta hai aur maani nahi badalte.

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

  perform set_config('agribridge.test_reset', 'on', true);

  delete from machinery_payment_reminders where true;  get diagnostics v_n = row_count; v_out := v_out || 'reminders ' || v_n || ', ';
  delete from machinery_booking_events     where true;  get diagnostics v_n = row_count; v_out := v_out || 'events ' || v_n || ', ';
  delete from machinery_dispatches         where true;  get diagnostics v_n = row_count; v_out := v_out || 'dispatches ' || v_n || ', ';
  delete from machinery_work_records       where true;  get diagnostics v_n = row_count; v_out := v_out || 'kaam ' || v_n || ', ';
  delete from machinery_fuel_logs          where true;  get diagnostics v_n = row_count; v_out := v_out || 'diesel ' || v_n || ', ';
  delete from machinery_payments           where true;  get diagnostics v_n = row_count; v_out := v_out || 'adaigiyan ' || v_n || ', ';
  delete from machinery_bills              where true;  get diagnostics v_n = row_count; v_out := v_out || 'bill ' || v_n || ', ';
  delete from machinery_booking_drafts     where true;
  delete from machinery_bookings           where true;  get diagnostics v_n = row_count; v_out := v_out || 'bookings ' || v_n || ', ';
  delete from machinery_vendor_machines    where true;  get diagnostics v_n = row_count; v_out := v_out || 'machinein ' || v_n || ', ';
  delete from machinery_vendors            where true;  get diagnostics v_n = row_count; v_out := v_out || 'vendor ' || v_n || ', ';

  delete from journal_entry_sources where true;
  delete from journal_lines         where true;
  delete from journal_entries       where true;  get diagnostics v_n = row_count; v_out := v_out || 'ledger entries ' || v_n || ', ';
  delete from cash_closings         where true;

  delete from machinery_booking_counters where true;
  delete from machinery_bill_counters    where true;
  delete from machinery_receipt_counters where true;
  delete from machinery_machine_counters where true;
  delete from journal_entry_counters     where true;

  return v_out || 'ho gaya';
end;
$function$;
