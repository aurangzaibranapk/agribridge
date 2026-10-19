-- 615: WhatsApp Inbox -- list (badges), assign / transfer, khola, Party 360. ADDITIVE ONLY. NOT applied.
-- Har function auth.uid() + 614 fn_wa_inbox_can_see se rok -- staff scope DB mein.

create table if not exists public.wa_conversation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations(id) on delete cascade,
  event text not null check (event in ('assign','transfer','opened','link','draft','sent','template_sent','send_failed')),
  actor_id uuid not null,
  to_profile_id uuid,
  to_department_key text,
  reason text,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists wa_conv_ev_idx on public.wa_conversation_events (conversation_id, created_at);
alter table public.wa_conversation_events enable row level security;
revoke all on table public.wa_conversation_events from public, anon, authenticated;
grant select on table public.wa_conversation_events to authenticated;
grant all on table public.wa_conversation_events to service_role;
drop policy if exists wa_ev_read on public.wa_conversation_events;
create policy wa_ev_read on public.wa_conversation_events for select to authenticated using (public.fn_wa_inbox_can_see(conversation_id));

-- Fehrist + badges. p_filter: all | farmer | customer | staff | unknown | unread | mine
create or replace function public.fn_wa_inbox_list(p_filter text default 'all', p_search text default null, p_limit int default 100)
returns table (id uuid, phone_key text, phone_display text, title text, party_kind text, farmer_id uuid, customer_id uuid,
               branch_id uuid, department_key text, assigned_to uuid, assigned_name text, unread_count int,
               last_inbound_at timestamptz, last_outbound_at timestamptz, last_preview text,
               is_naya boolean, pending_since timestamptz, stuck_with text, window_open boolean)
language sql stable security definer set search_path = public, auth
as $$
  select c.id, c.phone_key, c.phone_display,
         coalesce(f.full_name, cu.name, pp.full_name, c.profile_name, '+92 ' || c.phone_key) as title,
         c.party_kind, c.farmer_id, c.customer_id, c.branch_id, c.department_key, c.assigned_to, a.full_name,
         c.unread_count, c.last_inbound_at, c.last_outbound_at, c.last_preview,
         (c.opened_at is null and c.first_inbound_at > now() - interval '24 hours') as is_naya,
         c.first_unanswered_at as pending_since,
         case when c.first_unanswered_at is null then null
              else coalesce(a.full_name, c.department_key, 'Bina sapurd') end as stuck_with,
         (c.last_inbound_at is not null and c.last_inbound_at > now() - interval '24 hours') as window_open
    from public.wa_conversations c
    left join public.profiles a on a.id = c.assigned_to
    left join public.profiles pp on pp.id = c.party_user_id
    left join public.farmers f on f.id = c.farmer_id
    left join public.customers cu on cu.id = c.customer_id
   where public.fn_wa_inbox_can_see(c.id)
     and case coalesce(p_filter, 'all')
           when 'farmer' then c.party_kind = 'farmer'
           when 'customer' then c.party_kind = 'customer'
           when 'staff' then c.party_kind in ('staff','admin','owner')
           when 'unknown' then c.party_kind in ('unknown','ambiguous')
           when 'unread' then c.unread_count > 0
           when 'mine' then c.assigned_to = auth.uid()
           else true end
     and (p_search is null or length(trim(p_search)) = 0
          or c.phone_key like '%' || regexp_replace(p_search, '\D', '', 'g') || '%' and length(regexp_replace(p_search, '\D', '', 'g')) >= 3
          or coalesce(f.full_name, cu.name, pp.full_name, c.profile_name, '') ilike '%' || p_search || '%'
          or coalesce(c.last_preview, '') ilike '%' || p_search || '%')
   order by (c.first_unanswered_at is not null) desc, coalesce(c.last_inbound_at, c.created_at) desc
   limit least(greatest(coalesce(p_limit, 100), 1), 300)
$$;

create or replace function public.fn_wa_inbox_open(p_conv uuid) returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
begin
  if not public.fn_wa_inbox_can_see(p_conv) then raise exception 'wa inbox: ijazat nahi'; end if;
  update public.wa_conversations set unread_count = 0, opened_at = coalesce(opened_at, now()) where id = p_conv;
  insert into public.wa_conversation_events (conversation_id, event, actor_id) values (p_conv, 'opened', auth.uid());
end $$;

-- Assign (koi bhi jo dekh sake, khali ya apne aap ko / admin kisi ko). Transfer = wajah zaroori.
create or replace function public.fn_wa_inbox_assign(p_conv uuid, p_to uuid, p_department text, p_reason text, p_transfer boolean default false)
returns void
language plpgsql volatile security definer set search_path = public, auth
as $$
declare c record; v_ok boolean;
begin
  if not public.fn_wa_inbox_can_see(p_conv) then raise exception 'wa inbox: ijazat nahi'; end if;
  select * into c from public.wa_conversations where id = p_conv for update;
  if p_to is null and nullif(trim(p_department), '') is null then raise exception 'wa inbox: kis ko? (staff ya department)'; end if;
  if p_transfer and length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'wa inbox: transfer ki wajah likhein'; end if;
  if p_to is not null then
    select exists (select 1 from public.profiles p where p.id = p_to and coalesce(p.is_active, true)
                     and p.role::text not in ('farmer','customer','customer_portal','ai_assistant')) into v_ok;
    if not v_ok then raise exception 'wa inbox: sirf active staff ko sapurd'; end if;
  end if;
  -- Staff sirf apni ya apne paas wali conversation aage de sakta hai (admin sab).
  if not public.fn_wa_inbox_is_admin() and c.assigned_to is not null and c.assigned_to <> auth.uid() then
    raise exception 'wa inbox: ye kisi aur ke paas hai';
  end if;
  update public.wa_conversations set assigned_to = p_to, department_key = coalesce(nullif(trim(p_department), ''), department_key), updated_at = now() where id = p_conv;
  insert into public.wa_conversation_events (conversation_id, event, actor_id, to_profile_id, to_department_key, reason)
  values (p_conv, case when p_transfer then 'transfer' else 'assign' end, auth.uid(), p_to, nullif(trim(p_department), ''), nullif(trim(p_reason), ''));
end $$;

-- Party 360: khata, akhri bills/orders, season booking, wade. Sirf jo conversation dekh sake.
create or replace function public.fn_wa_inbox_party360(p_conv uuid) returns jsonb
language plpgsql stable security definer set search_path = public, auth
as $$
declare c record; v_cust uuid[]; v jsonb;
begin
  if not public.fn_wa_inbox_can_see(p_conv) then raise exception 'wa inbox: ijazat nahi'; end if;
  select * into c from public.wa_conversations where id = p_conv;
  select coalesce(array_agg(cu.id), array[]::uuid[]) into v_cust from public.customers cu
   where cu.id = c.customer_id or (c.farmer_id is not null and cu.farmer_id = c.farmer_id);
  select jsonb_build_object(
    'party_kind', c.party_kind, 'farmer_id', c.farmer_id, 'customer_id', c.customer_id,
    'balance', (select coalesce(sum(cu.current_balance), 0) from public.customers cu where cu.id = any(v_cust)),
    'credit_limit', (select max(cu.credit_limit) from public.customers cu where cu.id = any(v_cust)),
    'bills', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
        select jsonb_build_object('ref', 'POS', 'amount', s.total_amount, 'status', s.status, 'at', s.created_at) x
          from public.pos_sales s where s.customer_id = any(v_cust) order by s.created_at desc limit 3) b), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(x order by x->>'at' desc) from (
        select jsonb_build_object('ref', o.order_number, 'amount', o.grand_total, 'status', o.status, 'at', o.created_at) x
          from public.agri_orders o where o.customer_id = any(v_cust) order by o.created_at desc limit 3) b), '[]'::jsonb),
    'season', coalesce((select jsonb_agg(jsonb_build_object('campaign', bc.name, 'crop', bc.crop, 'acres', cb.acres, 'status', cb.status))
        from public.campaign_bookings cb join public.booking_campaigns bc on bc.id = cb.campaign_id
       where c.farmer_id is not null and cb.farmer_id = c.farmer_id), '[]'::jsonb),
    'promises', coalesce((select jsonb_agg(jsonb_build_object('amount', pp.promised_amount, 'date', pp.promise_date, 'status', pp.status) order by pp.promise_date desc)
        from (select * from public.payment_promises p
               where (p.party_type = 'customer' and p.party_id = any(v_cust)) or (p.party_type = 'farmer' and p.party_id = c.farmer_id)
               order by p.promise_date desc limit 4) pp), '[]'::jsonb)
  ) into v;
  return v;
end $$;

revoke all on function public.fn_wa_inbox_list(text,text,int), public.fn_wa_inbox_open(uuid),
  public.fn_wa_inbox_assign(uuid,uuid,text,text,boolean), public.fn_wa_inbox_party360(uuid) from public, anon;
grant execute on function public.fn_wa_inbox_list(text,text,int), public.fn_wa_inbox_open(uuid),
  public.fn_wa_inbox_assign(uuid,uuid,text,text,boolean), public.fn_wa_inbox_party360(uuid) to authenticated;
