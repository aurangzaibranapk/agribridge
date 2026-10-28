-- 697: Branch (shop) ke liye 30 din wali udhaar rok se waqti chhoot (owner/admin).
-- Additive: naya table. Purani rok, limit ya baqaya nahi badalta.
create table if not exists public.branch_credit_exemptions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  reason text not null check (length(trim(reason)) >= 3),
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  approved_by uuid,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  constraint branch_credit_exemptions_window check (valid_until > valid_from),
  constraint branch_credit_exemptions_max_90d check (valid_until <= valid_from + interval '90 days')
);
create index if not exists idx_branch_credit_exemptions_branch
  on public.branch_credit_exemptions(branch_id, valid_until) where revoked_at is null;

alter table public.branch_credit_exemptions enable row level security;
drop policy if exists "Owner/Admin can view branch_credit_exemptions" on public.branch_credit_exemptions;
create policy "Owner/Admin can view branch_credit_exemptions" on public.branch_credit_exemptions
  for select using (fn_has_dept(array['owner','super_admin','admin']::public.user_role[]));
-- Likhna sirf server (service_role) se, role check server action mein.
revoke all on public.branch_credit_exemptions from anon;
revoke insert, update, delete on public.branch_credit_exemptions from authenticated;
grant all on public.branch_credit_exemptions to service_role;
