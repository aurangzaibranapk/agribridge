-- =====================================================================
-- AgriBridge — Migration 315: AgriBridge Inbox
-- =====================================================================
-- Malik ka naqsha (5 September): har channel (WhatsApp, website,
-- marketplace, AI, staff) ka kaam usi ek ERP mein jaye, aur bande ko ye
-- na sochna paRe ke module kaunsa hai.
--
-- Us naqshe ka bara hissa pehle se bana hua tha -- Command Center, Mera
-- Kaam, department workspaces, approvals, audit. Jo cheez WAQAI nahi thi
-- wo ek darwaza hai. Bahar ka kaam aaj CHHE alag jaghon par girta hai:
--
--   whatsapp_submissions       -> /admin/submissions
--   bridge_ai_action_requests  -> /admin/bridge-ai/action-requests
--   contact_messages           -> /admin/contact-messages
--   agri_orders                -> /admin/agri-orders
--   access_requests            -> /admin/access-requests
--   suggestions                -> /admin/improvements
--
-- Har ek apna safha khulne ka intezar karta hai. Jo safha kisi ne aaj
-- nahi khola, us mein para kaam kisi ko nazar nahi aaya -- aur "kisi ko
-- nazar nahi aaya" is project ka sab se mehnga masla hai.
--
-- Ye migration koi nayi table nahi banati aur koi data nahi hilati.
-- Safha khud bhi kuch nahi badalta: wo sirf DIKHATA hai aur us safhe par
-- BHEJTA hai jahan kaam hota hai. Har faisla, manzoori aur audit apni
-- jagah, apne purane qaidon ke sath.
--
-- Is liye ye feature "sensitive" nahi hai, aur qatarein bande ke apne
-- allowed routes se chhanti hain -- band darwaze ka kaam kisi ko nahi
-- dikhta.
-- =====================================================================

insert into public.features (key, label, label_en, label_ur, route, icon, is_sensitive, description, description_en, description_ur, is_active)
values (
  'inbox',
  'AgriBridge Inbox',
  'AgriBridge Inbox',
  'اگری برج اِن باکس',
  '/admin/inbox',
  'Inbox',
  false,
  'Bahar se aane wala kaam ek jagah — WhatsApp, website, marketplace, AI ka draft aur ijazat ki darkhwast.',
  'Work arriving from outside in one place — WhatsApp, website, marketplace, AI drafts and access requests.',
  'باہر سے آنے والا کام ایک جگہ — واٹس ایپ، ویب سائٹ، مارکیٹ پلیس، اے آئی اور اجازت کی درخواست۔',
  true
)
on conflict (key) do update set
  label = excluded.label,
  label_en = excluded.label_en,
  label_ur = excluded.label_ur,
  route = excluded.route,
  icon = excluded.icon,
  is_sensitive = excluded.is_sensitive,
  description = excluded.description,
  description_en = excluded.description_en,
  description_ur = excluded.description_ur,
  is_active = true;

-- Master Command ke sab se upar -- ye pehla safha hai jo subah khulta
-- hai, kisi department ka auzaar nahi.
insert into public.dashboard_features (dashboard_key, feature_key, sort_order, section)
values ('master', 'inbox', 5, null)
on conflict (dashboard_key, feature_key) do update set sort_order = excluded.sort_order;

-- Help usi commit mein (malik ka 2 September wala usool: feature ke sath
-- us ki feature_help qatar bhi jaye).
insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'inbox',
  'rm',
  'Bahar se aane wala saara kaam ek jagah: WhatsApp par staff ka bheja hua, website ka rabta form, marketplace ka order, AI ka banaya hua draft, ijazat ki darkhwast aur behtari ki tajweez.',
  'Har wo banda jis ke paas in mein se koi safha khulta hai. Qatar sirf usay dikhti hai jis par us ka safha khulta ho.',
  'Din shuru karte waqt. Ye pehla safha hai — is ke baad "Mera Kaam" par apne assign shuda kaam.',
  ARRAY[
    'Upar rangeen chip dekh kar andaza lagayein ke kis channel se kitna kaam aaya hai.',
    'Qatar par click karein — system aap ko seedha us safhe par le jayega jahan us ka kaam hota hai.',
    'Faisla wahin karein: manzoori, jawab ya rad — jaise pehle karte the.',
    'Wapas Inbox par aayein; jo nipat gaya wo khud fehrist se nikal jata hai.'
  ],
  'Inbox khali ho jaye to "Mera Kaam" par jayein — wahan aap ke apne zimme ka kaam hai.',
  ARRAY[
    'Khali Inbox ko "kaam hi nahi hai" na samjhein agar upar peela paighaam likha ho — us ka matlab hai ke koi channel is waqt parha nahi ja saka.',
    'Yahan se kuch manzoor ya rad nahi hota. Ye safha sirf dikhata aur pahunchata hai — faisla apne safhe par hota hai, us ke apne qaidon ke sath.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  updated_at = now();
