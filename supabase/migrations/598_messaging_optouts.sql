-- 598: STOP / opt-out aur DND list. ADDITIVE ONLY.
-- Inbound "STOP" / "band karo" / "بند" -> opt-out; "START" -> wapas. Broadcast in numbers ko kabhi nahi bhejta.
create table if not exists public.messaging_optouts (
  phone text primary key check (phone ~ '^92[0-9]{10}$'),
  source text not null default 'whatsapp' check (source in ('whatsapp','sms','admin')),
  keyword text,
  opted_out_at timestamptz not null default now()
);
create table if not exists public.messaging_dnd (
  phone text primary key check (phone ~ '^92[0-9]{10}$'),
  reason text,
  added_by uuid default auth.uid(),
  added_at timestamptz not null default now()
);
alter table public.messaging_optouts enable row level security;
alter table public.messaging_dnd enable row level security;
drop policy if exists messaging_optouts_read on public.messaging_optouts;
create policy messaging_optouts_read on public.messaging_optouts for select to authenticated using (public.fn_broadcast_can_create(auth.uid()));
drop policy if exists messaging_dnd_read on public.messaging_dnd;
create policy messaging_dnd_read on public.messaging_dnd for select to authenticated using (public.fn_broadcast_can_create(auth.uid()));
drop policy if exists messaging_dnd_insert on public.messaging_dnd;
create policy messaging_dnd_insert on public.messaging_dnd for insert to authenticated with check (public.fn_broadcast_is_approver(auth.uid()) and added_by = auth.uid());
revoke all on public.messaging_optouts, public.messaging_dnd from anon, authenticated;
grant select on public.messaging_optouts to authenticated;
grant select, insert on public.messaging_dnd to authenticated;

create or replace function public.fn_messaging_contactable(p_phone text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from messaging_optouts where phone = p_phone)
     and not exists (select 1 from messaging_dnd where phone = p_phone)
$$;

-- Webhook (service role) se: STOP/START lafz pehchan kar list badalta hai. Returns 'stop' | 'start' | null.
create or replace function public.fn_messaging_keyword(p_phone text, p_text text, p_source text default 'whatsapp')
returns text language plpgsql security definer set search_path = public as $$
declare w text := lower(btrim(regexp_replace(coalesce(p_text,''), '[[:punct:]]', '', 'g')));
begin
  if p_phone !~ '^92[0-9]{10}$' then return null; end if;
  if w in ('stop','unsubscribe','band','band karo','band karen','band karein','بند','بند کرو','بند کریں') then
    insert into messaging_optouts (phone, source, keyword) values (p_phone, p_source, w)
      on conflict (phone) do update set keyword = excluded.keyword, opted_out_at = now();
    return 'stop';
  elsif w in ('start','subscribe','shuru','شروع') then
    delete from messaging_optouts where phone = p_phone;
    return 'start';
  end if;
  return null;
end $$;
revoke all on function public.fn_messaging_keyword(text, text, text) from public, anon, authenticated;
