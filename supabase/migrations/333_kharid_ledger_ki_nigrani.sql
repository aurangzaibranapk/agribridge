-- =====================================================================
-- AgriBridge — Migration 333: Kharid bhi Money Trail mein
-- =====================================================================
-- 6 September ko Live par ye nikla:
--
--   Rs 112,048 ki kharid receive ho chuki thi. Maal godam mein para
--   tha. `suppliers.current_payable` bhi theek tha. Magar us ki KOI
--   journal entry nahi thi:
--
--     khata 1200 (Stock)  =  Rs -28   (sirf POS ki bikri ke credit)
--     khata 2000 (Dena)   =  sirf machinery vendor, supplier nadarad
--
-- Do ghaltiyan thin, aur doosri pehli se zyada sanjeeda hai.
--
-- PEHLI: `receivePurchase` mein ledger ka poster tha hi nahi, aur
--   `supplier_payments` ki paanchon jagahon mein se kisi ne bhi ledger
--   ko nahi bataya. Wo code mein theek ho chuka hai.
--
-- DOOSRI: `v_ledger_unposted` -- wo view jis ka poora kaam hi ye batana
--   hai ke "kaun sa paisa ledger tak nahi pahuncha" -- us mein
--   `purchases` aur `supplier_payments` the hi nahi. Yani nigrani wale
--   safhe par sab hara tha, aur Rs 112,048 us hare ke andar chhupa hua
--   tha.
--
--   Rok toot jaye to nigrani bolti hai. Magar nigrani jis cheez ko
--   dekhti hi na ho, us ka toot-na kabhi pata nahi chalta. Ye migration
--   wohi sooraakh band karti hai.
--
-- View ka purana matn yahan dobara nahi likha gaya -- wo 107, 117 aur
-- 227 se banta chala aa raha hai, aur do jagah likhi hui cheez ek din
-- alag ho jati hai. Yahan usi ka maujooda matn le kar aage do shaakhein
-- joRi ja rahi hain (wohi tareeqa jo 117 ne istemal kiya tha).
-- =====================================================================

do $$
declare
  body text;
begin
  body := rtrim(btrim(pg_get_viewdef('public.v_ledger_unposted'::regclass, true)), ';');

  if position('supplier_payments' in body) = 0 then
    execute 'create or replace view public.v_ledger_unposted with (security_invoker = true) as '
      || body
      || $branch$
      -- Kharid: sirf WUSOOL SHUDA. Draft aur manzoori ke intezar wali
      -- purchase par abhi kuch dena nahi bana -- use "posted nahi"
      -- ginana rozana ek jhoota surkh nishan paida karta. Mansookh bhi
      -- bahar hai: us ka maal aaya hi nahi.
      --
      -- Raqam `total_amount` hai, `invoice_total` nahi. Receive ke baad
      -- `total_amount` wohi hota hai jo QABOOL hua (received x rate);
      -- invoice_total us se zyada ho sakta hai jab kuch toota ya kam
      -- aaya ho -- aur ledger mein utna hi jata hai jitna qabool hua.
      union all
      select 'purchases'::text as source_table, p.id as row_id,
             p.total_amount as amount, p.created_at, 'received'::text as kind,
             coalesce(p.purchase_number, 'Kharid') as detail
      from purchases p
      where p.status = 'received'
        and coalesce(p.total_amount, 0) > 0
        and not exists (select 1 from journal_entry_sources s
                        where s.source_table = 'purchases' and s.source_row_id = p.id)

      -- Supplier ko adaigi: har qatar. Yahan koi shart nahi -- qatar ka
      -- wujood hi is baat ka matlab hai ke paisa ja chuka hai.
      union all
      select 'supplier_payments'::text as source_table, sp.id as row_id,
             sp.amount, sp.created_at,
             coalesce(sp.payment_method, 'adaigi')::text as kind,
             coalesce(sp.notes, 'Supplier ko adaigi') as detail
      from supplier_payments sp
      where not exists (select 1 from journal_entry_sources s
                        where s.source_table = 'supplier_payments' and s.source_row_id = sp.id)
      $branch$;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Supplier ka yaad kiya hua "dena" aur ledger ka khata 2000
-- ---------------------------------------------------------------------
-- 139 ne `suppliers.current_payable` ko hisaab par khaRa kar diya tha
-- (kharida minus ada kiya), aur `v_supplier_payable_check` us par nazar
-- rakhta hai. Magar us jaanch ka ledger se koi taalluq nahi tha -- dono
-- adad apas mein theek rehte hue bhi ledger se alag ho sakte the, aur
-- 6 September ko bilkul yehi hua.
--
-- Ye view teesra adad saamne rakhta hai. Teen adad ek sath hon to
-- ghalati khud nazar aa jati hai; ek akela adad hamesha durust lagta
-- hai.
create or replace view v_supplier_payable_vs_ledger
with (security_invoker = true) as
  with yaad as (
    select s.id, s.name, coalesce(s.current_payable, 0) as yaad_kiya_hua
    from suppliers s
    where s.is_active
  ),
  khata as (
    select jl.party_id,
           round(sum(coalesce(jl.credit, 0) - coalesce(jl.debit, 0)), 2) as ledger_kehta_hai
    from journal_lines jl
    where jl.account_code = '2000'
      and jl.party_type = 'supplier'
      and jl.party_id is not null
    group by jl.party_id
  )
  select y.id                                    as supplier_id,
         y.name                                  as supplier_name,
         y.yaad_kiya_hua,
         -- NULL yahan jaan boojh kar hai: is supplier ki ledger mein
         -- koi qatar hi nahi. Us ke saamne Rs 0 likhna kehta ke
         -- "ledger ne gina aur sifar paya" -- jo jhoot hai. NULL kehta
         -- hai "ledger mein is ka koi indraj hi nahi".
         k.ledger_kehta_hai,
         case when k.ledger_kehta_hai is null then null
              else round(y.yaad_kiya_hua - k.ledger_kehta_hai, 2)
         end                                     as farq
  from yaad y
  left join khata k on k.party_id = y.id;

comment on view v_supplier_payable_vs_ledger is
  'Supplier ka dena teen taraf se: suppliers.current_payable, ledger ka khata 2000, aur donon ka farq. Farq NULL ho to ledger mein us supplier ka koi indraj hi nahi -- sifar nahi.';
