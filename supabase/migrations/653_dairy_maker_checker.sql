-- =====================================================================
-- 653: Maker-checker — apni entry khud manzoor nahi
-- =====================================================================
-- Owner bhi apni entry khud manzoor nahi karta. Maintenance par
-- branch verify aur aakhri manzoori do alag log hon.
-- NULL created_by (purani qatar) par check chup rehta hai, kyunki
-- NULL <> x unknown hota hai aur CHECK use rokta nahi.

alter table public.fuel_logs add column if not exists approved_by uuid;
alter table public.fuel_logs add column if not exists created_by uuid;
alter table public.fuel_logs drop constraint if exists chk_fuel_no_self_approval;
alter table public.fuel_logs add constraint chk_fuel_no_self_approval check (
  approved_by is null or created_by is null or approved_by <> created_by
);

alter table public.generator_logs add column if not exists approved_by uuid;
alter table public.generator_logs add column if not exists created_by uuid;
alter table public.generator_logs drop constraint if exists chk_generator_no_self_approval;
alter table public.generator_logs add constraint chk_generator_no_self_approval check (
  approved_by is null or created_by is null or approved_by <> created_by
);

alter table public.maintenance_logs add column if not exists approved_by uuid;
alter table public.maintenance_logs add column if not exists created_by uuid;
alter table public.maintenance_logs add column if not exists branch_verified_by uuid;

alter table public.maintenance_logs drop constraint if exists chk_maint_verifier_not_maker;
alter table public.maintenance_logs add constraint chk_maint_verifier_not_maker check (
  branch_verified_by is null or created_by is null or branch_verified_by <> created_by
);

alter table public.maintenance_logs drop constraint if exists chk_maint_approver_not_maker;
alter table public.maintenance_logs add constraint chk_maint_approver_not_maker check (
  approved_by is null or created_by is null or approved_by <> created_by
);

alter table public.maintenance_logs drop constraint if exists chk_maint_approver_not_verifier;
alter table public.maintenance_logs add constraint chk_maint_approver_not_verifier check (
  approved_by is null or branch_verified_by is null or approved_by <> branch_verified_by
);

comment on constraint chk_fuel_no_self_approval on public.fuel_logs is
  'Jis ne fuel likha wahi manzoor nahi kar sakta (653).';
comment on constraint chk_maint_approver_not_verifier on public.maintenance_logs is
  'Branch verify aur aakhri manzoori do alag log (653).';
