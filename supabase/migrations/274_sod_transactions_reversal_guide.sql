-- =====================================================================
-- AgriBridge — Migration 274: teen kaam jo malik ne "sara complete" mein rakhe
-- =====================================================================
-- 1. Transaction-level Separation of Duties: "Ahmed ke paas Create aur
--    Approve dono hon tab bhi wo apni banayi hui payment khud approve na
--    kar sake." Database trigger -- UI se bypass nahi ho sakta. Qawaid
--    sod_transaction_rules mein (badalne ke qabil), code mein nahi.
--      block -> exception (kaam rukta hai)
--      warn  -> chalne do, sod_transaction_events mein likho
--      exempt_roles (owner/super_admin/admin) -> chalne do, event likho
-- 2. Reversal ka apna feature (finance.reversal): SOD-PAY-REVERSE ab asal
--    action par, cash book edit wala TEMPORARY PROXY khatam.
-- 3. Training Mode: training_modules.guide -- qadam ba qadam asal button
--    highlight (data-guide) aur "Next".
-- 4. products.unit_code khud bhare jab unit text aaye (intake, import,
--    propose) -- 273 ka backfill ab hamesha ke liye.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Transaction-level SoD
-- ---------------------------------------------------------------------
create table if not exists sod_transaction_rules (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  creator_col text not null,
  approver_col text not null,
  label text not null,
  enforcement text not null default 'block',
  exempt_roles text[] not null default array['owner','super_admin','admin'],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_str_enforcement check (enforcement in ('block', 'warn')),
  unique (table_name, creator_col, approver_col)
);
comment on table sod_transaction_rules is 'Ek hi record par banane wala hi manzoor/tasdeeq na kare (274). block = rok; warn = chalne do, likho. Qawaid yahin badlein, phir fn_sod_attach_triggers().';

create table if not exists sod_transaction_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid references sod_transaction_rules(id) on delete set null,
  table_name text not null,
  record_id text,
  actor_id uuid,
  event text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ste_table on sod_transaction_events (table_name, created_at desc);

alter table sod_transaction_rules enable row level security;
alter table sod_transaction_events enable row level security;
drop policy if exists str_read on sod_transaction_rules;
create policy str_read on sod_transaction_rules for select to authenticated using (fn_can_review_access());
drop policy if exists ste_read on sod_transaction_events;
create policy ste_read on sod_transaction_events for select to authenticated using (fn_can_review_access());

create or replace function fn_sod_no_self_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  nj jsonb := to_jsonb(new);
  oj jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  v_creator text;
  v_approver text;
  v_old_approver text;
  v_role text;
begin
  for r in select * from sod_transaction_rules where is_active and table_name = tg_table_name loop
    v_creator := nj ->> r.creator_col;
    v_approver := nj ->> r.approver_col;
    v_old_approver := case when oj is null then null else oj ->> r.approver_col end;
    if v_creator is null or v_approver is null then continue; end if;
    if v_approver <> v_creator then continue; end if;
    -- Pehle se yehi tha (koi aur column badla) -> dobara na roko
    if v_old_approver is not null and v_old_approver = v_approver then continue; end if;

    select p.role::text into v_role from profiles p where p.id = v_approver::uuid;
    if v_role is not null and v_role = any (r.exempt_roles) then
      insert into sod_transaction_events (rule_id, table_name, record_id, actor_id, event, detail)
      values (r.id, tg_table_name, nj ->> 'id', v_approver::uuid, 'self_approval_exempt',
              jsonb_build_object('role', v_role, 'creator_col', r.creator_col, 'approver_col', r.approver_col, 'label', r.label));
      continue;
    end if;
    if r.enforcement = 'warn' then
      insert into sod_transaction_events (rule_id, table_name, record_id, actor_id, event, detail)
      values (r.id, tg_table_name, nj ->> 'id', v_approver::uuid, 'self_approval_warned',
              jsonb_build_object('role', v_role, 'creator_col', r.creator_col, 'approver_col', r.approver_col, 'label', r.label));
      continue;
    end if;
    raise exception 'SOD: % -- jis ne banaya wohi manzoor/tasdeeq nahi kar sakta. Doosra authorized banda kare. (%: % = %)',
      r.label, tg_table_name, r.approver_col, r.creator_col
      using errcode = 'check_violation';
  end loop;
  return new;
end;
$$;

-- Har us table par trigger jis ka rule hai (naya rule daalne ke baad dobara bulayein)
create or replace function fn_sod_attach_triggers()
returns int language plpgsql security definer set search_path = public as $$
declare t text; n int := 0;
begin
  for t in select distinct table_name from sod_transaction_rules loop
    if to_regclass('public.' || t) is null then
      raise notice 'sod: table % nahi mili, chhoR di', t;
      continue;
    end if;
    execute format('drop trigger if exists trg_sod_self_approval on %I', t);
    execute format('create trigger trg_sod_self_approval before insert or update on %I for each row execute function fn_sod_no_self_approval()', t);
    n := n + 1;
  end loop;
  return n;
end;
$$;

insert into sod_transaction_rules (table_name, creator_col, approver_col, label, enforcement) values
  ('purchases',                'created_by',   'reviewed_by',          'Purchase: banane wala hi manzoor kare',                 'block'),
  ('purchases',                'created_by',   'received_by',          'Purchase: banane wala hi maal receive kare',            'warn'),
  ('supplier_payment_requests','requested_by', 'approved_by',          'Supplier adaigi: maangne wala hi manzoor kare',         'block'),
  ('agri_order_payments',      'created_by',   'verified_by',          'Order ki adaigi: darj karne wala hi tasdeeq kare',      'block'),
  ('stock_counts',             'started_by',   'posted_by',            'Ginti: ginne wala hi post/manzoor kare',                'block'),
  ('cash_handovers',           'from_profile_id','received_by',        'Cash handover: dene wala hi receive kare',              'block'),
  ('pos_returns',              'created_by',   'authorized_by',        'POS wapsi: banane wala hi authorize kare',              'block'),
  ('milk_entries',             'created_by',   'verified_by_profile_id','Doodh entry: darj karne wala hi verify kare',          'block'),
  ('agri_orders',              'requested_by', 'sales_verified_by',    'Shop order: maangne wala hi sales verify kare',         'warn'),
  ('agri_orders',              'requested_by', 'finance_verified_by',  'Shop order: maangne wala hi finance verify kare',       'block'),
  ('agri_orders',              'requested_by', 'approved_by',          'Shop order: maangne wala hi manzoor kare',              'block'),
  ('agri_order_returns',       'created_by',   'received_by',          'Shop wapsi: banane wala hi HQ par receive kare',        'warn'),
  ('product_intake_batches',   'created_by',   'approved_by',          'Product intake: banane wala hi manzoor kare',           'warn'),
  ('company_expense_requests', 'requested_by', 'approved_by',          'Kharcha: maangne wala hi manzoor kare',                 'block'),
  ('machinery_work_records',   'submitted_by', 'verified_by',          'Machinery kaam: bhejne wala hi verify kare',            'block'),
  ('machinery_fuel_logs',      'submitted_by', 'verified_by',          'Fuel log: bhejne wala hi verify kare',                  'block')
on conflict (table_name, creator_col, approver_col) do nothing;

select fn_sod_attach_triggers();

-- ---------------------------------------------------------------------
-- 2. Reversal ka apna feature
-- ---------------------------------------------------------------------
insert into public.features (key, label, label_en, label_ur, description, description_en, description_ur, route, icon, is_sensitive, is_active) values
  ('finance.reversal', 'Entry Ulti Karein (Reversal)', 'Reverse / Correct Posted Entry', 'اندراج الٹنا', 'Post shuda journal entry ko ulta karna (wajah lazmi). Sirf jise ye ijazat di gayi ho -- role se kisi ko nahi.', 'Reverse a posted journal entry (reason mandatory). Only for users explicitly granted this.', 'پوسٹ شدہ اندراج الٹنا', '/admin/audit-trail#reversal', 'Undo2', true, true)
on conflict (key) do update set label = excluded.label, description = excluded.description, is_sensitive = true, is_active = true;
-- Role se kisi ko nahi: Owner/Admin unrestricted hain; baqi ko darkhwast se
-- (user_feature_permissions) -- SoD ke mutabiq banane/manzoor karne wale ko nahi.

update access_conflict_rules
   set duties = '[{"label":"Adaigi banana","features":["payouts","purchases.bills","finance","supplier_payment_requests"],"actions":["create"]},
                  {"label":"Adaigi manzoor / tasdeeq","features":["payouts","submissions","finance"],"actions":["approve","verify"]},
                  {"label":"Ulta karna (Reversal)","features":["finance.reversal"],"actions":["create"]}]'::jsonb,
       description = 'Create + Verify/Approve + Reverse ek hi user ke paas: adaigi bana kar, manzoor kar ke, phir ulta bhi kar sakta hai -- koi nishan nahi bachta. Reversal ab apna feature hai (finance.reversal, 274); cash book edit wala waqti proxy khatam.',
       updated_at = now()
 where code = 'SOD-PAY-REVERSE';

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, faq, related) values
  ('finance.reversal', 'rm', 'Post shuda entry ghalat ho to usay mitaya nahi jata -- ulti entry banti hai (reversal), wajah ke sath, hamesha ke liye.', 'Sirf jise Owner/Admin ne ye ijazat di ho (darkhwast se). Jo adaigi banata ya manzoor karta hai usay ye nahi milni chahiye (SoD).', 'Jab koi entry ghalat post ho gayi ho.',
   array['/admin/audit-trail par entry dhoondein.', 'Reverse dabayein, wajah likhein (kam az kam chand lafz).', 'Ulti entry ban jati hai; asal entry waise hi rehti hai.'],
   'Audit trail mein dono entries; cash book khud theek.', array['Bina wajah ke reverse.', 'Apni banayi entry khud ulta karna -- SoD.'], '[]'::jsonb, array['audit-trail']::text[]),
  ('finance.reversal', 'en', 'A wrongly posted entry is never deleted; a reversing entry is posted with a reason, permanently.', 'Only users explicitly granted this by Owner/Admin. Whoever creates or approves payments should not hold it (SoD).', 'When an entry was posted wrongly.',
   array['Find the entry on /admin/audit-trail.', 'Press Reverse and write the reason.', 'A reversing entry is posted; the original stays.'],
   'Both entries show in the audit trail; the cash book corrects itself.', array['Reversing without a reason.', 'Reversing your own entry -- SoD.'], '[]'::jsonb, array['audit-trail']::text[])
on conflict (feature_key, lang) do update set purpose = excluded.purpose, how_steps = excluded.how_steps, updated_at = now();

-- ---------------------------------------------------------------------
-- 3. Training guide: asal button highlight
-- ---------------------------------------------------------------------
-- guide = [{"path":"/admin/...","target":"[data-guide=\"...\"]" | null,"text":"..."}]
-- target null -> us safhe ka link (nav) highlight hota hai, safhe par card.
alter table training_modules add column if not exists guide jsonb;

update training_modules set guide = '[
  {"path":"/admin/products/bill-rates","target":"[data-guide=\"bill-upload\"]","text":"Supplier ka bill yahan charhayein: photo, PDF ya sheet. Ye button dabayein."},
  {"path":"/admin/products/bill-rates","target":null,"text":"AI ki parhi qatarein neeche aayengi. Andaze wali (fuzzy) qatar khol kar product tasdeeq karein aur Save dabayein."},
  {"path":"/admin/purchases","target":"[data-guide=\"purchase-review\"]","text":"Bill se purchase ban gayi. Owner/Admin yahan Jaanch dabakar manzoor, wapas ya radd karta hai."},
  {"path":"/admin/inventory/receiving","target":"[data-guide=\"purchase-receive\"]","text":"Maal aane par yahan ginein: theek aaya / toota / kam. Stock sirf theek aaye maal ka charhta hai."},
  {"path":"/admin/purchases/bills","target":null,"text":"Supplier ka dena yahan: sirf received maal ka. Due date aur adaigi isi safhe par."}
]'::jsonb where key = 'procurement';

update training_modules set guide = '[
  {"path":"/admin/inventory/receiving","target":"[data-guide=\"purchase-receive\"]","text":"Manzoor purchase ka maal yahan ginein: theek / toota / kam."},
  {"path":"/admin/inventory","target":null,"text":"Stock ki fehrist. Product ke naam par card: batch, miyaad, rakha hua maal."},
  {"path":"/admin/stock-transfers","target":null,"text":"Shop ko maal yahan se bhejein; lene wale ke stock mein receive par aata hai."},
  {"path":"/admin/purchases/grn","target":null,"text":"Shop ke orders yahan receive hote hain."},
  {"path":"/admin/stock-count","target":null,"text":"Mahine mein ek dafa asal ginti. Ginne wala aur manzoor karne wala alag (SoD)."},
  {"path":"/admin/stock-ledger","target":null,"text":"Har tabdeeli yahan nazar aati hai: kab, kahan se, kis wajah se."}
]'::jsonb where key = 'warehouse';

-- ---------------------------------------------------------------------
-- 4. products.unit_code khud bhare
-- ---------------------------------------------------------------------
create or replace function fn_products_fill_unit_code()
returns trigger language plpgsql as $$
begin
  if new.unit is not null and trim(new.unit) <> '' and (new.unit_code is null or (tg_op = 'UPDATE' and new.unit is distinct from old.unit)) then
    new.unit_code := fn_unit_code_for_text(new.unit);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_products_fill_unit_code on products;
create trigger trg_products_fill_unit_code before insert or update of unit on products
  for each row execute function fn_products_fill_unit_code();
