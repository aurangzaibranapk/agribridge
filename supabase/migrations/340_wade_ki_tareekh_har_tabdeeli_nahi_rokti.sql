-- =====================================================================
-- AgriBridge — Migration 340: Wade ki guzri hui tareekh har tabdeeli nahi rokti
-- =====================================================================
-- Malik (6 September): *"jab vendor ko payment record kar di to stage
-- close ho jana chahiye, dobara show nahi hona... jab record ho gayi to
-- doubling nahi honi chahiye."*
--
-- Jaanch par jo nikla wo is se bara tha: **paisa teen dafa nikal chuka
-- tha.**
--
-- =====================================================================
-- KYA HUA
-- =====================================================================
--
-- MB-2026-00004 par vendor ka dena Rs 24,750 tha. Malik ne Rs 30,000
-- darj kiye. Cash chala gaya, ledger mein entry ban gayi -- magar
-- booking par `amount_paid_to_vendor` SIFAR hi raha. Safhe ne phir
-- wohi "Rs 24,750 baqi" dikhaya, aur form dobara khula. Ye teen dafa
-- hua: TXN-26-000041, 42, 43 -- kul Rs 90,000.
--
-- =====================================================================
-- ASAL JARH: YE TRIGGER
-- =====================================================================
--
-- `fn_guard_payment_promise` HAR update par chalta tha:
--
--     if new.payment_promise_date < current_date then
--       raise exception 'Wade ki tareekh guzar chuki hai...';
--
-- Is booking par kisan ka wada 1 September ka tha ("main munji sale kar
-- ke de dun ga"). Aaj 6 September hai. Yani wo tareekh guzar chuki thi.
--
-- Nateeja: us booking ki **koi bhi qatar** kabhi update ho hi nahi
-- sakti thi -- na vendor ki adaigi, na kuch aur. Har koshish is
-- exception par ruk jati thi.
--
-- **Guzri hui tareekh koi GHALTI nahi hai -- wo ek WAQIA hai.** Kisan
-- ne wade ke din paisa nahi diya; ye baat darj rehni chahiye, us ki
-- saza poori booking ko taala lagana nahi.
--
-- Rok ka asal maqsad ye tha ke koi NAYA wada guzri hui tareekh par na
-- likhe. Wo maqsad barqarar hai -- bas ab wo sirf us waqt jaanchta hai
-- jab tareekh WAQAI likhi ya badli ja rahi ho.
--
-- Code ki taraf doosri kharabi bhi isi commit mein theek hui:
-- `recordVendorPayout` update ki nakami parhta hi nahi tha, is liye
-- paisa nikal jata aur kisi ko khabar na hoti.
-- =====================================================================

create or replace function public.fn_guard_payment_promise()
returns trigger
language plpgsql
as $$
begin
  if new.payment_promise_date is null then
    return new;
  end if;

  -- Sirf tab jaanchein jab tareekh WAQAI likhi ya badli ja rahi ho.
  --
  -- Pehle ye shart nahi thi, is liye ek dafa likha hua wada guzarte hi
  -- poori booking par taala lag jata tha -- aur wo taala khamosh tha:
  -- exception server par rukta tha, screen par kuch nazar nahi aata
  -- tha.
  if tg_op = 'UPDATE'
     and new.payment_promise_date is not distinct from old.payment_promise_date then
    -- Note khali kar dena bhi ek tabdeeli hai -- us par rok lagi rehni
    -- chahiye, warna wada bina wajah ke reh jata hai.
    if coalesce(new.payment_promise_note, '') = '' then
      raise exception 'Kisan ne kya kaha, wo likhein -- sirf tareekh se baad mein kuch yaad nahi rehta.';
    end if;
    return new;
  end if;

  if new.payment_promise_date < current_date then
    raise exception 'Wade ki tareekh guzar chuki hai -- aage ki tareekh likhein.';
  end if;

  if coalesce(new.payment_promise_note, '') = '' then
    raise exception 'Kisan ne kya kaha, wo likhein -- sirf tareekh se baad mein kuch yaad nahi rehta.';
  end if;

  if new.payment_promise_at is null then
    new.payment_promise_at := now();
  end if;

  return new;
end;
$$;

comment on function public.fn_guard_payment_promise() is
  'Naya wada guzri hui tareekh par nahi likha ja sakta. Magar PURANA wada guzar jane se booking par taala nahi lagta -- wo waqia hai, ghalti nahi (340).';
