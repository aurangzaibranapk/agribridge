-- =====================================================================
-- Migration 227: Uthane wale ka bill -- kisan ka poora baqi us ke zimme
-- =====================================================================
-- Malik ki baat: kattai ka paisa akela nahi jata. Kisan ke zimme jo aur
-- bhi hai -- khaad ka udhaar, khate ka baqi, jo bhi -- wo bhi uthane
-- wale ke zimme chala jaye. Wo fasal ki qeemat lagayega, us mein se ye
-- sab kaat kar kisan ko baqi dega, aur kaati hui poori raqam hamein.
--
-- ---------------------------------------------------------------------
-- EK KHARABI JO YAHAN CHUP KAR BAITHI THI
-- ---------------------------------------------------------------------
-- "Kisan ka kul baqi" ka ek hi asal malik hai: ledger ka khata 1150.
-- Magar machinery ka bill KHUD BHI usi khate mein jata hai
-- (postMachineryBill -> ACC.farmerDue). Yani 1150 ke andar kattai pehle
-- se shamil hai.
--
-- Agar bill par "kattai" aur "purana baqi" dono alag alag kaat diye
-- jate, to kisan se EK HI raqam DO DAFA kat jati -- aur wo farq kisi ko
-- nazar na aata, kyunke dono adad apni apni jagah bilkul theek lagte
-- hain.
--
-- Is liye yahan hisaab is tarah tora gaya hai:
--
--     kattai ka baqi  = is booking ka bill - is booking ki tasdeeq
--                       shuda adaigi        (wohi qaida jo kisan ke
--                                            khate ka hai)
--     purana baqi     = 1150 ka kul  -  kattai ka baqi
--
-- Aur teenon adad bill par ALAG ALAG likhe jate hain, taake koi bhi
-- ungli rakh kar poochh sake ke ye bana kaise.
--
-- ---------------------------------------------------------------------
-- ROK KE PEECHE KHALI JAWAB
-- ---------------------------------------------------------------------
-- Ye safha staff ke liye hai, magar function `security definer` hai --
-- warna RLS kisi ke haath mein kam adad de deti aur kisan ka baqi CHUP
-- CHAAP MAAF ho jata. Is project mein ye ghalti teen dafa ho chuki hai.
--
-- Aur jise ijazat nahi, usay SIFAR nahi -- KHALI milta hai. Sifar kehta
-- hai "dekh liya, kuch baqi nahi". Khali kehta hai "main bata hi nahi
-- sakta". Bill par in dono ka anjaam bilkul ulta hota hai.
--
-- Isi tarah `bharosa`: agar money trail mein koi raqam aisi pari ho jo
-- ledger tak nahi pahunchi (v_ledger_unposted), to 1150 ka adad adhoora
-- hai. Us waqt bill banane se pehle safha saaf batayega -- chup chaap
-- kam raqam nahi kaategi.

create or replace function fn_farmer_due_breakdown(
  p_farmer_id  uuid,
  p_booking_id uuid default null
)
returns table (
  kattai_baqi numeric,
  kul_baqi    numeric,
  purana_baqi numeric,
  bharosa     boolean,
  unposted    int
)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_unposted int;
  v_kul      numeric;
  v_kattai   numeric := 0;
begin
  -- Jise ijazat nahi, usay khali -- sifar nahi.
  if not fn_is_any_staff() then
    return query select null::numeric, null::numeric, null::numeric, false, null::int;
    return;
  end if;

  select count(*) into v_unposted from v_ledger_unposted;

  select round(coalesce(sum(coalesce(jl.debit, 0) - coalesce(jl.credit, 0)), 0), 2)
    into v_kul
    from journal_lines jl
   where jl.account_code = '1150'
     and jl.party_type   = 'farmer'
     and jl.party_id     = p_farmer_id;

  if p_booking_id is not null then
    select greatest(0, round(coalesce(b.balance_payable, 0) - coalesce(p.paid, 0), 2))
      into v_kattai
      from machinery_bills b
      left join lateral (
        select sum(mp.amount) as paid
          from machinery_payments mp
         where mp.booking_id = b.booking_id
           and mp.kind = 'final'
           and mp.verification_status = 'verified'
      ) p on true
     where b.booking_id = p_booking_id
       and b.cancelled_at is null
     limit 1;
    v_kattai := coalesce(v_kattai, 0);
  end if;

  return query select
    v_kattai,
    v_kul,
    -- Manfi purana baqi ka matlab hota hai ke ledger aur machinery ka
    -- hisaab aapas mein nahi mil raha. Us soorat mein sifar dikhaya
    -- jata hai (kisan se zyada nahi maanga jayega) aur `bharosa` neeche
    -- wali shart se waise bhi jhoot nahi bolta.
    greatest(0, round(v_kul - v_kattai, 2)),
    (v_unposted = 0),
    v_unposted;
end;
$$;

comment on function fn_farmer_due_breakdown(uuid, uuid) is
  'Kisan ka baqi teen hisson mein: is booking ka kattai, ledger 1150 ka kul, aur baqi purana. Kattai 1150 ke ANDAR shamil hai -- is liye purana = kul - kattai, warna ek hi raqam do dafa kat jati.';

revoke all on function fn_farmer_due_breakdown(uuid, uuid) from public;
grant execute on function fn_farmer_due_breakdown(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- 2
-- Bill ke khane
-- ---------------------------------------------------------------- 
-- Ye sab AKS hain -- us waqt ke adad jab bill bana. Baad mein 1150
-- badalta rahega (nayi kharidari, nayi adaigi), magar wo bill usi din ke
-- adad par bana tha aur usi par khara rehna chahiye. Har dafa dobara
-- ginne se purana bill kal apne aap badal jata -- aur us par dastakhat
-- ho chuke hote hain.
alter table booking_crop_lifts
  add column if not exists farmer_old_due_moved    numeric(14,2),
  add column if not exists farmer_old_due_reliable boolean,
  add column if not exists farmer_payable          numeric(14,2),
  add column if not exists lifter_payable          numeric(14,2),
  add column if not exists billed_at               timestamptz,
  add column if not exists billed_by               uuid references profiles(id);

comment on column booking_crop_lifts.farmer_old_due_moved is
  'Kattai ke ALAWA kisan ka jo baqi is uthane wale ke zimme gaya (ledger 1150 ka kul minus is booking ka kattai).';
comment on column booking_crop_lifts.farmer_old_due_reliable is
  'Bill banate waqt ledger poora tha ya nahi. false = kuch raqam ledger tak nahi pahunchi thi, adad adhoora ho sakta hai.';
comment on column booking_crop_lifts.farmer_payable is
  'Fasal ki qeemat mein se kattai aur purana baqi nikaal kar kisan ko dena. Commission YAHAN SE NAHI katta -- wo uthane wale ki apni jeb se hai.';
comment on column booking_crop_lifts.lifter_payable is
  'Uthane wale ne hamein dena: kattai + purana baqi + hamara commission.';

-- ---------------------------------------------------------------- 3
-- Khata: ab teen sabab, teen alag adad
-- ---------------------------------------------------------------- 
-- "Kul baqi" ek hi adad ho to us se ye kabhi nahi poochha ja sakta ke
-- ye kattai ka hai, purane udhaar ka, ya commission ka -- aur baat karte
-- waqt yehi teen alag alag cheezein hoti hain.
-- Khane ki tarteeb badal rahi hai (naya khana beech mein aa raha hai),
-- is liye `create or replace` kaam nahi karta -- Postgres maujooda khane
-- ka naam badalne se inkar kar deta hai. Pehle gira kar dobara banayi
-- jati hai.
drop view if exists v_crop_lifter_balances;
create view v_crop_lifter_balances as
select
  l.id                                     as lifter_id,
  l.name,
  l.phone,
  l.village,
  l.commission_rate,
  l.is_active,
  coalesce(h.kattai_ka_zimma, 0)           as kattai_ka_zimma,
  coalesce(c.purana_baqi_ka_zimma, 0)      as purana_baqi_ka_zimma,
  coalesce(c.commission_bana, 0)           as commission_bana,
  coalesce(p.diya, 0)                      as diya,
  coalesce(h.kattai_ka_zimma, 0)
    + coalesce(c.purana_baqi_ka_zimma, 0)
    + coalesce(c.commission_bana, 0)
    - coalesce(p.diya, 0)                  as baqi,
  coalesce(c.uthai_hui_bookings, 0)        as uthai_hui_bookings
from crop_lifters l
left join lateral (
  select sum(mp.amount) as kattai_ka_zimma
    from machinery_payments mp
   where mp.collected_by_lifter_id = l.id
     and mp.method = 'lifter_collected'
     and mp.verification_status = 'verified'
) h on true
left join lateral (
  select sum(bcl.commission_amount)       as commission_bana,
         sum(bcl.farmer_old_due_moved)    as purana_baqi_ka_zimma,
         count(*)                         as uthai_hui_bookings
    from booking_crop_lifts bcl
   where bcl.lifter_id = l.id
     and bcl.status = 'lifted'
) c on true
left join lateral (
  select sum(clp.amount) as diya
    from crop_lifter_payments clp
   where clp.lifter_id = l.id
) p on true;

grant select on v_crop_lifter_balances to authenticated;
