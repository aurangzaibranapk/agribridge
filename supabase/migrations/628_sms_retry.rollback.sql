-- 628 rollback. Outbox ki purani qatarein rehti hain. Attempts ka hisaab hat-ta hai.

drop function if exists public.fn_cc_take_sms(int);
drop index if exists public.cc_sms_outbox_due_idx;
alter table public.cc_sms_outbox drop constraint if exists cc_sms_outbox_attempts_check;
alter table public.cc_sms_outbox drop column if exists next_attempt_at;
alter table public.cc_sms_outbox drop column if exists attempts;

update public.feature_help
   set how_steps = array['Naam aur mobile likhein.','Agent banayein. Login password ek dafa screen par aata hai.','Audit mein dekhein kis ne kis ka khata kab dekha.'],
       next_step = 'Agent ko Agent Console ka raasta dein.'
 where feature_key = 'call-center-agents' and lang = 'rm';

update public.feature_help
   set how_steps = array['Enter name and mobile.','Create the agent. The password is shown once.','Read the audit of who viewed which khata.'],
       next_step = 'Send the agent to the Agent Console.'
 where feature_key = 'call-center-agents' and lang = 'en';
