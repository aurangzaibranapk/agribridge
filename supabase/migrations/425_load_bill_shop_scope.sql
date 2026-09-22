-- =====================================================================
-- AgriBridge — Migration 425: Load & Bill shop ke hisaab se
-- =====================================================================
-- Malik ka sawal (15 September): "load bill her shop k ana chaye sham
-- close krin pata chaly load sy kitni ammount bill sy kitni ammoun
-- udhar kitna dia naqad cash kitna shop ki sale kitni kis khata sy kis
-- card sy khan sy howi hy."
--
-- Jaanch se pata chala: `load_transactions.branch_id` bharta hai, magar
-- ek BRANCH mein kai SHOPS hoti hain (jaise "Main Branch" mein 4 shops --
-- Agri Inputs, Karyana, Grain, Vet Services). Branch ke hisaab se dekhna
-- kaafi nahi -- "is shop ka" sawal ka jawab hi nahi milta.
--
-- `load_accounts` ko ek shop se baandhna GHALAT hoga -- malik ka CBA
-- account jaan boojh kar HAR provider/shop ke liye saanjha hai (332).
-- Is liye shop khud account se nahi nikalta -- staff jis waqt qatar darj
-- karta hai, USI waqt batata hai ke wo kis shop mein baitha hai (jaise
-- POS mein counter khud staff chunta hai).
-- =====================================================================

alter table public.load_transactions
  add column if not exists shop_id uuid references public.shops(id);

create index if not exists idx_load_txn_shop on public.load_transactions (shop_id, created_at desc);

comment on column public.load_transactions.shop_id is
  'Staff ne qatar darj karte waqt jo shop batayi -- account se nahi nikalta (account ek se zyada shop ke liye saanjha ho sakta hai).';


-- ---------------------------------------------------------------------
-- Shop ka din -- Load, Bill aur POS sale ek nazar mein.
-- ---------------------------------------------------------------------
-- Roz shaam close karte waqt yehi sawal poochha jata hai: is shop se
-- load kitna gaya, bill kitna gaya, kitna naqad aaya, kitna udhaar par
-- gaya, aur shop ki poori sale kitni thi -- tareeqe ke hisaab se.
--
-- Waqt Asia/Karachi mein ginta hai, UTC mein nahi -- warna raat 12 se 5
-- baje ke darmiyan ka kaam pichhle din mein chala jata (yehi ghalti
-- `aajKaKhana()` ke comment mein khud likhi hui hai).
create or replace function public.fn_shop_day_summary(p_shop uuid, p_date date)
returns table (
  shop_name         text,
  load_principal    numeric,
  load_count        int,
  bill_principal    numeric,
  bill_count        int,
  lb_cash           numeric,
  lb_khata          numeric,
  lb_bank           numeric,
  lb_wallet         numeric,
  pos_sale_total    numeric,
  pos_khata_total   numeric,
  pos_sale_count    int,
  pos_cash          numeric,
  pos_bank_transfer numeric,
  pos_card          numeric,
  pos_jazzcash      numeric,
  pos_easypaisa     numeric,
  pos_qr            numeric,
  pos_waseela_card  numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not coalesce(fn_is_any_staff(), false) then
    raise exception 'Ye hisaab sirf staff dekh sakta hai.';
  end if;

  select s.name into shop_name from shops s where s.id = p_shop;

  select
    coalesce(sum(t.principal) filter (where t.kind = 'load'), 0),
    count(*) filter (where t.kind = 'load')::int,
    coalesce(sum(t.principal) filter (where t.kind = 'bill'), 0),
    count(*) filter (where t.kind = 'bill')::int,
    coalesce(sum(t.principal + coalesce(t.service_charge, 0)) filter (where t.payment_method = 'cash'), 0),
    coalesce(sum(t.principal + coalesce(t.service_charge, 0)) filter (where t.payment_method = 'khata'), 0),
    coalesce(sum(t.principal + coalesce(t.service_charge, 0)) filter (where t.payment_method = 'bank'), 0),
    coalesce(sum(t.principal + coalesce(t.service_charge, 0)) filter (where t.payment_method = 'wallet'), 0)
    into load_principal, load_count, bill_principal, bill_count, lb_cash, lb_khata, lb_bank, lb_wallet
  from load_transactions t
  where t.shop_id = p_shop
    and (t.created_at at time zone 'Asia/Karachi')::date = p_date
    and t.status in ('darj', 'saboot_baqi');

  select
    coalesce(sum(ps.total_amount), 0),
    coalesce(sum(ps.khata_amount), 0),
    count(*)::int
    into pos_sale_total, pos_khata_total, pos_sale_count
  from pos_sales ps
  where ps.shop_id = p_shop
    and (ps.created_at at time zone 'Asia/Karachi')::date = p_date;

  select
    coalesce(sum(d.amount) filter (where d.payment_method = 'cash'), 0),
    coalesce(sum(d.amount) filter (where d.payment_method = 'bank_transfer'), 0),
    coalesce(sum(d.amount) filter (where d.payment_method = 'card'), 0),
    coalesce(sum(d.amount) filter (where d.payment_method = 'jazzcash'), 0),
    coalesce(sum(d.amount) filter (where d.payment_method = 'easypaisa'), 0),
    coalesce(sum(d.amount) filter (where d.payment_method = 'qr'), 0),
    coalesce(sum(d.amount) filter (where d.payment_method = 'waseela_card'), 0)
    into pos_cash, pos_bank_transfer, pos_card, pos_jazzcash, pos_easypaisa, pos_qr, pos_waseela_card
  from pos_sale_payment_details d
  join pos_sales ps on ps.id = d.sale_id
  where ps.shop_id = p_shop
    and (ps.created_at at time zone 'Asia/Karachi')::date = p_date;

  return next;
end;
$$;

comment on function public.fn_shop_day_summary(uuid, date) is
  'Ek shop ka din -- Load/Bill (shop_id se) + POS sale (shop_id se), tareeqe ke hisaab se. Shaam ka band karne ke liye.';
