// 725: expire batch sirf admin code se bikti hai. Live / testing database ko haath nahi lagata.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("..", import.meta.url);
const read = (rel) => fs.readFileSync(new URL(rel, root), "utf8");
const sqlFile = read("supabase/migrations/725_pos_expired_batch_sale_code.sql");
const posAction = read("src/actions/pos.ts");
const posClient = read("src/components/pos/pos-client.tsx");
const msg = "Ye batch (SB-2026-007) stock mein show ho rahi hai, lekin physically side-line kar di gayi hai. Is se nuqsan ho sakta hai. Sale ke liye admin ka code lagayein.";

assert.match(sqlFile, /stock mein show ho rahi hai, lekin physically side-line kar di gayi hai/);
assert.match(sqlFile, /admin ka code lagayein/);
assert.doesNotMatch(sqlFile, /bikri band hai/);
assert.match(sqlFile, /staff_auth_codes/);
assert.match(sqlFile, /extensions\.crypt/);
assert.match(sqlFile, /agribridge\.expired_sale_override/);
assert.match(sqlFile, /pos_expired_sale_overrides/);
assert.match(sqlFile, /authorized_by/);
assert.match(sqlFile, /pos_expired_sale_code_attempts/);
assert.doesNotMatch(sqlFile, /create or replace function public\.create_pos_sale_base_504/i);
assert.match(posAction, /fn_pos_sale_with_expired_code/);
assert.match(posAction, /p_expired_sale_code/);
assert.match(posAction, /pos_expired_sale_overrides/);
assert.doesNotMatch(posAction, /create_pos_sale_with_credit_approval/);
assert.match(posClient, /pos-expired-code/);
assert.match(posClient, /expiredSaleCode: expiredGate \? expiredSaleCode\.trim\(\) : null/);
assert.doesNotMatch(posClient, /Expire batch ki bikri band hai/);
assert.match(msg, /SB-2026-007/);
assert.match(msg, /nuqsan/);

const STAFF = "00000000-0000-0000-0000-0000000000a1";
const ADMIN = "00000000-0000-0000-0000-0000000000a2";
const MANAGER = "00000000-0000-0000-0000-0000000000a3";
const OTHER = "00000000-0000-0000-0000-0000000000a4";
const CASHIER_CODE = "00000000-0000-0000-0000-0000000000a5";
const B1 = "00000000-0000-0000-0000-0000000000b1";
const B2 = "00000000-0000-0000-0000-0000000000b2";
const WH = "00000000-0000-0000-0000-0000000000d1";
const COUNTER = "00000000-0000-0000-0000-0000000000c1";
const PROD = "00000000-0000-0000-0000-0000000000e1";
const ONLY = "00000000-0000-0000-0000-0000000000e2";
const EXP = "00000000-0000-0000-0000-000000000111";
const FRESH = "00000000-0000-0000-0000-000000000112";
const ONLY_EXP = "00000000-0000-0000-0000-000000000113";

const db = new PGlite();
const run = (sql) => db.exec(sql);
const q = async (sql) => (await db.query(sql)).rows;

async function boom(sql) {
  try {
    await db.exec(sql);
    return "";
  } catch (e) {
    return String(e && e.message ? e.message : e);
  }
}

await run(`
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon;
  create role authenticated;
  create role service_role;
  create schema if not exists extensions;
  -- PGlite mein pgcrypto nahi. Ye stub wahi contract hai jo migration
  -- bulati hai: crypt(code, hash) = hash sirf jab code sahi ho.
  create or replace function extensions.gen_salt(kind text) returns text
  language sql immutable as $$ select 'stub-salt' $$;
  create or replace function extensions.crypt(pw text, hash text) returns text
  language sql immutable as $$
    select case
      when hash = 'stub-salt' then 'ok:' || pw
      when hash = 'ok:' || pw then hash
      else 'mismatch'
    end
  $$;

  create table public.profiles (
    id uuid primary key, full_name text, role text, is_active boolean default true, branch_id uuid
  );
  create table public.branches (id uuid primary key);
  insert into public.branches values ('${B1}'), ('${B2}');
  insert into public.profiles (id, full_name, role, branch_id) values
    ('${STAFF}','Staff','sales_staff','${B1}'),
    ('${ADMIN}','Admin','admin', null),
    ('${MANAGER}','Manager','manager','${B1}'),
    ('${OTHER}','Other','manager','${B2}'),
    ('${CASHIER_CODE}','Cashier','sales_staff','${B1}');

  create table public.staff_auth_codes (
    profile_id uuid primary key references public.profiles(id),
    code_hash text not null
  );
  insert into public.staff_auth_codes (profile_id, code_hash) values
    ('${ADMIN}', extensions.crypt('2468', extensions.gen_salt('bf'))),
    ('${MANAGER}', extensions.crypt('1357', extensions.gen_salt('bf'))),
    ('${OTHER}', extensions.crypt('9999', extensions.gen_salt('bf'))),
    ('${CASHIER_CODE}', extensions.crypt('1111', extensions.gen_salt('bf')));

  create table public.stock_batches (
    id uuid primary key,
    batch_number text,
    product_id uuid,
    warehouse_id uuid,
    remaining_quantity numeric,
    initial_quantity numeric,
    expiry_date date,
    created_at timestamptz
  );
  create table public.pos_sales (id uuid primary key default gen_random_uuid(), client_action_id uuid);
  create table public.pos_counters (id uuid primary key, warehouse_id uuid, branch_id uuid);
  insert into public.pos_counters values ('${COUNTER}', '${WH}', '${B1}');

  create or replace function public.fn_is_any_staff() returns boolean language sql stable as $$ select true $$;
  create or replace function public.current_dealer_id() returns uuid language sql stable as $$ select null::uuid $$;
  create or replace function public.fn_current_user_warehouse_id() returns uuid language sql stable as $$ select '${WH}'::uuid $$;
  create or replace function public.fn_current_user_branch_id() returns uuid language sql stable as $$ select '${B1}'::uuid $$;
  create or replace function public.pos_line_stock_units(p_product_id uuid, p_quantity numeric, p_unit_price numeric, p_sale_unit text)
  returns numeric language sql stable as $$
    select p_quantity * case when p_sale_unit = 'carton' then 2 else 1 end $$;

  create table public.feature_help (
    feature_key text, lang text, purpose text, who_uses text, when_use text,
    how_steps text[], next_step text, mistakes text[], primary key (feature_key, lang)
  );
  insert into public.feature_help (feature_key, lang, purpose, how_steps, mistakes)
  values ('pos','rm','Counter par bikri.', array['Rate na badlein.']::text[], array['Seedha mat bechein.']::text[]);
`);

await run(sqlFile);

await run(`
  create or replace function public.create_pos_sale_with_credit_approval(
    p_items jsonb,
    p_payment_mode text,
    p_cash_paid numeric default 0,
    p_khata_amount numeric default 0,
    p_customer_id uuid default null,
    p_counter_id uuid default null,
    p_payment_lines jsonb default null,
    p_discount numeric default null,
    p_discount_reason text default null,
    p_client_action_id uuid default null,
    p_credit_override_reason text default null,
    p_manager_code text default null
  ) returns uuid
  language plpgsql
  as $$
  declare
    v_wh uuid;
    v_item jsonb;
    v_left numeric;
    r record;
    v_take numeric;
    v_sale uuid := gen_random_uuid();
  begin
    select warehouse_id into v_wh from public.pos_counters where id = p_counter_id;
    if v_wh is null then v_wh := public.fn_current_user_warehouse_id(); end if;
    insert into public.pos_sales (id, client_action_id) values (v_sale, p_client_action_id);
    for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      v_left := coalesce(public.pos_line_stock_units(
        (v_item->>'product_id')::uuid,
        coalesce((v_item->>'quantity')::numeric, 0),
        coalesce((v_item->>'unit_price')::numeric, 0),
        nullif(v_item->>'sale_unit', '')
      ), coalesce((v_item->>'quantity')::numeric, 0));
      for r in
        select id, remaining_quantity from public.stock_batches
         where warehouse_id = v_wh and product_id = (v_item->>'product_id')::uuid
           and coalesce(remaining_quantity, 0) > 0
         order by created_at asc, id
      loop
        exit when v_left <= 0;
        v_take := least(v_left, r.remaining_quantity);
        update public.stock_batches set remaining_quantity = remaining_quantity - v_take where id = r.id;
        v_left := v_left - v_take;
      end loop;
    end loop;
    return v_sale;
  end $$;
`);

async function resetStock() {
  await run(`
    delete from public.pos_expired_sale_overrides;
    delete from public.pos_expired_sale_code_attempts;
    delete from public.pos_sales;
    delete from public.stock_batches;
    insert into public.stock_batches (id, batch_number, product_id, warehouse_id, remaining_quantity, initial_quantity, expiry_date, created_at) values
      ('${EXP}','SB-2026-007','${PROD}','${WH}', 4, 4, '2000-01-01', '2020-01-01'),
      ('${FRESH}','SB-FRESH','${PROD}','${WH}', 10, 10, '2099-01-01', '2024-01-01'),
      ('${ONLY_EXP}','SB-ONLY','${ONLY}','${WH}', 3, 3, '2000-06-01', '2021-01-01');
  `);
}

function sale(product, qty, code, extra = "") {
  const codeSql = code == null ? "null" : `'${code}'`;
  return `
    select public.fn_pos_sale_with_expired_code(
      p_items => jsonb_build_array(jsonb_build_object('product_id','${product}','quantity',${qty},'unit_price',10${extra})),
      p_payment_mode => 'cash',
      p_cash_paid => 10,
      p_counter_id => '${COUNTER}',
      p_expired_sale_code => ${codeSql}
    ) as sale_id
    from (select set_config('test.uid', '${STAFF}', true) as uid) cfg
  `;
}

await resetStock();
const blocked = await boom(sale(PROD, 1, null));
assert.match(blocked, /side-line/);
assert.match(blocked, /SB-2026-007/);
assert.match(blocked, /admin ka code/);
assert.doesNotMatch(blocked, /bikri band hai/);
let left = await q(`select remaining_quantity from public.stock_batches where id = '${EXP}'`);
assert.equal(Number(left[0].remaining_quantity), 4);
let attempts = await q(`select count(*)::int as n from public.pos_expired_sale_code_attempts`);
assert.equal(attempts[0].n, 0);

await resetStock();
const wrong = await q(sale(PROD, 1, "0000"));
assert.equal(wrong[0].sale_id, null);
left = await q(`select remaining_quantity from public.stock_batches where id = '${EXP}'`);
assert.equal(Number(left[0].remaining_quantity), 4);
attempts = await q(`select attempted_by::text as who, batch_numbers from public.pos_expired_sale_code_attempts`);
assert.equal(attempts.length, 1);
assert.equal(attempts[0].who, STAFF);
assert.ok(attempts[0].batch_numbers.includes("SB-2026-007"));

await resetStock();
const other = await q(sale(PROD, 1, "9999"));
assert.equal(other[0].sale_id, null);
const staffCode = await q(sale(PROD, 1, "1111"));
assert.equal(staffCode[0].sale_id, null);

await resetStock();
const ok = await q(sale(PROD, 1, "2468"));
assert.ok(ok[0].sale_id);
left = await q(`select id::text, remaining_quantity from public.stock_batches where product_id = '${PROD}' order by created_at`);
assert.equal(Number(left[0].remaining_quantity), 3);
assert.equal(Number(left[1].remaining_quantity), 10);
const ov = await q(`select attempted_by::text as who, authorized_by::text as code_of, batch_numbers from public.pos_expired_sale_overrides`);
assert.equal(ov.length, 1);
assert.equal(ov[0].who, STAFF);
assert.equal(ov[0].code_of, ADMIN);
assert.ok(ov[0].batch_numbers.includes("SB-2026-007"));

await resetStock();
const mgr = await q(sale(ONLY, 2, "1357"));
assert.ok(mgr[0].sale_id);
left = await q(`select remaining_quantity from public.stock_batches where id = '${ONLY_EXP}'`);
assert.equal(Number(left[0].remaining_quantity), 1);
const ov2 = await q(`select authorized_by::text as code_of from public.pos_expired_sale_overrides`);
assert.equal(ov2[0].code_of, MANAGER);

await resetStock();
await run(`
  update public.stock_batches set created_at = '2025-01-01' where id = '${FRESH}';
  update public.stock_batches set created_at = '2026-01-01' where id = '${EXP}';
`);
const freshFirst = await q(sale(PROD, 1, null));
assert.ok(freshFirst[0].sale_id);
left = await q(`select batch_number, remaining_quantity from public.stock_batches where product_id = '${PROD}' order by batch_number`);
const byNo = Object.fromEntries(left.map((r) => [r.batch_number, Number(r.remaining_quantity)]));
assert.equal(byNo["SB-FRESH"], 9);
assert.equal(byNo["SB-2026-007"], 4);
const noOv = await q(`select count(*)::int as n from public.pos_expired_sale_overrides`);
assert.equal(noOv[0].n, 0);

await resetStock();
const direct = await boom(`
  update public.stock_batches set remaining_quantity = remaining_quantity - 1 where id = '${ONLY_EXP}';
`);
assert.match(direct, /side-line/);
assert.match(direct, /SB-ONLY/);
await run(`
  update public.stock_batches
     set remaining_quantity = remaining_quantity - 1
   where id = '${ONLY_EXP}'
     and set_config('agribridge.allow_expired_out', 'on', true) = 'on';
`);
left = await q(`select remaining_quantity from public.stock_batches where id = '${ONLY_EXP}'`);
assert.equal(Number(left[0].remaining_quantity), 2);
await run(`select set_config('agribridge.allow_expired_out', 'off', true);`);

const help = await q(`select purpose, how_steps, mistakes from public.feature_help where feature_key = 'pos' and lang = 'rm'`);
assert.match(help[0].purpose, /side-line/);
assert.ok(help[0].how_steps.some((s) => s.includes("admin ka code")));
assert.ok(help[0].mistakes.some((s) => s.includes("bina code")));

await run(read("supabase/migrations/725_pos_expired_batch_sale_code.rollback.sql"));
const restored = await boom(`
  update public.stock_batches set remaining_quantity = remaining_quantity - 1 where id = '${EXP}';
`);
assert.match(restored, /Expire batch ki bikri band hai \(batch SB-2026-007\)/);
const gone = await boom(`select public.fn_pos_sale_with_expired_code('[]'::jsonb, 'cash')`);
assert.match(gone, /fn_pos_sale_with_expired_code/);

console.log("pos expired-batch sale code: theek");
