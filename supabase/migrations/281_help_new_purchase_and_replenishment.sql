-- =====================================================================
-- AgriBridge — Migration 281: Kharid aur shop ki tajweez ka help
-- =====================================================================
-- Malik ka 7-nuqta usool: feature tab tak "poora" nahi jab tak us ka
-- help (feature_help) na ho. 280 ka naya safha aur "Nayi Kharid" ka
-- darwaza -- dono ka help yahan.
--
-- Do baatein jaan boojh kar likhi gayi hain, kyunke yahi teen dafa ghalat
-- samjhi gayi hain:
--   1. Manzoori "maal aa gaya" nahi hai. Stock ginti (GRN) par barhta hai.
--   2. "Din baqi" par "—" ka matlab raftaar maloom NAHI, sifar nahi.
-- =====================================================================

insert into feature_help (feature_key, lang, purpose, who_uses, when_use, how_steps, next_step, mistakes, related)
values
(
  'purchases', 'rm',
  'Supplier se maal kharidna: bill se ya haath se, phir manzoori aur godam mein ginti.',
  'Kharid ka staff banata hai; Owner/Admin/Manager manzoor karte hain.',
  'Jab supplier ka maal ya bill aaye.',
  array[
    'Nayi Kharid par teen raaste: AI se bill parhwayein (sab se tez), AI ko bol kar, ya haath se likhein.',
    'AI qatarein parhta hai aur product milata hai -- aap sirf jaanchte hain.',
    'Adaigi ki shart yahin likhein: poora / kuch / udhaar aur kitne din.',
    'Manzoori ke liye bhejein.',
    'Maal aane par godam mein ginti (Maal Aana): theek / toota / kam.'
  ],
  'Manzoori ke baad bhi stock nahi barhta -- wo ginti (GRN) par barhta hai.',
  array[
    'Manzoori ko "maal aa gaya" na samjhein: ye do alag qadam hain, jaan boojh kar.',
    'Bill par likhi ginti aur asal ginti alag ho to asal likhein -- kami/tootna chhupane se supplier ka dena ghalat ho jata hai.',
    'AI ka draft bina parhe manzoori ke liye na bhejein.'
  ],
  array['products.bill-rates','inventory.receiving','purchases.bills','suppliers']
),
(
  'stock-transfers', 'rm',
  'Godam se dukan ko maal bhejna: darkhwast, manzoori, dispatch, phir dukan mein ginti.',
  'Dukan ka staff darkhwast banata hai; godam bhejta hai.',
  'Jab dukan mein koi cheez kam paR jaye.',
  array[
    '"Shop ko kya chahiye" kholein -- 30 din ki bikri se system khud batata hai kya kam paR raha hai.',
    'Tadad theek karein (tajweez hai, hukm nahi) aur darkhwast bana dein.',
    'Godam manzoor kar ke maal bhejta hai -- us waqt maal "raaste mein" hota hai.',
    'Dukan maal receive kare: jitna waqai mila utna likhein.'
  ],
  'Receive karte waqt asal ginti likhein -- wohi dukan ke stock mein charhti hai.',
  array[
    'Bheja hua aur pahuncha hua maal ek nahi: dukan ka stock receive par barhta hai, dispatch par nahi.',
    'Ek darkhwast ek hi dukan ki hoti hai.',
    '"Din baqi" par "—" ka matlab hai raftaar maloom nahi (30 din mein bikri nahi hui) -- sifar nahi.'
  ],
  array['inventory','stock-ledger','agri-orders']
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
