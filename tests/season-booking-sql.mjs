// Real SQL test: 561-563 ko PGlite (in-process Postgres) par chalata hai -- live DB nahi.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (s) => db.exec(s);
const q = async (s, p = []) => (await db.query(s, p)).rows;
const one = async (s, p = []) => Object.values((await q(s, p))[0] ?? { v: null })[0];
const files = ["561_season_booking_farms", "562_custom_product_requests", "563_season_import_staging"].map((f) => fs.readFileSync(`supabase/migrations/${f}.sql`, "utf8"));

await run(fs.readFileSync("tests/sql/season-booking-stubs.sql", "utf8"));
for (const s of files) { await run(s); await run(s); } // idempotent
for (const s of files) assert.doesNotMatch(s, /\bdrop table\b|\btruncate\b|\bdrop column\b|\bdelete from\b|\bupdate public\./i, "sirf additive");

// Category tree -> line kind
await run(`
  insert into categories (id, name) values ('00000000-0000-0000-0000-0000000000a1','Seeds'),('00000000-0000-0000-0000-0000000000a2','Fertilizer'),('00000000-0000-0000-0000-0000000000a3','Pesticide'),('00000000-0000-0000-0000-0000000000a4','Soap, Detergent & Personal Care');
  insert into categories (id, name, parent_category_id) values ('00000000-0000-0000-0000-0000000000b1','Field Crop Seeds','00000000-0000-0000-0000-0000000000a1'),
    ('00000000-0000-0000-0000-0000000000b2','Phosphate (DAP/SSP)','00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000b3','Herbicides/Weedicides','00000000-0000-0000-0000-0000000000a3');
  insert into products (name, category_id, is_deleted) values ('Wheat Seed (Certified)','00000000-0000-0000-0000-0000000000b1',false),('Maize Seed (Hybrid)','00000000-0000-0000-0000-0000000000b1',false),
    ('Sona DAP','00000000-0000-0000-0000-0000000000b2',false),('Engro Urea','00000000-0000-0000-0000-0000000000a2',false),('Atrazine 50% WP','00000000-0000-0000-0000-0000000000b3',false),
    ('Korum','00000000-0000-0000-0000-0000000000a3',false),('Ariel','00000000-0000-0000-0000-0000000000a4',false),('Old DAP','00000000-0000-0000-0000-0000000000b2',true),('No Cat',null,false);`);
assert.equal(await one(`select fn_product_line_kind('00000000-0000-0000-0000-0000000000b1')`), "seed");
assert.equal(await one(`select fn_product_line_kind('00000000-0000-0000-0000-0000000000a2')`), "fertilizer");
assert.equal(await one(`select fn_product_line_kind('00000000-0000-0000-0000-0000000000b3')`), "pesticide");
assert.equal(await one(`select fn_product_line_kind('00000000-0000-0000-0000-0000000000a4')`), null);
assert.equal(await one(`select fn_product_line_kind(null)`), null);
const kinds = Object.fromEntries((await q(`select line_kind, count(*)::int n from v_campaign_products group by 1`)).map((r) => [r.line_kind, r.n]));
assert.deepEqual(kinds, { seed: 2, fertilizer: 2, pesticide: 2 }, "detergent, deleted, bina category bahar");
assert.equal(await one(`select count(*)::int from v_campaign_products where name in ('Ariel','Old DAP','No Cat')`), 0);

// Campaign crop default wheat
await run(`insert into booking_campaigns (id, name, crop, deadline) values ('00000000-0000-0000-0000-0000000000c1','Gandum Season 2026','wheat','2026-10-20')`);
assert.deepEqual(await one(`select allowed_crops from booking_campaigns`), ["wheat"]);

// Booking farms: sirf wheat, acre > 0, booking delete par cascade
await run(`insert into farmers (id, full_name, phone_key) values ('00000000-0000-0000-0000-0000000000d1','Kisan','3001234567');
  insert into farms (id, farmer_id, name) values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','Dera');
  insert into campaign_bookings (id, campaign_id, farmer_id, acres) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1',12);
  insert into campaign_booking_farms (booking_id, farm_id, acres) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e1',12);`);
assert.equal(await one(`select crop from campaign_booking_farms`), "wheat");
await assert.rejects(() => run(`insert into campaign_booking_farms (booking_id, farm_id, acres, crop) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e1',5,'rice')`), /check|unique/i);
await assert.rejects(() => run(`update campaign_booking_farms set acres = 0`), /check/i);
await assert.rejects(() => run(`insert into campaign_booking_farms (booking_id, farm_id, acres) values ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000e1',3)`), /unique|duplicate/i);

// Custom products: kind check, maker-checker, demand link
await run(`insert into profiles (id, role) values ('00000000-0000-0000-0000-000000000011','admin'),('00000000-0000-0000-0000-000000000012','owner')`);
await run(`insert into custom_product_requests (id, farmer_id, campaign_id, campaign_booking_id, line_kind, name, quantity, unit, created_by)
  values ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000f1','seed','Akbar-19',12,'bag','00000000-0000-0000-0000-000000000011')`);
await assert.rejects(() => run(`insert into custom_product_requests (farmer_id, line_kind, name) values ('00000000-0000-0000-0000-0000000000d1','grocery','X1')`), /check/i);
await assert.rejects(() => run(`insert into custom_product_requests (farmer_id, line_kind, name) values ('00000000-0000-0000-0000-0000000000d1','seed',' ')`), /check/i);
await assert.rejects(() => run(`update custom_product_requests set status='mapped', reviewed_by='00000000-0000-0000-0000-000000000011'`), /no_self_review|check/i, "khud review nahi");
await run(`update custom_product_requests set status='mapped', reviewed_by='00000000-0000-0000-0000-000000000012'`);
await run(`insert into farmer_product_demands (farmer_id, product_name, quantity, unit, custom_request_id) values ('00000000-0000-0000-0000-0000000000d1','Akbar-19',12,'bag','00000000-0000-0000-0000-000000000021')`);
assert.equal(await one(`select count(*)::int from farmer_product_demands where custom_request_id is not null`), 1);

// Import staging: result check, unique row, cascade
await run(`insert into season_import_batches (id, campaign_id, total_rows) values ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000c1',2);
  insert into season_import_rows (batch_id, row_no, raw, result) values ('00000000-0000-0000-0000-000000000031',2,'{}','ok'),('00000000-0000-0000-0000-000000000031',3,'{}','error')`);
await assert.rejects(() => run(`insert into season_import_rows (batch_id, row_no, raw, result) values ('00000000-0000-0000-0000-000000000031',4,'{}','maybe')`), /check/i);
await assert.rejects(() => run(`insert into season_import_rows (batch_id, row_no, raw, result) values ('00000000-0000-0000-0000-000000000031',2,'{}','ok')`), /unique|duplicate/i);
await assert.rejects(() => run(`update season_import_batches set status='done'`), /check/i);
await run(`delete from season_import_batches`);
assert.equal(await one(`select count(*)::int from season_import_rows`), 0);

// RLS on, staging authenticated se band
for (const t of ["campaign_booking_farms", "custom_product_requests", "season_import_batches", "season_import_rows"])
  assert.equal(await one(`select relrowsecurity from pg_class where relname = $1`, [t]), true, `${t} RLS`);
assert.equal(await one(`select has_table_privilege('authenticated','season_import_rows','select')`), false);
assert.equal(await one(`select has_table_privilege('authenticated','campaign_booking_farms','insert')`), false);

console.log("season-booking SQL (PGlite): sab theek");
