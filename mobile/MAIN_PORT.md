# Flutter app on main (v0.5.5 Beta) — port notes

Branch `feat/mobile-app-on-main`. Source: `feature/mobile-office-service-inbox` (draft PR #42, testing history, no merge-base with main).

## Database (new, additive, NOT applied on Live)

| Migration | Replaces testing | What |
| --- | --- | --- |
| `583_mobile_devices_account_deletion` | 377 | `mobile_devices` (RLS own read/delete; write only via `mobile_register_device`). Account deletion goes into the existing 580 queue `portal_account_delete_requests` via `mobile_request_account_deletion` (no second table; maker-checker constraint from 580). `mobile_my_account_deletion` for status. |
| `584_mobile_service_requests` | 380 + 20261010050001 | `mobile_service_requests` + `mobile_submit_service_request`. Admin/manager of same org may change status; requester may only cancel; trigger blocks self-decision; `decided_by <> profile_id` check; 10/hour rate limit. |
| `585_mobile_catalog_dashboard` | 380 + 20261010050002 | `mobile_product_catalog` (live schema: `inventory.shop_id`, no `shop_inventory`; only verified, priced, non-expired; never cost) and `mobile_role_dashboard_summary` (+ office inbox count). |
| `586_mobile_my_summary` | 379 + 20261010050003/4 | `mobile_my_farmer_summary` now reads the single khata from 565 (`fn_my_khata_summary`) instead of re-adding milk/credit/GL/shop balances separately (double-count risk). Works for farmers and customers. |
| `587_mobile_farmer_grain_machinery` | 20261010050005/6 + 20261010171500 | `mobile_my_grain_summary`, `mobile_my_machinery_bookings` (verified payments/diesel only, no vendor/finance fields). |
| `588_mobile_order_request` | 378 + 381 + 20261010165000 | Own-read RLS on `agri_orders/items/timeline` and `mobile_submit_agri_order` safe checkout: server price, own org, verified/priced/non-expired, integer qty, no duplicates, no Credit, 10/hour; status `submitted` only (existing SOD trigger + staff flow). |

589 left free. 582 is reserved for #146.

Tests: `npm run test:mobile-app` (PGlite, RLS as `authenticated`, idempotent re-run, additive-only check).

## App now uses main's portal RPCs (565-577)

- Mera Khata: `fn_my_khata_summary` + `fn_my_khata_statement` (90 days, categories karyana/khaad/doodh/gandum/machinery/qist/adaigi…)
- Mere Bill: `fn_my_bills`
- Doodh aur Janwar: `fn_my_milk_collection`, `fn_my_due_tasks`
- Repository also has `fn_my_payments`, `fn_my_requests` (not yet on a screen)

## Web API

- `POST /api/mobile/farmer-ai` — Bearer-token version of `/api/farmer-ai`, RLS client from the user's own token; body validation in `src/lib/mobile/bearer.ts`.

## Not ported / gaps

See the PR description.
