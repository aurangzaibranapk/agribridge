-- =====================================================================
-- Migration 110: Godam ka maal gin kar hisaab se milana
-- =====================================================================
-- Cash ke liye ye kaam 108 mein ho chuka: roz raat ko gin kar hisaab se
-- milana. Maal ke sath bhi bilkul wahi masla hai, aur wo cash se BARA
-- hai -- kyunki maal chupke se nikalna cash se aasan hai. Rs 50,000
-- ghayab hon to raat ko pakre jate hain; paanch bori khaad ghayab ho to
-- kisi ko pata nahi chalta, kyunki koi ginta hi nahi.
--
-- Ek baat is poore amal ki jaan hai, aur wo hai ANDHI GINTI:
--
--     Ginne wale ko ye NAZAR NAHI AANA CHAHIYE ke system kya kehta hai.
--
-- Wajah saaf hai. Agar screen par likha ho "42 bori honi chahiyen", to
-- ginne wala 40 gin kar bhi 42 likh dega -- kabhi be-imani se, aksar is
-- liye ke "shayad maine ghalat gina hoga, system to theek hi hoga". Ye
-- ghalti neyat ki nahi, insani hai; aur is ka ilaj bharosa nahi, tarteeb
-- hai. Adad chhupa dein to ginti asal mein ginti banti hai.
--
-- Is liye amal do hisson mein hai:
--
--   1. GINTI  -- system ka adad us waqt mahfooz ho jata hai (taake baad
--      mein badal na sake), magar screen par nahi aata. Ginne wala sirf
--      maal ka naam dekhta hai aur apna gina hua adad likhta hai.
--
--   2. MILAAN -- ab dono adad saamne aate hain. Jahan farq ho, wahan
--      wajah likhni parti hai. Us ke baad hi ginti mukammal hoti hai
--      aur nuqsan khate mein jata hai.

-- ---------------------------------------------------------------
-- 1) Ginti ka sarnama
-- ---------------------------------------------------------------
create table if not exists stock_counts (
  id uuid primary key default uuid_generate_v4(),
  warehouse_id uuid not null references warehouses(id),
  count_date date not null default current_date,

  -- 'counting' -- adad mahfooz ho gaye, ginti jari hai
  -- 'posted'   -- milaan ho gaya, nuqsan khate mein chala gaya
  status text not null default 'counting',

  started_by uuid not null references profiles(id),
  started_at timestamptz not null default now(),
  posted_by uuid references profiles(id),
  posted_at timestamptz,

  total_difference_value numeric(14,2),
  journal_entry_id uuid references journal_entries(id),
  notes text,
  created_at timestamptz not null default now()
);

alter table stock_counts drop constraint if exists chk_stock_count_status;
alter table stock_counts add constraint chk_stock_count_status
  check (status in ('counting', 'posted'));

-- Ek godam mein ek waqt mein ek hi ginti khuli reh sakti hai. Do khuli
-- hon to jis mein farq nikle wo chhor kar doosri mukammal kar di jayegi.
create unique index if not exists idx_stock_count_one_open
  on stock_counts(warehouse_id) where status = 'counting';

create index if not exists idx_stock_count_date on stock_counts(count_date desc);

-- ---------------------------------------------------------------
-- 2) Ginti ki qataren
-- ---------------------------------------------------------------
create table if not exists stock_count_lines (
  id uuid primary key default uuid_generate_v4(),
  count_id uuid not null references stock_counts(id) on delete cascade,
  product_id uuid not null references products(id),
  inventory_id uuid references inventory(id),

  -- Ginti shuru hote hi mahfooz. Baad mein bikri ya kharid se inventory
  -- badalti rahegi, magar ye adad wahi rahega jo ginti ke waqt tha --
  -- warna farq us cheez ka nikle ga jo ginti ke DAURAN hui, aur us ka
  -- ilzam ginne wale par aayega.
  expected_qty numeric(14,3) not null,

  counted_qty numeric(14,3),
  difference_qty numeric(14,3),

  -- Qeemat bhi usi waqt mahfooz. Kal rate badla to purani ginti ka
  -- nuqsan bhi badal jata -- yani guzra hua hisaab khud ba khud badalta
  -- rehta, jo sab se mushkil qism ki ghalti hai kyunki koi us ko chhota
  -- bhi nahi.
  unit_cost numeric(14,2) not null default 0,
  difference_value numeric(14,2),

  reason varchar(255)
);

create index if not exists idx_stock_count_lines_count on stock_count_lines(count_id);

alter table stock_count_lines drop constraint if exists chk_scl_difference;
alter table stock_count_lines add constraint chk_scl_difference
  check (
    counted_qty is null
    or difference_qty = counted_qty - expected_qty
  );

alter table stock_count_lines drop constraint if exists chk_scl_counted;
alter table stock_count_lines add constraint chk_scl_counted
  check (counted_qty is null or counted_qty >= 0);

-- Farq ho to wajah lazmi -- bilkul cash ki tarah. "Shayad kam aayi thi"
-- likhna bhi kaafi hai; kuch na likhna kaafi nahi.
--
-- Magar ye rok QATAR par nahi lagti, MUKAMMAL karne par lagti hai
-- (neeche fn_stock_count_guard mein). Wajah ye hai ke ginti ke dauran
-- ginne wale ko farq nazar hi nahi aata -- us waqt wajah maangna aisi
-- cheez maangna hai jo us ke paas ho hi nahi sakti, aur us ka anjaam ye
-- hota hai ke koi jhooti wajah bhar di jati hai. Jhooti wajah, wajah na
-- hone se buri hai.

-- ---------------------------------------------------------------
-- 3) Mukammal ginti badalti nahi
-- ---------------------------------------------------------------
create or replace function fn_stock_count_guard()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_missing int;
begin
  if tg_op = 'DELETE' then
    raise exception 'Ginti ka record mitaya nahi ja sakta.';
  end if;

  if tg_table_name = 'stock_counts' then
    if old.status = 'posted' then
      raise exception 'Ye ginti mukammal ho chuki hai. Dobara ginna hai to nayi ginti shuru karein.';
    end if;
    -- Mahfooz shuda adad ka sarnama bhi na badle.
    if new.warehouse_id is distinct from old.warehouse_id
       or new.started_by is distinct from old.started_by then
      raise exception 'Ginti ka godam ya ginne wala badla nahi ja sakta.';
    end if;

    -- Mukammal hote waqt: koi qatar bin gini na reh jaye, aur har farq
    -- wali qatar par wajah maujood ho.
    if new.status = 'posted' then
      select count(*) into v_missing from stock_count_lines
      where count_id = new.id and counted_qty is null;
      if v_missing > 0 then
        raise exception 'Ginti mukammal nahi ho sakti: % cheezen abhi gini nahi gayin.', v_missing;
      end if;

      select count(*) into v_missing from stock_count_lines
      where count_id = new.id
        and coalesce(difference_qty, 0) <> 0
        and (reason is null or length(btrim(reason)) < 5);
      if v_missing > 0 then
        raise exception 'Ginti mukammal nahi ho sakti: % qataron ka farq bina wajah ke hai.', v_missing;
      end if;
    end if;

    return new;
  end if;

  select status into v_status from stock_counts where id = new.count_id;
  if v_status = 'posted' then
    raise exception 'Ye ginti mukammal ho chuki hai, ab qataren badli nahi ja saktin.';
  end if;

  -- Ye wohi adad hai jise chhupaya gaya tha. Badalne ki ijazat de dein
  -- to andhi ginti ka koi faida nahi rehta: farq nikalne par expected ko
  -- counted ke barabar kar diya jayega.
  if new.expected_qty is distinct from old.expected_qty
     or new.unit_cost is distinct from old.unit_cost then
    raise exception 'System ka mahfooz shuda adad badla nahi ja sakta.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stock_count_guard on stock_counts;
create trigger trg_stock_count_guard
  before update or delete on stock_counts
  for each row execute function fn_stock_count_guard();

drop trigger if exists trg_stock_count_lines_guard on stock_count_lines;
create trigger trg_stock_count_lines_guard
  before update or delete on stock_count_lines
  for each row execute function fn_stock_count_guard();

-- ---------------------------------------------------------------
-- 4) Jin godamon ki ginti bohat arse se nahi hui
-- ---------------------------------------------------------------
create or replace view v_stock_count_overdue
with (security_invoker = true) as
  select
    w.id as warehouse_id,
    w.name as warehouse_name,
    max(sc.posted_at) as aakhri_ginti,
    case
      when max(sc.posted_at) is null then 9999
      else (current_date - max(sc.posted_at)::date)
    end as din_guzray
  from warehouses w
  left join stock_counts sc on sc.warehouse_id = w.id and sc.status = 'posted'
  where w.is_active
  group by w.id, w.name
  having max(sc.posted_at) is null
      or (current_date - max(sc.posted_at)::date) > 30;

-- ---------------------------------------------------------------
-- 5) RLS
-- ---------------------------------------------------------------
alter table stock_counts enable row level security;
alter table stock_count_lines enable row level security;

drop policy if exists staff_read_stock_counts on stock_counts;
create policy staff_read_stock_counts on stock_counts for select using (fn_is_any_staff());
drop policy if exists staff_write_stock_counts on stock_counts;
create policy staff_write_stock_counts on stock_counts for insert with check (fn_is_any_staff());
drop policy if exists staff_update_stock_counts on stock_counts;
create policy staff_update_stock_counts on stock_counts for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

drop policy if exists staff_read_stock_count_lines on stock_count_lines;
create policy staff_read_stock_count_lines on stock_count_lines for select using (fn_is_any_staff());
drop policy if exists staff_write_stock_count_lines on stock_count_lines;
create policy staff_write_stock_count_lines on stock_count_lines for insert with check (fn_is_any_staff());
drop policy if exists staff_update_stock_count_lines on stock_count_lines;
create policy staff_update_stock_count_lines on stock_count_lines for update
  using (fn_is_any_staff()) with check (fn_is_any_staff());

-- ---------------------------------------------------------------
-- 6) Safha
-- ---------------------------------------------------------------
insert into features (key, label, route, icon, is_sensitive) values
('stock-count', 'Maal ki Ginti', '/admin/stock-count', 'PackageSearch', true)
on conflict (key) do update set
  label = excluded.label, route = excluded.route, is_sensitive = excluded.is_sensitive;

insert into dashboard_features (dashboard_key, feature_key, sort_order) values
('master', 'stock-count', 6),
('finance', 'stock-count', 5),
('admin', 'stock-count', 18)
on conflict do nothing;

-- Godam wala ginta hai. Manager aur finance dekh sakte hain aur milaan
-- kar sakte hain -- magar ginne wala aur milaan karne wala alag hon to
-- behtar hai, isi liye warehouse ko sirf ginti ka haq hai.
insert into role_feature_permissions (role, feature_key, actions, data_scope) values
('warehouse', 'stock-count', array['view','create']::text[], 'own_branch'),
('manager', 'stock-count', array['view','create','approve']::text[], 'own_branch'),
('finance', 'stock-count', array['view','approve','export']::text[], 'all')
on conflict (role, feature_key) do update set
  actions = excluded.actions, data_scope = excluded.data_scope;
