-- Rollback 622. Pehle check: koi 'supplier_bill_udhaar' kharcha ya linked settlement to nahi?
--   select count(*) from company_expense_requests where kind='supplier_bill_udhaar';
--   select count(*) from party_settlements where party_link_id is not null;
-- Agar hain to pehle un ki ulti qatarein / backup lein; warna neeche ke qadam fail honge.
delete from public.dashboard_features where dashboard_key = 'admin' and feature_key = 'party-links';
delete from public.features where key = 'party-links';
drop function if exists public.fn_party_gl_lines(text, uuid, text[]);

alter table public.company_expense_requests drop constraint if exists company_expense_requests_kind_check;
alter table public.company_expense_requests add constraint company_expense_requests_kind_check check (kind = any (array[
  'kharcha','supplier_ko_diya','staff_ko_advance','kisan_ko_advance','mazdoor_ko_advance','mazdoori_ki_adaigi',
  'customer_se_wasooli','staff_se_wapas','kisan_se_wapas','aamdani','malik_ne_nikala','malik_ka_sarmaya'
]::text[]));

create or replace function public.fn_settlement_taala()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'approved' then
    if new.amount is distinct from old.amount
       or new.lena_khata is distinct from old.lena_khata
       or new.dena_khata is distinct from old.dena_khata
       or new.party_id is distinct from old.party_id
       or new.party_type is distinct from old.party_type then
      raise exception 'Ye adjustment manzoor ho kar kitab mein ja chuka hai. Ab badla nahi ja sakta — ulti qatar banayein.';
    end if;
  end if;
  return new;
end;
$$;

alter table public.party_settlements drop constraint if exists chk_settlement_linked_maker_checker;
alter table public.party_settlements drop constraint if exists chk_settlement_linked_shape;
alter table public.party_settlements drop column if exists party_link_id;
alter table public.party_settlements drop column if exists dena_party_id;
alter table public.party_settlements drop column if exists dena_party_type;

drop table if exists public.party_links;
