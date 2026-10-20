# Dairy review fixes — 20 October 2026

Review file: dairy review dated 20 October 2026. Code is on branch `cursor/dairy-review-fixes-fa47`.

Migrations **650–659 are files only**. They were not applied to testing (`hwaiuwxqldxsoukkfefn`) and not applied to live. No live rows were changed.

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
| 656 | Anonymous rate read removed; meter photo bucket private. Drops both `public_read_milk_rate_settings` and live name `public_read_milk_rates` |
| 657 | Same two policy names again, so a database that already ran the old 656 still loses the open rate policy |
| 658 | Milk payment, qist cut, farmer khata pair, wallet, and cash GL (debit 1150, credit 1000) in one transaction. `fn_qist_reverse_source` is service-role only. Farmer credit balance takes a per-farmer lock |
| 659 | Owner or super admin may correct someone else's company receipt. The person who received or created that dispatch cannot. Audit row in `milk_dispatch_corrections` |

Deploy the web build only after these migrations have run. The new pages call the new functions. Backup must be verified before any live migration.

## Decisions

- **Invoice (C2).** Income is `sum(milk_dispatches.received_liters) × service rate` — litres the company accepted. Rejected milk, pending FAT, and dispatches with no receipt are not billed.
- **SNF constant (M2) — needs owner approval.** The formula constant stays **0.805**. It was not changed. Wasela contract confirmation is still required before anyone changes it. If the settings row is missing, the screen and the database refuse to guess.
- **Anonymous rates (L5, N1).** `public_read_fuel_rate_settings`, `public_read_milk_rate_settings`, and the live policy `public_read_milk_rates` are dropped. `anon` cannot select those tables. Logged-in staff still can. The public website does not read these tables. If the website later needs anonymous rates, that needs owner approval.
- **Maker-checker.** The person who created an entry cannot approve it, including Owner and Admin. On maintenance, the branch verifier and the final approver must also be two different people. A company receipt can be corrected only by an owner or super admin who did not create the dispatch and did not enter the receipt.
- **Cash milk payment posts GL.** Debit 1150 (clears the FAT credit) and credit 1000 (cash out). The method stays in the memo. Qist is cut inside the same payment function: debit 2010, credit 1140 when the plan started as an advance, otherwise credit 1150. The farmer khata gets a debit and a matching credit for that qist, so the running balance does not move for the qist itself. The wallet moves only for the cash that was actually paid. If the payment fails, the qist cut rolls back with it.
- **Billing page** calls the bill function only after an owner, super admin, or admin money check.
- **Website milk form.** If FAT is refused, the pending row is deleted. The form sends a stable id, so a second submit does not create a second entry.
- **Meter photos.** Fuel, generator, and fleet screens sign `meter-readings` paths. The bucket is private. Old public URLs are turned into paths in the app. The stored rows were not rewritten.
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
