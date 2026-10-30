-- 726 rollback. Certificate columns aur lines hatt te hain.
-- milk_dispatches ki purani rawangi (litre, raseed) rehti hai.
-- Jo litre certificate se likhe gaye, wo dispatched_liters par rehte hain.

drop function if exists public.fn_save_milk_handover(
  uuid, uuid, uuid, uuid, date, text, time, text, text, text, text, boolean, text, text, text, text, jsonb
);

create or replace function public.fn_milk_dispatch_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if old.received_liters is not null and new.received_liters is distinct from old.received_liters then
      if coalesce(current_setting('agribridge.milk_receipt_correct', true), '') <> 'on' then
        raise exception 'Raseed pehle darj ho chuki hai';
      end if;
    end if;
    if new.dispatched_liters is distinct from old.dispatched_liters then
      raise exception 'Bheji hui miqdar badli nahi ja sakti';
    end if;
  end if;
  if new.received_liters is not null and new.received_liters > new.dispatched_liters then
    raise exception 'Company bheje se zyada nahi maan sakti';
  end if;
  return new;
end $$;

drop table if exists public.milk_dispatch_lines;
drop table if exists public.milk_handover_specs;

alter table public.milk_dispatches drop constraint if exists milk_dispatch_reject_reason;
alter table public.milk_dispatches
  drop column if exists collection_time,
  drop column if exists mcc_name,
  drop column if exists shop_id,
  drop column if exists accepted,
  drop column if exists rejection_reason,
  drop column if exists licensee_rep_name,
  drop column if exists licensee_signature,
  drop column if exists licensee_signed_at,
  drop column if exists licensee_signed_by,
  drop column if exists collector_signature,
  drop column if exists collector_signed_at,
  drop column if exists collector_signed_by;

delete from public.feature_help where feature_key = 'milk-collection.handover';
delete from public.role_feature_permissions where feature_key = 'milk-collection.handover';
delete from public.dashboard_features where feature_key = 'milk-collection.handover';
delete from public.features where key = 'milk-collection.handover';

update public.feature_help set
  how_steps = array['Miqdar aur gaari likhein.','Bhejein.','Pahunchne par tasdeeq karein.'],
  next_step = 'Pahunchne ke baad billing ka qadam.'
where feature_key = 'milk-collection.dispatch' and lang = 'rm';

update public.role_page_permissions
set allowed_pages = array_remove(allowed_pages, '/admin/milk-collection/handover')
where role in ('milk_collection', 'manager');
