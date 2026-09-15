-- =====================================================================
-- AgriBridge — Migration 387: Bill se MRP (khata) rate bhi
-- =====================================================================
-- Malik ka kehna (10 September): "yahan par MRP rate ya khata rate set
-- karna hai, udhar wale bande ko MRP rate lage" -- trade/wholesale/sale
-- (382) ki tarah, MRP bhi isi qatar se lag jaye. `products.mrp_price`
-- pehle se maujood hai (product form, POS par reference ke tor par
-- dikhta hai) -- ye sirf us tak Bill Rates se rasta deta hai.
--
-- KHALI RAHNA jayaz hai, wholesale/sale ka wahi qaida yahan bhi.
-- =====================================================================

alter table public.supplier_bill_lines
  add column if not exists mrp_rate numeric(12,2);

comment on column public.supplier_bill_lines.mrp_rate is
  'Udhar (khata) par bechne ka rate -- products.mrp_price mein jata hai. KHALI = mat badlo.';

alter table public.supplier_bill_lines
  drop constraint if exists chk_bill_line_mrp_positive;
alter table public.supplier_bill_lines
  add constraint chk_bill_line_mrp_positive
  check (mrp_rate is null or mrp_rate > 0);

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

  -- Wholesale, sale aur MRP sirf tab badalte hain jab qatar par likhe
  -- hon. Khali khana kuch nahi badalta -- warna har bill purana rate
  -- mita deta.
  update products
     set purchase_price = v_rate,
         trade_rate_pending = false,
         wholesale_price = coalesce(v_line.wholesale_rate, wholesale_price),
         selling_price = coalesce(v_line.sale_rate, selling_price),
         mrp_price = coalesce(v_line.mrp_rate, mrp_price),
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
    'wholesale', v_line.wholesale_rate,
    'sale', v_line.sale_rate,
    'mrp', v_line.mrp_rate
  );
end;
$function$;
