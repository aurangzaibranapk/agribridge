-- =====================================================================
-- 194  Aakhri bill par discount
-- =====================================================================
--
-- Amir Sultan se Rs 28,000 lene the, bill Rs 30,000 ka ban gaya. Rate
-- kaam mukammal hone ke baad cheerna poori zanjeer hila deta hai --
-- kisan ki tasdeeq wapas leni parti hai, machine bhej di gayi, kaam ho
-- chuka. Malik ka faisla saada aur behtar hai: rate wohi rahe, aakhri
-- bill par discount lag jaye.
--
-- MALIK KA QAIDA, LAFZ BA LAFZ: "jo discount hoga us ka commission bhi
-- na ho, na vendor ki side wo show ho. Wo nikal kar 28,000 aa jayega,
-- us mein commission aur vendor ke alag alag ho jayenge."
--
-- Yani discount SAB SE PEHLE nikalta hai, aur hissa us ke baad bantta
-- hai:
--
--   gross        2 acre x Rs 15,000     = 30,000
--   discount                            = -2,000
--   ------------------------------------------------
--   net                                 = 28,000
--   commission   12% of 28,000          =  3,360   (30,000 par 3,600 tha)
--   vendor ka    28,000 - 3,360         = 24,640   (26,400 tha)
--
-- Dono baatein isi soorat mein poori hoti hain: us Rs 2,000 par hamein
-- commission nahi mila, aur wo Rs 2,000 vendor ke khate mein bhi nahi
-- gaye. Bojh dono par apne apne hisse ke mutabiq para -- jaise poore
-- bill par parta hai.
--
-- Gross apni jagah likha rehta hai. Usay 28,000 kar dena discount ka
-- nishan hi mita deta -- aur phir kal ye sawal jawab nahi paata ke
-- kisan ko riayat kis ne aur kyun di.

alter table public.machinery_bills
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists discount_reason text;

comment on column public.machinery_bills.discount_amount is
  'Bill par di gayi riayat. Hisse is ke KATNE KE BAAD bante hain (194).';

-- ---------------------------------------------------------------------
-- Shartein: adad khud ek doosre se milte rahen
-- ---------------------------------------------------------------------
-- Ye shartein trigger ka kaam dobara nahi karteen -- wo us ki gawah
-- hain. Trigger ghalat likh de ya koi seedha SQL chala de, to bhi qatar
-- jo kehti hai wo apne andar sach rehti hai.
alter table public.machinery_bills
  drop constraint if exists chk_machinery_bill_discount;
alter table public.machinery_bills
  add constraint chk_machinery_bill_discount
  check (discount_amount >= 0 and round(discount_amount, 2) <= round(gross_amount, 2));

alter table public.machinery_bills
  drop constraint if exists chk_machinery_bill_commission;
alter table public.machinery_bills
  add constraint chk_machinery_bill_commission
  check (round(commission_amount, 2)
         = round((gross_amount - discount_amount) * commission_percentage / 100, 2));

alter table public.machinery_bills
  drop constraint if exists chk_machinery_bill_vendor_share;
alter table public.machinery_bills
  add constraint chk_machinery_bill_vendor_share
  check (round(vendor_payable, 2)
         = round((gross_amount - discount_amount) - commission_amount - diesel_deducted, 2));

alter table public.machinery_bills
  drop constraint if exists chk_machinery_bill_balance;
alter table public.machinery_bills
  add constraint chk_machinery_bill_balance
  check (round(balance_payable, 2)
         = round((gross_amount - discount_amount) - advance_adjusted - previous_payment - diesel_deducted, 2));

alter table public.machinery_bills
  drop constraint if exists chk_machinery_bill_diesel;
alter table public.machinery_bills
  add constraint chk_machinery_bill_diesel
  check (diesel_deducted >= 0
         and round(diesel_deducted, 2) <= round((gross_amount - discount_amount) - commission_amount, 2));

-- ---------------------------------------------------------------------
-- Guard: sara hisaab ab NET par
-- ---------------------------------------------------------------------
create or replace function public.fn_machinery_bill_guard()
returns trigger
language plpgsql
as $$
declare
  v_actual        numeric(12,4);
  v_final         boolean;
  v_rate          numeric(12,2);
  v_type          text;
  v_sabit_rate    numeric(12,2);
  v_kutra_rate    numeric(12,2);
  v_sabit_sum     numeric(12,4);
  v_kutra_sum     numeric(12,4);
  v_advance       numeric(14,2);
  v_pct           numeric(6,3);
  v_gross         numeric(14,2);
  v_net           numeric(14,2);
  v_diesel        numeric(14,2);
  v_vendor_before numeric(14,2);
begin
  if tg_op = 'UPDATE' then
    if old.cancelled_at is not null then
      raise exception 'Ye bill mansookh ho chuka hai — is mein tabdeeli nahi ho sakti. Naya bill banayein.';
    end if;

    if new.cancelled_at is not null
       and new.actual_area       is not distinct from old.actual_area
       and new.rate_amount       is not distinct from old.rate_amount
       and new.gross_amount      is not distinct from old.gross_amount
       and new.discount_amount   is not distinct from old.discount_amount
       and new.commission_amount is not distinct from old.commission_amount
       and new.vendor_payable    is not distinct from old.vendor_payable
       and new.advance_adjusted  is not distinct from old.advance_adjusted
       and new.balance_payable   is not distinct from old.balance_payable then
      return new;
    end if;
  end if;

  select coalesce(sum(w.actual_area), 0), bool_or(w.is_final)
    into v_actual, v_final
    from machinery_work_records w
   where w.booking_id = new.booking_id
     and w.verification_status = 'verified';

  if v_actual is null or v_actual = 0 then
    raise exception 'Bill se pehle asal kaam darj karein (kitne acre waqai kaate gaye).';
  end if;
  if not coalesce(v_final, false) then
    raise exception 'Kaam abhi mukammal nishaan zada nahi hua. Aakhri indraj par "kaam poora ho gaya" par nishaan lagayein, phir bill banega.';
  end if;
  if round(new.actual_area, 4) <> round(v_actual, 4) then
    raise exception 'Bill ka raqba tasdeeq shuda kaam ke jor se mel nahi khata (% ke muqable %).', new.actual_area, v_actual;
  end if;

  select b.final_rate, b.harvest_type, b.sabit_rate, b.kutra_rate
    into v_rate, v_type, v_sabit_rate, v_kutra_rate
    from machinery_bookings b where b.id = new.booking_id;

  if v_type is null then
    if v_rate is null then
      raise exception 'Bill se pehle final rate kisan se confirm karwana zaroori hai.';
    end if;
    if round(new.rate_amount, 2) <> round(v_rate, 2) then
      raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
        new.rate_amount, v_rate;
    end if;

    v_gross := round(v_actual * v_rate, 2);
    new.sabit_area := null; new.kutra_area := null;
    new.sabit_rate := null; new.kutra_rate := null;
    new.sabit_amount := null; new.kutra_amount := null;

  else
    select coalesce(sum(w.sabit_area), 0), coalesce(sum(w.kutra_area), 0)
      into v_sabit_sum, v_kutra_sum
      from machinery_work_records w
     where w.booking_id = new.booking_id
       and w.verification_status = 'verified';

    if round(v_sabit_sum + v_kutra_sum, 4) <> round(v_actual, 4) then
      raise exception 'Kaam ka Sabit (%) aur Kutra (%) jor kul asal raqbe (%) se mel nahi khata.',
        v_sabit_sum, v_kutra_sum, v_actual;
    end if;
    if v_sabit_sum > 0 and v_sabit_rate is null then
      raise exception 'Sabit Parali ka kaam hua hai magar us ka rate final nahi hua.';
    end if;
    if v_kutra_sum > 0 and v_kutra_rate is null then
      raise exception 'Kutra ka kaam hua hai magar us ka rate final nahi hua.';
    end if;

    new.sabit_area := v_sabit_sum;
    new.kutra_area := v_kutra_sum;
    new.sabit_rate := v_sabit_rate;
    new.kutra_rate := v_kutra_rate;
    new.sabit_amount := round(v_sabit_sum * coalesce(v_sabit_rate, 0), 2);
    new.kutra_amount := round(v_kutra_sum * coalesce(v_kutra_rate, 0), 2);
    v_gross := round(new.sabit_amount + new.kutra_amount, 2);

    if v_type = 'dono' then
      new.rate_amount := round(v_gross / v_actual, 2);
    elsif round(new.rate_amount, 2) <> round(v_rate, 2) then
      raise exception 'Bill ka rate us rate se mel nahi khata jis par kisan raazi hua (Rs % ke muqable Rs %).',
        new.rate_amount, v_rate;
    end if;
  end if;

  new.gross_amount := v_gross;

  -- Discount ka hisaab yahan se shuru hota hai. Riayat gross se BARI
  -- nahi ho sakti -- warna bill kisan ke haq mein khara ho jata, jo
  -- riayat nahi udhaar hai.
  new.discount_amount := round(coalesce(new.discount_amount, 0), 2);
  if new.discount_amount < 0 then
    raise exception 'Discount minus mein nahi hota.';
  end if;
  if new.discount_amount > v_gross then
    raise exception 'Discount (Rs %) bill (Rs %) se bara nahi ho sakta.', new.discount_amount, v_gross;
  end if;
  if new.discount_amount > 0 and length(btrim(coalesce(new.discount_reason, ''))) < 5 then
    raise exception 'Discount ki wajah likhna zaroori hai -- kam az kam paanch harf. Ye wajah hamesha darj rahegi.';
  end if;

  v_net := round(v_gross - new.discount_amount, 2);

  select coalesce((value #>> '{}')::numeric, 12) into v_pct
    from platform_settings where key = 'machinery_commission_rate';
  v_pct := coalesce(v_pct, 12);

  -- Commission NET par -- discount ke paison par hamein kuch nahi milta.
  new.commission_percentage := v_pct;
  new.commission_amount := round(v_net * v_pct / 100, 2);
  v_vendor_before := round(v_net - new.commission_amount, 2);

  select coalesce(sum(l.amount), 0) into v_diesel
    from machinery_fuel_logs l
   where l.booking_id = new.booking_id
     and l.paid_by = 'farmer'
     and l.verification_status = 'verified'
     and (l.deducted_in_bill_id is null or l.deducted_in_bill_id = new.id);

  if v_diesel > v_vendor_before then
    raise exception 'Kisan ka diesel (Rs %) vendor ke hisse (Rs %) se ziyada hai -- pehle diesel ke indraj dekh lein.',
      round(v_diesel, 2), v_vendor_before;
  end if;

  new.diesel_deducted := v_diesel;
  -- Vendor ka hissa bhi NET par -- discount us ki side nazar nahi aata,
  -- yani us mein se wo raqam ginti hi nahi.
  new.vendor_payable := round(v_vendor_before - v_diesel, 2);

  select coalesce(sum(p.amount), 0) into v_advance
    from machinery_payments p
    where p.booking_id = new.booking_id
      and p.kind = 'advance'
      and p.verification_status = 'verified';

  if round(new.advance_adjusted, 2) <> round(least(v_advance, v_net), 2) then
    raise exception 'Advance ka adjustment ghalat hai: tasdeeq shuda advance Rs % hai, bill mein Rs % kata gaya.',
      round(v_advance, 2), round(new.advance_adjusted, 2);
  end if;

  new.balance_payable := round(v_net - new.advance_adjusted - new.previous_payment - v_diesel, 2);

  return new;
end
$$;

-- ---------------------------------------------------------------------
-- P&L: discount ke baad wala adad, aur mansookh bill bahar
-- ---------------------------------------------------------------------
-- Do cheezein yahan theek ho rahi hain:
--
--   Mansookh bill (192) P&L mein ab tak bhi ginti mein aa raha tha --
--   yani ulta hua bill kamai dikhata rehta.
--
--   gross_billing par discount ka koi nishan nahi tha. Kisan se aaye
--   Rs 28,000 aur P&L kahe Rs 30,000 -- to wasooli hamesha kam nazar
--   aati aur koi na koi us farq ko dhoondta rehta. Ab gross wo hai jo
--   waqai bill hua, aur riayat apne khane mein alag nazar aati hai.
drop view if exists v_machinery_pnl_booking cascade;

create view v_machinery_pnl_booking as
 SELECT b.id AS booking_id,
    b.booking_number,
    b.booking_date,
    bl.bill_number,
    bl.bill_date,
    date_trunc('month'::text, bl.bill_date::timestamp with time zone)::date AS maheena,
    w.aakhri_kaam AS kaam_ki_tareekh,
    date_trunc('month'::text, w.aakhri_kaam::timestamp with time zone)::date AS kaam_ka_maheena,
    b.crop_type,
    v.id AS vendor_id,
    v.vendor_name,
    m.id AS machine_id,
    m.machine_code,
    m.machine_type,
    COALESCE(m.owner, 'vendor'::text) AS machine_owner,
    COALESCE(w.kiya, 0::numeric) AS acre,
    COALESCE(bl.gross_amount, 0::numeric) - COALESCE(bl.discount_amount, 0::numeric) AS gross_billing,
    COALESCE(bl.gross_amount, 0::numeric) AS gross_before_discount,
    COALESCE(bl.discount_amount, 0::numeric) AS riayat,
    COALESCE(bl.commission_amount, 0::numeric) AS commission,
    COALESCE(bl.vendor_payable, 0::numeric) AS vendor_ka_hissa,
    COALESCE(bl.diesel_deducted, 0::numeric) AS kisan_ka_diesel,
    COALESCE(d.wapas, 0::numeric) AS diesel_wapas_aane_wala,
    COALESCE(d.hamara, 0::numeric) AS diesel_hamara_kharcha,
    COALESCE(d.vendor_ne, 0::numeric) AS diesel_vendor_ne_diya,
    COALESCE(d.kisan_ne, 0::numeric) AS diesel_kisan_ne_diya,
    COALESCE(p.wasool, 0::numeric) AS wasooli,
        CASE
            WHEN COALESCE(m.owner, 'vendor'::text) = 'art'::text
              THEN COALESCE(bl.gross_amount, 0::numeric) - COALESCE(bl.discount_amount, 0::numeric)
            ELSE COALESCE(bl.commission_amount, 0::numeric)
        END AS hamari_aamdani,
        CASE
            WHEN COALESCE(m.owner, 'vendor'::text) = 'art'::text
              THEN COALESCE(bl.gross_amount, 0::numeric) - COALESCE(bl.discount_amount, 0::numeric) - COALESCE(d.hamara, 0::numeric)
            ELSE COALESCE(bl.commission_amount, 0::numeric) - COALESCE(d.hamara, 0::numeric)
        END AS munafa
   FROM machinery_bookings b
     LEFT JOIN machinery_vendors v ON v.id = b.vendor_id
     LEFT JOIN machinery_vendor_machines m ON m.id = b.machine_id
     JOIN machinery_bills bl ON bl.booking_id = b.id AND bl.cancelled_at IS NULL
     LEFT JOIN LATERAL ( SELECT sum(w2.actual_area) AS kiya,
            max(w2.work_date) AS aakhri_kaam
           FROM machinery_work_records w2
          WHERE w2.booking_id = b.id AND w2.verification_status = 'verified'::text) w ON true
     LEFT JOIN LATERAL ( SELECT sum(l.amount) FILTER (WHERE l.vendor_recoverable) AS wapas,
            sum(l.amount) FILTER (WHERE l.paid_by = 'company'::text AND NOT l.vendor_recoverable) AS hamara,
            sum(l.amount) FILTER (WHERE l.paid_by = 'vendor'::text) AS vendor_ne,
            sum(l.amount) FILTER (WHERE l.paid_by = 'farmer'::text) AS kisan_ne
           FROM machinery_fuel_logs l
          WHERE l.booking_id = b.id AND l.verification_status = 'verified'::text) d ON true
     LEFT JOIN LATERAL ( SELECT sum(pp.amount) AS wasool
           FROM machinery_payments pp
          WHERE pp.booking_id = b.id AND pp.verification_status = 'verified'::text) p ON true
  WHERE b.status <> 'cancelled'::text AND fn_is_any_staff();

comment on view public.v_machinery_pnl_booking is
  'Machinery P&L ki bunyaad. gross_billing DISCOUNT ke BAAD wala adad hai (194) -- wohi jo kisan se waqai maanga gaya; riayat apne khane mein alag hai. Mansookh bill (192) is mein aata hi nahi. maheena BILL ki tareekh se banta hai; kaam_ka_maheena kaam ki tareekh se. munafa = hamari aamdani - ART ka apna wapas-na-aane-wala diesel.';

-- ---- Isi bunyaad par khare chaar view, jyun ke tyun ----

create view public.v_machinery_pnl_machine as
select machine_id, machine_code, machine_type, machine_owner, vendor_name,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(vendor_ka_hissa) as vendor_ka_hissa,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(diesel_hamara_kharcha) as hamara_diesel,
       sum(diesel_wapas_aane_wala) as diesel_wapas_aane_wala,
       sum(munafa) as munafa,
       case when sum(acre) > 0 then round(sum(munafa) / sum(acre), 2) end as munafa_per_acre
  from public.v_machinery_pnl_booking p
 where machine_id is not null
 group by machine_id, machine_code, machine_type, machine_owner, vendor_name;

create view public.v_machinery_pnl_vendor as
select vendor_id, vendor_name,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(vendor_ka_hissa) as vendor_ka_hissa,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(diesel_hamara_kharcha) as hamara_diesel,
       sum(diesel_wapas_aane_wala) as diesel_wapas_aane_wala,
       sum(munafa) as munafa
  from public.v_machinery_pnl_booking p
 where vendor_id is not null
 group by vendor_id, vendor_name;

create view public.v_machinery_pnl_crop as
select coalesce(crop_type, 'darj nahi') as crop_type,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(munafa) as munafa
  from public.v_machinery_pnl_booking p
 group by coalesce(crop_type, 'darj nahi');

create view public.v_machinery_pnl_month as
select maheena,
       count(*) as bookings,
       sum(acre) as acre,
       sum(gross_billing) as gross_billing,
       sum(vendor_ka_hissa) as vendor_ka_hissa,
       sum(hamari_aamdani) as hamari_aamdani,
       sum(diesel_hamara_kharcha) as hamara_diesel,
       sum(munafa) as munafa
  from public.v_machinery_pnl_booking p
 group by maheena;

-- View dobara banane par us ki ijazatein sath nahi aatin. 184 mein ye
-- hissa likha hi nahi gaya tha -- wahan Supabase ki default ijazat ne
-- kaam chala diya, magar us par bharosa karna sirf itna hai ke ye
-- ghalti abhi tak pakri nahi gayi. Testing par view banate hi safha
-- "permission denied" dene laga. Ijazat ab saaf likhi hui hai.
grant select on public.v_machinery_pnl_booking to anon, authenticated, service_role;
grant select on public.v_machinery_pnl_machine to anon, authenticated, service_role;
grant select on public.v_machinery_pnl_vendor  to anon, authenticated, service_role;
grant select on public.v_machinery_pnl_crop    to anon, authenticated, service_role;
grant select on public.v_machinery_pnl_month   to anon, authenticated, service_role;
