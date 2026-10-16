const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync('supabase/migrations/541_promise_terms_credit_report.sql', 'utf8');
// verbal terms: required staff/time/version; otp/signature nullable
assert.match(sql, /add column if not exists terms_accepted_by uuid/);
assert.match(sql, /add column if not exists signature_ref text,/);
assert.match(sql, /add column if not exists otp_ref text,/);
assert.doesNotMatch(sql, /signature_ref is null[^;]*raise|otp_ref is null[^;]*raise/i, 'otp/signature must not be required');
assert.match(sql, /terms_accepted_at is null or new\.terms_accepted_by is null/);
assert.match(sql, /promised_days, 0\) > 30 and coalesce\(v_role,''\) not in \('owner','super_admin','admin'\)/);
// score events
assert.match(sql, /'promise_kept',1,8,false/);
assert.match(sql, /'promise_broken',-1,20,true/);
// default never erased, softens after 12 months
assert.match(sql, /before delete or update on public\.credit_default_marks/);
assert.match(sql, /marked_at > now\(\) - interval '12 months'/);
// sweep + cron + POS enforcement
assert.match(sql, /status = 'open' and promise_date < p_today/);
assert.match(sql, /cron\.schedule\('agribridge_promise_sweep'/);
assert.match(sql, /v_default := public\.fn_default_active\('customer', new\.crm_customer_id\)/);
assert.match(sql, /if \(not v_found or not p\.blocked\) and not v_default then return new/);
assert.match(sql, /not public\.fn_is_any_staff\(\) then raise exception 'Staff permission required/);
// additive only
assert.doesNotMatch(sql, /\bdrop table\b|\bdelete from\b|\btruncate\b/i);
// API + UI wired
const route = fs.readFileSync('src/app/api/recovery/route.ts', 'utf8');
assert.match(route, /body\.termsAccepted !== true/);
assert.match(route, /terms_accepted_by: user\.id/);
assert.match(route, /terms_channel: "verbal"/);
const dlg = fs.readFileSync('src/components/pos/overdue-credit-dialog.tsx', 'utf8');
assert.match(dlg, /setStep\("promise"\)/, 'promise opens inline, not new URL');
assert.match(dlg, /max=\{isAdmin \? pkDate\(365\) : pkDate\(STAFF_MAX_PROMISE_DAYS\)\}/);
assert.doesNotMatch(dlg, /window\.open/);
const pos = fs.readFileSync('src/components/pos/pos-client.tsx', 'utf8');
assert.match(pos, /choice\.kind === "promised"/);
const page = fs.readFileSync('src/app/admin/intelligence/party/page.tsx', 'utf8');
assert.match(page, /loadCreditReport/);
console.log('PASS: 541 promise terms + credit report wiring');
assert.match(sql, /coalesce\(c\.name, f\.full_name\) as name/, 'farmers has full_name, not name');
