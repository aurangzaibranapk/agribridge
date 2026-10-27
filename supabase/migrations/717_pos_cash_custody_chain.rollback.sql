-- Rollback 717. Cash handover wasoli (receiveCash) isse nahi badli thi.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'agribridge_cash_custody_overdue') then
      perform cron.unschedule('agribridge_cash_custody_overdue');
    end if;
  end if;
exception when others then
  raise notice 'cash custody cron unschedule skip: %', sqlerrm;
end $$;

drop trigger if exists trg_pos_deposit_custody on public.pos_collection_deposits;
drop trigger if exists trg_cash_handover_custody on public.cash_handovers;
drop trigger if exists trg_pos_shift_cash_custody on public.pos_shifts;

drop function if exists public.trg_pos_deposit_custody();
drop function if exists public.trg_cash_handover_custody();
drop function if exists public.trg_pos_shift_cash_custody();
drop function if exists public.fn_cash_custody_overdue_notify();
drop function if exists public.fn_cash_custody_staff_confirm(uuid, uuid, numeric, text, text);
drop function if exists public.fn_cash_custody_apply_deposit(uuid);
drop function if exists public.fn_cash_custody_mark_wasoli(uuid);
drop function if exists public.fn_cash_custody_mark_sent(uuid, uuid);
drop function if exists public.fn_cash_custody_drop_fresh(uuid);
drop function if exists public.fn_cash_custody_open_shift(uuid);
drop function if exists public.fn_cash_custody_hop(uuid, text, uuid, uuid, uuid, uuid, uuid, numeric, text, timestamptz, boolean);
drop function if exists public.fn_cash_custody_kind_label(text);
drop function if exists public.fn_cash_custody_span(timestamptz, timestamptz);

alter table public.cash_handovers drop column if exists custody_packet_id;

drop table if exists public.cash_custody_hops;
drop table if exists public.cash_custody_packets;
drop table if exists public.cash_custody_slip_counters;
drop function if exists public.fn_cash_custody_visible(uuid);

alter table public.pos_collection_deposits drop column if exists submitted_by;

delete from public.role_feature_permissions
 where feature_key = 'cash-custody' and role = 'manager';

delete from public.dashboard_features
 where feature_key = 'cash-custody' and dashboard_key in ('admin', 'master');

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes) values
('cash-custody', 'rm',
 'Kis ke paas cash: kis mulazim ke zimme is waqt kitni raqam hai.',
 'Owner, Admin, Finance, Manager.',
 'Roz shaam, aur jab kisi se cash lena ho.',
 array['Fehrist kholein: naam aur us ke zimme raqam.','Zyada raqam kisi ek ke paas ruki ho to handover karwayein.'],
 'Cash Haath Badalna se raqam agle bande ke hawale karein.',
 array['Zimmedari zubani na badlein -- handover darj hona chahiye, warna nuqsan par kisi ka naam nahi hota.'])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();

delete from public.feature_help where feature_key = 'cash-custody' and lang in ('en', 'ur');
