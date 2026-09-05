-- =====================================================================
-- AgriBridge — Migration 312: Vendor ko hisse se ZYADA diya hua paisa
-- =====================================================================
-- Malik ka kehna (5 September): vendor ka hissa Rs 24,750 banta tha aur
-- Rs 30,000 de diye --
--
--   "us ke ledger mein jayega, mere ledger mein kam hoga. Kal hum hisaab
--    karein to asani ho: us ka amount banta kitna tha, kitna diya, mera
--    kitna banta tha commission mein."
--
-- Zyada raqam ab vendor ke khate mein ADVANCE (1120) jati hai, is
-- booking ka kharcha nahi banti. Magar settlement ke safhe par wo nazar
-- hi nahi aati thi -- aur jo cheez nazar na aaye wo hisaab ke waqt yaad
-- bhi nahi rehti.
--
-- Ye migration us safhe par ek khana aur jorti hai: "hisse se zyada
-- diya". Wo seedha LEDGER se aata hai (journal_lines), booking ke kisi
-- khane se nahi -- kyunki wo raqam kisi ek booking ki hai hi nahi.
--
-- Diesel wala advance is mein NAHI aata: us ka apna khana pehle se hai
-- (`art_diesel_advance`), aur dono ko ek jagah jama kar dena wohi ghalti
-- hoti jis se "kitna diya" ka jawab do dafa gina jata.
-- =====================================================================

create or replace view public.v_machinery_vendor_settlement as
  select
    s.vendor_id,
    s.vendor_name,
    s.user_id,
    count(*) as kitni_bookings,
    sum(s.gross) as kul_gross,
    sum(s.art_commission) as kul_commission,
    sum(s.kisan_ka_diesel) as kul_kisan_diesel,
    sum(s.vendor_ka_hissa) as kul_hissa,
    sum(s.vendor_ko_mila) as kul_mila,
    sum(s.vendor_ka_baqi) as kul_baqi,
    sum(s.art_ke_paas_jama) as art_ke_paas_jama,
    sum(s.kisan_ke_paas) as kisan_ke_paas,
    sum(s.art_diesel_advance) as art_diesel_advance,
    greatest(sum(s.art_ke_paas_jama) - sum(s.art_diesel_advance), 0::numeric) as net_abhi_dena,
    -- Naya khana AAKHIR mein -- Postgres view ke maujooda khanon ki
    -- tarteeb badalne nahi deta.
    --
    -- Hisse se zyada diya hua paisa: LEDGER se, kisi booking se nahi --
    -- kyunki wo raqam kisi ek booking ki hai hi nahi. Diesel wala
    -- advance is mein shaamil NAHI (us ka apna khana upar hai); dono ko
    -- ek jagah jama karna wohi ghalti hoti jis se "kitna diya" do dafa
    -- gina jata.
    coalesce((
      select sum(jl.debit) - sum(jl.credit)
        from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id
       where jl.account_code = '1120'
         and jl.party_type = 'machinery_vendor'
         and jl.party_id = s.vendor_id
         and je.source_module = 'machinery_vendor_payout'
    ), 0) as zyada_diya
  from public.v_machinery_vendor_booking_settlement s
  group by s.vendor_id, s.vendor_name, s.user_id;
