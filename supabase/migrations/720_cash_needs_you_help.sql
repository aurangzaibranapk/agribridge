-- =====================================================================
-- 720: Cash custody queue — menu naam + feature_help
-- =====================================================================
-- Koi naya table, koi naya RPC, koi raqam nahi badalti.
-- Safha /admin/cash-custody pehle se 717 ke packets par hai.
-- Yahan sirf menu ka naam "Cash custody" aur Needs-you ki madad.
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 720_cash_needs_you_help.rollback.sql

update public.features
   set label = 'Cash custody',
       label_en = 'Cash custody',
       label_ur = 'کیش کسٹڈی'
 where key = 'cash-custody';

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
('cash-custody', 'rm',
 'Aaj aapki zarurat: POS cash ki queue. Har band shift — kis ke paas hai, kitni der, aur agla qadam. Wasoli baqi ho to Ask why. Jama copy par Approve wahi tasdeeq hai jo Finance deposit par pehle se hai. 1 din mein jama aur verify na ho to Admin alert, timeline ke sath.',
 'Admin, Owner aur Finance sab. Manager apni branch. Sales staff sirf apni do slips, ye queue nahi.',
 'Jab koi POS cash bank verify ke baghair pari ho. Subah ye queue kholen.',
 array[
   'Cash custody kholen. Badge jitni khuli qatarein hain.',
   'KPI: aaj ki jama, 1 din se atki, manager ke paas, finance verify. Jo ginti na mile us par dash, sifar nahi.',
   'Wasoli baqi ho to Ask why — holder ko in-app sawal. SMS ya WhatsApp nahi.',
   'Jama copy verify ke liye ho to Approve. Apni jama khud nahi.',
   'Card kholen: kis ne kitni der cash rakhi.'
 ],
 'Mera Kaam se Cash custody. Agla qadam usi card ka button: wasoli Cash Handover par, jama Finance verify par.',
 array[
   'Ask why ko manzoori samajhna.',
   'Apni deposit khud approve karna.',
   '1 din ke alert ko chhor dena.',
   'Sifar aur parha nahi gaya ek cheez samajhna.'
 ]),
('cash-custody', 'en',
 'What you need today: the POS cash queue. Each closed shift shows who holds the cash, for how long, and the next step. Ask why while wasoli is still pending. Approve on the deposit copy is the existing Finance deposit verify. If it is not deposited and verified within one day, Admin sees an alert with the timeline.',
 'Admin, Owner and Finance see every shop. A manager sees their branch. Sales staff only see their own two slips, not this queue.',
 'Whenever POS cash is still unverified. Open this queue in the morning.',
 array[
   'Open Cash custody. The badge is the number of open packets.',
   'KPIs: deposited today, stuck more than a day, with the manager, finance verify. A dash means the count was not read. Zero means it was read and nothing is there.',
   'If wasoli is pending, Ask why. The holder gets an in-app question. No SMS or WhatsApp.',
   'If the deposit copy is waiting, Approve. You cannot verify a deposit you submitted yourself.',
   'Open the card for who held the cash and for how long.'
 ],
 'From My Work, open Cash custody. The next step is the button on that card: wasoli on Cash Handover, jama on Finance verify.',
 array[
   'Treating Ask why as an approval.',
   'Approving your own deposit.',
   'Ignoring the one-day alert.',
   'Reading a dash as zero.'
 ]),
('cash-custody', 'ur',
 'آج آپکی ضرورت: پی او ایس کیش کی قطار. ہر بند شفٹ — کس کے پاس ہے، کتنی دیر، اگلا قدم. وصولی باقی ہو تو وجہ پوچھیں. جمع کاپی پر منظور وہی فنانس تصدیق ہے. ایک دن میں تصدیق نہ ہو تو ایڈمن الرٹ.',
 'ایڈمن، اونر اور فنانس سب. مینیجر اپنی برانچ. سیلز صرف اپنی سلپس.',
 'جب کیش تصدیق کے بغیر پڑی ہو.',
 array[
   'کیش کسٹڈی کھولیں. بیج کھلی قطاریں ہیں.',
   'آج جمع، ایک دن سے رکی، مینیجر کے پاس، فنانس تصدیق. جو گنتی نہ ملے اس پر ڈیش، صفر نہیں.',
   'وصولی باقی ہو تو وجہ پوچھیں. ایس ایم ایس نہیں.',
   'جمع کاپی پر منظور. اپنی جمع خود نہیں.',
   'کارڈ کھولیں: کس نے کتنی دیر رکھی.'
 ],
 'میرا کام سے کیش کسٹڈی. اگلا قدم اسی کارڈ کا بٹن.',
 array[
   'وجہ پوچھنے کو منظوری سمجھنا.',
   'اپنی جمع خود منظور کرنا.',
   'ایک دن کا الرٹ چھوڑ دینا.',
   'ڈیش کو صفر سمجھنا.'
 ])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();
