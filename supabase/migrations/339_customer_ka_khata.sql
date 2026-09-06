-- =====================================================================
-- AgriBridge — Migration 339: Customer ka khata (naqad udhaar aur statement)
-- =====================================================================
-- Malik (6 September):
--
--   *"ek customer dukan se paise udhaar le gaya hai 5,000 -- wo kis
--   tarah kahan darj karun mujhe batao."*
--
-- Aur phir:
--
--   *"customer ke bana dein, POS ke upar jahan hum load bill kar rahe
--   hain wahan udhaar raqam bhi karein -- wo customer ke ledger mein
--   jaye, har jagah wo balance jayega, aur jab customer wo hamein wapas
--   dega to wo bhi indraj hona chahiye ke aaj aaya hai, wo har ledger
--   khata finance har side update ho jayega."*
--
-- =====================================================================
-- JO NAHI THA
-- =====================================================================
--
-- Do cheezein:
--
-- 1. **Naqad udhaar ka koi khana nahi tha.** Khata sirf BIKRI par banta
--    tha (POS ki "khata" wali adaigi). Dukan se seedha paisa dene ka
--    koi raasta nahi tha -- aur wo roz hota hai.
--
-- 2. **Customer ka statement kahin nahi tha.** Supplier, kisan, dealer,
--    buyer, driver, investor -- sab ka statement maujood hai. Customer
--    ka nahi. Yani "is ne kab kya liya aur kab kya diya" ka jawab kahin
--    se nahi milta tha; sirf ek kul adad nazar aata tha.
--
-- Code ki taraf pehla hissa `src/actions/customer-udhaar.ts` mein hai.
-- Ye migration doosra hissa deti hai.
--
-- =====================================================================
-- JAWAB `SECURITY DEFINER` SE KYUN
-- =====================================================================
--
-- Ye is project ka pakka usool hai (CLAUDE.md): RLS ya staff-gated view
-- kisi bande ke haath mein KHALI jawab laati hai, aur us "kuch nahi
-- mila" ko "qeemat sifar hai" samajh lena yahan teen dafa ghalat adad de
-- chuka hai.
--
-- Is liye statement ka jawab `SECURITY DEFINER` function se aata hai --
-- aur us par taala `fn_is_any_staff()` ka hai, taake wo raasta sirf
-- staff ke liye khule. Aur jahan customer hi na mile, wahan jawab NULL
-- hai, sifar nahi.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Customer ka khata -- ledger se, source tables se nahi
-- ---------------------------------------------------------------------
-- Jaan boojh kar LEDGER se: POS ka khata, load ka khata, naqad udhaar
-- aur har wapsi -- sab 1100 par party ke sath baithte hain. Source
-- tables se banane ka matlab hota ke har naye raaste ke sath statement
-- bhi badalna paRta, aur koi na koi raasta chhoot jata.
create or replace function public.fn_customer_ledger(
  p_customer uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  entry_date   date,
  entry_number text,
  tafseel      text,
  module       text,
  debit        numeric,
  credit       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select e.entry_date,
         e.entry_number,
         coalesce(l.memo, e.description) as tafseel,
         e.source_module,
         coalesce(l.debit, 0),
         coalesce(l.credit, 0)
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
   where fn_is_any_staff()
     and l.account_code = '1100'
     and l.party_type = 'customer'
     and l.party_id = p_customer
     and (p_start is null or e.entry_date >= p_start)
     and (p_end   is null or e.entry_date <= p_end)
   order by e.entry_date, e.entry_number;
$$;

comment on function public.fn_customer_ledger(uuid, date, date) is
  'Customer ka khata ledger (1100) se. SECURITY DEFINER kyunki RLS ke peeche khali jawab ko sifar samajh liya jata hai (339).';


-- ---------------------------------------------------------------------
-- 2) Customer par kitna baqi -- aur "maloom nahi" ke liye NULL
-- ---------------------------------------------------------------------
-- Do jawab alag hain aur dono zaroori hain:
--
--   * Customer maujood hai magar us par kuch nahi -> 0
--   * Customer mila hi nahi (ya ijazat nahi) -> NULL
--
-- Doosre ko sifar bana dena wo ghalti hai jis se CLAUDE.md mana karti
-- hai.
create or replace function public.fn_customer_baqi(p_customer uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_baqi numeric;
begin
  if not fn_is_any_staff() then
    return null;
  end if;
  if not exists (select 1 from customers where id = p_customer) then
    return null;
  end if;

  select round(coalesce(sum(coalesce(l.debit,0) - coalesce(l.credit,0)), 0), 2)
    into v_baqi
    from journal_lines l
   where l.account_code = '1100'
     and l.party_type = 'customer'
     and l.party_id = p_customer;

  return coalesce(v_baqi, 0);
end;
$$;

comment on function public.fn_customer_baqi(uuid) is
  'Customer par kitna baqi hai, ledger ke mutabiq. Customer na mile ya ijazat na ho to NULL -- sifar nahi (339).';

grant execute on function public.fn_customer_ledger(uuid, date, date) to authenticated;
grant execute on function public.fn_customer_baqi(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 3) Help -- har naye khane ke sath us ki qatar, usi commit mein
-- ---------------------------------------------------------------------
-- Malik ka usool (2 September): feature tab tak "poora" nahi jab tak
-- Help, Permission, Audit aur staff ka raasta sath na hon.
--
-- Udhaar aur commission `/admin/load-bill` ke apne khane hain (alag
-- safhe nahi), is liye un ki madad usi safhe ki qatar mein jati hai --
-- menu mein naya naam banane se sirf uljhan barhti.
update public.feature_help
   set how_steps = how_steps || array[
         'Naqad udhaar dena ho to upar "Udhaar" chunein, phir "Udhaar diya" — customer, raqam, aur ye ke paisa kis khate se gaya.',
         'Customer paisa wapas laaye to wohi khana, magar "Wapas aaya" — raqam us ke khate se kam ho jayegi.',
         'Company ki commission mil jaye to us qatar ke saamne raqam likh kar "Mil gayi" dabayein, aur batayein ke wo kis khate mein aayi.'
       ],
       mistakes = mistakes || array[
         'Naqad udhaar BIKRI NAHI hai — koi maal nahi gaya. Ise POS par bikri bana dena us mahine ka nafa jhoota kar deta hai.',
         'Commission apne aap darj nahi hoti. Company se mil jaye to us qatar par khud likhni paRti hai — warna wo kitab mein aati hi nahi.',
         'Commission "float mein" aayi ya kisi aur khate mein — ye poochha jata hai, maan nahi liya jata. Ghalat khata chunne ka pata mahine baad company ki statement se milan par chalta hai.'
       ],
       next_step = 'Shaam ko /admin/load-bill/reconcile par milan karein. Customer ka poora khata /admin/crm par us ke naam se khulta hai.',
       updated_at = now()
 where feature_key = 'load-bill' and lang = 'rm';

update public.feature_help
   set how_steps = how_steps || array[
         'Kisi gahak ka poora khata dekhna ho to us ki qatar par "Khata" dabayein — har lena aur dena tareekh ke sath.'
       ],
       mistakes = mistakes || array[
         'Khate ka adad khali nazar aaye to us ka matlab hamesha "kuch nahi" nahi hota — ho sakta hai us gahak ka hisaab abhi shuru hi na hua ho. Dono baatein alag likhi jati hain.'
       ],
       updated_at = now()
 where feature_key = 'crm' and lang = 'rm';
