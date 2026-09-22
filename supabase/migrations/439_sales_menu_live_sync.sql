-- Admin panel ke total review se nikla (Boss, 19 September):
--
-- 1. Live par "Sales & POS" dashboard ke saaton link ghayab the (POS,
--    POS Returns, Khata, POS Counters, Settlements, Produce Orders,
--    Bridge Orders) aur admin wale group se pos-collection ka link --
--    Testing par sab maujood the, Live ka menu-data peechhe reh gaya
--    tha. Nateeja: POS jaisa bunyadi safha sidebar mein kahin nahi tha.
--    Idempotent: Testing par ye rows pehle se hain, conflict par kuch
--    nahi hota.
--
-- 2. /admin/business-dashboard ka feature menu mein tha magar ye safha
--    code mein hai hi nahi -- sidebar se click karte hi 404. Feature
--    band (is_active=false); safha kabhi bana to wapas chalu ho jayega.

insert into dashboard_features (dashboard_key, feature_key, sort_order, section, section_order)
values
  ('sales', 'bridge-orders',  10, 'Operations', 2),
  ('sales', 'khata',          20, 'Operations', 2),
  ('sales', 'pos',            30, 'Operations', 2),
  ('sales', 'pos-counters',   40, 'Operations', 2),
  ('sales', 'pos.returns',    50, 'Operations', 2),
  ('sales', 'produce-orders', 60, 'Operations', 2),
  ('sales', 'settlements',    70, 'Operations', 2),
  ('admin', 'pos-collection', 150, 'Operations', 2)
on conflict (dashboard_key, feature_key) do nothing;

update features set is_active = false where key = 'business-dashboard';
