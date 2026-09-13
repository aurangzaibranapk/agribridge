-- =====================================================================
-- AgriBridge — Migration 311: Raseed ka number ab waqai aage barhta hai
-- =====================================================================
-- Malik ne 5 September ko ye pakRa: kisan ne Rs 28,125 ke bill par
-- Rs 24,000 diye, aur adaigi darj hi nahi hui --
--
--   "duplicate key value violates unique constraint
--    uq_machinery_payment_receipt"
--
-- ASAL WAJAH (aur ye teen hisson ka joR hai):
--
--   1. Migration 171 ne `machinery_receipt_counters` par se `authenticated`
--      ki saari ijazat le li thi -- wo table sirf service_role ke liye
--      hai.
--
--   2. Magar code us counter ko BANDE KE APNE client se parh aur likh
--      raha tha. Yani: SELECT ko kuch nahi milta tha (rok ke peeche
--      khali jawab), is liye har dafa "agla number = 1" banta tha; aur
--      UPDATE/INSERT chup chaap nakaam ho jate the, is liye counter
--      hamesha khali rehta tha.
--
--   3. Pehli adaigi chal gayi (MR-2026-00001 pehle se tha hi nahi), aur
--      US KE BAAD HAR ADAIGI RUK GAYI -- kyunki har dafa wohi number
--      banta tha.
--
-- Yehi wo kism ki kharabi hai jis se ye project bar bar takrata hai:
-- ijazat wali rok ke peeche khali jawab ko asal jawab samajh lena. Yahan
-- "counter mein kuch nahi hai" ka matlab "koi raseed nahi bani" liya
-- gaya, jabke asal baat ye thi ke DEKHNE KI IJAZAT NAHI THI.
--
-- ILAAJ: number ab database ke andar ek function banata hai (jaise
-- asaason ka `fn_next_asset_code`). Do faide:
--
--   * Ijazat ka masla khatam -- function SECURITY DEFINER hai.
--   * Number ek hi hukm mein barhta hai, is liye do bande ek hi lamhe
--     mein adaigi darj karein to bhi dono ko alag number milta hai.
--     Purana tareeqa (pehle parho, phir likho) do adaigiyon ko ek hi
--     number de sakta tha.
-- =====================================================================

create or replace function public.fn_next_machinery_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_n int;
begin
  if p_kind = 'booking' then
    insert into public.machinery_booking_counters (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = public.machinery_booking_counters.last_number + 1
    returning last_number into v_n;
    return 'MB-' || v_year || '-' || lpad(v_n::text, 5, '0');

  elsif p_kind = 'bill' then
    insert into public.machinery_bill_counters (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = public.machinery_bill_counters.last_number + 1
    returning last_number into v_n;
    return 'MBL-' || v_year || '-' || lpad(v_n::text, 5, '0');

  elsif p_kind = 'receipt' then
    insert into public.machinery_receipt_counters (year, last_number) values (v_year, 1)
    on conflict (year) do update set last_number = public.machinery_receipt_counters.last_number + 1
    returning last_number into v_n;
    return 'MR-' || v_year || '-' || lpad(v_n::text, 5, '0');
  end if;

  raise exception 'Anjaan number ki qism: %', p_kind;
end;
$$;

grant execute on function public.fn_next_machinery_number(text) to authenticated;

-- ---------------------------------------------------------------------
-- Counter ko us jagah par le aayein jahan wo waqai hona chahiye
-- ---------------------------------------------------------------------
-- Raseed ka counter khali para tha jabke MR-2026-00001 pehle se bani
-- hui thi. Usay sifar se shuru karne ka matlab hota ke agli raseed phir
-- wohi number maangti aur phir ruk jati.
--
-- Booking aur bill ke counter theek chal rahe the (un par 171 wali rok
-- nahi thi), magar unhen bhi wahin rakha ja raha hai jahan asal number
-- pahunch chuke hain -- taake aage kabhi ye sawal na uthe.
insert into public.machinery_receipt_counters (year, last_number)
select extract(year from current_date)::int,
       coalesce(max(substring(receipt_number from '\d+$')::int), 0)
  from public.machinery_payments
 where receipt_number like 'MR-' || extract(year from current_date)::int || '-%'
on conflict (year) do update
  set last_number = greatest(public.machinery_receipt_counters.last_number, excluded.last_number);
