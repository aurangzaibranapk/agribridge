-- 400 ke baad feature_help theek karna -- Stage 3 ka tasdeeq wala
-- daayra ab is safhe ka hissa hai.

insert into public.feature_help
  (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes)
values (
  'system.owner_commands', 'rm',
  'Malik ne WhatsApp par jo bhi kaha ("is booking ka masla theek karo" waghera) uski fehrist. Jawab (tajweez) likhte hi wo WhatsApp par bhi chala jata hai; malik "haan" kahein to wo tajweez "Tasdeeq ho gayi" ban jati hai.',
  'Sirf Owner, Admin, Super Admin.',
  'Jab malik WhatsApp par koi hidayat bheje aur uska jawab dena ho, ya jab "Tasdeeq ho gayi" wali qatar par amal karna ho.',
  array[
    'Malik ka WhatsApp paigham yahan "received" ke sath aata hai (turant ek acknowledgment bhi WhatsApp par chala jata hai).',
    'Claude Code session "Jawab likhein" se ek tajweez jama karta hai -- wo seedha malik ke WhatsApp par bhi bhej di jati hai.',
    'Malik WhatsApp par "haan"/"theek hai" likhe to status "Tasdeeq ho gayi" ban jata hai (safhe par sab se upar, naranji lakeer ke sath) -- ye batata hai ke amal ab karna hai. "nahi" likhe to "Malik ne mana kar diya".',
    'Amal (asal fix) hamesha insaan (Claude Code session) khud karta hai -- ye safha khud kabhi kuch execute nahi karta.',
    'Kaam ho jane par "Kaam ho gaya" dabayein.'
  ],
  'Agar 24 ghante se zyada guzar chuka ho to WhatsApp par jawab nahi jayega -- malik ko dobara likhna hoga taake daayra khule.',
  array[
    'Ye samajh lena ke paigham aana hi kaam ho jana hai -- asal fix ab bhi alag se, Claude Code session mein, malik ki tasdeeq ke sath hota hai.',
    '"Tasdeeq ho gayi" dekh kar bhi amal na karna -- wo sirf malik ki haan hai, khud kuch nahi karta.'
  ]
)
on conflict (feature_key, lang) do update set
  purpose = excluded.purpose, who_uses = excluded.who_uses, when_use = excluded.when_use,
  how_steps = excluded.how_steps, next_step = excluded.next_step, mistakes = excluded.mistakes;
