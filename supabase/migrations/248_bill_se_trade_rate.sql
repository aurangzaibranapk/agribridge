-- =====================================================================
-- AgriBridge — Migration 248: Supplier ke bill se trade rate
-- =====================================================================
-- Migration 241 ne "trade rate abhi maloom nahi" ka khana banaya tha.
-- Ye us sawal ka jawab hai: rate aata kahan se hai.
--
-- Dabbe par trade rate LIKHA HI NAHI hota. Dabbe par MRP hoti hai --
-- wo qeemat jis par gahak ko bechna hai. Jis rate par maal hamein
-- mila, wo sirf ek jagah likha hota hai: supplier ke bill par.
--
-- Is liye ye reader dabbe wale reader (intake-extraction-client) se
-- ALAG hai, aur us bill reader se bhi alag hai jo kul raqam parhta hai
-- (bill-cash-photo-client). Wo kehta hai "kul 84,300 rupay". Yahan
-- kaam ek ek qatar ka hai -- kaun si cheez, kitni, kis rate par.
--
-- ---------------------------------------------------------------------
-- Rate seedha products par kyun nahi charhta
-- ---------------------------------------------------------------------
-- Kyunke bill par "SUFI 5LTR" likha hota hai, aur hamare paas product
-- ka naam "Sufi Cooking Oil 5 Litre" hai. Ye dono ek hi cheez hain --
-- magar ye faisla AI ka nahi, bande ka hai.
--
-- Agar AI ka mila hua naam seedha products.purchase_price par charh
-- jaye, to ek ghalat milaan chup chaap ghalat lagat bana deta hai, aur
-- us ka pata mahine baad munafe ke adad se chalta hai -- jab tak bees
-- bill aur charh chuke hote hain.
--
-- Is liye do qadam: pehle bill ki qatarein mehfooz hoti hain, banda
-- har qatar ke saamne product chunta (ya theek karta) hai, phir "lagao"
-- dabta hai. Aur jo qatar mili hi nahi, wo khali rehti hai -- sifar
-- nahi.
--
-- ---------------------------------------------------------------------
-- Purana rate mitta nahi
-- ---------------------------------------------------------------------
-- purchase_price ek hi khana hai; naya rate charhte hi purana khatam
-- ho jata hai. Magar sawal banta hai: "ye cheez pehle 240 ki aati thi,
-- ab 310 ki kyun hai?" -- aur us ka jawab sirf tab milta hai jab har
-- tabdeeli ka indraj ho, us bill ke hawale ke sath.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Bill ki photo aur us ka parha hua
-- ---------------------------------------------------------------------
create table if not exists supplier_bill_reads (
  id uuid primary key default uuid_generate_v4(),

  supplier_id uuid references suppliers(id),
  -- Bill par jo naam likha tha, jyun ka tyun. Supplier record se mila
  -- ya na mila -- likha hua naam phir bhi rehta hai.
  supplier_name_raw text,

  image_url text not null,
  bill_number text,
  bill_date date,

  -- AI ne bill ke neeche jo kul raqam parhi. Qataron ke jorh se milan
  -- karne ke liye -- agar farq hai to koi qatar chhoot gayi hai.
  bill_total numeric(12,2),

  status text not null default 'draft',
  notes text,

  ai_raw jsonb,
  ai_read_at timestamptz,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_by uuid references profiles(id),

  constraint chk_bill_read_status
    check (status in ('draft', 'applied', 'discarded')),
  constraint chk_bill_read_applied
    check (status <> 'applied' or (applied_at is not null and applied_by is not null))
);

create index if not exists idx_bill_reads_status
  on supplier_bill_reads (status, created_at desc);
create index if not exists idx_bill_reads_supplier
  on supplier_bill_reads (supplier_id, bill_date desc);

-- ---------------------------------------------------------------------
-- 2) Bill ki ek ek qatar
-- ---------------------------------------------------------------------
create table if not exists supplier_bill_lines (
  id uuid primary key default uuid_generate_v4(),
  bill_read_id uuid not null references supplier_bill_reads(id) on delete cascade,

  line_no integer,
  -- Qatar jaisi bill par likhi thi. Ye kabhi nahi badalti -- baad mein
  -- "AI ne kya parha tha" ka jawab isi se milta hai.
  raw_text text,

  item_name text,
  pack_size text,
  qty numeric(14,3),
  -- Ek adad ka trade rate. NULL = bill par saaf nahi tha. Sifar nahi.
  rate numeric(12,2),
  line_total numeric(12,2),

  product_id uuid references products(id),
  -- Product kaise mila. 'barcode' sab se pukhta, 'chosen' bande ne khud
  -- chuna, 'auto_name' naam se apne aap mila (jaanch lein).
  match_source text,

  status text not null default 'draft',
  problem text,

  -- Jo rate waqai charha (bande ne badla ho to wo).
  applied_rate numeric(12,2),
  applied_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_bill_line_status
    check (status in ('draft', 'ready', 'applied', 'skipped')),
  constraint chk_bill_line_match_source
    check (match_source is null or match_source in ('barcode', 'auto_name', 'chosen')),
  constraint chk_bill_line_match_has_product
    check (product_id is null or match_source is not null),
  constraint chk_bill_line_qty check (qty is null or qty >= 0),
  constraint chk_bill_line_rate check (rate is null or rate >= 0),
  -- "Ready" ka matlab: ye qatar charhne layak hai. Bina product aur
  -- bina rate ke wo dawa jhooti hai.
  constraint chk_bill_line_ready_needs_both
    check (status <> 'ready' or (product_id is not null and rate is not null)),
  constraint chk_bill_line_applied
    check (status <> 'applied' or (product_id is not null and applied_rate is not null and applied_at is not null))
);

create index if not exists idx_bill_lines_read
  on supplier_bill_lines (bill_read_id, line_no);
create index if not exists idx_bill_lines_status
  on supplier_bill_lines (bill_read_id, status);
create index if not exists idx_bill_lines_product
  on supplier_bill_lines (product_id, applied_at desc);

-- Ek bill mein ek product do dafa charhne se rate do dafa badalta hai
-- aur aakhri jeet jata hai -- bina kisi ke jaane. Wo rok yahin lagti
-- hai. (Skipped qatarein is se bahar hain.)
create unique index if not exists idx_bill_line_product_once
  on supplier_bill_lines (bill_read_id, product_id)
  where product_id is not null and status <> 'skipped';

drop trigger if exists trg_bill_line_touch on supplier_bill_lines;
create trigger trg_bill_line_touch
  before update on supplier_bill_lines
  for each row execute function fn_intake_touch();

-- ---------------------------------------------------------------------
-- 3) Rate ki tabdeeli ka indraj
-- ---------------------------------------------------------------------
-- Sirf bill wale raaste ke liye nahi -- jahan se bhi trade rate badle,
-- yahan likha ja sakta hai. Abhi bill wala raasta likhta hai.
create table if not exists product_trade_rate_history (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,

  -- Purana rate NULL bhi ho sakta hai: jab pehli dafa charh raha ho
  -- aur pehle "maloom nahi" tha. Wahan sifar likhna jhoot hoga.
  old_rate numeric(12,2),
  old_rate_was_pending boolean not null default false,
  new_rate numeric(12,2) not null,

  source text not null default 'manual',
  bill_line_id uuid references supplier_bill_lines(id) on delete set null,
  supplier_id uuid references suppliers(id),
  bill_number text,
  bill_date date,

  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),

  constraint chk_rate_hist_source
    check (source in ('manual', 'supplier_bill', 'intake', 'import')),
  constraint chk_rate_hist_new check (new_rate >= 0)
);

create index if not exists idx_rate_hist_product
  on product_trade_rate_history (product_id, changed_at desc);

comment on table product_trade_rate_history is
  'Trade rate kab, kis se, kitna se kitna hua -- us bill ke hawale ke sath. Purana rate NULL = pehle maloom hi nahi tha (248).';

-- ---------------------------------------------------------------------
-- 4) Rate charhane ka ek hi darwaza
-- ---------------------------------------------------------------------
-- Ye SECURITY DEFINER hai magar khud sawal poochta hai ke bulane wala
-- kaun hai. Wajah: rate charhana teen kaam ek sath hai -- product par
-- rate likhna, "abhi maloom nahi" ka nishan hatana, aur indraj karna.
-- Teenon alag alag hone se ek raat wo haalat ban sakti hai jahan rate
-- charh gaya magar indraj nahi hua, ya nishan laga rah gaya.
create or replace function fn_apply_bill_line_rate(p_line_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line   supplier_bill_lines%rowtype;
  v_read   supplier_bill_reads%rowtype;
  v_old    numeric(12,2);
  v_pend   boolean;
  v_rate   numeric(12,2);
begin
  if not exists (
    select 1 from profiles p
     where p.id = auth.uid() and p.is_active
       and p.role::text in ('owner','super_admin','admin','warehouse')
  ) then
    raise exception 'Rate charhana sirf Owner, Admin ya Warehouse wale ka kaam hai.';
  end if;

  select * into v_line from supplier_bill_lines where id = p_line_id;
  if not found then
    raise exception 'Qatar nahi mili.';
  end if;
  if v_line.status = 'applied' then
    return jsonb_build_object('ok', false, 'reason', 'pehle_charh_chuki');
  end if;
  if v_line.product_id is null then
    raise exception 'Is qatar ka product nahi chuna gaya.';
  end if;

  -- Bande ne rate badla ho to wohi chalta hai; warna bill wala.
  v_rate := coalesce(v_line.applied_rate, v_line.rate);
  if v_rate is null then
    raise exception 'Is qatar ka rate khali hai -- bina rate ke kuch nahi charhta.';
  end if;

  select * into v_read from supplier_bill_reads where id = v_line.bill_read_id;

  select purchase_price, trade_rate_pending into v_old, v_pend
    from products where id = v_line.product_id for update;

  update products
     set purchase_price = v_rate,
         trade_rate_pending = false,
         updated_at = now()
   where id = v_line.product_id;

  insert into product_trade_rate_history
    (product_id, old_rate, old_rate_was_pending, new_rate, source,
     bill_line_id, supplier_id, bill_number, bill_date, changed_by)
  values
    (v_line.product_id,
     -- Nishan laga tha to purana rate "maloom nahi" tha -- us jagah
     -- purana adad likhna jhoot hoga.
     case when coalesce(v_pend, false) then null else v_old end,
     coalesce(v_pend, false),
     v_rate, 'supplier_bill',
     v_line.id, v_read.supplier_id, v_read.bill_number, v_read.bill_date, auth.uid());

  update supplier_bill_lines
     set status = 'applied', applied_rate = v_rate, applied_at = now(), problem = null
   where id = p_line_id;

  return jsonb_build_object('ok', true, 'product_id', v_line.product_id, 'rate', v_rate);
end;
$$;

revoke all on function fn_apply_bill_line_rate(uuid) from public;
grant execute on function fn_apply_bill_line_rate(uuid) to authenticated;

comment on function fn_apply_bill_line_rate is
  'Bill ki ek qatar ka rate product par charhata hai: rate, nishan aur indraj -- teenon ek sath ya koi nahi (248).';

-- ---------------------------------------------------------------------
-- 5) Kaam ki fehristein
-- ---------------------------------------------------------------------
create or replace view v_bill_lines_baqi as
select
  l.id,
  l.bill_read_id,
  r.bill_number,
  r.bill_date,
  r.supplier_name_raw,
  s.name as supplier_name,
  l.line_no,
  l.raw_text,
  l.item_name,
  l.pack_size,
  l.qty,
  l.rate,
  l.product_id,
  l.match_source,
  l.status,
  l.problem
from supplier_bill_lines l
join supplier_bill_reads r on r.id = l.bill_read_id
left join suppliers s on s.id = r.supplier_id
where l.status in ('draft', 'ready')
  and r.status = 'draft';

comment on view v_bill_lines_baqi is
  'Bill ki wo qatarein jin ka rate abhi charhna baqi hai (248).';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table supplier_bill_reads enable row level security;
alter table supplier_bill_lines enable row level security;
alter table product_trade_rate_history enable row level security;

do $$
declare t text;
begin
  foreach t in array array['supplier_bill_reads', 'supplier_bill_lines'] loop
    execute format('drop policy if exists billrate_read_%s on public.%I', t, t);
    execute format(
      'create policy billrate_read_%s on public.%I for select to authenticated using (public.fn_is_any_staff())', t, t);

    execute format('drop policy if exists billrate_write_%s on public.%I', t, t);
    execute format($p$
      create policy billrate_write_%s on public.%I for all to authenticated
      using (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.is_active
                       and p.role::text in ('owner','super_admin','admin','warehouse')))
      with check (exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.is_active
                       and p.role::text in ('owner','super_admin','admin','warehouse')))
    $p$, t, t);
  end loop;
end;
$$;

-- Indraj sab staff parh sakte hain; likhta sirf wo function hai jo
-- SECURITY DEFINER se chalta hai. Haath se qatar daalne ka raasta
-- jaan boojh kar nahi rakha -- warna indraj par bharosa khatam.
drop policy if exists rate_hist_read on public.product_trade_rate_history;
create policy rate_hist_read on public.product_trade_rate_history
  for select to authenticated using (public.fn_is_any_staff());

comment on table supplier_bill_reads is
  'Supplier ke bill ki photo aur us ka parha hua. Rate yahin se products par charhta hai (248).';
comment on table supplier_bill_lines is
  'Bill ki ek ek qatar. product_id bande ke chunne se bharta hai, AI ke kehne se nahi (248).';
