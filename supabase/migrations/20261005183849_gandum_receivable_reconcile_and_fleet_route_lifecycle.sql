-- Fleet route lifecycle schema, safe for existing rows.
alter table public.fuel_logs add column if not exists route_status text not null default 'closed';
alter table public.fuel_logs add column if not exists opening_meter_photo_url text;
alter table public.fuel_logs add column if not exists closing_meter_photo_url text;
alter table public.fuel_logs add column if not exists opening_reading_source text not null default 'manual';
alter table public.fuel_logs add column if not exists closing_reading_source text not null default 'manual';
alter table public.fuel_logs add column if not exists petrol_rate numeric(10,2);
alter table public.fuel_logs add column if not exists fuel_receipt_url text;
alter table public.fuel_logs add column if not exists work_description text;
alter table public.fuel_logs add column if not exists voice_note text;
alter table public.fuel_logs add column if not exists closed_at timestamptz;
create index if not exists fuel_logs_route_status_idx on public.fuel_logs(route_status, log_date);

-- Preserve procurement payment rows while linking each genuine receipt once.
alter table public.grain_procurement_payments
  add column if not exists reclassified_as_sale_payment_id uuid references public.grain_sale_payments(id);
create index if not exists idx_grain_procurement_payment_sale_reclass
  on public.grain_procurement_payments(reclassified_as_sale_payment_id);

do $$
declare
  v_canonical_sale uuid := '627e5e6d-db2f-40a5-b043-67e288475c3a'::uuid;
  v_duplicate_sale uuid := '1ea1bafd-0042-4ea8-80ae-abec15d05e8e'::uuid;
  v_payment record;
  v_sale_payment uuid;
  v_received numeric := 0;
  v_duplicate_amount numeric;
  v_duplicate_qty numeric;
begin
  if not exists (select 1 from public.grain_sales where id = v_canonical_sale)
     or not exists (select 1 from public.grain_sales where id = v_duplicate_sale) then
    raise exception 'Expected wheat sale rows were not found; no reconciliation applied';
  end if;

  for v_payment in
    select id, amount, payment_method, notes, created_by
    from public.grain_procurement_payments
    where id in (
      'cb32459d-9612-49d4-8cfe-64cea06ce669'::uuid,
      '2f2b2ee8-f196-4851-83cc-9966627af21d'::uuid
    )
      and reclassified_as_sale_payment_id is null
    order by created_at, id
  loop
    insert into public.grain_sale_payments
      (sale_id, amount, payment_method, notes, created_by)
    values
      (v_canonical_sale, v_payment.amount, v_payment.payment_method,
       concat('Reclassified from grain procurement payment ', v_payment.id, '. ',
              coalesce(v_payment.notes, '')), v_payment.created_by)
    returning id into v_sale_payment;

    update public.grain_procurement_payments
    set reclassified_as_sale_payment_id = v_sale_payment
    where id = v_payment.id;

    v_received := v_received + v_payment.amount;
  end loop;

  select coalesce(sum(amount), 0) into v_received
  from public.grain_sale_payments
  where sale_id = v_canonical_sale;

  update public.grain_sales
  set amount_received = v_received
  where id = v_canonical_sale;

  select total_amount, quantity_kg
    into v_duplicate_amount, v_duplicate_qty
  from public.grain_sales
  where id = v_duplicate_sale;

  update public.grain_sales
  set total_amount = 0,
      total_cogs = 0,
      profit = 0,
      quantity_kg = 0,
      amount_received = 0,
      notes = concat(
        '[VOID DUPLICATE RECONCILED 2026-10-05] Original amount Rs ',
        v_duplicate_amount, ', quantity kg ', v_duplicate_qty,
        '. Original record retained; canonical sale is GRN-SALE-26-00001. ',
        coalesce(notes, '')
      )
  where id = v_duplicate_sale
    and total_amount = v_duplicate_amount
    and quantity_kg = v_duplicate_qty
    and amount_received = 0;
end $$;
