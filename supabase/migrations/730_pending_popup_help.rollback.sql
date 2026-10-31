-- 730 rollback: pending-approvals ki madad 713 wale matn par.
-- Koi table nahi mit-ti.

update public.feature_help set
  how_steps = array['Pending with column dekhein — Manager, ya Escalated par Admin / Owner.','Owner upar escalated / delay ki khulasa dekhta hai.','Jis ke paas item hai wo delay ki wajah likh sakta hai.','Timeline par har level ka intezar aur wajah hai.'],
  next_step = 'Faisla yahin, ya asal safhe par. Cron har 15 minute escalate karta hai.',
  mistakes = array['Manager apni entry khud approve nahi karta.','Sifar aur parha nahi ja saka ek cheez nahi.','Bahar koi message is escalate se nahi jata.'],
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'rm';

update public.feature_help set
  how_steps = array['Pending with shows Manager, or Admin / Owner once escalated.','The Owner sees an escalated / delay summary at the top.','The person holding it can write a delay reason.','The timeline records each wait and why it moved.'],
  next_step = 'Decide here or on the original page. The job escalates every 15 minutes.',
  mistakes = array['A manager never approves their own entry.','Unread is not zero.','This escalation stays inside the app.'],
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'en';

update public.feature_help set
  how_steps = array['کس کے پاس: مینیجر، یا Escalated پر ایڈمن / مالک۔','مالک اوپر خلاصہ دیکھتا ہے۔','جس کے پاس کام ہے وہ تاخیر کی وجہ لکھ سکتا ہے۔'],
  next_step = 'فیصلہ یہیں یا اصل صفحے پر۔',
  mistakes = array['مینیجر اپنی اندراج خود منظور نہیں کرتا۔'],
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'ur';
