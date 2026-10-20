-- 626 test ke liye support tickets ki chhoti nakal. Live table pehle se maujood hai.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no bigint generated always as identity,
  organization_id uuid not null,
  reporter_id uuid not null,
  assigned_to uuid,
  title text not null,
  description text not null,
  priority text not null default 'normal',
  status text not null default 'new',
  page_url text,
  device_info jsonb not null default '{}'::jsonb,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  department_id uuid,
  assigned_kind text,
  assigned_agent text,
  assignment_status text,
  assigned_at timestamptz
);

create table if not exists public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  organization_id uuid not null,
  actor_id uuid,
  event_type text not null,
  from_value text,
  to_value text,
  note text,
  created_at timestamptz not null default now()
);
