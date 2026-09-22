-- Supplier Purchase Bill workspace: record the chosen receiving warehouse,
-- register the Admin-only route under Purchases, and document its GRN flow.

alter table public.purchases
  add column if not exists warehouse_id uuid
    references public.warehouses(id) on delete set null;

create index if not exists idx_purchases_warehouse_id
  on public.purchases (warehouse_id)
  where warehouse_id is not null;

comment on column public.purchases.warehouse_id is
  'Supplier bill ka target warehouse. Legacy purchase par NULL ho sakta hai; GRN purane branch/shop warehouse fallback se chalega.';

insert into public.features
  (key, label, label_en, label_ur, description, description_en, description_ur,
   route, icon, is_sensitive, is_active)
values
  ('purchases.supplier-bill', 'Supplier Purchase Bill', 'Supplier Purchase Bill', 'سپلائر پرچیز بل',
   'Saved product master se supplier ka invoice, payment aur receiving warehouse darj karein.',
   'Record a supplier invoice using saved products, payment terms, and its receiving warehouse.',
   'محفوظ پروڈکٹ ماسٹر سے سپلائر کا بل، ادائیگی اور مال وصول کرنے کا گودام درج کریں۔',
   '/admin/purchases/supplier-bill', 'ReceiptText', true, true)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  description = excluded.description,
  description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  route = excluded.route,
  icon = excluded.icon,
  is_sensitive = true,
  is_active = true;

insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values ('purchase', 'purchases.supplier-bill', 11, 'SUPPLIER BILLING', 1)
on conflict (dashboard_key, feature_key) do update set
  sort_order = excluded.sort_order,
  section = excluded.section,
  section_order = excluded.section_order;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, related)
values
  ('purchases.supplier-bill', 'rm',
   'Saved Product Master se supplier ka bill banana, payment/udhaar darj karna aur maal ke receiving warehouse ko select karna.',
   'Sirf Owner, Admin aur Super Admin.',
   'Supplier ka invoice aaye ya purchase mein koi naya product pehli martaba master mein save karna ho.',
   array[
     'Supplier, invoice number, bill date aur receiving warehouse chunein.',
     'Karyana, Khaad, Wanda ya Pesticide filter se saved product dhoondein; na mile to New Product par us ka naam aur category save karein.',
     'Har item ki quantity aur invoice wala purchase rate likhein. Zaroorat par batch aur expiry details kholein.',
     'Discount, tax, abhi di hui raqam ya udhaar ki shart aur payment account bharein.',
     'Save & Post Bill karein; phir Purchase page par maal ki GRN ginti mukammal karein.'
   ],
   'Bill save hone ke baad GRN / Maal Receive par asal quantity gintein. Stock sirf GRN ke baad warehouse mein charhta hai.',
   array[
     'Bill save hona stock receive hona nahi hai; GRN ko skip na karein.',
     'Ek hi product/pack ko dobara naam se banane ke bajaye Product Master se search karein.',
     'Supplier ka invoice number wahi likhein jo bill par hai; paid amount aur payment account tasdeeq se bharein.'
   ],
   array['purchases', 'products', 'inventory.receiving', 'purchases.bills', 'suppliers']),
  ('purchases.supplier-bill', 'en',
   'Create a supplier bill from saved Product Master items, record payment or credit, and choose the warehouse that will receive the goods.',
   'Owner, Admin, and Super Admin only.',
   'When a supplier invoice arrives or a product needs to be added to the master for the first time.',
   array[
     'Choose the supplier, invoice number, bill date, and receiving warehouse.',
     'Find saved items using Karyana, Khaad, Wanda, or Pesticide filters; use New Product to save a missing product and category.',
     'Enter each invoice quantity and purchase rate. Open batch and expiry details when needed.',
     'Enter discount, tax, payment made now or credit terms, and the payment account.',
     'Save & Post Bill, then complete the goods receipt count from the Purchase page.'
   ],
   'After saving the bill, count the actual quantity in GRN / Receive Goods. Stock enters the warehouse only after GRN.',
   array[
     'Saving a bill does not mean the goods have been received; complete GRN.',
     'Search Product Master before creating the same product and pack again.',
     'Use the invoice number printed by the supplier and verify payment amount and account.'
   ],
   array['purchases', 'products', 'inventory.receiving', 'purchases.bills', 'suppliers'])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  related = excluded.related,
  updated_at = now();
