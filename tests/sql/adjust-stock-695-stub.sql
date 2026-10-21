-- Minimal stub of live objects used by fn_adjust_stock (695 test only).
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;
do $$ begin create role anon; exception when others then null; end $$;
do $$ begin create role authenticated; exception when others then null; end $$;
do $$ begin create role service_role; exception when others then null; end $$;
create type public.stock_movement_type as enum ('purchase_in','sale_out','transfer_in','transfer_out','adjustment_increase','adjustment_decrease','return_in','damaged_out','expired_out','loss_write_off');
create table public.profiles(id uuid primary key, role text, is_active boolean);
create table public.inventory(id uuid primary key default gen_random_uuid(), product_id uuid, warehouse_id uuid, batch_id uuid, shop_id uuid, bin_id uuid, quantity_on_hand numeric(14,3), updated_at timestamptz);
create table public.stock_movements(id uuid primary key default gen_random_uuid(), inventory_id uuid, movement_type public.stock_movement_type, quantity numeric, balance_after numeric, reference_type text, reference_id uuid, notes text, created_by uuid, created_at timestamptz default now(), client_action_id uuid unique, dedupe_key text);
create table public.stock_batches(id uuid primary key default gen_random_uuid(), product_id uuid, warehouse_id uuid, batch_number text, initial_quantity numeric, remaining_quantity numeric, unit_cost numeric);
create function public.fn_warehouse_in_scope(a uuid, w uuid) returns boolean language sql as $$ select true $$;
create function public.fn_consume_sellable_fifo(w uuid, p uuid, q numeric, e boolean, a uuid, rt text, rid uuid)
 returns table(batch_id uuid, taken numeric, unit_cost numeric) language sql as $$ select null::uuid, q, 4::numeric $$;
