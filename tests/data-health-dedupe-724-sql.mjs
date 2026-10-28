// 724: roz ki data-health naqal khuli na chhootay. PGlite — live DB nahi.
// Stock / ledger / journal ki koi qataar nahi banti.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const mig = fs.readFileSync("supabase/migrations/724_data_health_dedupe.sql", "utf8");
const rb = fs.readFileSync("supabase/migrations/724_data_health_dedupe.rollback.sql", "utf8");
const page = fs.readFileSync("src/app/admin/data-health/page.tsx", "utf8");
const code = mig.replace(/--.*$/gm, "");

assert.match(code, /superseded_by_duplicate/);
assert.match(code, /fn_data_health_record/);
assert.match(code, /uq_data_health_findings_open_fingerprint/);
assert.doesNotMatch(code, /insert\s+into\s+(public\.)?(journal_|stock_|inventory)/i);
assert.doesNotMatch(code, /update\s+(public\.)?(journal_|stock_|inventory|gl_accounts)/i);
assert.match(rb, /on conflict \(dedupe_key\) do nothing/);
assert.match(rb, /resolution_note = 'superseded_by_duplicate'/);
assert.match(page, /superseded_by_duplicate/);
assert.match(page, /resolution_note\.is\.null,resolution_note\.neq\.superseded_by_duplicate/);

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;
const fails = async (sql, re, msg) => {
  await assert.rejects(() => db.exec(sql), (e) => {
    assert.match(String(e?.message ?? e), re, msg);
    return true;
  }, msg);
};

await run(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $$;

  create table public.profiles (id uuid primary key);
  create table public.feature_help (
    feature_key text not null,
    lang text not null,
    purpose text,
    who_uses text,
    when_use text,
    how_steps text[],
    next_step text,
    mistakes text[],
    primary key (feature_key, lang)
  );
  insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
  values ('system.data_health', 'rm', 'p', 'w', 'kab', array['a'], 'next', array['m']);

  create table public.data_health_findings (
    id uuid primary key default gen_random_uuid(),
    finding_type text not null,
    department text not null,
    severity text not null default 'medium',
    title text not null,
    description text not null,
    related_table text,
    related_id uuid,
    related_label text,
    amount numeric(14, 2),
    status text not null default 'open'
      check (status in ('open', 'sent_to_claude', 'sent_to_assistant', 'dismissed', 'resolved')),
    dedupe_key text not null unique,
    detected_at timestamptz not null default now(),
    resolved_at timestamptz,
    resolved_by uuid references public.profiles(id),
    resolution_note text
  );

  create or replace function public.fn_data_health_guard()
  returns trigger language plpgsql as $g$
  begin
    if tg_op = 'DELETE' then
      raise exception 'Ye masla mitaya nahi ja sakta — dekh kar band kiya ja sakta hai.';
    end if;
    if old.status <> 'open' and new.status = old.status
       and new.resolution_note is not distinct from old.resolution_note then
      return new;
    end if;
    if new.status <> 'open' and (new.resolution_note is null or length(btrim(new.resolution_note)) < 5 or new.resolved_by is null) then
      raise exception 'Band karne ki wajah likhna zaroori hai (kam az kam 5 harf).';
    end if;
    if new.dedupe_key is distinct from old.dedupe_key
       or new.amount is distinct from old.amount
       or new.finding_type is distinct from old.finding_type then
      raise exception 'Saboot badla nahi ja sakta — sirf faisla likha ja sakta hai.';
    end if;
    return new;
  end $g$;

  create trigger trg_data_health_guard
    before update or delete on public.data_health_findings
    for each row execute function public.fn_data_health_guard();
`);

const P = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const W = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const P2 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const HUMAN = "00000000-0000-0000-0000-00000000aa01";
await run(`insert into public.profiles (id) values ('${HUMAN}')`);

const row = (id, type, key, day, status, amount, note = "null", by = "null") =>
  `('${id}','${type}','inventory','high','Batch aur ginti barabar nahi','${day}',${amount},'${status}','${key}','${day} 04:00+00',${note},${by})`;

await run(`
  insert into public.data_health_findings
    (id, finding_type, department, severity, title, description, amount, status, dedupe_key, detected_at, resolution_note, resolved_by)
  values
    ${row("00000000-0000-0000-0000-000000000001", "batch_inventory_mismatch", `batch_inventory_mismatch:${P}:${W}:2026-10-26`, "2026-10-26", "open", 1)},
    ${row("00000000-0000-0000-0000-000000000002", "batch_inventory_mismatch", `batch_inventory_mismatch:${P}:${W}:2026-10-27`, "2026-10-27", "open", 2)},
    ${row("00000000-0000-0000-0000-000000000003", "batch_inventory_mismatch", `batch_inventory_mismatch:${P}:${W}:2026-10-28`, "2026-10-28", "open", 3)},
    ${row("00000000-0000-0000-0000-000000000004", "batch_inventory_mismatch", `batch_inventory_mismatch:${P2}:${W}:2026-10-28`, "2026-10-28", "open", 9)},
    ${row("00000000-0000-0000-0000-000000000005", "negative_cash_account", "negative_cash_account:1010:2026-10-26", "2026-10-26", "dismissed", -10, "'jaan boojh kar'", `'${HUMAN}'`)},
    ${row("00000000-0000-0000-0000-000000000006", "negative_cash_account", "negative_cash_account:1010:2026-10-27", "2026-10-27", "open", -11)},
    ${row("00000000-0000-0000-0000-000000000007", "negative_cash_account", "negative_cash_account:1010:2026-10-28", "2026-10-28", "open", -12)},
    ${row("00000000-0000-0000-0000-000000000008", "stock_ledger_mismatch", "stock_ledger_mismatch:2026-10-20", "2026-10-20", "sent_to_assistant", 100, "'assistant ko bheja'", `'${HUMAN}'`)},
    ${row("00000000-0000-0000-0000-000000000009", "stock_ledger_mismatch", "stock_ledger_mismatch:2026-10-27", "2026-10-27", "open", 110)},
    ${row("00000000-0000-0000-0000-000000000010", "stock_ledger_mismatch", "stock_ledger_mismatch:2026-10-28", "2026-10-28", "open", 120)},
    ${row("00000000-0000-0000-0000-000000000011", "machinery_double_payout", "machinery_double_payout:dddddddd-dddd-dddd-dddd-dddddddddddd", "2026-10-01", "resolved", 500, "'khud theek kiya'", `'${HUMAN}'`)};
`);

await run(mig);
await run(mig);

const fp = async (key) => (await q(`select public.fn_data_health_fingerprint('${key}') t`))[0].t;
assert.equal(await fp(`batch_inventory_mismatch:${P}:${W}:2026-10-28`), `batch_inventory_mismatch:${P}:${W}`);
assert.equal(await fp("negative_cash_account:1010:2026-10-28"), "negative_cash_account:1010");
assert.equal(await fp("stock_ledger_mismatch:2026-10-28"), "stock_ledger_mismatch");
assert.equal(await fp("machinery_double_payout:dddddddd-dddd-dddd-dddd-dddddddddddd"), "machinery_double_payout:dddddddd-dddd-dddd-dddd-dddddddddddd");

const opens = await q(`select id::text from public.data_health_findings where status = 'open' order by id`);
assert.deepEqual(opens.map((r) => r.id), [
  "00000000-0000-0000-0000-000000000003",
  "00000000-0000-0000-0000-000000000004",
  "00000000-0000-0000-0000-000000000007",
  "00000000-0000-0000-0000-000000000010",
]);

const closedDupes = await q(`
  select id::text, resolved_by::text as by
  from public.data_health_findings
  where resolution_note = 'superseded_by_duplicate'
  order by id`);
assert.deepEqual(closedDupes.map((r) => r.id), [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
  "00000000-0000-0000-0000-000000000006",
  "00000000-0000-0000-0000-000000000009",
]);
assert.ok(closedDupes.every((r) => r.by == null));

assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000005'`))[0].status, "dismissed");
assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000008'`))[0].status, "sent_to_assistant");
assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000011'`))[0].status, "resolved");

const dupGroups = await q(`
  select public.fn_data_health_fingerprint(dedupe_key) fp, count(*)::int n
  from public.data_health_findings where status = 'open'
  group by 1 having count(*) > 1`);
assert.equal(dupGroups.length, 0);

const help = (await q(`select mistakes from public.feature_help where feature_key = 'system.data_health'`))[0].mistakes.join(" ");
assert.match(help, /superseded_by_duplicate/);

const scanDef = (await q(`select pg_get_functiondef('public.fn_data_health_scan()'::regprocedure) d`))[0].d;
assert.match(scanDef, /fn_data_health_record/);
assert.doesNotMatch(scanDef, /on conflict \(dedupe_key\) do nothing/i);

const fresh = await q(`
  select public.fn_data_health_record(
    'batch_inventory_mismatch','inventory','high','Batch aur ginti barabar nahi','day 29',
    'products','${P}'::uuid,'item',4,
    'batch_inventory_mismatch:${P}:${W}:2026-10-29'
  ) ok`);
assert.equal(fresh[0].ok, true);
assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000003'`))[0].status, "resolved");
assert.equal((await q(`
  select count(*)::int n from public.data_health_findings
  where status = 'open' and public.fn_data_health_fingerprint(dedupe_key) = 'batch_inventory_mismatch:${P}:${W}'
`))[0].n, 1);

const again = await q(`
  select public.fn_data_health_record(
    'batch_inventory_mismatch','inventory','high','Batch aur ginti barabar nahi','day 29',
    'products','${P}'::uuid,'item',4,
    'batch_inventory_mismatch:${P}:${W}:2026-10-29'
  ) ok`);
assert.equal(again[0].ok, false);
assert.equal((await q(`select count(*)::int n from public.data_health_findings where dedupe_key like '%2026-10-29'`))[0].n, 1);

const stable = "machinery_double_payout:eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
assert.equal((await q(`select public.fn_data_health_record('machinery_double_payout','machinery','high','t','d',null,null,null,10,'${stable}') ok`))[0].ok, true);
assert.equal((await q(`select public.fn_data_health_record('machinery_double_payout','machinery','high','t','d',null,null,null,99,'${stable}') ok`))[0].ok, false);
assert.equal((await q(`select amount::int a from public.data_health_findings where dedupe_key = '${stable}'`))[0].a, 10);

await fails(
  `insert into public.data_health_findings (finding_type, department, severity, title, description, dedupe_key)
   values ('batch_inventory_mismatch','inventory','high','t','d','batch_inventory_mismatch:${P}:${W}:2026-10-30')`,
  /uq_data_health_findings_open_fingerprint|duplicate key/,
  "doosri open naqal index rokay",
);
await fails(`delete from public.data_health_findings where id = '00000000-0000-0000-0000-000000000004'`, /mitaya nahi/, "delete band");
await fails(`update public.data_health_findings set amount = 1 where id = '00000000-0000-0000-0000-000000000004'`, /Saboot badla nahi/, "amount band");
await fails(
  `update public.data_health_findings set status = 'resolved', resolution_note = 'theek' where id = '00000000-0000-0000-0000-000000000004'`,
  /wajah likhna zaroori/,
  "bina resolved_by band",
);
await run(`
  update public.data_health_findings
     set status = 'resolved', resolution_note = 'khud theek kar diya', resolved_by = '${HUMAN}', resolved_at = now()
   where id = '00000000-0000-0000-0000-000000000004'`);
await fails(
  `select set_config('agribridge.data_health_supersede','on',true);
   update public.data_health_findings set amount = 0, status = 'resolved', resolution_note = 'superseded_by_duplicate', resolved_by = null
   where id = '00000000-0000-0000-0000-000000000007'`,
  /Duplicate band karne ka raasta/,
  "GUC se saboot nahi badalta",
);

await run(`alter table public.data_health_findings enable row level security`);
const rls = await q(`
  select public.fn_data_health_record(
    'negative_cash_account','finance','high','t','d',null,null,null,-1,
    'negative_cash_account:1018:2026-10-29'
  ) ok`);
assert.equal(rls[0].ok, true, "security definer RLS ke peeche bhi likhe");

await run(rb);
assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000001'`))[0].status, "open");
assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000005'`))[0].status, "dismissed");
assert.equal((await q(`select status from public.data_health_findings where id = '00000000-0000-0000-0000-000000000008'`))[0].status, "sent_to_assistant");
assert.equal((await q(`select resolution_note from public.data_health_findings where id = '00000000-0000-0000-0000-000000000011'`))[0].resolution_note, "khud theek kiya");
assert.equal((await q(`select count(*)::int n from pg_indexes where indexname = 'uq_data_health_findings_open_fingerprint'`))[0].n, 0);
await fails(`select public.fn_data_health_record('x','inventory','high','t','d',null,null,null,1,'x:2026-10-01')`, /fn_data_health_record/, "rollback function hataaye");
const oldScan = (await q(`select pg_get_functiondef('public.fn_data_health_scan()'::regprocedure) d`))[0].d;
assert.match(oldScan, /on conflict \(dedupe_key\) do nothing/i);
const helpBack = (await q(`select mistakes from public.feature_help where feature_key = 'system.data_health'`))[0].mistakes.join(" ");
assert.doesNotMatch(helpBack, /superseded_by_duplicate/);

await run(`
  insert into public.data_health_findings (finding_type, department, severity, title, description, dedupe_key)
  values ('batch_inventory_mismatch','inventory','high','t','d','batch_inventory_mismatch:${P}:${W}:2026-11-01')`);

console.log("data-health-dedupe-724 ok");
