-- =====================================================================
-- AgriBridge — Migration 276: Assistant + Messages ek panel mein
-- =====================================================================
-- Malik ka faisla (3 September): "My Work" ke upar wala AI box aur right
-- side ka Messages widget do alag tajurbe lagte the. Ab ek hi floating
-- panel: Assistant | Messages | Tajaweez.
--
-- Backend phir bhi ALAG rehte hain (malik ka architecture rule):
--   AI baat cheet   -> Work Coach (/api/bridge-ai)
--   Insani paighaam -> staff_messages
--   Tajweez         -> suggestions
--   Ijazat          -> access_requests
-- UI ek jagah, record alag -- warna audit aur ijazat gaddmadd ho jate.
--
-- Yahan sirf do cheezein: ek se ziyada bandon ko bheje gaye paighaam ka
-- audit, aur panel ka help content.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Ek se ziyada bandon ko bheja gaya paighaam -- ka record
-- ---------------------------------------------------------------------
-- staff_messages mein har banday ki apni qatar banti hai. Us se ye pata
-- nahi chalta ke "ye 19 qatarein dar-asal EK elaan thin". Elaan ghalti se
-- chala jaye to sawal yehi hota hai: kis ne, kab, kitnon ko, kya bheja.
create table if not exists staff_message_broadcasts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references profiles(id),
  -- 'all' = poore idare ko elaan, 'department' = ek department ko.
  scope text not null check (scope in ('all','department')),
  department_key text,
  recipient_count integer not null default 0,
  message text,
  attachment_url text,
  created_at timestamptz not null default now(),
  constraint staff_broadcast_dept_needed check (scope <> 'department' or department_key is not null)
);

create index if not exists idx_staff_broadcasts_sender on staff_message_broadcasts(sender_id, created_at desc);
create index if not exists idx_staff_broadcasts_scope on staff_message_broadcasts(scope, created_at desc);

alter table staff_message_broadcasts enable row level security;

drop policy if exists smb_read on staff_message_broadcasts;
-- Apna bheja hua har koi dekh sakta hai; sab ka bheja hua sirf wo jo
-- ijazat ka jaiza le sakte hain (owner/admin/manager/department head).
create policy smb_read on staff_message_broadcasts for select to authenticated
  using (sender_id = auth.uid() or fn_can_review_access());

-- Likhna sirf server (service role) se -- wahan ginti aur ijazat dono
-- jaanchi jati hain.

-- ---------------------------------------------------------------------
-- 2. Help content -- "?" panel aur Work Coach dono yahi parhte hain
-- feature_help ki qatar `features` se juri hui hai, is liye panel ki
-- madad `messages` feature ke neeche likhi hai -- panel usi cheez ka
-- naya chehra hai, alag feature nahi.
-- ---------------------------------------------------------------------
insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, related)
values (
  'messages', 'rm',
  'Ek hi jagah se: AI se kaam poochna, sathi ya department ko paighaam, aur tajweez dena.',
  'Har staff. Elaan (sab ko paighaam) sirf Owner/Admin/Manager.',
  'Jab samajh na aaye ke kaam kahan se shuru karein, ya kisi ko batana ho.',
  array[
    'Neeche daayen kone ka gol button dabayein -- panel khul jayega.',
    'Assistant: seedha likh dein "mujhe stock ledger dekhna hai" ya screenshot laga dein.',
    'AI ijazat ki darkhwast ya tajweez ka DRAFT banata hai -- bhejna aap ke haath mein hai.',
    'Paighaam: naam ya department dhoondein, phir likhein. Purani baat cheet upar "Haal hi mein" mein.',
    'Tajaweez: apni bheji hui tajweez aur us ka darja yahan.'
  ],
  'AI jo draft banaye us par "Bhej dein" dabana zaroori hai -- AI khud kuch mehfooz nahi karta.',
  array[
    'Sab ko elaan bhejne se pehle ginti parh lein -- paighaam wapas nahi aata.',
    'Department chunne par sirf usi department ko jata hai, poore idare ko nahi.',
    'AI se ki gayi baat insani paighaam nahi hai -- wo kisi sathi tak nahi pahunchti.'
  ],
  array['access-requests','improvements','my-access']
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose,
  who_uses = excluded.who_uses,
  when_use = excluded.when_use,
  how_steps = excluded.how_steps,
  next_step = excluded.next_step,
  mistakes = excluded.mistakes,
  related = excluded.related,
  updated_at = now();
