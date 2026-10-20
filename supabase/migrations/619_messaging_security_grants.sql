-- 619: 589-618 ke naye functions ki security sakht. ADDITIVE (sirf grants + 1 function body).
-- * Trigger/guard functions: koi role direct call na kare (trigger privilege check nahi hota).
-- * fn_broadcast_can_create / fn_broadcast_is_approver: RLS policies mein lagte hain -> authenticated rahe, anon/PUBLIC se hata.
-- * fn_messaging_contactable: sirf andar (security definer) se chalta hai -> service_role only.
-- * fn_wa_inbox_mark_sent: sirf server (service_role). Bhejne wale ki shart ab ticket ke sent_by se.
revoke execute on function public.fn_broadcast_can_create(uuid), public.fn_broadcast_is_approver(uuid) from public, anon;
grant execute on function public.fn_broadcast_can_create(uuid), public.fn_broadcast_is_approver(uuid) to authenticated, service_role;

revoke execute on function public.fn_broadcast_guard(), public.fn_broadcast_recipient_guard(), public.fn_broadcast_audit_immutable(),
  public.fn_wa_inbox_guard_submission(), public.fn_wa_inbox_guard_demand(), public.fn_messaging_contactable(text)
  from public, anon, authenticated;
grant execute on function public.fn_broadcast_guard(), public.fn_broadcast_recipient_guard(), public.fn_broadcast_audit_immutable(),
  public.fn_wa_inbox_guard_submission(), public.fn_wa_inbox_guard_demand(), public.fn_messaging_contactable(text) to service_role;

alter function public.fn_broadcast_audit_immutable() set search_path = public;

create or replace function public.fn_wa_inbox_mark_sent(p_message uuid, p_ok boolean, p_wa_message_id text default null, p_error text default null)
returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
declare m record;
begin
  select * into m from public.wa_messages where id = p_message and direction = 'out' and send_status = 'queued' for update;
  if not found then raise exception 'wa inbox: ticket nahi mila'; end if;
  if m.sent_by is null then raise exception 'wa inbox: ticket ka bhejne wala nahi'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and m.sent_by is distinct from auth.uid() then raise exception 'wa inbox: sirf bhejne wala'; end if;
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
  values (m.conversation_id, case when not p_ok then 'send_failed' when m.template_key is not null then 'template_sent' else 'sent' end, m.sent_by,
          jsonb_build_object('message_id', p_message, 'edited', m.ai_draft is not null and m.ai_draft is distinct from m.body));
end $$;
revoke execute on function public.fn_wa_inbox_mark_sent(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.fn_wa_inbox_mark_sent(uuid,boolean,text,text) to service_role;
