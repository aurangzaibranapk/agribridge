-- =====================================================================
-- AgriBridge — Migration 412: Stock Count ka help — rename + extra item
-- =====================================================================
-- Malik ke 2 September usool ke mutabiq: naye khane ka feature_help
-- usi commit mein jana chahiye. "Naam badalna" (408) aur "extra item"
-- (multi-row, GRN ke baghair -- cb06bbc/323d962) ginti ke safhe par aa
-- chuke, magar us ka help text purana reh gaya tha -- ye theek karta hai.

update public.feature_help
set
  how_steps = array[
    'Tarteeb ek dafa lagayein: har godam ke saamne "har N din", "mahine ki tareekh" ya "mahine ka aakhir" chunein.',
    'Zimmedar chunein — us ko us godam ki ginti ka darwaza khud khul jayega.',
    'Jis din ginti due ho, safhe par wo godam saamne aa jata hai.',
    'Ginti shuru karein: system ka adad us waqt mahfooz ho kar CHHUP jata hai — jo aap ginein wohi likhein.',
    'Fehrist mein na mili koi cheez mil jaye to "Extra Item" se ek ya ek se zyada qatarein ek sath add karein — ye GRN nahi mangta, stock seedha isi waqt barh jata hai (jaisa "Maal Andar" karta hai).',
    'Cheez ka naam ginti ke dauran hi ghalat lage to pencil (✎) se badal sakte hain — "Naam ki Tareekh" mein mehfooz rehta hai (purana record nahi badalta, sirf ab se naya naam).',
    'Sab qatarein bhar jayen to milaan karein: wahan farq saamne aata hai aur har farq ki wajah likhni parti hai.'
  ],
  mistakes = array[
    'Ginte waqt system ka adad dekhne ki koshish na karein — wo jaan boojh kar chhupa hai. Adad dikh jaye to ginti ginti nahi rehti, tasdeeq ban jati hai.',
    'Jis godam ki tarteeb darj na ho, us par 30 din ka DEFAULT chalta hai — wo aap ka chuna hua nahi. Safha us par "default" likh kar batata hai.',
    'Ginti waqai nahi karni to "band" chunein aur wajah likhein — khana khali chhoRne se tarteeb ka faisla kabhi darj hi nahi hota.',
    'Zimmedar bana dene se us bande ko poore nizam ka ikhtiyar NAHI milta — sirf usi godam ki ginti ka darwaza khulta hai.',
    'Naam badalna seedha nahi ho sakta agar aap ki ijazat "manzoori chahiye" par hai — is soorat mein darkhwast Product Edit Requests mein jati hai, khud badalta nahi.'
  ]
where feature_key = 'stock-count' and lang = 'rm';

update public.feature_help
set
  how_steps = array[
    'Pick the warehouse, enter counts.',
    'Add "Extra Item" for anything found but not listed — no GRN needed, stock increases right away (like Maal Andar).',
    'Rename a product inline (pencil icon) if its name is wrong — old records keep the old name; only future ones use the new name.',
    'Explain and post differences.'
  ]
where feature_key = 'stock-count' and lang = 'en';
