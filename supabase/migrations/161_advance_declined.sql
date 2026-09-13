-- 161: "Advance nahi de raha" -- ye bhi ek jawab hai, khamoshi nahi
--
-- Booking ke form par advance ek dafa poochha jata hai. Kisan "nahi"
-- keh de to wo "nahi" kahin mehfooz nahi hota tha -- sirf koi payment
-- na banti thi. Aur khali jagah ka matlab do cheezein ho sakti hain:
-- "poochha tha, us ne mana kiya" aur "abhi poochha hi nahi".
--
-- Booking khulne par safha wohi sawal dobara poochh leta tha. Jo baat
-- kisan pehle keh chuka hai, wo dobara poochhna staff ko ye shak deta
-- hai ke shayad pehle wala darj hi nahi hua -- aur wohi shak ek hi
-- raqam do dafa likhwa deta hai.
--
-- Is liye "nahi" ko bhi likh lete hain. Ye raqam nahi hai, iradah hai:
-- ledger mein kuch nahi jata, bill par koi asar nahi. Sirf itna ke
-- sawal poochha ja chuka hai.

alter table public.machinery_bookings
  add column if not exists advance_declined_at timestamptz,
  add column if not exists advance_declined_by uuid references auth.users(id);

comment on column public.machinery_bookings.advance_declined_at is
  'Booking ke waqt kisan ne kaha ke advance nahi de raha. Raqam nahi, sirf jawab -- ledger par koi asar nahi. Is se safha wohi sawal dobara nahi poochhta.';

-- Aur ye dono baatein ek sath sach nahi ho sakteen: advance aaya bhi
-- ho aur mana bhi kiya ho. Agar baad mein advance aa jaye to nishan
-- hat jata hai (server wahi karta hai) -- ye guard us bhoolne ko
-- pakarta hai.
create or replace function public.fn_guard_advance_declined()
returns trigger language plpgsql as $$
begin
  if new.advance_declined_at is not null and exists (
    select 1 from public.machinery_payments p
     where p.booking_id = new.id
       and p.kind = 'advance'
       and p.verification_status = 'verified'
  ) then
    raise exception 'Advance aa chuka hai -- "advance nahi de raha" ka nishan sath nahi reh sakta.';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_advance_declined on public.machinery_bookings;
create trigger trg_guard_advance_declined
  before insert or update of advance_declined_at on public.machinery_bookings
  for each row execute function public.fn_guard_advance_declined();
