# Dairy review fixes — 20 October 2026

Review file: dairy review dated 20 October 2026. Code is on branch `cursor/dairy-review-fixes-fa47`.

Migrations **650–656 are files only**. They were not applied to testing (`hwaiuwxqldxsoukkfefn`) and not applied to live. No live rows were changed.

Tests: `npm run test:dairy-review` (TypeScript rules plus PGlite SQL). That test does not connect to any remote database.

## Migration numbers

| File | What it locks |
|---|---|
| 650 | FAT 1–12, LR 15–40, no self-verify, atomic collection number, variance kind, indexes |
| 651 | FAT, farmer khata, wallet, and GL (debit 5010, credit 1150) in one transaction |
| 652 | Milk payment balance, idempotent `client_action_id`, priced/verified balance view |
| 653 | Maker-checker: nobody approves their own fuel, generator, or maintenance entry |
| 654 | Counter writes revoked; dispatch RLS; received litres cannot exceed dispatched |
| 655 | Monthly Wasela bill in SQL (`fn_dairy_month_pnl`) |
| 656 | Anonymous rate read removed; meter photo bucket private |

Deploy the web build only after these migrations have run. The new pages call the new functions. Backup must be verified before any live migration.

## Decisions

- **Invoice (C2).** Income is `sum(milk_dispatches.received_liters) × service rate` — litres the company accepted. Rejected milk, pending FAT, and dispatches with no receipt are not billed.
- **SNF constant (M2) — needs owner approval.** The formula constant stays **0.805**. It was not changed. Wasela contract confirmation is still required before anyone changes it. If the settings row is missing, the screen and the database refuse to guess.
- **Anonymous rates (L5).** `public_read_fuel_rate_settings` and `public_read_milk_rate_settings` are dropped. `anon` cannot select those tables. Logged-in staff still can. The public website does not read these tables. If the website later needs anonymous rates, that needs owner approval.
- **Maker-checker.** The person who created an entry cannot approve it, including Owner and Admin. On maintenance, the branch verifier and the final approver must also be two different people.
- **Cash milk payment** still does not post a new GL entry. Qist is a `milk_payments` row only. Cash debits the farmer khata and the wallet.
- **Master dashboard** uses the same bill function as the billing page. If settings are missing, the billing page shows the error. The master dashboard card shows zero until the function returns numbers.

## needs owner approval — proposed data cleanup (not executed)

App code already turns an old public meter URL into a path and signs it. Stored rows were not rewritten.

Run this only after the owner writes that the old public URLs should be stored as paths:

```sql
-- needs owner approval — do not run until the owner says so
-- update public.fuel_logs
--   set meter_photo_url = regexp_replace(meter_photo_url, '^.*meter-readings/', '')
--   where meter_photo_url like '%/meter-readings/%';
-- update public.fuel_logs
--   set opening_meter_photo_url = regexp_replace(opening_meter_photo_url, '^.*meter-readings/', '')
--   where opening_meter_photo_url like '%/meter-readings/%';
-- update public.fuel_logs
--   set closing_meter_photo_url = regexp_replace(closing_meter_photo_url, '^.*meter-readings/', '')
--   where closing_meter_photo_url like '%/meter-readings/%';
-- update public.generator_logs
--   set meter_photo_url = regexp_replace(meter_photo_url, '^.*meter-readings/', '')
--   where meter_photo_url like '%/meter-readings/%';
-- update public.generator_logs
--   set opening_meter_photo_url = regexp_replace(opening_meter_photo_url, '^.*meter-readings/', '')
--   where opening_meter_photo_url like '%/meter-readings/%';
-- update public.generator_logs
--   set closing_meter_photo_url = regexp_replace(closing_meter_photo_url, '^.*meter-readings/', '')
--   where closing_meter_photo_url like '%/meter-readings/%';
```

The same text is a comment inside `656_dairy_rate_privacy_meter_bucket.sql`. The migration itself only sets the `meter-readings` bucket to private when `storage.buckets` exists.
