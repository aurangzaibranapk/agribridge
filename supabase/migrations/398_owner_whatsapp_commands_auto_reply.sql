-- Command Center Stage 2 (Step 2) -- jawab ab seedha WhatsApp par jata
-- hai (sendWhatsAppMessage, wahi raasta jo hazri/milk ke jawab bhejta
-- hai). 397 ke waqt ye raasta nahi bana tha, is liye feature_help theek
-- kar rahe hain taake ghalat baat na likhi rahe.

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'system.owner_commands', 'rm',
  'Malik ne WhatsApp par jo bhi kaha ("is booking ka masla theek karo" waghera) uski fehrist. Jawab likhte hi wo seedha malik ke WhatsApp par bhi chala jata hai.',
  'Sirf Owner, Admin, Super Admin.',
  'Jab malik WhatsApp par koi hidayat bheje aur uska jawab dena ho.',
  array[
    'Malik ka WhatsApp paigham yahan "received" ke sath aata hai (turant ek acknowledgment bhi WhatsApp par chala jata hai).',
    'Claude Code session usay dekh kar "Jawab likhein" se jawab jama karta hai -- jama hote hi wo seedha malik ke WhatsApp number par bhi bhej diya jata hai.',
    'Agar WhatsApp par bhejna nakaam ho (jaise 24 ghante ka waqt guzar chuka ho), jawab yahan phir bhi darj rehta hai -- safha khud bata deta hai ke WhatsApp par nahi gaya.',
    'Kaam ho jane par "done" mark karein.'
  ],
  'Agar malik dobara WhatsApp par kuch likhe (chahe sirf "theek hai"), 24 ghante ka daayra naya ho jata hai.',
  array[
    'Ye samajh lena ke paigham aana hi kaam ho jana hai -- asal fix ab bhi alag se, Claude Code session mein, malik ki tasdeeq ke sath hota hai.',
    '24 ghante se zyada purane paigham par jawab likhna -- WhatsApp par nahi jayega, safha par hi rah jayega.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;
