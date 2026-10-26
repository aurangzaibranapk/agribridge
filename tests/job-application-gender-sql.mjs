// Gender column + message log. PGlite only. Live and Testing are not touched.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;
const genderSql = fs.readFileSync("supabase/migrations/20261022100000_job_application_gender.sql", "utf8");
const messageSql = fs.readFileSync("supabase/migrations/20261022100100_job_application_messages.sql", "utf8");

assert.doesNotMatch(genderSql, /update\s+public\.job_applications/i);
assert.doesNotMatch(messageSql, /update\s+public\.job_applications/i);
assert.match(genderSql, /chk_job_application_gender/);
assert.match(messageSql, /job_application_messages_hr/);
assert.match(messageSql, /'hr', 'admin', 'owner', 'super_admin', 'manager'/);

await run(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create table public.profiles (
    id uuid primary key,
    is_active boolean,
    role text
  );
  create table public.job_applications (
    id uuid primary key default gen_random_uuid(),
    full_name text not null,
    email text not null,
    status text not null default 'pending'
  );
`);

const oldId = (await q(`insert into public.job_applications (full_name, email) values ('Old', 'old@b.c') returning id`))[0].id;
await run(genderSql);
await run(genderSql);

const col = (await q(`select is_nullable from information_schema.columns
  where table_schema = 'public' and table_name = 'job_applications' and column_name = 'gender'`))[0];
assert.equal(col.is_nullable, "YES");
assert.equal((await q(`select gender from public.job_applications where id = '${oldId}'`))[0].gender, null);

await run(`insert into public.job_applications (full_name, email, gender) values ('Ali', 'a@b.c', 'female')`);
await assert.rejects(() => run(`insert into public.job_applications (full_name, email, gender) values ('Bad', 'b@b.c', 'nope')`));

await run(messageSql);
await run(messageSql);
const appId = (await q(`select id from public.job_applications where email = 'a@b.c'`))[0].id;
await run(`insert into public.job_application_messages
  (application_id, channel, to_address, subject, body, link_url, attachment_name, status, error)
  values ('${appId}', 'email', 'a@b.c', 'Hello', '<p>Hi</p>', 'https://alranatraders.pk/job-offer/x', 'Offer.pdf', 'failed', 'smtp down')`);
await assert.rejects(() => run(`insert into public.job_application_messages (application_id, channel, status) values ('${appId}', 'pigeon', 'sent')`));
await assert.rejects(() => run(`insert into public.job_application_messages (application_id, channel, status) values ('${appId}', 'sms', 'queued')`));

const logged = (await q(`select channel, status, error, link_url, attachment_name from public.job_application_messages`))[0];
assert.equal(logged.channel, "email");
assert.equal(logged.status, "failed");
assert.equal(logged.error, "smtp down");
assert.equal(logged.link_url, "https://alranatraders.pk/job-offer/x");
assert.equal(logged.attachment_name, "Offer.pdf");

const rls = (await q(`select relrowsecurity from pg_class where relname = 'job_application_messages'`))[0];
assert.equal(rls.relrowsecurity, true);

console.log("job application gender sql ok");
