# supabase/tools

## Zaroori baat: `supabase/migrations/` ab poora database nahi banati

Testing project (`agribrige testing`) ko sifar se banate waqt ye baat saamne aayi:

- Live database mein **212 tables** hain.
- `supabase/schema.sql` + `supabase/migrations/*.sql` mila kar sirf **157** tables
  banti hain.
- Yani **55 tables kisi migration file mein maujood hi nahi hain** — wo seedha
  Supabase dashboard ke SQL editor mein banayi gayi thin aur kisi file mein kabhi
  likhi nahi gayin.

Missing tables (in ke sath juRe functions bhi, jaise `current_dealer_id()` aur
`current_shop_id()`):

```
agri_delivery_items       ai_purchase_suggestions   ai_report_instructions
announcement_dismissals   announcements             bridge_ai_action_requests
bridge_ai_activity_log    bridge_ai_settings        buyer_payments
crop_diagnoses            dealer_customers          dealer_inventory
dealer_payments           dealer_users              dispatch_vehicles
driver_payments           drivers                   farmer_ai_requests
farmer_loans              farmer_subscriptions      fertilizer_items
fertilizer_requests       grain_cut_presets         grain_expenses
grain_parties             grain_sale_counters       grain_sale_payments
grain_sales               grain_type_products       investor_investments
investor_returns          khata_accounts            khata_transactions
livestock_loans           loss_verifiers            machinery_booking_counters
machinery_bookings        machinery_requests        machinery_vendor_machines
machinery_vendors         mandi_rates               payment_method_account_map
pos_sale_items            pos_sales                 product_edit_requests
service_categories        shops                     staff_messages
stock_loss_counters       stock_loss_records        subscription_settings
subscription_votes        supplier_payment_request_counters
supplier_payment_requests vehicle_maintenance_records
```

**Iska matlab:** agar kal live project kharab ho jaye, to sirf is repo se database
dobara nahi banaya ja sakta. Live hi asal record hai.

Isi liye testing project ko migrations chala kar nahi, balki **live ki naql utaar
kar** banaya gaya. `dump_schema_and_data.sql` isi kaam ka auzaar hai.

## `dump_schema_and_data.sql` kya karti hai

Ye file **source (live)** database par chalti hai aur teen functions banati hai:

| function | kya deta hai |
| --- | --- |
| `__ab_dump_ddl(token)` | poora schema: extensions, enums, functions, tables, constraints, indexes, views, triggers, RLS, policies, grants, storage buckets |
| `__ab_dump_data(token)` | har table ki rows, `insert ... json_populate_recordset` ki shakal mein (auth.users aur auth.identities samet) |
| `__ab_row_fingerprint(token)` | har table ka row count — naql ke baad milaan ke liye |

Token file ke andar likha hai. Naql ka kaam khatam hote hi teenon functions
`drop` kar dene chahiyein — ye sirf waqti auzaar hain, hamesha ke liye nahi.

## Naql utaarne ka tareeqa

1. Source (live) par ye file chalayein.
2. Source par ek chhota Edge Function lagayein jo `__ab_dump_ddl` / `__ab_dump_data`
   ko `service_role` se call kar ke saada text wapas kare (`verify_jwt: false`,
   token query string mein — is se token ke baghair koi is tak nahi pahunch sakta).
3. Target (testing) project par:

```sql
create extension if not exists http with schema extensions;

drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all   on schema public to postgres, service_role;

-- pehle schema
do $outer$
declare v text;
begin
  select content into v from extensions.http_get('<function-url>?token=<token>&what=schema');
  execute v;
end $outer$;

-- phir data
do $outer$
declare v text;
begin
  select content into v from extensions.http_get('<function-url>?token=<token>&what=data');
  execute v;
end $outer$;
```

4. Dono taraf `__ab_row_fingerprint` ka md5 aur schema ka md5 milaa kar tasdeeq
   karein — dekhe baghair "ho gaya" maan lena isi system ke usool ke khilaf hai.
5. Source se `__ab_*` functions aur Edge Function hata dein; target se `http`
   extension hata dein.

## Ek maaloom farq

`quantity_reconciliations.chk_qr_period` target par thoRe mukhtalif brackets ke
sath likhi jati hai — `(a and b and (c and d))` bajaye `((a and b) and (c and d))`.
Matlab bilkul wahi hai; ye Postgres ka apna dobara likhne ka andaz hai, kharabi
nahi.

## Jo naql nahi hota

- `storage.objects` (files ki fehrist) — asal files S3 mein hain, sirf fehrist
  copy karne se toota hua link banta hai. Is liye testing mein purani tasveerein
  nazar nahi aayengi; nayi upload karna kaam karta hai.
- Cron jobs, Edge Functions, aur project settings — ye database ke bahar hain.
