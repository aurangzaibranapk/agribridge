-- Product stock statement page ki feature_help (484)
-- Har cheez ka mukammal ledger: kab aya, kab gaya, kahan se, baqi kitna.

insert into public.feature_help (page_key, purpose, who_uses, when_to_use, how_to_use, next_step, common_errors)
values (
  'product_statement',
  'Ek product ka mukammal stock hisaab: har kharid ka PO number, har bikri ka invoice, aur roz-baa-roz baqi — ek jagah.',
  'Admin, manager, procurement, warehouse staff',
  'Jab check karna ho ke kisi cheez ka kitna maal kab aya, kab aur kahan bika, aur abhi kitna baqi hai.',
  'Inventory > kisi bhi cheez par click karein > "Puri Fehrist" button. Godam ke mutabiq filter kar sakte hain. Har laeen mein: kharid to PO number dikhega, bikri to invoice number. Sab se neeche total IN, total OUT, aur aakhri baqi.',
  'Agar kisi cheez ki ginti mein shak ho to is fehrist mein dekh kar har movement check karein. Supplier invoice se milana ho to PO number dekh kar purchases page par jayein.',
  'Agar koi movement nazar na aaye: maal system mein darj nahi hua hoga (GRN pending hoga). Godam filter lagane ke baad sab nahi dikh raha: "Sab Godam" chunein.'
)
on conflict (page_key) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_to_use = excluded.when_to_use,
  how_to_use = excluded.how_to_use,
  next_step = excluded.next_step,
  common_errors = excluded.common_errors;
