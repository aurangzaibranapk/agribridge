// I18n columns + manual live-row SQL, PGlite par. Live database nahi chhuti.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;
const migration = fs.readFileSync("supabase/migrations/20261022082729_job_vacancy_public_i18n.sql", "utf8");
const manual = fs.readFileSync("supabase/manual/job_vacancy_i18n_live_rows.sql", "utf8");

await run(`create table public.job_vacancies (
  id uuid primary key,
  title text not null,
  description text
)`);
await run(migration);
await run(migration);

const cols = (await q(`select column_name, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'job_vacancies'
   and column_name in ('title_en','title_ur','title_roman','description_en','description_ur','description_roman','brand','brand_en','brand_ur','brand_roman')
 order by column_name`));
assert.deepEqual(cols.map((c) => c.column_name), [
  "brand", "brand_en", "brand_roman", "brand_ur", "description_en", "description_roman", "description_ur", "title_en", "title_roman", "title_ur",
]);
assert.ok(cols.every((c) => c.is_nullable === "YES"));

await assert.rejects(() => run(manual), /Expected 2 live vacancy rows, found 0/);
await run("rollback");

await run(`insert into public.job_vacancies (id, title, description) values
  ('4142631f-5e2c-4b77-99b7-07b0ea8d2613', 'Milk Center Staff - Mahanbali', 'purana mahan'),
  ('bb95b584-c11b-4c31-a31e-75986f4fcdc4', 'Milk Center Staff - 157NB', 'purana 157')`);
await run(manual);
await run(manual);

const rows = await q(`select id::text, title, description, title_en, title_roman, title_ur, description_en, description_roman, description_ur, brand, brand_en, brand_ur, brand_roman
  from public.job_vacancies order by title`);
assert.equal(rows.length, 2);
const mahan = rows.find((r) => r.id === "4142631f-5e2c-4b77-99b7-07b0ea8d2613");
const nb = rows.find((r) => r.id === "bb95b584-c11b-4c31-a31e-75986f4fcdc4");
assert.equal(mahan.title, "Milk Center Staff - Mahanbali", "purana title fallback ke liye rehta hai");
assert.equal(mahan.description, "purana mahan");
assert.equal(mahan.title_en, "Milk Collection Officer (MCO) - Mahanbali");
assert.match(mahan.description_en, /Mahanbali milk center/);
assert.match(mahan.description_en, /Positions: 2/);
assert.match(mahan.title_roman, /Mahanbali/);
assert.match(mahan.title_ur, /مہانبالی/);
assert.match(mahan.description_ur, /آسامیاں: 2/);
assert.equal(mahan.brand, null);
assert.equal(mahan.brand_ur, null);
assert.equal(nb.brand_en, null);
assert.equal(nb.title, "Milk Center Staff - 157NB");
assert.equal(nb.title_en, "Milk Collection Officer (MCO) - 157NB");
assert.match(nb.description_en, /157NB milk center/);
assert.match(nb.description_en, /Positions: 1/);
assert.match(nb.description_roman, /Aasamiyan: 1/);
assert.ok(nb.description_ur.includes("157NB"));

console.log("careers i18n sql ok");
