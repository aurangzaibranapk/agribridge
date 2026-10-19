-- 614: WhatsApp Chat Inbox -- core. ADDITIVE ONLY. NOT applied.
-- Depends on 610 (fn_wa_resolve_identity, whatsapp_processed_messages).
--
-- * Do naye tables: wa_conversations, wa_messages. Koi purana table nahi chhua.
-- * Parhna RLS se: owner / super_admin / admin sab; baqi staff ko sirf
--   (a) jo un ke sapurd hai, ya (b) un ke department ki qatar
--   (staff_details.department_key), ya (c) apni branch ki bina-sapurd
--   qatar -- aur wo bhi tab jab un ke paas inbox feature ki 'view' ijazat ho.
-- * Likhna sirf definer functions se (anon / authenticated ko insert/update nahi).
-- * Kuch bhi bhejta nahi. Bhejna 616 + insaan ka "Bhejo".

create table if not exists public.wa_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_key text not null unique check (phone_key ~ '^[0-9]{10}$'),
  phone_display text,
  profile_name text,
  party_kind text not null default 'unknown'
    check (party_kind in ('owner','admin','staff','farmer','customer','unknown','ambiguous')),
  party_user_id uuid,
  farmer_id uuid,
  customer_id uuid,
  linked_by uuid,
  linked_at timestamptz,
  branch_id uuid,
  department_key text,
  assigned_to uuid,
  status text not null default 'open' check (status in ('open','closed')),
  unread_count int not null default 0,
  first_inbound_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  first_unanswered_at timestamptz,  -- sab se purana bina-jawab inbound ("Pending X se")
  last_preview text,
  opened_at timestamptz,             -- pehli dafa kisi ne khola ("Naya" khatam)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wa_conv_last_idx on public.wa_conversations (coalesce(last_inbound_at, created_at) desc);
create index if not exists wa_conv_assigned_idx on public.wa_conversations (assigned_to);

create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  msg_type text not null check (msg_type in ('text','image','audio','template','other')),
  body text,
  media_path text,        -- 618 bucket wa-media: <conversation_id>/<file>
  media_mime text,
  transcript text,        -- voice: "Aap ne kaha"
  ai_intent text,
  wa_message_id text unique references public.whatsapp_processed_messages(wa_message_id),
  template_key text,
  ai_draft text,          -- AI ka mashwara (kabhi khud nahi jata)
  sent_by uuid,           -- out: kis insaan ne Bhejo dabaya
  send_status text check (send_status in ('queued','sent','failed')),
  send_error text,
  wa_timestamp timestamptz,
  created_at timestamptz not null default now(),
  check (direction = 'in' or sent_by is not null)   -- har outbound ka zimmedar insaan
);
create index if not exists wa_msg_conv_idx on public.wa_messages (conversation_id, created_at);

alter table public.wa_conversations enable row level security;
alter table public.wa_messages enable row level security;
revoke all on table public.wa_conversations, public.wa_messages from public, anon, authenticated;
grant select on table public.wa_conversations, public.wa_messages to authenticated;
grant all on table public.wa_conversations, public.wa_messages to service_role;

-- Inbox feature ka raasta (app menu bhi isi se).
create or replace function public.fn_wa_inbox_role() returns text
language sql stable security definer set search_path = public, auth
as $$ select p.role::text from public.profiles p where p.id = auth.uid() and coalesce(p.is_active, true) $$;

create or replace function public.fn_wa_inbox_is_admin() returns boolean
language sql stable security definer set search_path = public, auth
as $$ select coalesce(public.fn_wa_inbox_role() in ('owner','super_admin','admin'), false) $$;

create or replace function public.fn_wa_inbox_has_feature() returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select public.fn_wa_inbox_is_admin() or exists (
    select 1 from public.v_user_feature_access v
     where v.profile_id = auth.uid() and 'view' = any(coalesce(v.actions, array[]::text[]))
       and v.route is not null and ('/admin/whatsapp-inbox' = v.route or '/admin/whatsapp-inbox' like v.route || '/%'))
$$;

-- DB ki asal rok: ye banda ye conversation dekh sakta hai?
create or replace function public.fn_wa_inbox_can_see(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, auth
as $$
  select case
    when auth.uid() is null then false
    when public.fn_wa_inbox_is_admin() then exists (select 1 from public.wa_conversations c where c.id = p_conv)
    when not public.fn_wa_inbox_has_feature() then false
    else exists (
      select 1 from public.wa_conversations c
       left join public.profiles me on me.id = auth.uid()
       left join public.staff_details sd on sd.profile_id = auth.uid()
       where c.id = p_conv and (
            c.assigned_to = auth.uid()
         or (c.department_key is not null and c.department_key = sd.department_key)
         or (c.assigned_to is null and c.department_key is null and c.branch_id is not null and c.branch_id = me.branch_id)))
  end
$$;

drop policy if exists wa_conv_read on public.wa_conversations;
create policy wa_conv_read on public.wa_conversations for select to authenticated using (public.fn_wa_inbox_can_see(id));
drop policy if exists wa_msg_read on public.wa_messages;
create policy wa_msg_read on public.wa_messages for select to authenticated using (public.fn_wa_inbox_can_see(conversation_id));

-- Webhook (service_role) ka darwaza: inbound paigham inbox mein. Idempotent (wamid).
create or replace function public.fn_wa_inbox_ingest(
  p_phone_key text, p_phone_display text, p_profile_name text,
  p_msg_type text, p_body text, p_media_path text, p_media_mime text,
  p_transcript text, p_ai_intent text, p_ai_draft text,
  p_wa_message_id text, p_wa_ts timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = public, auth
as $$
declare v_conv uuid; v_id record; v_mid uuid; v_farmer_branch uuid;
begin
  if p_phone_key !~ '^[0-9]{10}$' then raise exception 'wa inbox: phone key ghalat'; end if;
  if p_wa_message_id is not null then
    insert into public.whatsapp_processed_messages (wa_message_id, phone_key)
    values (p_wa_message_id, p_phone_key) on conflict do nothing;
    if exists (select 1 from public.wa_messages m where m.wa_message_id = p_wa_message_id) then
      return null;  -- Meta retry: dobara nahi
    end if;
  end if;
  select * into v_id from public.fn_wa_resolve_identity(p_phone_key) limit 1;
  select f.branch_id into v_farmer_branch from public.farmers f where f.id = v_id.farmer_id;
  insert into public.wa_conversations as c (phone_key, phone_display, profile_name, party_kind, party_user_id, farmer_id, customer_id, branch_id)
  values (p_phone_key, p_phone_display, p_profile_name, coalesce(v_id.kind, 'unknown'), v_id.user_id, v_id.farmer_id,
          (v_id.customer_ids)[1], coalesce(v_id.branch_id, v_farmer_branch))
  on conflict (phone_key) do update set
    profile_name = coalesce(excluded.profile_name, c.profile_name),
    -- pehchan sirf tab badle jab haath se link na hua ho
    party_kind = case when c.linked_at is null then excluded.party_kind else c.party_kind end,
    party_user_id = case when c.linked_at is null then excluded.party_user_id else c.party_user_id end,
    farmer_id = case when c.linked_at is null then excluded.farmer_id else c.farmer_id end,
    customer_id = case when c.linked_at is null then excluded.customer_id else c.customer_id end,
    branch_id = coalesce(c.branch_id, excluded.branch_id)
  returning id into v_conv;
  insert into public.wa_messages (conversation_id, direction, msg_type, body, media_path, media_mime, transcript, ai_intent, ai_draft, wa_message_id, wa_timestamp)
  values (v_conv, 'in', coalesce(nullif(p_msg_type,''), 'other'), left(p_body, 4000), p_media_path, p_media_mime,
          left(p_transcript, 2000), p_ai_intent, left(p_ai_draft, 2000), p_wa_message_id, coalesce(p_wa_ts, now()))
  returning id into v_mid;
  update public.wa_conversations set
    unread_count = unread_count + 1,
    first_inbound_at = coalesce(first_inbound_at, coalesce(p_wa_ts, now())),
    last_inbound_at = greatest(coalesce(last_inbound_at, '-infinity'), coalesce(p_wa_ts, now())),
    first_unanswered_at = coalesce(first_unanswered_at, coalesce(p_wa_ts, now())),
    last_preview = left(coalesce(case when p_msg_type = 'audio' then '🎙 ' || coalesce(p_transcript, 'Voice') when p_msg_type = 'image' then '📷 ' || coalesce(p_body, 'Photo') end, p_body, ''), 140),
    status = 'open', updated_at = now()
  where id = v_conv;
  return v_mid;
end $$;

revoke all on function public.fn_wa_inbox_ingest(text,text,text,text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.fn_wa_inbox_ingest(text,text,text,text,text,text,text,text,text,text,text,timestamptz) to service_role;
revoke all on function public.fn_wa_inbox_can_see(uuid), public.fn_wa_inbox_role(), public.fn_wa_inbox_is_admin(), public.fn_wa_inbox_has_feature() from public, anon;
grant execute on function public.fn_wa_inbox_can_see(uuid), public.fn_wa_inbox_role(), public.fn_wa_inbox_is_admin(), public.fn_wa_inbox_has_feature() to authenticated, service_role;
