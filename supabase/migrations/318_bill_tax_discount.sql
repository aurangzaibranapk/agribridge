-- =====================================================================
-- AgriBridge — Migration 318: Bill par TAX aur DISCOUNT ka apna khana
-- =====================================================================
-- Malik ka kehna (5 September), bill reader ka paighaam dekh kar:
--
--   "1822.76 discount amount hai, 322.76 tax amount hai. Hamein tax
--    amount ka bhi khana banana chahiye -- kal ko FBR ke sath link karte
--    hain to wo tax nikalna asaan hoga. Aur discount ka bhi hona
--    chahiye."
--
-- Safha keh raha tha: qatarein Rs 64,533.54 banti hain, bill par
-- Rs 63,033.45 likha hai, Rs 1,500.09 ka farq -- "shayad koi qatar nahi
-- paRhi gayi".
--
-- Magar hisaab poora milta tha:
--
--   64,533.54  −  1,822.76 (discount)  +  322.76 (tax)  =  63,033.54
--
-- Yani AI ne saari qatarein THEEK paRhi thin. Farq is liye tha ke
-- discount aur tax ke KHANE HI NAHI THE -- aur jis cheez ka khana na ho,
-- us ka adad kahin nahi ja sakta. Safha us kami ko "qatar chhoot gayi"
-- samajh raha tha, aur banda poora bill dobara ginta rehta.
--
-- Ab teen khane: discount, tax, aur baqi kharche (freight/labour jaise).
-- Teenon KHALI reh sakte hain -- har bill par discount ya tax nahi hota,
-- aur khali ko sifar likh dena wohi ghalti hai jo is project mein bar
-- bar mehngi paRi.
--
-- FBR wali baat ahem hai aur usi ne shakal tay ki.
--
-- Asal bill (JX FSD-Jhang-Hamid Traders) par ye likha hai:
--
--   INVOICE TOTAL:   64,533.54
--   TOTAL DISCOUNT:   1,822.76
--   ADVANCE TAX:        322.67
--   GRAND TOTAL:     63,033.45
--
-- Ghor karne wali baat: us par "ADVANCE TAX" likha hai, GST nahi.
-- FBR ke liye ye DO ALAG cheezein hain -- advance tax (236G/236H) rok
-- kar jama karaya jata hai aur aage adjust hota hai; sales tax ka
-- raasta bilkul aur hai. Dono ko ek "tax" ke khane mein daal dena aaj
-- to chal jata, magar us din nahi chalta jis din FBR ko dena ho.
--
-- Is liye tax ke sath us ka NAAM bhi rakha jata hai -- jaisa bill par
-- likha ho, waisa ka waisa. Apni taraf se "GST" maan lena wohi ghalti
-- hoti jis se is project mein bar bar ghalat adad nikle.
-- =====================================================================

alter table public.supplier_bill_reads
  add column if not exists discount_amount numeric(14,2),
  add column if not exists tax_amount      numeric(14,2),
  add column if not exists tax_label       text,
  add column if not exists tax_rate        numeric(6,3),
  add column if not exists other_charges   numeric(14,2);

comment on column public.supplier_bill_reads.discount_amount is
  'Bill par likhi hui riayat. KHALI = bill par thi hi nahi (sifar se alag baat).';
comment on column public.supplier_bill_reads.tax_amount is
  'Bill par likha hua tax. FBR ke liye alag rakha jata hai -- gross mein jama nahi kiya jata.';
comment on column public.supplier_bill_reads.tax_label is
  'Tax ka naam JAISA BILL PAR LIKHA HAI -- "Advance Tax", "GST", "Sales Tax". FBR ke liye ye alag alag cheezein hain; apni taraf se koi naam maan lena ghalat adad deta hai.';
comment on column public.supplier_bill_reads.tax_rate is
  'Tax ki shirah (fisad). Bill par likhi ho to yahan, warna khali.';
comment on column public.supplier_bill_reads.other_charges is
  'Freight, labour ya koi aur kharcha jo bill ke total mein shaamil ho.';

-- Manfi adad kisi khane mein nahi. Riayat "manfi riayat" ke tor par
-- nahi likhi jati -- wo ulta hisaab hai aur usi se log dhoke khate hain.
alter table public.supplier_bill_reads
  drop constraint if exists chk_bill_amounts_positive;
alter table public.supplier_bill_reads
  add constraint chk_bill_amounts_positive check (
    coalesce(discount_amount, 0) >= 0
    and coalesce(tax_amount, 0) >= 0
    and coalesce(other_charges, 0) >= 0
    and coalesce(tax_rate, 0) >= 0
  );

-- ---------------------------------------------------------------------
-- Milan ka hisaab -- ek hi jagah se
-- ---------------------------------------------------------------------
-- Pehle ye hisaab safhe par (code mein) hota tha: qataron ka jama minus
-- bill ka total. Ab wohi hisaab yahan hai, poora:
--
--   qatarein − discount + tax + baqi kharche  =  bill ka total
--
-- `farq` sifar ke qareeb ho to bill mila hua hai. Jahan bill ka total
-- likha hi na ho, wahan farq NULL rehta hai -- "mila hua" nahi.
create or replace view public.v_supplier_bill_milan as
  select
    r.id as bill_read_id,
    r.bill_number,
    r.bill_date,
    r.supplier_name_raw,
    r.status,
    coalesce(l.qataron_ka_jama, 0)                 as qataron_ka_jama,
    l.qatarein,
    r.discount_amount,
    r.tax_amount,
    r.other_charges,
    r.bill_total,
    case
      when r.bill_total is null then null
      else round(
        coalesce(l.qataron_ka_jama, 0)
          - coalesce(r.discount_amount, 0)
          + coalesce(r.tax_amount, 0)
          + coalesce(r.other_charges, 0)
          - r.bill_total
      , 2)
    end as farq
  from public.supplier_bill_reads r
  left join lateral (
    select sum(x.line_total) as qataron_ka_jama, count(*) as qatarein
      from public.supplier_bill_lines x
     where x.bill_read_id = r.id
  ) l on true;

grant select on public.v_supplier_bill_milan to authenticated;
