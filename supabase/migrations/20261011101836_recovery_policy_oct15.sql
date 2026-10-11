-- Recovery policy starts on 15 October 2026 (Asia/Karachi).
-- Existing ledger dates and balances are preserved. Apply Testing first.
alter table public.receivable_recovery_settings
  add column if not exists effective_from date not null default '2026-10-15',
  add column if not exists reminder_interval_days integer not null default 7
    check (reminder_interval_days between 1 and 365);
update public.receivable_recovery_settings
set effective_from = '2026-10-15', due_days = 30, reminder_day = 15,
    final_notice_day = 30, reminder_interval_days = 7, min_amount = 0.01,
    block_overdue_credit = true, reminders_enabled = true, updated_at = now()
where id;

-- One attempt per customer/day; failures can retry on the next day's run.
alter table public.receivable_reminders add column if not exists reminder_date date;
update public.receivable_reminders
set reminder_date = (created_at at time zone 'Asia/Karachi')::date
where reminder_date is null;
alter table public.receivable_reminders alter column reminder_date set not null;
alter table public.receivable_reminders alter column reminder_date
  set default ((now() at time zone 'Asia/Karachi')::date);
alter table public.receivable_reminders drop constraint if exists receivable_reminders_once;
create unique index if not exists receivable_reminder_customer_day
  on public.receivable_reminders(customer_id, stage, reminder_date);

create schema if not exists private;
revoke all on schema private from public;

-- Covers direct RPCs and offline replay, not just the POS screen.
create or replace function private.enforce_pos_recovery_credit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s public.receivable_recovery_settings%rowtype;
  a record;
  reason text;
  actor_role text;
begin
  if coalesce(new.khata_amount,0) <= 0 then return new; end if;
  if tg_op = 'UPDATE' then
    if new.crm_customer_id is not distinct from old.crm_customer_id
       and new.customer_id is not distinct from old.customer_id
       and new.khata_amount <= old.khata_amount then return new; end if;
  end if;
  select * into s from public.receivable_recovery_settings where id;
  if not found then raise exception 'Udhaar policy verify nahi ho saki.'; end if;
  if (now() at time zone 'Asia/Karachi')::date < s.effective_from
     or not s.block_overdue_credit then return new; end if;
  if auth.uid() is null then raise exception 'Udhaar ke liye login zaroori hai.'; end if;
  -- ART branch POS stores its shared CRM khata in crm_customer_id.
  -- Dealer customer_id uses a separate ledger and is not reclassified here.
  if new.crm_customer_id is null then return new; end if;
  perform 1 from public.customers where id = new.crm_customer_id for update;
  if not found then raise exception 'Gahak ka khata verify nahi ho saka.'; end if;
  select * into a from public.fn_customer_receivable_aging(null,new.crm_customer_id);
  if not found then return new; end if;
  if a.balance <= 0.009 or a.balance < s.min_amount
     or coalesce(a.oldest_days,0) < s.due_days then return new; end if;
  reason := trim(coalesce(current_setting('agribridge.credit_override_reason',true),''));
  select role::text into actor_role from public.profiles
    where id = auth.uid() and is_active;
  if actor_role not in ('owner','super_admin','admin') or actor_role is null
     or length(reason) < 3 then
    raise exception '30 din purana baqaya hai; naya udhaar band hai. Sirf Admin/Owner wajah likh kar ijazat de sakta hai.';
  end if;
  insert into public.credit_block_overrides
    (customer_id,context,amount,overdue_amount,oldest_days,reason,overridden_by,overridden_role)
  values (new.crm_customer_id,'pos',new.khata_amount,a.bucket_30_plus,a.oldest_days,
          reason,auth.uid(),actor_role);
  return new;
end $$;
revoke all on function private.enforce_pos_recovery_credit() from public,anon,authenticated;
drop trigger if exists enforce_pos_recovery_credit on public.pos_sales;
create trigger enforce_pos_recovery_credit
  before insert or update of khata_amount,crm_customer_id,customer_id on public.pos_sales
  for each row execute function private.enforce_pos_recovery_credit();

-- A separate name avoids PostgREST ambiguity with existing default overloads.
create or replace function public.create_pos_sale_with_credit_approval(
  p_items jsonb, p_payment_mode text, p_cash_paid numeric default 0,
  p_khata_amount numeric default 0, p_customer_id uuid default null,
  p_counter_id uuid default null, p_payment_lines jsonb default null,
  p_discount numeric default null, p_discount_reason text default null,
  p_client_action_id uuid default null, p_credit_override_reason text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare result uuid; previous_reason text;
begin
  previous_reason := coalesce(current_setting('agribridge.credit_override_reason',true),'');
  perform set_config('agribridge.credit_override_reason',coalesce(p_credit_override_reason,''),true);
  result := public.create_pos_sale(p_items,p_payment_mode,p_cash_paid,p_khata_amount,
    p_customer_id,p_counter_id,p_payment_lines,p_discount,p_discount_reason,p_client_action_id);
  perform set_config('agribridge.credit_override_reason',previous_reason,true);
  return result;
exception when others then
  perform set_config('agribridge.credit_override_reason',coalesce(previous_reason,''),true);
  raise;
end $$;
revoke all on function public.create_pos_sale_with_credit_approval(jsonb,text,numeric,numeric,uuid,uuid,jsonb,numeric,text,uuid,text) from public,anon;
grant execute on function public.create_pos_sale_with_credit_approval(jsonb,text,numeric,numeric,uuid,uuid,jsonb,numeric,text,uuid,text) to authenticated;

insert into public.feature_help
  (feature_key,lang,purpose,who_uses,when_use,how_steps,next_step,mistakes)
values ('system.receivable_reminders','rm',
 '15 October 2026 se purane aur naye CRM khaton par 15/30 din ka recovery qaida.',
 'Admin/Owner settings aur override; staff cash sale aur recovery.',
 '15 din par reminder; 30 din purana baqaya ho to naya udhaar band.',
 array['15 October se pehle scheduled hai. Purane udhaar ki tareekh reset nahi hoti.',
 'WhatsApp approved recovery template aur daily authenticated cron zaroori hain.',
 'Reminder 7 din baad dobara; final stage par foran. Failed attempt agle din retry hota hai.',
 'Cash sale aur recovery khuli hain. Offline udhaar nahi; Admin override online wajah ke sath.'],
 'Purana overdue clear karein ya Admin har sale ke liye wajah ke sath ijazat de.',
 array['Reminder pause udhaar ki rok nahi kholta.','WhatsApp SMS nahi hai; approved template ke baghair scheduled delivery band rahegi.'])
on conflict(feature_key,lang) do update set purpose=excluded.purpose,
 who_uses=excluded.who_uses,when_use=excluded.when_use,how_steps=excluded.how_steps,
 next_step=excluded.next_step,mistakes=excluded.mistakes;
notify pgrst, 'reload schema';

-- Admin page configures a daily job using the server's existing CRON_SECRET.
-- The secret stays in Vault, never in cron.command or in browser output.
create or replace function private.run_receivable_reminder_cron()
returns bigint language plpgsql security definer set search_path = '' as $$
declare token text; request_id bigint;
begin
  select decrypted_secret into token from vault.decrypted_secrets
    where name = 'agribridge_recovery_cron_secret' limit 1;
  if token is null then raise exception 'Recovery cron secret missing'; end if;
  select net.http_get(
    url := 'https://alranatraders.pk/api/cron/receivable-reminders',
    headers := jsonb_build_object('Authorization','Bearer '||token),
    timeout_milliseconds := 30000
  ) into request_id;
  return request_id;
end $$;
revoke all on function private.run_receivable_reminder_cron() from public,anon,authenticated;

create or replace function public.configure_receivable_reminder_cron(p_secret text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare secret_id uuid; job_id bigint;
begin
  if length(coalesce(p_secret,'')) < 16 then raise exception 'CRON_SECRET must have at least 16 characters'; end if;
  select id into secret_id from vault.secrets where name='agribridge_recovery_cron_secret' limit 1;
  if secret_id is null then
    perform vault.create_secret(p_secret,'agribridge_recovery_cron_secret','Recovery daily cron authorization');
  else
    perform vault.update_secret(secret_id,p_secret,'agribridge_recovery_cron_secret','Recovery daily cron authorization');
  end if;
  select cron.schedule('agribridge-receivable-reminders','0 4 * * *',
    'select private.run_receivable_reminder_cron()') into job_id;
  return job_id;
end $$;
revoke all on function public.configure_receivable_reminder_cron(text) from public,anon,authenticated;
grant execute on function public.configure_receivable_reminder_cron(text) to service_role;

create or replace function public.receivable_reminder_cron_status()
returns table(active boolean,schedule text,last_run_status text,last_run_at timestamptz)
language sql security definer set search_path = '' as $$
  select j.active,j.schedule,r.status,r.start_time
    from cron.job j left join lateral (
      select d.status,d.start_time from cron.job_run_details d
       where d.jobid=j.jobid order by d.start_time desc limit 1
    ) r on true where j.jobname='agribridge-receivable-reminders';
$$;
revoke all on function public.receivable_reminder_cron_status() from public,anon,authenticated;
grant execute on function public.receivable_reminder_cron_status() to service_role;
notify pgrst, 'reload schema';
