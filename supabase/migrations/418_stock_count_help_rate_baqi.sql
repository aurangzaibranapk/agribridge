-- =====================================================================
-- AgriBridge — Migration 418: Stock Count help — Rate Baqi ginti mein
-- =====================================================================
-- Malik: "yahan bhi sath sath rate hona chahiye jo add kar sakein" --
-- jis product ka rate khali ho, us ka chhota khana ginti ke andar hi
-- aa jata hai (Owner/Admin/Warehouse). Help text update.

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
  'Koi cheez DUPLICATE dikhe (wohi maal, alag naam se do dafa) to naam ke saamne wale (⇄) button se "Asal naam" likhein — kitna stock wahan jayega dikhega, phir "Tajweez bhejein". Admin ki tasdeeq ke baad stock chala jayega aur purana naam hat jayega.',
  'Jis product ka "Rate Baqi" ho (sale ya trade rate khali), naam ke neeche ek chhota amber khana khud aa jata hai (Owner/Admin/Warehouse) — wahin rate likh kar mehfooz karein, alag safhe par jane ki zaroorat nahi.',
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
  'See a DUPLICATE product (same thing under two names)? Use the (⇄) button to name the real product — it shows how much stock will move there, then "Send request". Once approved, the stock moves and the old name is removed.',
  'If a product is missing its rate ("Rate Baqi"), a small amber box appears right under its name (Owner/Admin/Warehouse) — fill it in there, no need to go to a separate page.',
  'Explain and post differences.'
]
where feature_key = 'stock-count' and lang = 'en';
