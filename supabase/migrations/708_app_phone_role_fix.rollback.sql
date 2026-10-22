-- 708 rollback. Testing par. Live par mat chalana.
-- Notes ki table 707 ki hai. Yahan sirf 708 ki keys aur rows.

delete from public.app_phone_notes
where key in (
  'home.name.kisan',
  'home.name.mca',
  'home.name.mco',
  'home.name.admin',
  'home.name.customer',
  'home.name.dealer',
  'home.name.staff',
  'home.name.vet',
  'home.dealer.stock.1',
  'home.dealer.stock.2',
  'home.dealer.stock.3',
  'home.dealer.stock.4',
  'home.cat.1',
  'home.cat.2',
  'home.cat.3',
  'home.cat.4'
);

update public.farmers
set full_name = btrim(full_name) || ' (TEST)'
where is_test
  and farmer_code like 'TEST-F%'
  and full_name !~* '\(TEST\)';

update public.milk_entries
set
  status = 'pending_fat',
  fat_percentage = null,
  rate_per_liter = null,
  total_amount = null,
  verified_by_profile_id = null,
  verified_comment = null
where is_test
  and verified_comment = 'TEST phone 708';

update public.dairy_health_events
set voided = true, void_reason = 'TEST phone 708 rollback'
where notes = 'TEST phone 708'
  and not voided;

update public.pos_sales
set created_at = (
  (
    current_date
    - (abs(hashtext(id::text)) % 28)
    + interval '11 hours'
  ) at time zone 'Asia/Karachi'
)
where is_test
  and created_at < (current_date - 40);
