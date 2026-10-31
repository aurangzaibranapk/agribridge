-- 730: Pending Approvals — Dekhein popup ki madad.
-- Koi table, koi column, koi journal nahi. Sirf feature_help ka matn.
-- Faisla ab bhi purane actions par: kharcha, mazdoori, supplier request.
-- Pehle Testing. Live par tab jab backup verify ho.
-- Rollback: 730_pending_popup_help.rollback.sql

update public.feature_help set
  how_steps = array[
    'Dekhein se item isi safhe par khulta hai. Kholein doosra raasta hai.',
    'Kharcha: tasdeeq, manzoor, radd aur theek — wahi Paisa & Khata ke actions. Manzoor se pehle tasdeeq.',
    'Mazdoori: manzoor par raye lazmi, radd par wajah. Apni entry Manager khud nahi.',
    'Finance queue ki supplier request: approve, reject, theek — wahi purane actions. Khata na ho to approve se pehle chunein.',
    'Work handoff aur WhatsApp alert: poori khabar. Un par alag approve nahi.',
    'Agar hawala kisi kharche ya supplier request par hai to us record ka faisla isi popup se ho sakta hai.'
  ],
  next_step = 'Faisla popup se, ya Kholein se asal safhe par. Kitab sirf purani manzoori par hilti hai.',
  mistakes = array[
    'Manager apni entry khud approve nahi karta.',
    'Kharcha manzoor se pehle tasdeeq (verified) chahiye.',
    'Tasdeeq shuda kharche ka raqam ya khata badalne par tasdeeq khatam, dubara pending.',
    'WhatsApp alert ki qatar manzoori nahi — bhejne ka kaam alag hai.',
    'Sifar aur parha nahi ja saka ek cheez nahi.'
  ],
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'rm';

update public.feature_help set
  how_steps = array[
    'View opens the item on this page. Open is the secondary link.',
    'Expenses: verify, approve, reject and edit use the Paisa & Khata actions. Approve needs verification first.',
    'Labour: approve needs a note. Reject needs a reason. A manager cannot decide their own entry.',
    'Finance queue supplier requests: approve, reject and edit use the existing actions. Pick an account when the request has none.',
    'Work handoffs and WhatsApp alerts are a full view only. They have no separate approve.',
    'If a handoff points at an expense or supplier request, that record can be decided in the same popup.'
  ],
  next_step = 'Decide in the popup, or open the original page. The books move only on the existing approval.',
  mistakes = array[
    'A manager never approves their own entry.',
    'An expense must be verified before final approval.',
    'Changing the amount or account of a verified expense clears verification.',
    'A WhatsApp alert row is a send queue, not an approval.',
    'Unread is not zero.'
  ],
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'en';

update public.feature_help set
  how_steps = array[
    'دیکھیں سے چیز اسی صفحے پر کھلتی ہے۔ کھولیں دوسرا راستہ ہے۔',
    'خرچہ: تصدیق، منظور، مسترد اور درست — وہی پرانے اعمال۔',
    'مزدوری اور سپلائر درخواست بھی وہی پرانے اعمال۔',
    'کام حوالہ اور واٹس ایپ الرٹ صرف پوری خبر۔ الگ منظوری نہیں۔'
  ],
  next_step = 'فیصلہ پاپ اپ سے، یا اصل صفحے پر۔ کتاب صرف پرانی منظوری پر ہلتی ہے۔',
  mistakes = array[
    'مینیجر اپنی اندراج خود منظور نہیں کرتا۔',
    'خرچہ منظور سے پہلے تصدیق۔',
    'واٹس ایپ الرٹ منظوری نہیں۔'
  ],
  updated_at = now()
where feature_key = 'pending-approvals' and lang = 'ur';
