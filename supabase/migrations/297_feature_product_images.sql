-- =====================================================================
-- AgriBridge — Migration 297: Tasveeron ka safha nizam mein darj
-- =====================================================================
-- Malik ka usool (2 September): koi feature tab tak poora nahi jab tak
-- saaton na hon -- code, ijazat, madad, AI ko khabar, audit, staff ka
-- raasta, aur jaanch.
--
-- Code 296 ke sath aa chuka. Yahan baqi teen darj ho rahe hain: feature,
-- us ki ijazat, aur us ki madad.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, is_active, description)
values (
  'products.images',
  'Cheezon ki Tasveerein',
  'Product Images',
  'چیزوں کی تصویریں',
  '/admin/products/images',
  true,
  'Jis cheez ki tasveer na ho, us ka masoda AI banata hai -- lagti aadmi ke manzoor karne ke baad hai.'
)
on conflict (key) do update set
  label       = excluded.label,
  label_en    = excluded.label_en,
  label_ur    = excluded.label_ur,
  route       = excluded.route,
  is_active   = true,
  description = excluded.description;

-- Ijazat: banana aur manzoor karna Owner/Admin/Manager ka kaam hai.
-- Manager is liye ke tasveer roz ka kaam hai aur har dafa Owner ka
-- intezar counter par maal rok deta hai. Aage jaane ki ijazat (approve)
-- se hi tasveer cheez par lagti hai.
insert into public.role_feature_permissions (role, feature_key, actions, data_scope)
values
  ('manager',  'products.images', array['view','create','approve','reject'], 'all'),
  ('warehouse','products.images', array['view'], 'all'),
  ('sales_staff','products.images', array['view'], 'all')
on conflict (role, feature_key) do update set
  actions    = excluded.actions,
  data_scope = excluded.data_scope;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'products.images', 'rm',
  'Jis cheez ki tasveer na ho, us ka masoda AI bana deta hai. Cheez par wo tasveer aadmi ke dekhne aur manzoor karne ke BAAD lagti hai.',
  'Owner, Admin aur Manager bana aur manzoor kar sakte hain. Baqi sirf dekh sakte hain.',
  'Jab POS par cheezein khali dabbe ki tarah nazar aane lagein — yani un ki tasveer nahi lagi.',
  array[
    'Upar likha hota hai kitni cheezon ki tasveer baqi hai.',
    'Ek cheez ka masoda banana ho to us ke saamne "Masoda banayein" dabayein.',
    'Bohat si ek sath chahiyen to upar adad likh kar "Banayein" dabayein — ek dafa mein 15 tak.',
    'Masode neeche aa jate hain. Har ek ko dekh kar "Manzoor" ya "Radd" karein.',
    'Manzoor hote hi tasveer cheez par lag jati hai aur POS par nazar aane lagti hai.'
  ],
  'Naam wali cheezon (Surf Excel, Coca-Cola) ki ASAL tasveer haath se charhayein — wo AI se nahi banti.',
  array[
    'AI ki banayi hui tasveer ko asal dabbe ki tasveer samajh lena. Naam wali cheez par AI sirf ek saada nishaan banata hai, us par asal logo ya likhai nahi hoti — aur agar hoti to wo banayi hui hoti, asal nahi. Counter par banda aisi tasveer dekh kar ghalat dabba uthha sakta hai.',
    'Ek dabane par sab kuch banwa dena. Har tasveer paisa aur waqt lagati hai, aur bina dekhe lag jane wali ghalat tasveer utni hi jagah ghalat hoti hai jitni cheezein hain. Isi liye ek dafa mein 15 ki hadd hai aur har masode ko aadmi dekhta hai.',
    'Asal tasveer ki jagah AI wali laga dena. Jis cheez par kisi ne asal tasveer charhayi hui ho, us par AI wali khud nahi lagti — us ke liye alag se tick karna parta hai, aur purani tasveer ka pata bhi mehfooz rehta hai.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose    = excluded.purpose,
  who_uses   = excluded.who_uses,
  when_use   = excluded.when_use,
  how_steps  = excluded.how_steps,
  next_step  = excluded.next_step,
  mistakes   = excluded.mistakes,
  updated_at = now();
