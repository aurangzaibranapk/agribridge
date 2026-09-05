# Live Shadow Deployment — Pre-Migration Record

Project (Live): `ktskwawkslaznkjjacni`
Record banaya: 2026-08-31 (UTC)
Repo commit: `21e75b9` — branch `claude/code-load-project-structure-fq91y9`

Ye record migrations 199–223 Live par chalane se **pehle** ki haalat mehfooz karta
hai, taake baad mein har farq sabit kiya ja sake.

---

## 1. Backup — NOT VERIFIED BY ME

| Item | Haalat |
|---|---|
| Backup mojood hai? | **MALIK NE CONFIRM KIYA** (2026-08-31, migration se foran pehle) — malik ne apni machine par `npx supabase db dump` se schema + data backup banaya |
| Exact backup timestamp | Malik ki taraf se "ban gaya" ki tasdeeq; exact timestamp/file size mujhe nahi bheja gaya |
| Backup ki apni jaanch (critical tables + row counts) | **OUTPUT NAHI MILA** — jaanch wali command bheji gayi thi, us ka output mujh tak nahi pahuncha. Is liye ye backup **mere taraf se verified nahi** hai; malik ki tasdeeq par aage barha gaya. |
| `pg_dump --schema-only` mere environment se | **NOT PERFORMED** — yahan DB password / connection string mojood nahi (koi `.env` file nahi; `dblink` bhi "password required" par fail ho chuka hai) |
| Restore drill | **NOT TESTED** — isolated staging available nahi. Ye risk khula rahega, PASS nahi likha jayega. |

Iske badle SQL se schema ka **fingerprint** liya gaya hai. Ye `pg_dump` ka
mutabadil **nahi** hai — is se schema wapas banaya nahi ja sakta, sirf pehle/baad
ka farq sabit hota hai.

---

## 2. Pre-migration schema fingerprint (SQL-derived)

| Cheez | Adad |
|---|---|
| Tables (BASE TABLE) | 237 |
| Views | 62 |
| Columns | 3393 |
| Functions (public) | 100 |
| Triggers (non-internal) | 71 |
| RLS policies | 421 |
| Indexes | 436 |
| RLS-enabled tables | 237 / 237 |
| Extensions | pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp |

Column fingerprint (md5 over `table.column:type:nullable:default`):
`0eb6927c635269f4a641b630cf0a1050`  (3393 rows)

---

## 3. Pre-migration core ERP row counts

| Table | Rows |
|---|---|
| farmers | 2 |
| milk_entries | 0 |
| machinery_bookings | 3 |
| agri_orders | 0 |
| farmer_credit_ledger | 0 |
| profiles | 19 |
| machinery_bills | 2 |
| grain_procurement_entries | 0 |

Migration ke baad ye **bilkul wahi** hone chahiye. Koi farq = STOP.

---

## 4. Migration state

- Last applied migration version: `20260831084647`
- Kul migration rows: 129
- Chalane wali migrations: `199` → `223` (25 files, exact dependency order)

---

## 5. Dependency audit — PASS

Har wo object jis par 199–223 ka inhesaar hai, Live par mojood hai:

**Functions:** `fn_farmer_profile_status`, `fn_has_dept`, `fn_is_any_staff`, `fn_phone_key`

**Tables:** `agri_complaints`, `agri_order_payments`, `agri_orders`, `customers`,
`dashboard_features`, `dashboards`, `department_head_grants`, `departments`,
`farmer_credit_ledger`, `farmer_loans`, `features`, `grain_parties`,
`grain_procurement_entries`, `grain_procurement_payments`, `livestock_loans`,
`machinery_bills`, `machinery_bookings`, `machinery_payments`,
`machinery_vendors`, `milk_entries`, `platform_settings`,
`role_feature_permissions`, `staff_credit_ledger`, `user_feature_permissions`

**Columns:** `farmers.phone_key/profile_status/registration_stage`;
`machinery_bills.balance_payable/cancelled_at/diesel_deducted/discount_amount/previous_payment`;
`machinery_bookings.payment_promise_date/farmer_confirmed_at/confirmation_override_by/rate_reopened_at/reached_farm_at/work_started_at/completed_at`;
`machinery_payments.collected_by_vendor_id/custody_profile_id/vendor_settlement/verification_status`;
`milk_entries.possible_duplicate_of/status/verified_at/verified_by_profile_id`;
`machinery_vendors.user_id`; `customers.user_id/payment_due_days`

---

## 6. Collision check — saaf

Koi bhi naya object Live par pehle se mojood **nahi** hai:

- Score tables (`score_factor_weights`, `score_obligations`, `score_events`,
  `score_snapshots`, `score_runs`, `score_event_severity`, `score_sync_queue`,
  `loan_installments`) → **0 mojood**
- Naye columns (199/200/217) → **0 mojood**
- `fn_score*` functions → **0 mojood**
- `features` mein trust/score row → **0 mojood**

`pg_cron`: available = **haan**, installed = **nahi** (migration 222 install karegi).

---

## 7. Rukawat

Malik ka qadam 1–3 (backup verify, backup timestamp, `pg_dump --schema-only`)
main khud nahi kar sakta. Live par pehli migration chalane se pehle malik ka
backup confirmation darkar hai.
