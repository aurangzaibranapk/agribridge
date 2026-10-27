-- 721 rollback: menu naam aur madad 717 / 171 par wapas.
-- Koi table nahi girti.

update public.features
   set label = 'Kis ke paas Cash',
       label_en = 'Cash with People',
       label_ur = 'کس کے پاس کیش'
 where key = 'cash-custody';

insert into public.feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values
('cash-custody', 'rm',
 'POS band hote hi har dukan ki cash ka silsila: staff copy (jama karne wala rakhta hai, dastakhat aur system mein raqam) aur jama copy (cash ke sath). Manager wasoli ke baad Finance ya bank tak har qadam par zimmedar aur waqt. 1 din mein jama aur tasdeeq na ho to Admin ko timeline ke sath alert.',
 'Admin aur Owner hamesha. Manager apni branch. Finance sab. Sales staff sirf apni do slips.',
 'Shift band hote hi, aur jab cash 1 din se verify na ho.',
 array[
   'Shift band karein — staff copy aur jama copy dono kholein.',
   'Staff copy par raqam likh kar apna naam confirm karein. Jama copy cash ke sath rakhein.',
   'Manager wasoli Cash Handover par kare, phir Finance ko bheje ya bank jama karaye.',
   'Finance deposit verify kare — tab silsila band hota hai.'
 ],
 'Jo atki hai us ki timeline kholein: kis ke paas kitni der.',
 array[
   'Sirf ek slip chhapna.',
   'Wasoli ke baghair jama ho gayi maan lena.',
   '1 din ka alert khol kar chhor dena.'
 ]),
('cash-custody', 'en',
 'When a POS shift closes, every shop gets two slips: a staff copy the depositor keeps (signature and an in-system amount confirm) and a deposit copy that travels with the cash. After sales, each hop records who holds it and when. If it is not bank-deposited and verified within one day, Admin is alerted with that timeline.',
 'Admin and Owner always. Manager for their branch. Finance for all. Sales staff only their own two slips.',
 'As soon as the shift closes, and again if cash is still unverified after one day.',
 array[
   'Close the shift and open both slips.',
   'On the staff copy, enter the amount and confirm your name. Keep the deposit copy with the cash.',
   'Manager records wasoli on Cash Handover, then forwards to Finance or submits the bank deposit.',
   'Finance verifies the deposit. That closes the chain.'
 ],
 'Open the timeline of anything stuck: who held it, and for how long.',
 array[
   'Printing only one slip.',
   'Treating wasoli as a finished bank deposit.',
   'Ignoring the one-day alert.'
 ]),
('cash-custody', 'ur',
 'شفٹ بند ہوتے ہی ہر دکان پر دو سلپ: سٹاف کاپی (جمع کرانے والا رکھتا ہے، دستخط اور سسٹم میں رقم) اور جمع کاپی (کیش کے ساتھ). ایک دن میں تصدیق نہ ہو تو ایڈمن کو ٹائم لائن کے ساتھ الرٹ.',
 'ایڈمن اور اونر ہمیشہ. مینیجر اپنی برانچ. فنانس سب. سیلز صرف اپنی سلپس.',
 'شفٹ بند ہوتے ہی، اور جب کیش ایک دن سے تصدیق نہ ہو.',
 array[
   'دونوں سلپس کھولیں.',
   'سٹاف کاپی پر رقم اور نام کنفرم کریں.',
   'مینیجر وصولی کرے، پھر فنانس یا بینک جمع.',
   'فنانس تصدیق کرے.'
 ],
 'اٹکی ہوئی کیش کی ٹائم لائن کھولیں.',
 array['صرف ایک سلپ.', 'وصولی کو جمع سمجھ لینا.', 'الرٹ چھوڑ دینا.'])
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();
