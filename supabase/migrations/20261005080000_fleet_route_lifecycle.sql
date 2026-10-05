-- Route lifecycle fields for the existing motorcycle fuel ledger.
-- Existing rows remain valid and are treated as closed legacy logs.
alter table fuel_logs add column if not exists route_status text not null default 'closed';
alter table fuel_logs add column if not exists opening_meter_photo_url text;
alter table fuel_logs add column if not exists closing_meter_photo_url text;
alter table fuel_logs add column if not exists opening_reading_source text not null default 'manual';
alter table fuel_logs add column if not exists closing_reading_source text not null default 'manual';
alter table fuel_logs add column if not exists petrol_rate numeric(10,2);
alter table fuel_logs add column if not exists fuel_receipt_url text;
alter table fuel_logs add column if not exists work_description text;
alter table fuel_logs add column if not exists voice_note text;
alter table fuel_logs add column if not exists closed_at timestamptz;

create index if not exists fuel_logs_route_status_idx on fuel_logs(route_status, log_date);
