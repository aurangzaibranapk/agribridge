-- 722 rollback: Help ka purana matn. Code ki Tx ID rok is se nahi hat-ti.

update public.feature_help
set how_steps = array_replace(
      how_steps,
      'Mobile Load, Bill Payment, aur Bank Transfer par transaction ID (Trex / Tx ID) lazmi likhein. Bina is ke save nahi hota.',
      'Use Save as Pending Proof when the customer has not paid or provider evidence is still missing.'
    ),
    mistakes = array_replace(
      mistakes,
      'Nayi load (LD-) ya bill (BP-) bina Tx ID (Trex ID) ke save nahi hoti, is liye naya "Load proof missing" nahi banta. Purani "saboot baqi" qatarein tab tak rehti hain jab tak un par TID na lag jaye — wo nakaam nahi, sirf purana saboot baqi hai.',
      '"Saboot baqi" ka matlab "nakaam" nahi. Us ka matlab hai ke kaam ho gaya magar provider ki TID abhi nahi lagi. TID lagate hi wo "darj" ho jata hai.'
    ),
    updated_at = now()
where feature_key = 'load-bill' and lang = 'rm';
