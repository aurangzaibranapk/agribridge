-- "Supplier ko kitna dena hai" ka adad kabhi durust tha hi nahi.
--
-- suppliers.current_payable ek yaad kiya hua adad tha, aur us ka koi
-- malik nahi tha:
--
--   * Barhta KAHIN se nahi tha. Maal udhaar par aa jaye to bhi ye adad
--     wahin ka wahin rehta -- yani jo dena hai wo kabhi likha hi nahi
--     jata tha.
--
--   * Ghatta TEEN jagah se tha, teenon haath se:
--       src/actions/supplier-payments.ts
--       src/actions/supplier-payment-requests.ts   (approve par)
--       src/actions/company-expenses.ts            (supplier_payment wala kharcha)
--
--   * Har jagah Math.max(0, ...) laga tha. Ye ghalati ko theek nahi
--     karta -- chhupa deta hai. Adad manfi mein jane ke bajaye sifar par
--     ruk jata, aur us ke baad har adaigi ka koi asar hi na hota.
--
-- Yani wo adad jis par ye faisla hota hai ke kis supplier ko paisa
-- bhejna hai, wo kisi hisaab se nahi banta tha.
--
-- Ye wohi kharabi hai jo cash book (127) aur godam (129) mein thi, aur
-- hal bhi wohi hai: adad ka EK malik.
--
-- ---------------------------------------------------------------------
-- Asal hisaab
-- ---------------------------------------------------------------------
--   jo maal wusool ho chuka          (purchases, status = 'received')
--   minus jo adaigi ho chuki         (supplier_payments)
--   minus wo kharche jo supplier ko diye gaye
--                                    (company_expense_requests,
--                                     category = 'supplier_payment',
--                                     status = 'approved')
--
-- Teesri qatar is liye ke company-expenses.ts us raaste par
-- supplier_payments mein kuch nahi likhta -- sirf payable ghata deta
-- tha. Us raaste ko hisaab se bahar chhoR dena wohi purani ghalati
-- dohrana hota.
--
-- supplier_payment_requests ki alag ginti NAHI hoti: manzoori par wo
-- khud supplier_payments mein qatar daal deta hai. Dono ginne se ek hi
-- adaigi do dafa katti.

-- ---------------------------------------------------------------------
-- 1) Purana adad kahin likha reh jaye
-- ---------------------------------------------------------------------
create table if not exists supplier_payable_repairs (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid not null references suppliers(id),
  supplier_name text not null,
  purana_payable numeric(14,2) not null,
  naya_payable numeric(14,2) not null,
  farq numeric(14,2) not null,
  kharidari_ginti integer not null,
  adaigi_ginti integer not null,
  wajah text not null,
  repaired_at timestamptz not null default now()
);

comment on table supplier_payable_repairs is
  'Jab supplier ka yaad kiya hua "dena" asal hisaab se milaya gaya, farq yahan likha gaya -- taake wo adad gum na ho jo pehle screen par tha.';

-- ---------------------------------------------------------------------
-- 2) Asal hisaab -- ek hi jagah likha hua
-- ---------------------------------------------------------------------
create or replace function fn_supplier_true_payable(p_supplier_id uuid)
returns numeric
language sql
stable
as $$
  select round(
      coalesce((select sum(total_amount) from purchases
                 where supplier_id = p_supplier_id and status = 'received'), 0)
    - coalesce((select sum(amount) from supplier_payments
                 where supplier_id = p_supplier_id), 0)
    - coalesce((select sum(amount) from company_expense_requests
                 where supplier_id = p_supplier_id
                   and category = 'supplier_payment'
                   and status = 'approved'), 0)
  , 2);
$$;

-- ---------------------------------------------------------------------
-- 3) Purani kharabi ki marammat
-- ---------------------------------------------------------------------
do $$
declare
  r record;
  v_should numeric;
begin
  for r in select id, name, current_payable from suppliers loop
    v_should := fn_supplier_true_payable(r.id);

    if round(coalesce(r.current_payable, 0), 2) <> v_should then
      insert into supplier_payable_repairs (
        supplier_id, supplier_name, purana_payable, naya_payable, farq,
        kharidari_ginti, adaigi_ginti, wajah
      )
      values (
        r.id, r.name, coalesce(r.current_payable, 0), v_should,
        round(coalesce(r.current_payable, 0), 2) - v_should,
        (select count(*) from purchases where supplier_id = r.id and status = 'received'),
        (select count(*) from supplier_payments where supplier_id = r.id),
        'Migration 139: haath ki likhai ki marammat'
      );

      update suppliers set current_payable = v_should where id = r.id;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4) Ab adad khud chalta hai
-- ---------------------------------------------------------------------
-- Teenon tables par ek hi trigger. Kaun sa supplier hila, ye har table
-- mein supplier_id se milta hai -- purani aur nayi dono qatar dekhni
-- parti hain, kyunke qatar ek supplier se doosre par bhi ja sakti hai.
create or replace function fn_sync_supplier_payable()
returns trigger
language plpgsql
as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := old.supplier_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := new.supplier_id; end if;

  if v_new is not null then
    update suppliers set current_payable = fn_supplier_true_payable(v_new) where id = v_new;
  end if;
  if v_old is not null and v_old is distinct from v_new then
    update suppliers set current_payable = fn_supplier_true_payable(v_old) where id = v_old;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_supplier_payable_purchases on purchases;
create trigger trg_supplier_payable_purchases
  after insert or update or delete on purchases
  for each row execute function fn_sync_supplier_payable();

drop trigger if exists trg_supplier_payable_payments on supplier_payments;
create trigger trg_supplier_payable_payments
  after insert or update or delete on supplier_payments
  for each row execute function fn_sync_supplier_payable();

drop trigger if exists trg_supplier_payable_expenses on company_expense_requests;
create trigger trg_supplier_payable_expenses
  after insert or update or delete on company_expense_requests
  for each row execute function fn_sync_supplier_payable();

-- ---------------------------------------------------------------------
-- 5) Pehra: ab koi haath se nahi likh sakta
-- ---------------------------------------------------------------------
-- Rok is par hai ke KYA likha ja raha hai, na ke KAUN likh raha hai.
-- Trigger jo adad likhta hai wo asal hisaab ke barabar hota hai, is liye
-- wo bila rok guzar jata hai; koi aur adad rok diya jata hai.
create or replace function fn_guard_supplier_payable()
returns trigger
language plpgsql
as $$
declare
  v_should numeric(14,2);
begin
  if new.current_payable is distinct from old.current_payable then
    v_should := fn_supplier_true_payable(new.id);
    if round(coalesce(new.current_payable, 0), 2) <> v_should then
      raise exception
        'Supplier ka "dena" seedha nahi likha ja sakta. Wo khud kharidari aur adaigi se nikalta hai. Likha ja raha tha: %, asal hisaab: %. Adaigi darj karni ho to supplier_payments mein qatar daalein.',
        round(coalesce(new.current_payable, 0), 2), v_should;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_supplier_payable on suppliers;
create trigger trg_guard_supplier_payable
  before update on suppliers
  for each row execute function fn_guard_supplier_payable();

-- ---------------------------------------------------------------------
-- 6) Roz ki jaanch
-- ---------------------------------------------------------------------
create or replace view v_supplier_payable_check as
select
  s.id as supplier_id,
  s.name as supplier_name,
  s.current_payable as yaad_kiya_hua,
  fn_supplier_true_payable(s.id) as asal_hisaab,
  s.current_payable - fn_supplier_true_payable(s.id) as farq
from suppliers s
where fn_is_any_staff()
  and coalesce(s.current_payable, 0) <> fn_supplier_true_payable(s.id);

comment on view v_supplier_payable_check is
  'Khali honi chahiye. Koi qatar aaye to supplier ka yaad kiya hua "dena" asal hisaab se hat chuka hai.';

-- 138 wali seekh: create or replace ke baad grants haath se dene parte
-- hain, warna safha "permission denied" deta hai.
revoke all on public.v_supplier_payable_check from anon;
grant select on public.v_supplier_payable_check to authenticated, service_role;
