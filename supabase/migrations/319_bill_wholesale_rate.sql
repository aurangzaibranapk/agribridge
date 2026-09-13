-- =====================================================================
-- AgriBridge — Migration 319: Bill se WHOLESALE rate bhi
-- =====================================================================
-- Malik ka kehna (5 September): *"is ke sath ek aur cheez add karein --
-- jab hum ye products add kar rahe hon, next page par in ke wholesale
-- rate update ki jagah honi chahiye."*
--
-- Ab tak bill se sirf KHARID ka rate charhta tha (`purchase_price`).
-- Wholesale rate ke liye banda ko har cheez alag se khol kar badalni
-- parti thi -- 14 qataron wale bill par 14 dafa. Wohi kaam jo koi nahi
-- karta, aur phir wholesale rate purana hi chalta rehta hai.
--
-- Ab wholesale rate usi qatar par likha ja sakta hai, aur bill charhte
-- waqt sath hi lag jata hai.
--
-- KHALI RAHNA JAYAZ HAI aur usi ka matlab hai "ye rate mat chhuo".
-- Sifar likhna alag baat hai (wo "muft" ka matlab deta hai) -- is liye
-- khali khana kuch nahi badalta, aur `fn_apply_bill_line_rate` us par
-- haath nahi lagata.
-- =====================================================================

alter table public.supplier_bill_lines
  add column if not exists wholesale_rate numeric(12,2);

comment on column public.supplier_bill_lines.wholesale_rate is
  'Is cheez ka wholesale rate. KHALI = mat badlo (sifar se alag baat -- sifar ka matlab muft hota hai).';

alter table public.supplier_bill_lines
  drop constraint if exists chk_bill_line_wholesale_positive;
alter table public.supplier_bill_lines
  add constraint chk_bill_line_wholesale_positive
  check (wholesale_rate is null or wholesale_rate > 0);

-- ---------------------------------------------------------------------
-- Charhane wala function: wholesale bhi, magar sirf jab likha ho
-- ---------------------------------------------------------------------
create or replace function public.fn_apply_bill_line_rate(p_line_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  v_rate := coalesce(v_line.applied_rate, v_line.rate);
  if v_rate is null then
    raise exception 'Is qatar ka rate khali hai -- bina rate ke kuch nahi charhta.';
  end if;

  select * into v_read from supplier_bill_reads where id = v_line.bill_read_id;

  select purchase_price, trade_rate_pending into v_old, v_pend
    from products where id = v_line.product_id for update;

  -- Wholesale sirf tab badalta hai jab qatar par likha ho. Khali khana
  -- kuch nahi badalta -- warna har bill purana wholesale rate mita deta.
  update products
     set purchase_price = v_rate,
         trade_rate_pending = false,
         wholesale_price = coalesce(v_line.wholesale_rate, wholesale_price),
         updated_at = now()
   where id = v_line.product_id;

  insert into product_trade_rate_history
    (product_id, old_rate, old_rate_was_pending, new_rate, source,
     bill_line_id, supplier_id, bill_number, bill_date, changed_by)
  values
    (v_line.product_id,
     case when coalesce(v_pend, false) then null else v_old end,
     coalesce(v_pend, false),
     v_rate, 'supplier_bill',
     v_line.id, v_read.supplier_id, v_read.bill_number, v_read.bill_date, auth.uid());

  update supplier_bill_lines
     set status = 'applied', applied_rate = v_rate, applied_at = now(), problem = null
   where id = p_line_id;

  return jsonb_build_object(
    'ok', true,
    'product_id', v_line.product_id,
    'rate', v_rate,
    'wholesale', v_line.wholesale_rate
  );
end;
$function$;
