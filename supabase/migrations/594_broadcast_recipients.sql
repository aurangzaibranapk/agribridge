-- 594: Broadcast ke wusool kunindgan (submit par "freeze" shuda list). ADDITIVE ONLY.
-- Likhna sirf 599 ke SECURITY DEFINER RPCs / service worker se; app user seedha nahi likh sakta.
create table if not exists public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id),
  party_type text not null check (party_type in ('farmer','customer','staff','custom')),
  party_id uuid,
  name text,
  phone text not null check (phone ~ '^92[0-9]{10}$'),
  lang text not null default 'rm' check (lang in ('en','rm','ur')),
  vars jsonb not null default '{}'::jsonb,
  channel text not null check (channel in ('whatsapp','sms')),
  status text not null default 'queued' check (status in ('queued','skipped_optout','sent','delivered','read','failed')),
  provider text,
  provider_msg_id text,
  error text,
  fallback_of uuid references public.broadcast_recipients(id),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (broadcast_id, phone, channel)
);
create index if not exists broadcast_recipients_q_idx on public.broadcast_recipients (status, broadcast_id);
create index if not exists broadcast_recipients_msg_idx on public.broadcast_recipients (provider_msg_id);

alter table public.broadcast_recipients enable row level security;
drop policy if exists broadcast_recipients_read on public.broadcast_recipients;
create policy broadcast_recipients_read on public.broadcast_recipients for select to authenticated
  using (exists (select 1 from public.broadcasts b where b.id = broadcast_id and (b.created_by = auth.uid() or public.fn_broadcast_is_approver(auth.uid()))));
revoke all on public.broadcast_recipients from anon, authenticated;
grant select on public.broadcast_recipients to authenticated;
