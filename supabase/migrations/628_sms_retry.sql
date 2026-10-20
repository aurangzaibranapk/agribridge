-- 628: SMS queue retry. Veevo bhejne se pehle attempts aur next_attempt_at.
--
-- 625 ke baad. Live / Testing par tab tak nahi jab tak backup verify na ho.
-- Purani queued qatarein rehti hain. Koi paighaam yahan se nahi jaata.
-- Stage badalne wala SQL ab bhi SMS nahi likhta.

alter table public.cc_sms_outbox
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz;

alter table public.cc_sms_outbox drop constraint if exists cc_sms_outbox_attempts_check;
alter table public.cc_sms_outbox
  add constraint cc_sms_outbox_attempts_check check (attempts >= 0 and attempts <= 10);

create index if not exists cc_sms_outbox_due_idx
  on public.cc_sms_outbox (status, next_attempt_at, created_at);

-- Due qatarein uthati hai aur 15 minute ka lease lagati hai taake do cron
-- ek hi SMS do dafa na bhejein. App phir status likhti hai.
create or replace function public.fn_cc_take_sms(p_limit int default 20)
returns table (id uuid, to_phone text, body text, attempts int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.cc_sms_outbox s
     set next_attempt_at = now() + interval '15 minutes'
   where s.id in (
     select q.id
       from public.cc_sms_outbox q
      where q.status = 'queued'
        and q.channel = 'sms'
        and q.attempts < 3
        and (q.next_attempt_at is null or q.next_attempt_at <= now())
      order by q.created_at
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
      for update skip locked
   )
  returning s.id, s.to_phone, s.body, s.attempts;
end;
$$;

revoke all on function public.fn_cc_take_sms(int) from public, anon, authenticated;
grant execute on function public.fn_cc_take_sms(int) to service_role;

comment on function public.fn_cc_take_sms(int) is
  'Queued SMS jo bhejne ka waqt aa chuka. Sirf service role. Teen attempts ke baad nahi uth-ti.';

update public.feature_help
   set how_steps = array[
         'Naam aur mobile likhein.',
         'Agent banayein. Login password ek dafa screen par aata hai.',
         'Test SMS se ek number par paighaam azmayein. Provider khali ho to queue mein rehta hai.',
         'Audit mein dekhein kis ne kis ka khata kab dekha.'
       ],
       next_step = 'Agent ko Agent Console ka raasta dein. SMS tab jati hai jab Veevo (SMS_PROVIDER, VEEVO_API_KEY, VEEVO_SENDER) set ho.'
 where feature_key = 'call-center-agents' and lang = 'rm';

update public.feature_help
   set how_steps = array[
         'Enter name and mobile.',
         'Create the agent. The password is shown once.',
         'Use Test SMS for one number. If the provider is empty the message stays queued.',
         'Read the audit of who viewed which khata.'
       ],
       next_step = 'Send the agent to the Agent Console. SMS leaves only after Veevo env is set.'
 where feature_key = 'call-center-agents' and lang = 'en';
