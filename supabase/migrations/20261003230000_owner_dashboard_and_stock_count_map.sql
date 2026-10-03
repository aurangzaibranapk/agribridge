-- AgriBridge: owner dashboard + daily stock-count map completion
-- UI-only directory entries are mirrored in the feature registry so the
-- permissions/help system and ERP map describe the same routes.

insert into public.features (key, label, label_en, route, icon, is_active)
values
  ('master-dashboard', 'Master Dashboard', 'Master Dashboard', '/admin/master-dashboard', 'Scale', true),
  ('email-templates', 'Email Templates', 'Email Templates', '/admin/email-templates', 'MailPlus', true),
  ('reset-test-data', 'Test Data Reset', 'Test Data Reset', '/admin/reset-test-data', 'Trash2', true)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  route = excluded.route,
  icon = excluded.icon,
  is_active = excluded.is_active;

update public.feature_help
set
  purpose = 'Dukan ki rotation aur rozana maal ki ginti. Admin counted products/staff ka session shuru karta hai, staff ko Urdu notification milti hai aur submit hone tak pending popup reminder aata rehta hai.',
  who_uses = 'Admin, Manager, Warehouse Staff',
  when_use = 'Rozana stock count ke waqt.',
  how_steps = array[
    'Product Cycles kholein aur Daily Stock Count Cycle tab par jayein.',
    'Admin aaj ka batch aur zimmedar staff select/confirm kare.',
    'Staff ko Urdu notification milti hai ke ye products count karein.',
    'Staff sirf assigned products ki asal ginti darj kare.',
    'Submit hone tak pending popup reminder nazar aata rahega.',
    'Submit ke baad Admin farq verify/approve kare.'
  ],
  next_step = 'Submit ke baad Stock Ledger aur Admin Stock Count mein farq verify karein.',
  mistakes = array[
    'Assigned products ke ilawa kisi aur maal ki ginti na likhein.',
    'Ginti mukammal karke Submit zaroor karein — warna reminder pending rahega.'
  ]
where feature_key = 'product-cycles' and lang = 'rm';

update public.feature_help
set
  purpose = 'Run the daily stock-count cycle. Admin starts the batch and confirms the responsible staff; the staff member receives a notification, counts only assigned products, and keeps seeing a pending reminder until submission.',
  who_uses = 'Admin, Manager, Warehouse Staff',
  when_use = 'Every day during stock counting.',
  how_steps = array[
    'Open Product Cycles and select Daily Stock Count Cycle.',
    'Admin starts today''s batch and confirms the responsible staff.',
    'The staff member receives the count notification.',
    'Count only the assigned products and enter the actual quantity.',
    'The pending popup remains until the session is submitted.',
    'Admin verifies and approves the variance after submission.'
  ],
  next_step = 'Verify the variance in Stock Ledger and Admin Stock Count.',
  mistakes = array[
    'Do not enter products outside the assigned batch.',
    'Submit the completed count or the reminder will remain pending.'
  ]
where feature_key = 'product-cycles' and lang = 'en';

