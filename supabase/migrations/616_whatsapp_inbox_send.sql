-- 616: WhatsApp Inbox -- bhejne ki tayyari (24h window, templates). ADDITIVE ONLY. NOT applied.
-- * DB KHUD KUCH NAHI BHEJTA (koi trigger / pg_net nahi). Ye sirf ek "ticket"
--   banata hai jab insaan Bhejo dabaye; phir server action WhatsApp API chalata
--   hai aur nateeja fn_wa_inbox_mark_sent se likhta hai.
-- * 24 ghante ke andar: azad text. Baad mein: sirf manzoor-shuda template.

create table if not exists public.wa_templates (
  key text primary key check (key ~ '^[a-z0-9_]{3,60}$'),
  meta_name text not null,         -- Meta par manzoor template ka naam
  language_code text not null default 'ur',
  label text not null,
  body_preview text not null,      -- {{1}} waghera
  param_count int not null default 0 check (param_count between 0 and 5),
  is_active boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.wa_templates enable row level security;
revoke all on table public.wa_templates from public, anon, authenticated;
grant select on table public.wa_templates to authenticated;
grant all on table public.wa_templates to service_role;
drop policy if exists wa_tpl_read on public.wa_templates;
create policy wa_tpl_read on public.wa_templates for select to authenticated using (public.fn_wa_inbox_has_feature());

create or replace function public.fn_wa_inbox_window_open(p_conv uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select c.last_inbound_at > now() - interval '24 hours' + interval '10 minutes'
                         from public.wa_conversations c where c.id = p_conv), false) $$;

create or replace function public.fn_wa_inbox_prepare_send(
  p_conv uuid, p_text text, p_template_key text default null, p_params text[] default null, p_ai_draft text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public, auth
as $$
declare c record; t record; v_open boolean; v_id uuid; v_meta text; v_lang text; v_preview text;
begin
  if auth.uid() is null then raise exception 'wa inbox: login zaroori'; end if;
  if not public.fn_wa_inbox_can_see(p_conv) then raise exception 'wa inbox: ijazat nahi'; end if;
  select * into c from public.wa_conversations where id = p_conv;
  v_open := public.fn_wa_inbox_window_open(p_conv);
  if p_template_key is null then
    if not v_open then raise exception 'wa inbox: 24 ghante guzar gaye -- sirf template'; end if;
    if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'wa inbox: khali paigham'; end if;
  else
    select * into t from public.wa_templates where key = p_template_key and is_active;
    if not found then raise exception 'wa inbox: template manzoor / active nahi'; end if;
    if coalesce(array_length(p_params, 1), 0) <> t.param_count then raise exception 'wa inbox: template ke khane poore karein'; end if;
    v_meta := t.meta_name; v_lang := t.language_code; v_preview := t.body_preview;
  end if;
  insert into public.wa_messages (conversation_id, direction, msg_type, body, template_key, ai_draft, sent_by, send_status)
  values (p_conv, 'out', case when p_template_key is null then 'text' else 'template' end,
          case when p_template_key is null then left(trim(p_text), 4000) else v_preview end,
          p_template_key, left(p_ai_draft, 2000), auth.uid(), 'queued')
  returning id into v_id;
  return jsonb_build_object('message_id', v_id, 'phone_key', c.phone_key,
    'kind', case when p_template_key is null then 'text' else 'template' end,
    'meta_name', v_meta, 'language_code', v_lang, 'params', to_jsonb(coalesce(p_params, array[]::text[])));
end $$;

-- Sirf wohi insaan jis ne ticket banaya, aur sirf 'queued' qatar.
create or replace function public.fn_wa_inbox_mark_sent(p_message uuid, p_ok boolean, p_wa_message_id text default null, p_error text default null)
returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
declare m record;
begin
  select * into m from public.wa_messages where id = p_message and direction = 'out' and send_status = 'queued' for update;
  if not found then raise exception 'wa inbox: ticket nahi mila'; end if;
  if m.sent_by is distinct from auth.uid() then raise exception 'wa inbox: sirf bhejne wala'; end if;
  if p_ok and p_wa_message_id is not null then
    insert into public.whatsapp_processed_messages (wa_message_id) values (p_wa_message_id) on conflict do nothing;
  end if;
  update public.wa_messages set send_status = case when p_ok then 'sent' else 'failed' end,
         wa_message_id = case when p_ok then p_wa_message_id end, send_error = left(p_error, 500)
   where id = p_message;
  if p_ok then
    update public.wa_conversations set last_outbound_at = now(), first_unanswered_at = null, updated_at = now() where id = m.conversation_id;
  end if;
  insert into public.wa_conversation_events (conversation_id, event, actor_id, detail)
  values (m.conversation_id, case when not p_ok then 'send_failed' when m.template_key is not null then 'template_sent' else 'sent' end, auth.uid(),
          jsonb_build_object('message_id', p_message, 'edited', m.ai_draft is not null and m.ai_draft is distinct from m.body));
end $$;

revoke all on function public.fn_wa_inbox_window_open(uuid), public.fn_wa_inbox_prepare_send(uuid,text,text,text[],text),
  public.fn_wa_inbox_mark_sent(uuid,boolean,text,text) from public, anon;
grant execute on function public.fn_wa_inbox_window_open(uuid), public.fn_wa_inbox_prepare_send(uuid,text,text,text[],text),
  public.fn_wa_inbox_mark_sent(uuid,boolean,text,text) to authenticated;
