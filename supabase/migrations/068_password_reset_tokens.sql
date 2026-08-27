-- =====================================================================
-- AgriBridge — Migration 068: Custom Password Reset Tokens
-- =====================================================================
-- Bypasses Supabase's own built-in reset-password email (unreliable
-- without confirmed Custom SMTP) - we generate our own token, email it
-- via job@alranatraders.pk (already proven working), and use
-- service-role to directly set the new password when redeemed.

create table if not exists password_reset_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table password_reset_tokens enable row level security;
create policy service_only_reset_tokens on password_reset_tokens for all using (false) with check (false);