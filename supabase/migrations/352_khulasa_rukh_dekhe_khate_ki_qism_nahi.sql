-- =====================================================================
-- AgriBridge — Migration 352: Khulasa RUKH dekhe, khate ki qism nahi
-- =====================================================================
-- 349 ka `fn_bande_ka_khulasa` khate ki QISM se faisla karta tha:
--
--   asset     -> "lena"  (debit − credit)
--   liability -> "dena"  (credit − debit)
--
-- Ye aam soorat mein theek hai, magar ULTE balance par ye paisa CHHUPA
-- deta hai -- aur wo soorat aam hai.
--
-- =====================================================================
-- JO JAANCH MEIN NIKLA
-- =====================================================================
--
-- Testing par ye chala kar dekha gaya: kisan ko Rs 7,000 ZYADA ada kar
-- diye gaye, yani 2010 (liability) par DEBIT balance ban gaya. Khulasa
-- ye laaya:
--
--   2010: lena = 0, dena = 0
--
-- Yani bilkul KHALI qatar. Rs 7,000 kahin nazar hi nahi aate, jab ke wo
-- paisa hamein us bande se wapas lena hai. `greatest(..., 0)` ne manfi
-- adad ko sifar bana diya, aur qism ne doosri taraf dekhne hi nahi di.
--
-- Ye wohi qism ki khamoshi hai jis se CLAUDE.md mana karti hai: sifar
-- kehta hai "dekh liya, kuch nahi hai" -- jab ke yahan Rs 7,000 the.
--
-- =====================================================================
-- HAL: RUKH BALANCE SE AATA HAI
-- =====================================================================
--
--   net = sum(debit − credit)
--   net > 0  ->  hamein LENA hai
--   net < 0  ->  hamein DENA hai
--
-- Ye dono qism ke khaton par sach hai, aur bande ke khaate mein sawal
-- bhi yehi hota hai: paisa kis taraf chal raha hai. Khata "asset" hai ya
-- "liability" -- ye kitab ka sawal hai, bande ka nahi.
--
-- `fn_bande_ka_khate_par_baqi` (350) JAAN BOOJH KAR nahi badla ja raha.
-- Wo adjustment ki HADD nikalta hai, aur wahan qism dekhna theek hai:
-- ulte balance par wo sifar deta hai, yani adjustment ruk jata hai --
-- aur ruk jana hi theek hai, kyunke ulta balance khud ek masla hai jo
-- pehle dekha jana chahiye.
-- =====================================================================

create or replace function public.fn_bande_ka_khulasa(
  p_party_type text,
  p_party_id   uuid
)
returns table (
  khata_code text,
  khata_naam text,
  lena       numeric,
  dena       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select l.account_code,
         coalesce(a.name, l.account_code),
         greatest(sum(coalesce(l.debit,0) - coalesce(l.credit,0)), 0),
         greatest(sum(coalesce(l.credit,0) - coalesce(l.debit,0)), 0)
    from journal_lines l
    left join gl_accounts a on a.code = l.account_code
   where fn_is_any_staff()
     and l.party_type = p_party_type
     and l.party_id = p_party_id
     and a.account_type in ('asset', 'liability')
   group by l.account_code, a.name
  having sum(coalesce(l.debit,0) - coalesce(l.credit,0)) <> 0
  order by l.account_code;
$$;

comment on function public.fn_bande_ka_khulasa(text, uuid) is
  'Is bande ka har baqi wala khata alag -- Lena aur Dena, RUKH ke hisaab se (khate ki qism se nahi). Ulte balance par bhi raqam nazar aati hai; qism dekhne se wo chhup jati thi (352).';

revoke all on function public.fn_bande_ka_khulasa(text, uuid) from public;
grant execute on function public.fn_bande_ka_khulasa(text, uuid) to authenticated;
