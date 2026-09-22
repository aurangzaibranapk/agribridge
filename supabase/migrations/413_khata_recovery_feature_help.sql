-- =====================================================================
-- AgriBridge — Migration 413: Khata Recovery (finance.recovery) ka help
-- =====================================================================
-- Malik ke "feature poora" usool (2 September) mein Help lazmi hissa
-- hai. /admin/finance/recovery (feature key: finance.recovery, migration
-- 395 se maujood, 411 mein farmer ka combined balance jura) ka ab tak
-- koi feature_help row hi nahi tha -- "? Samjhein" panel khali khulta.

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'finance.recovery', 'rm',
  'Kis kis se kitna lena hai -- customer, farmer, dealer, supplier -- sab ek fehrist mein, sab se ooncha baqaya sab se upar. Farmer ka baqaya machine + doodh + khad/input + POS, chaaron jama kar ke ek qatar mein (411).',
  'Owner/Admin aur Finance Team -- yaad dihani bhejna aur wapsi ka pichha karna.',
  'Roz ya haftay mein ek dafa -- dekhna hai ke kis se lena baqi hai, aur reminder/statement bhejna hai.',
  array[
    'Fehrist khud upar-neeche ooncha baqaya pehle dikhati hai. Naam ya phone se search kar sakte hain.',
    'Har qatar ke type se pehchanen -- Customer/Farmer/Dealer/Supplier -- filter se ek qism chun sakte hain.',
    'Farmer ki qatar mein machine, doodh, khad, aur POS chaaron ka jama hai -- alag alag dekhne ke liye us farmer ka apna safha kholein.',
    '"Statement" se us party ka poora hisaab bhej sakte hain (customer ke liye WhatsApp/email statement bhi).',
    'Reminder Template se yaad dihani bhejein -- "Aaj wapis mila" upar khud dikh jata hai (ledger se seedha, is safhe ki apni qatar nahi).'
  ],
  'Ek dafa reminder bhej dein to "Last Reminder" tareekh us qatar par aa jati hai, taake dobara dobara ek hi din na bheja jaye.',
  array[
    'Due date hamesha ANDAZA hai (aakhri lena-dena + credit din) -- asal wada tareekh nahi, is liye far ho sakta hai.',
    'Jis farmer ka POS customer se link nahi (phone match nahi hua), us ka POS hissa is fehrist mein FARMER ki qatar mein nahi, alag "Customer" qatar mein reh sakta hai -- CRM se link check karein.',
    'Sifar ya khali baqaya matlab "kuch lena nahi" hai, "track nahi hoti" nahi -- agar kisi farmer ka koi hissa (machine/doodh/khad/POS) system mein hai hi nahi to wo qatar mein aayega hi nahi.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'finance.recovery', 'en',
  'Who owes what -- customers, farmers, dealers, suppliers -- one list, highest outstanding first. A farmer''s outstanding combines machinery + milk + input credit + POS into one row.',
  'Owner/Admin and Finance -- sending reminders and chasing collections.',
  'Daily or weekly -- to see who still owes, and send reminders or statements.',
  array[
    'The list sorts by outstanding, highest first. Search by name or phone.',
    'Filter by type -- Customer/Farmer/Dealer/Supplier.',
    'A farmer row combines machinery, milk, input credit and POS -- open that farmer''s own page for the breakdown.',
    'Use Statement to send a full account (WhatsApp/email for customers).',
    'Send reminders from a template -- "Collected Today" updates automatically from the ledger.'
  ],
  'Sending a reminder sets "Last Reminder" on that row so it is not sent twice the same day.',
  array[
    'Due date is always an ESTIMATE (last activity + credit days), not a real promised date.',
    'A farmer whose POS customer is not linked (phone did not match) may still show as a separate Customer row -- check the CRM link.',
    'Zero or missing means nothing owed, not "not tracked" -- if a farmer has no record in machinery/milk/khad/POS at all, they simply will not appear.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;
