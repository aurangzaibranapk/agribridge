-- =====================================================================
-- AgriBridge — Migration 360: WhatsApp par adhoora farmer nahi banta
-- =====================================================================
-- Malik (7 September): "ye nahi hona chahiye, aisa farmer nahi banna
-- chahiye. Agar farmer banna hai to naam, mobile, location ke sath
-- bane -- aisa bilkul na bane."
--
-- Ab tak jo bhi naya (na-maloom) number business ke WhatsApp par
-- message karta, foran ek khaali farmer record ban jata tha: naam
-- "WhatsApp Farmer 8999" (phone ke aakhri 4 hindse), CNIC/village
-- khaali. Farmers ki fehrist mein ye asli, adhooray records ki tarah
-- baith jate the.
--
-- Ye chhoti si table sirf itna yaad rakhti hai: is number se ab tak
-- kya poocha ja chuka hai (naam? gaon?). Jab tak dono na mil jayen,
-- `farmers` mein koi qatar nahi banti. Milte hi asal farmer ek hi
-- qadam mein, poora bhar kar banta hai -- aur ye qatar mit jati hai.
-- =====================================================================

create table if not exists public.whatsapp_onboarding (
  phone_key text primary key,
  phone_number text not null,
  full_name text,
  created_at timestamptz not null default now()
);

comment on table public.whatsapp_onboarding is
  'Na-maloom WhatsApp number se naam/gaon poochne ke dauran ka mehmaan record. farmers mein qatar sirf dono milne ke baad banti hai.';

alter table public.whatsapp_onboarding enable row level security;

create policy "sirf service role" on public.whatsapp_onboarding
  for all using (false) with check (false);
