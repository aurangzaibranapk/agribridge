-- =====================================================================
-- AgriBridge — Migration 414: Stock Count help — search + auto-move
-- =====================================================================
-- Malik: "produts k oper search ka option ho, jo product count ho jaye
-- wo list se move ho jaye, yahan khaRi na rahe" (14 September). Safha
-- par search box aur "gin li gayin" wala hissa aa gaya -- help text
-- mein bhi likh dena.

update public.feature_help
set how_steps = array[
  'Tarteeb ek dafa lagayein: har godam ke saamne "har N din", "mahine ki tareekh" ya "mahine ka aakhir" chunein.',
  'Zimmedar chunein — us ko us godam ki ginti ka darwaza khud khul jayega.',
  'Jis din ginti due ho, safhe par wo godam saamne aa jata hai.',
  'Ginti shuru karein: system ka adad us waqt mahfooz ho kar CHHUP jata hai — jo aap ginein wohi likhein.',
  'Search box se cheez dhoondein — badi fehrist mein har cheez upar-neeche dhoondne ki zaroorat nahi.',
  'Jis cheez ka adad likh dein, wo khud "gin li gayin" wale hisse mein chali jati hai — upar wali fehrist mein sirf wo cheezein khaRi rehti hain jo abhi baqi hain.',
  'Fehrist mein na mili koi cheez mil jaye to "Extra Item" se ek ya ek se zyada qatarein ek sath add karein — ye GRN nahi mangta, stock seedha isi waqt barh jata hai (jaisa "Maal Andar" karta hai).',
  'Cheez ka naam ginti ke dauran hi ghalat lage to pencil (✎) se badal sakte hain — "Naam ki Tareekh" mein mehfooz rehta hai (purana record nahi badalta, sirf ab se naya naam).',
  'Sab qatarein bhar jayen to milaan karein: wahan farq saamne aata hai aur har farq ki wajah likhni parti hai.'
]
where feature_key = 'stock-count' and lang = 'rm';

update public.feature_help
set how_steps = array[
  'Pick the warehouse, enter counts.',
  'Use the search box to find an item quickly in a long list.',
  'Once you enter a number for an item, it moves down into "Counted" — the list above only shows what is still left.',
  'Add "Extra Item" for anything found but not listed — no GRN needed, stock increases right away (like Maal Andar).',
  'Rename a product inline (pencil icon) if its name is wrong — old records keep the old name; only future ones use the new name.',
  'Explain and post differences.'
]
where feature_key = 'stock-count' and lang = 'en';
