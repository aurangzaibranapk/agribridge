-- =====================================================================
-- AgriBridge — Migration 313: Do baatein jo 5 September ko saamne aayin
-- =====================================================================
-- MALIK KA PEHLA SAWAL: "maine desil ek dafa he add kia hy"
--
-- MB-2026-00008 par diesel DO dafa darj ho gaya tha -- 4 September ko,
-- 23 sekind ke faasle se, dono dafa 30 litre x Rs 376. Ledger wali
-- ghalti reverse ho chuki (TXN-26-000009 -> TXN-26-000021), magar
-- `machinery_fuel_logs` ki qatar abhi bhi "verified" pari hai. Is liye
-- vendor ka safha aaj bhi Rs 33,930 diesel kaat raha hai jabke ledger
-- Rs 22,650 kehta hai. Do kitabein alag ho chuki hain.
--
-- Qatar mitai nahi ja sakti (saboot chala jata hai) aur `fn_guard_fuel_log`
-- theek hi rokta hai ke tasdeeq shuda diesel chupke se wapas na ho jaye.
-- Is liye ek TEESRA darja: `cancelled` -- wajah ke sath, tareekh ke sath,
-- aur likhne wale ke naam ke sath. Diesel ko dekhne wale das ke das view
-- sirf 'verified' ginte hain, is liye mansookh qatar khud ba khud har
-- hisaab se nikal jati hai -- magar safhe par nazar aati rehti hai.
--
-- ---------------------------------------------------------------------
-- MALIK KA DUSRA SAWAL: "farman ali ko farmer sy 32000 rup mil chuky hn
-- wo ni nazar a rha... mera commission bhi usi ki taraf hai"
--
-- Bilkul theek pakRa. Ledger mein wo raqam MAUJOOD hai (TXN-26-000014:
-- 2000 "Supplier ko dena" par Rs 32,000 debit) -- yani vendor ko mil
-- chuka. Magar settlement ka view `machinery_payments` ka TAREEQA dekhta
-- hi nahi tha: us ke liye har kisan ki adaigi "ART ke paas jama" thi.
-- Nateeja: Rs 32,000 wahan likha aa raha tha jahan wo hai hi nahi --
-- hamari tijori mein.
--
-- Farq sirf ek khane ka hai, aur wo khana pehle se mehfooz hai:
--   vendor_settlement = 'kept'        -> vendor ne apne hisse mein rakha
--                                        => VENDOR KO MIL GAYA
--   vendor_settlement = 'handed_over' -> vendor ne hamein dena hai
--                                        => hamara paisa, us ke haath mein
--
-- Sirf 'kept' wali raqam "vendor ko mila" mein jayegi. Aur agar us ne
-- apne hisse se ZYADA rakh liya (yahan Rs 32,000 mein se Rs 28,160 us ka
-- tha, Rs 3,840 hamara commission), to wo farq apne alag khane mein
-- likha jayega: `vendor_ne_zyada_rakha`. Us ko chhupa dena ya "sifar"
-- dikha dena wohi ghalti hai jis se hisaab ke waqt yaad hi nahi rehta
-- ke hamara commission kis ki jeb mein para hai.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Diesel ki qatar mansookh karne ka raasta
-- ---------------------------------------------------------------------

alter table public.machinery_fuel_logs
  add column if not exists cancelled_at     timestamptz,
  add column if not exists cancelled_by     uuid references auth.users(id),
  add column if not exists cancelled_reason text;

comment on column public.machinery_fuel_logs.cancelled_reason is
  'Mansookhi ki wajah. Bina wajah ke qatar mansookh nahi hoti -- wajah hi wo cheez hai jo agli dafa ghalti rokti hai.';

alter table public.machinery_fuel_logs
  drop constraint if exists chk_fuel_verification;

alter table public.machinery_fuel_logs
  add constraint chk_fuel_verification
  check (verification_status = any (array['claimed'::text, 'verified'::text, 'rejected'::text, 'cancelled'::text]));

-- Mansookh qatar par teenon nishan sath hone chahiyein, ya ek bhi nahi.
-- Aadha nishan sab se buri shakal hai: qatar hisaab se nikal jaye aur
-- koi bata na sake ke kis ne aur kyun nikali.
alter table public.machinery_fuel_logs
  drop constraint if exists chk_fuel_cancelled_shape;

alter table public.machinery_fuel_logs
  add constraint chk_fuel_cancelled_shape
  check (
    (verification_status = 'cancelled'
       and cancelled_at is not null
       and length(coalesce(cancelled_reason, '')) >= 10)
    or
    (verification_status <> 'cancelled'
       and cancelled_at is null
       and cancelled_reason is null)
  );

create or replace function public.fn_guard_fuel_log()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' and new.source = 'vendor' and new.verification_status <> 'claimed' then
    raise exception 'Vendor ka darj kiya hua diesel pehle dawa hi hota hai -- tasdeeq hamari team karti hai.';
  end if;

  -- Mansookh qatar par khate wali shart nahi lagti: wo raqam ab kisi
  -- khate se nikli hui nahi maani jati.
  if new.verification_status = 'verified'
     and new.paid_by = 'company'
     and new.finance_account_id is null then
    raise exception 'ART ka diesel hai to khata bhi batana hoga ke kis khate se nikla.';
  end if;

  if new.paid_by <> 'company' and new.finance_account_id is not null then
    raise exception 'Khata sirf ART ke diye hue diesel par lagta hai.';
  end if;

  if new.verification_status = 'rejected' and coalesce(new.rejection_reason, '') = '' then
    raise exception 'Rad karne ki wajah likhna zaroori hai.';
  end if;

  if new.verification_status = 'verified' and new.verified_at is null then
    new.verified_at := now();
  end if;

  if new.verification_status = 'cancelled' then
    if length(coalesce(new.cancelled_reason, '')) < 10 then
      raise exception 'Mansookhi ki wajah likhna zaroori hai (kam az kam das harf).';
    end if;
    if new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  if tg_op = 'UPDATE' and old.verification_status = 'cancelled' then
    raise exception 'Mansookh shuda diesel dobara zinda nahi hota -- naya indraj karein.';
  end if;

  -- Tasdeeq shuda diesel sirf MANSOOKHI ki taraf ja sakta hai, aur wo
  -- bhi wajah ke sath. Chupke se "claimed" ya "rejected" par wapas jana
  -- pehle bhi mana tha aur ab bhi hai.
  if tg_op = 'UPDATE'
     and old.verification_status = 'verified'
     and new.verification_status not in ('verified', 'cancelled') then
    raise exception 'Tasdeeq shuda diesel wapas nahi ja sakta -- ghalti ho to mansookh karein (wajah ke sath).';
  end if;

  return new;
end;
$function$;


-- ---------------------------------------------------------------------
-- 2. Vendor ne jo paisa kisan se khud le kar apne paas rakha
-- ---------------------------------------------------------------------
-- Purane view ke khanon ki tarteeb badalni hai, aur Postgres
-- `create or replace` par wo hone nahi deta. Is liye dono view gira kar
-- dobara banae ja rahe hain -- pehle upar wala (jo neeche wale par khara
-- hai), phir neeche wala.

drop view if exists public.v_machinery_vendor_settlement;
drop view if exists public.v_machinery_vendor_booking_settlement;

create view public.v_machinery_vendor_booking_settlement as
  select
    b.id as booking_id,
    b.booking_number,
    b.booking_date,
    b.status,
    v.id as vendor_id,
    v.vendor_name,
    v.user_id,
    f.full_name as farmer_name,

    coalesce(bl.gross_amount, 0::numeric) - coalesce(bl.discount_amount, 0::numeric) as gross,
    coalesce(bl.commission_amount, 0::numeric) as art_commission,
    coalesce(bl.diesel_deducted, 0::numeric)   as kisan_ka_diesel,
    coalesce(bl.vendor_payable, 0::numeric)    as vendor_ka_hissa,

    -- Vendor tak paisa DO raaston se pahunchta hai, aur pehle sirf ek
    -- ginta tha:
    --   (a) hum ne apne haath se diya  -> b.amount_paid_to_vendor
    --   (b) kisan ne usi ko de diya aur us ne apne hisse mein rakh liya
    --                                  -> vendor_settlement = 'kept'
    -- (b) ko na ginna hi wo ghalti thi jis ki wajah se Rs 32,000 "hamare
    -- paas jama" likha aa raha tha.
    coalesce(b.amount_paid_to_vendor, 0::numeric) as hum_ne_diya,
    coalesce(kept.raqam, 0::numeric)              as khud_rakha,
    coalesce(b.amount_paid_to_vendor, 0::numeric) + coalesce(kept.raqam, 0::numeric) as vendor_ko_mila,

    greatest(
      coalesce(bl.vendor_payable, 0::numeric)
        - coalesce(b.amount_paid_to_vendor, 0::numeric)
        - coalesce(kept.raqam, 0::numeric),
      0::numeric
    ) as vendor_ka_baqi,

    -- Hisse se zyada rakh liya -- yani hamara commission us ke paas hai.
    -- Rs 32,000 mein se Rs 28,160 us ka tha, Rs 3,840 hamara.
    greatest(
      coalesce(kept.raqam, 0::numeric) - coalesce(bl.vendor_payable, 0::numeric),
      0::numeric
    ) as vendor_ne_zyada_rakha,

    coalesce(fp.mila, 0::numeric) as kisan_ne_diya,

    -- Kisan ne jo diya, us mein se HAM tak kitna pahuncha. 'kept' wali
    -- raqam ham tak aayi hi nahi -- wo seedhi vendor ke paas rahi.
    coalesce(fp.mila, 0::numeric) - coalesce(kept.raqam, 0::numeric) as art_tak_pahuncha,

    least(
      greatest(
        coalesce(bl.vendor_payable, 0::numeric)
          - coalesce(b.amount_paid_to_vendor, 0::numeric)
          - coalesce(kept.raqam, 0::numeric),
        0::numeric
      ),
      greatest(coalesce(fp.mila, 0::numeric) - coalesce(kept.raqam, 0::numeric), 0::numeric)
    ) as art_ke_paas_jama,

    greatest(
      greatest(
        coalesce(bl.vendor_payable, 0::numeric)
          - coalesce(b.amount_paid_to_vendor, 0::numeric)
          - coalesce(kept.raqam, 0::numeric),
        0::numeric
      ) - greatest(coalesce(fp.mila, 0::numeric) - coalesce(kept.raqam, 0::numeric), 0::numeric),
      0::numeric
    ) as kisan_ke_paas,

    coalesce(art.diesel, 0::numeric) as art_diesel_advance

  from public.machinery_bookings b
    join public.machinery_vendors v on v.id = b.vendor_id
    left join public.farmers f on f.id = b.farmer_id
    left join public.machinery_bills bl
      on bl.booking_id = b.id and bl.cancelled_at is null

    -- Kisan ne is booking par kul kitna diya (kisi bhi tareeqe se).
    left join lateral (
      select sum(p.amount) as mila
        from public.machinery_payments p
       where p.booking_id = b.id
         and p.kind = 'final'
         and p.verification_status = 'verified'
    ) fp on true

    -- Us mein se kitna vendor ne khud le kar apne hisse mein rakha.
    -- 'handed_over' yahan NAHI aata: wo hamara paisa hai jo us ke haath
    -- mein hai (ledger mein 1030 "Cash raaste mein"), us ka hissa nahi.
    left join lateral (
      select sum(p.amount) as raqam
        from public.machinery_payments p
       where p.booking_id = b.id
         and p.kind = 'final'
         and p.verification_status = 'verified'
         and p.method = 'vendor_collected'
         and p.vendor_settlement = 'kept'
    ) kept on true

    -- Mansookh shuda diesel ab yahan nahi aata (upar wala hissa).
    left join lateral (
      select sum(l.amount) as diesel
        from public.machinery_fuel_logs l
       where l.booking_id = b.id
         and l.vendor_recoverable
         and l.verification_status = 'verified'
    ) art on true

  where b.status <> 'cancelled'
    and (public.fn_is_any_staff() or v.user_id = auth.uid());


create view public.v_machinery_vendor_settlement as
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

    sum(s.hum_ne_diya)  as hum_ne_diya,
    sum(s.khud_rakha)   as khud_rakha,
    sum(s.vendor_ne_zyada_rakha) as vendor_ne_zyada_rakha,

    -- Hisse se zyada NAQAD diya hua paisa (312). Ye seedha LEDGER se
    -- aata hai, kisi booking se nahi -- kyunki wo raqam kisi ek booking
    -- ki hai hi nahi. Diesel wala advance is mein shaamil NAHI: us ka
    -- apna khana upar hai, aur dono ko jama karna wohi ghalti hoti jis
    -- se "kitna diya" do dafa gina jata.
    coalesce((
      select sum(jl.debit) - sum(jl.credit)
        from public.journal_lines jl
        join public.journal_entries je on je.id = jl.entry_id
       where jl.account_code = '1120'
         and jl.party_type = 'machinery_vendor'
         and jl.party_id = s.vendor_id
         and je.source_module = 'machinery_vendor_payout'
    ), 0) as zyada_diya,

    -- "Ab dena banta hai" -- wo raqam jo WAQAI abhi di ja sakti hai.
    --
    -- Hamare paas jo jama hai, us mein se teen cheezein nikalni hoti
    -- hain, kyunki teenon hamara paisa hain jo us ke paas para hai:
    --   - ART ka diesel (1120)
    --   - hamara commission jo us ne kisan se le kar rakh liya
    --   - naqad jo hum ne hisse se zyada de diya (1120)
    --
    -- Kisan ke paas wali raqam is mein NAHI: wo hamare paas aayi hi
    -- nahi. Aur ye adad kabhi manfi nahi hota -- manfi ka matlab hota
    -- hai ke ULTA us se lena hai, aur wo alag sawal hai jo is khane ka
    -- nahi. Us ke liye `vendor_ne_zyada_rakha` aur `art_diesel_advance`
    -- apne apne khanon mein saaf likhe hain.
    greatest(
      sum(s.art_ke_paas_jama)
        - sum(s.art_diesel_advance)
        - sum(s.vendor_ne_zyada_rakha)
        - coalesce((
            select sum(jl.debit) - sum(jl.credit)
              from public.journal_lines jl
              join public.journal_entries je on je.id = jl.entry_id
             where jl.account_code = '1120'
               and jl.party_type = 'machinery_vendor'
               and jl.party_id = s.vendor_id
               and je.source_module = 'machinery_vendor_payout'
          ), 0),
      0::numeric
    ) as net_abhi_dena

  from public.v_machinery_vendor_booking_settlement s
  group by s.vendor_id, s.vendor_name, s.user_id;


grant select on public.v_machinery_vendor_booking_settlement to authenticated;
grant select on public.v_machinery_vendor_settlement to authenticated;
