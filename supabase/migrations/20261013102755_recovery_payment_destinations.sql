-- Reusable recipient bank/wallet details for outgoing Recovery payments.
create table if not exists public.recovery_payment_destinations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  party_type text not null,
  party_id uuid,
  party_name text not null,
  channel_type text not null check (channel_type in ('bank','easypaisa','jazzcash','sadapay','nayapay','upaisa','other_wallet')),
  institution_name text not null,
  account_title text not null,
  account_number text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists recovery_payment_destination_unique
  on public.recovery_payment_destinations
  (organization_id, party_type, coalesce(party_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(institution_name), lower(account_number));
create index if not exists recovery_payment_destination_party_idx
  on public.recovery_payment_destinations(organization_id, party_type, party_id, is_active);

alter table public.recovery_payment_destinations enable row level security;
drop policy if exists recovery_payment_destinations_read on public.recovery_payment_destinations;
create policy recovery_payment_destinations_read on public.recovery_payment_destinations
  for select to authenticated
  using (public.fn_is_any_staff() and organization_id = public.fn_current_user_organization_id());

revoke all on table public.recovery_payment_destinations from anon, authenticated;
grant select on table public.recovery_payment_destinations to authenticated;
grant all on table public.recovery_payment_destinations to service_role;

create or replace function public.fn_save_recovery_payment_destination(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_id uuid := nullif(p_input->>'id', '')::uuid;
  v_party_type text := lower(trim(coalesce(p_input->>'partyType', 'other')));
  v_party_id uuid := nullif(p_input->>'partyId', '')::uuid;
  v_party_name text := trim(coalesce(p_input->>'partyName', ''));
  v_channel text := lower(trim(coalesce(p_input->>'channelType', '')));
  v_institution text := trim(coalesce(p_input->>'institutionName', ''));
  v_title text := trim(coalesce(p_input->>'accountTitle', ''));
  v_number text := trim(coalesce(p_input->>'accountNumber', ''));
begin
  if v_user is null or not public.fn_is_any_staff() then raise exception 'Staff permission required.'; end if;
  select organization_id into v_org from public.profiles where id = v_user and is_active = true;
  if v_org is null then raise exception 'Organization nahi mili.'; end if;

  if v_id is not null then
    if not exists (select 1 from public.recovery_payment_destinations where id=v_id and organization_id=v_org and is_active) then
      raise exception 'Saved recipient account nahi mila.';
    end if;
    return v_id;
  end if;

  if v_party_name='' or v_channel not in ('bank','easypaisa','jazzcash','sadapay','nayapay','upaisa','other_wallet')
     or v_institution='' or v_title='' or v_number='' then
    raise exception 'Recipient bank/wallet, account title aur account/IBAN/mobile zaroori hain.';
  end if;

  select id into v_id from public.recovery_payment_destinations
  where organization_id=v_org and party_type=v_party_type
    and coalesce(party_id, '00000000-0000-0000-0000-000000000000'::uuid)=coalesce(v_party_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and lower(institution_name)=lower(v_institution) and lower(account_number)=lower(v_number);
  if v_id is not null then
    update public.recovery_payment_destinations set party_name=v_party_name, channel_type=v_channel,
      account_title=v_title, is_active=true, updated_at=now() where id=v_id;
    return v_id;
  end if;

  insert into public.recovery_payment_destinations
    (organization_id, party_type, party_id, party_name, channel_type, institution_name,
     account_title, account_number, created_by)
  values
    (v_org, v_party_type, v_party_id, v_party_name, v_channel, v_institution,
     v_title, v_number, v_user)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.fn_save_recovery_payment_destination(jsonb) from public, anon;
grant execute on function public.fn_save_recovery_payment_destination(jsonb) to authenticated, service_role;
