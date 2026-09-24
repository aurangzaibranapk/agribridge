-- 146: Kisan ka dawa booking se PEHLE
--
-- Kisan farmaish bhejte waqt kehta hai "advance de diya hai". Us waqt
-- booking abhi bani hi nahi, is liye machinery_payments mein us ka koi
-- ghar nahi (wahan booking_id lazmi hai). Dawa farmaish par hi para
-- rehta hai, aur jab staff us farmaish se booking banata hai to dawa
-- sath chala jata hai -- 'claimed' halat mein (145).
--
-- Ye jaan boojh kar farmaish par hai, kisi "pending payments" ki alag
-- fehrist mein nahi: dawa us farmaish ka hissa hai jis ke sath aaya.
-- Alag fehrist mein para dawa us din bhula diya jata hai jis din
-- farmaish kisi aur wajah se rad ho jaye.

alter table public.machinery_requests
  add column if not exists advance_claimed_amount numeric(14,2),
  add column if not exists advance_claimed_method text,
  add column if not exists advance_claimed_reference text,
  add column if not exists advance_proof_url text;

alter table public.machinery_requests drop constraint if exists chk_request_advance_claim;
alter table public.machinery_requests add constraint chk_request_advance_claim check (
  advance_claimed_amount is null or advance_claimed_amount > 0
);

comment on column public.machinery_requests.advance_claimed_amount is
  'Kisan ka kaha hua advance. Ye ABHI paisa nahi hai -- booking banne par claimed payment banta hai, aur staff ki tasdeeq par ledger mein jata hai.';
