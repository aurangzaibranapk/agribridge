-- =====================================================================
-- AgriBridge — Migration 415: help text -- rename ab hamesha tajweez ban sakti hai
-- =====================================================================
-- Malik: "ijazat to di thi lakin approval admin ne dena thi darj q nahi
-- ho rha" -- Anwar (sales_staff, staff_product_permissions.can_edit=false)
-- ko ginti ke dauran naam badalne par seedha "ijazat nahi hai" mil raha
-- tha, tajweez tak nahi ban rahi thi. Code (renameProductFromCount) ab
-- theek kiya: koi bhi ginti karne wala naam ki TAJWEEZ bhej sakta hai
-- (Product Edit Requests mein, admin ki tasdeeq ka intezar) -- FORAN
-- badalne ke liye hi can_edit + edit_needs_approval=false dono chahiye.
-- Sirf help text yahan theek ho raha hai.

update public.feature_help
set mistakes = array[
  'Ginte waqt system ka adad dekhne ki koshish na karein — wo jaan boojh kar chhupa hai. Adad dikh jaye to ginti ginti nahi rehti, tasdeeq ban jati hai.',
  'Jis godam ki tarteeb darj na ho, us par 30 din ka DEFAULT chalta hai — wo aap ka chuna hua nahi. Safha us par "default" likh kar batata hai.',
  'Ginti waqai nahi karni to "band" chunein aur wajah likhein — khana khali chhoRne se tarteeb ka faisla kabhi darj hi nahi hota.',
  'Zimmedar bana dene se us bande ko poore nizam ka ikhtiyar NAHI milta — sirf usi godam ki ginti ka darwaza khulta hai.',
  'Naam badalna kisi bhi ginti karne wale ke liye ek TAJWEEZ hai — Admin ki tasdeeq tak khud nahi badalta. Seedha (foran) badalne ke liye alag se Product Edit ki ijazat chahiye (Staff Access se).'
]
where feature_key = 'stock-count' and lang = 'rm';
