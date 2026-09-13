-- 163: Adhoori booking khoti nahi -- draft
--
-- Ye form khet par bhara jata hai, mobile par. Phone ki battery khatam,
-- signal chala gaya, ya koi phone aa gaya aur browser band -- aur sab
-- kuch chala jata tha. Kisan ka naam, raqba, jagah, sab dobara.
--
-- Dobara bharna sirf waqt ka nuqsan nahi. Jo bande ko dobara bharna
-- pare wo aksar dobara bharta hi nahi -- wo kaghaz par likh leta hai
-- aur "baad mein daal doonga" kehta hai. Aur wo baad kabhi nahi aata.
-- Jo booking system mein nahi aayi, us ka bill bhi kabhi nahi banta.
--
-- Is liye jo likha ja raha hai wo khud mehfooz hota rehta hai. Ye
-- BOOKING nahi hai -- booking tab banti hai jab banda "banayein" kehta
-- hai. Ye sirf adhoora kaghaz hai jo mez par para reh gaya.
--
-- Har bande ka ek hi adhoora kaghaz: form ek waqt mein ek hi khulta
-- hai. Kai draft rakhne se sirf ye sawal paida hota ke "kaun sa
-- wala?" -- aur us sawal ka jawab kisi ke paas nahi hota.

create table if not exists public.machinery_booking_drafts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.machinery_booking_drafts is
  'Adhoori booking ka kaghaz -- booking nahi. Har bande ka ek. Booking ban jane par khud mit jata hai.';

alter table public.machinery_booking_drafts enable row level security;

-- Apna hi kaghaz -- kisi doosre ka adhoora form dekhne ki koi wajah
-- nahi, aur us mein kisan ka phone aur jagah likhi hoti hai.
drop policy if exists p_draft_own on public.machinery_booking_drafts;
create policy p_draft_own on public.machinery_booking_drafts
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.machinery_booking_drafts from anon;
grant select, insert, update, delete on public.machinery_booking_drafts to authenticated;
grant all on public.machinery_booking_drafts to service_role;
