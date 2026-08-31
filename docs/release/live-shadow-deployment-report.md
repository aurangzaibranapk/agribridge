# AgriBridge Trust Engine — Live Shadow Deployment Report

Project: **Live `ktskwawkslaznkjjacni`** ("Agribrige", ap-northeast-2, Postgres 17.6)
Tareekh: 2026-08-31 (UTC)
Repo commit: `20fbd66` — branch `claude/code-load-project-structure-fq91y9`
Mode: **SHADOW ONLY** — P3 farmer-facing gauge LOCKED

---

## 1. Backup

| Item | Haalat |
|---|---|
| Backup banaya gaya | **HAAN — malik ne khud banaya aur confirm kiya** (`npx supabase db dump`, schema + data) |
| Exact timestamp / file size | Mujhe nahi bheja gaya |
| Backup ki apni jaanch (critical tables + row counts) | **NAHI HUI** — jaanch wali command bheji gayi thi, output nahi mila |
| Restore drill | **NOT TESTED** — isolated staging available nahi |

**Ye backup mere taraf se VERIFIED nahi hai.** Malik ki tasdeeq par aage barha
gaya. Restore drill ka risk release record mein **khula** hai, PASS nahi.

WAL archiving `on` thi aur DB sehatmand primary tha — magar wo backup ka saboot
nahi, sirf ek ishaara.

---

## 2. Migrations

**25 migrations, 199 → 223, exact tarteeb mein. Sab kaamyab. Koi error nahi,
koi STOP nahi, kisi production qatar ko haath nahi lagaya gaya.**

| # | Migration | Kaam |
|---|---|---|
| 199 | due_date_ki_buniyad | `machinery_bills.due_date/terms_days`, `agri_orders.payment_due_date`, `loan_installments` table. **Koi backfill nahi.** |
| 200 | login_aur_udhaar_ki_lakeer | `farmers.phone_verified_at`, `farmers.credit_status` (default `none`) |
| 201 | score_ka_dhaancha | 4 score tables + 25 wazan |
| 202 | score_engine_aur_rls | engine, eligibility, visibility, RLS (SELECT-only, koi INSERT policy nahi) |
| 203 | engine_ki_do_kharabiyan | `decays` column; eligibility par band floor |
| 204 | waqia_batil_hota_hai | `invalidated_at/_reason` + partial unique index |
| 205 | machinery_se_score_waqiat | machinery reconciler |
| 206 | roz_ka_hisaab_aur_nigrani | `score_runs` + daily run |
| 207 | waqie_ka_wazan_table_mein | `score_event_severity`; naya `fn_score_put_event` |
| 208 | machinery_sync_wazan_table_se | machinery sync ab table se wazan leta hai |
| 209 | payments_credit_ke_waqiat | credit line, qistein, vendor settlement, staff custody |
| 210 | pichhli_adaigi_do_dafa | `previous_payment` do dafa ginne wala bug |
| 211 | milk_se_score_ke_waqiat | mahana anchor, miqdar se azad |
| 212 | grain_se_score_ke_waqiat | `created_by` ho to verified, warna pending |
| 213 | orders_se_score_ke_waqiat | kisan `fn_phone_key` se; staff waqiat |
| 214 | saye_wala_safha_menu_mein | `features` + `dashboard_features` — **`role_feature_permissions` mein koi qatar nahi** |
| 215 | score_par_parhne_ki_ijazat | GRANT SELECT; `loan_installments` par RLS phir grant |
| 216 | apni_qist_dekhne_ka_raasta | `fn_owns_loan` SECURITY DEFINER |
| 217 | chaar_faisle_schema_par | `cancellation_party`, grain `edit_kind/reason`, `agri_orders.customer_id/party_link_state` |
| 218 | faislon_ke_mutabiq_sync | mansookhi sirf `cancellation_party='farmer'` par; grain sirf `unexplained`; order customer-aware |
| 219 | score_ki_qatar | `score_sync_queue` + 12 enqueue triggers (AFTER, sirf parchi) |
| 220 | qatar_chalana_aur_taazgi | drain / retry / daily / **freshness health** |
| 221 | runner_ko_mazboot_karna | `dead` darja, `FOR UPDATE SKIP LOCKED`, health mein dead + last_drain |
| 222 | pg_cron_do_kaam | `pg_cron`; queue `*/5`, daily `0 3 * * *` |
| 223 | taala_khud_khulne_wala | `pg_try_advisory_xact_lock` |

**Ek baat darj karne wali:** 222 wo cron job banati hai jo `fn_score_queue_tick`
ko bulata hai, aur wo function 223 mein banta hai. Dono foran ek doosre ke baad
chalayi gayin (chand second ka faasla). Agar us darmiyan cron chal jata to ek
tick nakaam hota — us ka koi asar data par nahi hota. Aage se 223 ko 222 se
pehle rakhna behtar hoga.

---

## 3. Migration se pehle aur baad — core ERP

| Table | Pehle | Baad | Farq |
|---|---|---|---|
| farmers | 2 | 2 | 0 |
| milk_entries | 0 | 0 | 0 |
| machinery_bookings | 3 | 3 | 0 |
| agri_orders | 0 | 0 | 0 |
| farmer_credit_ledger | 0 | 0 | 0 |
| profiles | 19 | 19 | 0 |
| machinery_bills | 2 | 2 | 0 |
| grain_procurement_entries | 0 | 0 | 0 |

**Ek bhi ERP qatar nahi badli.**

Schema (sab izafa, koi kami nahi):

| Cheez | Pehle | Baad |
|---|---|---|
| Tables | 237 | 245 (+8) |
| Views | 62 | 62 (0) |
| Columns | 3393 | 3507 (+114) |
| RLS policies | 421 | 430 (+9) |
| Triggers | 71 | 83 (+12) |
| RLS band tables | 0 | **0** |

---

## 4. Post-migration verification

| Jaanch | Nateeja |
|---|---|
| 8 nayi tableain mojood | PASS |
| Sab 8 par RLS chalu | PASS |
| Score/sync functions mojood | PASS (27 naye) |
| 12 enqueue triggers | PASS — machinery_bookings, machinery_bills, machinery_payments, farmer_credit_ledger, loan_installments, milk_entries, grain_procurement_entries, grain_procurement_payments, agri_orders, agri_order_payments, agri_complaints, staff_credit_ledger |
| Wazan matrix | PASS — 25 factor rows, 43 severity rows |
| pg_cron dono job chalu | PASS — `agribridge_score_queue` `*/5 * * * *`, `agribridge_score_daily` `0 3 * * *` |
| Daily runner | PASS — ek dafa chalaya, status `ok`, 3 subjects |
| Queue runner (asal cron tick) | PASS — pg_cron ne 21:15:00 UTC par khud chalaya, `succeeded`, run `drain`/`ok`, queue baqi 0 |
| Freshness guard | PASS — chalne se pehle khud ko `is_stale` bataya, drain ke baad `is_stale = false` |
| Kill-switch | Available — `cron.unschedule(...)` / `update cron.job set active=false`, aur `features` ki qatar `is_active=false` |
| `role_feature_permissions` mein trust ki qatar | **0** — sirf owner/super_admin/admin ko dikhega |

---

## 5. Controlled historical backfill

Pehle source audit, phir sync, phir har adad ka source tak milaan.

Source (Live par jitna hai): 3 bookings, 2 bills, **0 payments**, 2 farmers,
1 vendor. Milk / grain / orders / credit sab khali.

`fn_sync_machinery_all()` = 5 · baqi chaar `_all()` = 0 (kuch tha hi nahi).

**Bana: 7 waqiat, 1 zimmedari, 3 snapshot. Expected = Actual, har jagah.**

| Waqia | Kis par | Source | Kyun |
|---|---|---|---|
| rate_confirmed +5 | farmer | booking `358501be` | `farmer_confirmed_at` 30 Aug 16:13 |
| rate_confirmed +5 | farmer | booking `eb39fe5b` | `farmer_confirmed_at` 31 Aug 05:52 |
| rate_confirmed +5 | farmer | booking `f1bc01fd` | `farmer_confirmed_at` 31 Aug 05:52 |
| work_completed +10 | farmer | booking `f1bc01fd` | `completed_at` 31 Aug 05:53 |
| confirmed +5 | vendor | booking `358501be` | wahi tasdeeq |
| confirmed +5 | vendor | booking `f1bc01fd` | wahi tasdeeq |
| completed +10 | vendor | booking `f1bc01fd` | wahi takmeel |

Zimmedari: bill `72c20237` — Rs 28,000, khula, due **2026-09-04**,
`due_date_source = farmer_promise` (booking ka `payment_promise_date`).

Do baatein sabit hueen:
- **Mansookh bill se koi zimmedari nahi bani.** Bill `9328009f` (Rs 30,000)
  mansookh hai — us ki koi qatar nahi.
- **Koi manfi waqia nahi bana.** Kisi booking par `reached_farm_at` /
  `work_started_at` nahi, koi mansookhi nahi, aur akela due date (4 Sep) abhi
  aaya hi nahi — is liye na "der", na "overdue".

Snapshot:

| Subject | Score | State | Coverage | Credit history | Din | Tasdeeq shuda |
|---|---|---|---|---|---|---|
| farmer `431cd13f` | **NULL** | score_building | 0.25 | none | 1 | 1 |
| farmer `9820c25d` | **NULL** | score_building | 0.25 | insufficient | 1 | 3 |
| vendor `71e0ad4a` | **NULL** | score_building | 0.45 | none | 1 | 3 |

**Teenon par score NULL hai, sifar nahi** — aur yehi durust hai: taalluq ek din
purana hai (30 din ki shart poori nahi). Kisi ko koi darja nahi mila, kisi par
koi nishan nahi laga.

---

## 6. Shadow mode ki pabandiyan — sab qaim

- `/admin/trust` sirf `UNRESTRICTED_ROLES` (owner / super_admin / admin) —
  `role_feature_permissions` mein qatar hai hi nahi.
- Farmer / Customer / Vendor / Staff portal par score kahin nazar nahi aata.
- **Koi khud kaar faisla nahi**: na loan approve/reject, na credit limit,
  na vendor par rok, na staff par saza, na kisan ki service band.
- `fn_credit_eligibility` hamesha `requires_human_approval = true` lautata hai.
- Score par likhne ki koi RLS policy nahi — sirf engine (SECURITY DEFINER).

---

## 7. Jo khula hua hai

1. **Restore drill NOT TESTED** — isolated staging nahi hai. Ye risk khula rahega.
2. **Backup meri taraf se verified nahi** — malik ki tasdeeq par chala gaya.
3. ~~Queue runner ka pehla asal cron tick~~ — **BAND. Ho gaya.** pg_cron ne
   21:15:00 UTC par khud chalaya, `succeeded`; `score_runs` mein `drain` /
   `ok` / `pg_cron` darj hua aur `fn_score_health()` ab `is_stale = false`,
   "Sab theek hai" kehta hai.
5. **Backfill sirf machinery se hai**, kyunke Live par baqi kuch hai hi nahi.
   Milk / grain / orders / credit ka asal imtihaan tab hoga jab Live par un ka
   data aayega.
6. **222 aur 223 ki tarteeb** (upar §2) — aage ke liye theek karni chahiye.

---

## 8. Faisla

**P2.6 = COMPLETE / LIVE SHADOW MODE**, in do shartoun ke saath jo abhi khuli
hain: restore drill nahi hui, aur backup ki apni jaanch ka output nahi mila.

P3 (farmer-facing gauge) **LOCKED** rahega. Nigrani ka arsa shuru.
