-- =====================================================================
-- AgriBridge — Migration 288: Command Center ka help nayi shakl par
-- =====================================================================
-- Command Center ka "Department -- is mahine" wala hissa ab sirf
-- aamdani/kharcha ki fehrist nahi raha; wo department ka nafa nuqsan
-- ka khulasa ban gaya hai: kaam, aamdani, seedhi lagat, baqi kharcha,
-- nafa, margin aur ruka hua kaam -- wajah ke sath.
--
-- Do baatein help mein zaroori thin, kyunke inhi par ghalat faisla
-- hota hai:
--   1. "—" aur "Rs 0" ek cheez nahi. Rs 0 kehta hai "dekh liya, kuch
--      nahi hua"; "—" kehta hai "is ka hisaab hi nahi rakha jata".
--   2. Kul totals mein sirf wo department ginte hain jin ka hisaab
--      poora hai. Adhoora department chup chaap sifar nahi banta --
--      us ka naam saaf likha jata hai.
-- =====================================================================

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('command-center','rm',
 'Malik ka command center: aaj ka paisa, har department ka nafa nuqsan, aur wo cheezein jin par foran nazar chahiye.',
 'Owner (aur Admin).',
 'Roz subah, aur mahine ke aakhir mein.',
 array[
  'Upar "Aaj" wale paanch adad dekhein: bikri, kharche, nafa, khaton mein maujood, aur wusool karna hai.',
  'Phir chaar card: kul aamdani, kul lagat, saaf nafa, aur kitni cheezein tawajjah mangti hain.',
  'Department wali qatarein parhein: har department ka kaam, aamdani, seedhi lagat, baqi kharcha, nafa aur margin.',
  'Kisi department ke naam par click karein to us ka apna nafa nuqsan ka safha khulta hai.',
  '"Baqi / tawajjah" wale khane par click karein -- wo seedha us qatar par le jata hai jahan kaam ruka hua hai.',
  'Neeche AI ki raye parhein: wo sirf wohi baat likhti hai jo khaton se nikalti hai.'
 ],
 'Har ruki hui cheez seedha us safhe par le jati hai jahan qadam poora hota hai.',
 array[
  '"—" aur "Rs 0" ko ek na samjhein. Rs 0 ka matlab hai dekh liya, kuch nahi hua. "—" ka matlab hai us ka hisaab hi nahi rakha jata.',
  'Kul totals mein sirf wo department shaamil hain jin ka hisaab poora hai -- adhoore department ka naam neeche saaf likha hota hai. Us ko sifar samajh kar moqabla na karein.',
  'Machinery ki aamdani commission hai, gross billing nahi; aur wapas aane wala diesel hamara kharcha nahi. Is farq ko samjhe baghair machinery ka nafa kam ya zyada nazar aata hai.',
  'Anaj mein is mahine ki kharid aur is mahine ki bikri ka moqabla na karein -- jo maal godam mein para hai wo nuqsan nahi, maal hai.',
  'Doodh ki aamdani service rate (fi litre) se banti hai; kisan ko di jane wali raqam guzarne wali raqam hai, is nafa nuqsan ka hissa nahi.',
  'Alert ko dekh kar chhoR dena is safhe ko bekar kar deta hai -- yahi wo jagah hai jahan se rukka hua kaam chalta hai.'
 ])

on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes,
  updated_at = now();
