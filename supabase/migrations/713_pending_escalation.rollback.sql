-- 698 rollback. Sirf is migration ki nayi cheezen.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'agribridge_pending_escalation';
  end if;
exception when others then
  null;
end $$;

-- POS review wapas 528 wale guard par, agar function abhi maujood ho.
do $$
begin
  if to_regclass('public.pos_returns') is not null then
    execute 'drop trigger if exists trg_shared_approval_guard on public.pos_returns';
    execute $fn$
      create or replace function public.fn_pos_return_review_guard()
      returns trigger language plpgsql as $body$
      begin
        if new.admin_review_status is distinct from old.admin_review_status then
          if old.admin_review_status <> 'pending' then
            raise exception 'Is wapsi ka review ho chuka hai.';
          end if;
          if new.admin_reviewed_by is null
             or new.admin_reviewed_by = old.created_by
             or new.admin_reviewed_by = old.authorized_by then
            raise exception 'Wapsi ka review doosra Owner/Admin kare.';
          end if;
          if not exists (select 1 from public.profiles p where p.id = new.admin_reviewed_by
                         and p.role::text in ('owner', 'admin', 'super_admin') and p.is_active) then
            raise exception 'POS wapsi ka review sirf Owner/Admin kar sakta hai.';
          end if;
        end if;
        return new;
      end $body$;
    $fn$;
    execute 'drop trigger if exists trg_pos_return_review_guard on public.pos_returns';
    execute 'create trigger trg_pos_return_review_guard before update on public.pos_returns for each row execute function public.fn_pos_return_review_guard()';
  end if;
  if to_regclass('public.fuel_logs') is not null then
    execute 'drop trigger if exists trg_shared_approval_guard on public.fuel_logs';
    execute 'alter table public.fuel_logs drop constraint if exists chk_fuel_no_self_approval';
    execute 'alter table public.fuel_logs add constraint chk_fuel_no_self_approval check (approved_by is null or created_by is null or approved_by <> created_by)';
  end if;
  if to_regclass('public.generator_logs') is not null then
    execute 'drop trigger if exists trg_shared_approval_guard on public.generator_logs';
    execute 'alter table public.generator_logs drop constraint if exists chk_generator_no_self_approval';
    execute 'alter table public.generator_logs add constraint chk_generator_no_self_approval check (approved_by is null or created_by is null or approved_by <> created_by)';
  end if;
  if to_regclass('public.maintenance_logs') is not null then
    execute 'drop trigger if exists trg_shared_approval_guard on public.maintenance_logs';
    execute 'alter table public.maintenance_logs drop constraint if exists chk_maint_verifier_not_maker';
    execute 'alter table public.maintenance_logs drop constraint if exists chk_maint_approver_not_maker';
    execute 'alter table public.maintenance_logs drop constraint if exists chk_maint_approver_not_verifier';
    execute 'alter table public.maintenance_logs add constraint chk_maint_verifier_not_maker check (branch_verified_by is null or created_by is null or branch_verified_by <> created_by)';
    execute 'alter table public.maintenance_logs add constraint chk_maint_approver_not_maker check (approved_by is null or created_by is null or approved_by <> created_by)';
    execute 'alter table public.maintenance_logs add constraint chk_maint_approver_not_verifier check (approved_by is null or branch_verified_by is null or approved_by <> branch_verified_by)';
  end if;
end $$;

drop function if exists public.fn_install_shared_approval_guards();
drop function if exists public.fn_shared_approval_row_guard();
drop function if exists public.fn_actor_may_decide(uuid, uuid, uuid);
drop function if exists public.fn_pending_escalate();
drop function if exists public.fn_pending_log_self_decision(text, text, text);
drop function if exists public.fn_pending_delay_note(text, text, text);
drop function if exists public.fn_pending_escalation_set_sla(text, int);
drop function if exists public.fn_may_decide_entry(uuid, uuid);

drop table if exists public.pending_escalation_events;
drop table if exists public.pending_escalation_state;
drop table if exists public.pending_escalation_settings;

do $$
begin
  if to_regclass('public.season_import_batches') is not null then
    execute 'drop policy if exists season_import_batches_staff_read on public.season_import_batches';
    execute 'revoke select on table public.season_import_batches from authenticated';
  end if;
end $$;

delete from public.feature_help where feature_key = 'pending-approvals';
delete from public.features where key = 'pending-approvals';
