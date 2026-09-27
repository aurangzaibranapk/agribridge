-- Web Push subscriptions — har device ki apni entry
-- endpoint unique hai per browser+device, is liye primary key.

create table if not exists public.push_subscriptions (
  endpoint        text        primary key,
  user_id         uuid        references auth.users(id) on delete cascade,
  p256dh          text        not null,
  auth_key        text        not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- User apni subscriptions dekh sakta hai, dusron ki nahi
alter table public.push_subscriptions enable row level security;

create policy "user apni subscription manage kare"
  on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service role (server-side notification sending) ko poora access
create policy "service role sab dekhe"
  on public.push_subscriptions
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);
