-- Product stock statement page: features + feature_help (484)
-- Har cheez ka mukammal ledger: kab aya, kab gaya, kahan se, baqi kitna.

insert into public.features (key, label, label_en, route, is_sensitive, is_active)
values ('products.statement', 'Maal ki Puri Fehrist', 'Stock Statement', '/admin/inventory', false, true)
on conflict (key) do update set
  label    = excluded.label,
  label_en = excluded.label_en,
  route    = excluded.route;


insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
(
  'product.statement', 'rm',
  'Ek product ka mukammal stock hisaab: har kharid ka PO number, har bikri ka invoice, aur roz-baa-roz baqi — ek jagah.',
  'Admin, manager, procurement, warehouse staff',
  'Jab check karna ho ke kisi cheez ka kitna maal kab aya, kab aur kahan bika, aur abhi kitna baqi hai.',
  ARRAY[
    'Inventory > kisi bhi cheez par click karein.',
    'Puri Fehrist button dabayein.',
    'Godam ke mutabiq filter kar sakte hain — upar pill tabs se.',
    'Har laeen mein: kharid to PO number dikhega, bikri to invoice number.',
    'Sab se neeche total IN, total OUT, aur aakhri baqi dikhega.'
  ],
  'Agar kisi cheez ki ginti mein shak ho to is fehrist mein dekh kar har movement check karein. Supplier invoice se milana ho to PO number dekh kar purchases page par jayein.',
  ARRAY[
    'Koi movement nazar na aaye: maal system mein darj nahi hua hoga — GRN pending hoga.',
    'Godam filter lagane ke baad sab nahi dikh raha: Sab Godam wala option chunein.'
  ]
),
(
  'product.statement', 'en',
  'Complete stock ledger for one product: every purchase PO, every sale invoice, and the running balance — in one place.',
  'Admin, manager, procurement, warehouse staff',
  'When you need to verify how much stock came in, when it was sold and to whom, or what is left right now.',
  ARRAY[
    'Go to Inventory and click any product.',
    'Press the Full Statement button.',
    'Filter by warehouse using the pill tabs at the top.',
    'Each row shows: PO number for purchases, invoice number for sales.',
    'The footer shows total IN, total OUT, and closing balance.'
  ],
  'If a quantity looks wrong, trace it row by row here. To cross-check a supplier invoice, note the PO number and go to the Purchases page.',
  ARRAY[
    'No movements showing: stock may not have been received yet — GRN pending.',
    'After applying a warehouse filter, not all rows visible: select All Warehouses.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose    = excluded.purpose,
  who_uses   = excluded.who_uses,
  when_use   = excluded.when_use,
  how_steps  = excluded.how_steps,
  next_step  = excluded.next_step,
  mistakes   = excluded.mistakes;
