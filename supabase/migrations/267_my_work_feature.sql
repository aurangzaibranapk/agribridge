-- =====================================================================
-- AgriBridge — Migration 267: "Mera Kaam" bhi ek feature
-- =====================================================================
-- /admin/my-work har staff ka ghar hai (ALWAYS raaston mein), magar
-- features ki fehrist mein nahi tha -- is liye us par "? Samjhein" kuch
-- nahi dikhata tha. Ab feature hai (kisi dashboard ke menu mein nahi;
-- raasta pehle ki tarah sab ke liye khula).
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur,
                             route, icon, is_sensitive, is_active) values
  ('my-work', 'Mera Kaam', 'My Work', 'میرا کام',
   'Aaj ka kaam aur aap ke safhe', 'Today''s work and your pages', 'آج کا کام اور آپ کے صفحات',
   '/admin/my-work', 'Home', false, true)
on conflict (key) do update set
  route = excluded.route, label = excluded.label, label_en = excluded.label_en, label_ur = excluded.label_ur,
  description = excluded.description, description_en = excluded.description_en, description_ur = excluded.description_ur,
  is_active = true;

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related) values
  ('my-work', 'rm', 'Aap ka ghar: aaj kya baqi hai (asal ginti ke sath), aur jo safhe aap ke hain.', 'Har staff', 'Login ke baad, aur din mein jab bhi "ab kya karoon" ka sawal ho.',
   array['Upar "Aaj kya baqi hai" dekhein -- har qatar par click karein, seedha kaam ke safhe par.', 'Neeche card par apna kaam chunein.', 'Upar daayen "? Samjhein" har safhe par hai.'],
   'Jo baqi hai wo yahan ginti ke sath rehta hai jab tak ho na jaye.', array['Ginti ki jagah "—" ho to wo sifar nahi -- adad mil nahi saka.'],
   '[{"q": "Mujhe koi safha nahi dikhta?", "a": "Admin ne ijazat nahi di. Un se kahein."}]'::jsonb, array[]::text[]),
  ('my-work', 'en', 'Your home: what needs attention today (live counts) and your pages.', 'All staff', 'After login and whenever you wonder what to do next.',
   array['Read "Needs attention" -- each row opens the page where the work is.', 'Pick a card below.', 'Every page has "? Help" top right.'],
   'Pending work stays here with counts until it is done.', array['A "—" is not zero -- the count could not be read.'],
   '[]'::jsonb, array[]::text[])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes, faq = excluded.faq, updated_at = now();
