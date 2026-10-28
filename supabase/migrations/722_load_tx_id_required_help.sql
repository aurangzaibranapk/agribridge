-- =====================================================================
-- 722: Load / bill / bank transfer — Tx ID lazmi. Sirf Help ka matn.
-- 721 cash-custody help hai (PR #234). Ye us se alag hai.
-- =====================================================================
-- Koi column nahi, koi nullability nahi. Nayi entry code mein rokta
-- hai (createLoadTransaction / createBankTransfer). Yahan sirf staff
-- Help, taake "baad mein saboot" wala qadam na rahe.
--
-- Purani saboot_baqi qatarein (My Work: Load proof missing) waise hi
-- rehti hain. Un par TID aaj bhi Today ke transactions se lagti hai.
--
-- Live par mat chalao jab tak backup verify na ho.
-- Pehle Testing (hwaiuwxqldxsoukkfefn), phir Live (ktskwawkslaznkjjacni).

update public.feature_help
set how_steps = case
      when how_steps @> array['Use Save as Pending Proof when the customer has not paid or provider evidence is still missing.']::text[]
      then array_replace(
        how_steps,
        'Use Save as Pending Proof when the customer has not paid or provider evidence is still missing.',
        'Mobile Load, Bill Payment, aur Bank Transfer par transaction ID (Trex / Tx ID) lazmi likhein. Bina is ke save nahi hota.'
      )
      else how_steps
    end,
    mistakes = case
      when mistakes @> array['"Saboot baqi" ka matlab "nakaam" nahi. Us ka matlab hai ke kaam ho gaya magar provider ki TID abhi nahi lagi. TID lagate hi wo "darj" ho jata hai.']::text[]
      then array_replace(
        mistakes,
        '"Saboot baqi" ka matlab "nakaam" nahi. Us ka matlab hai ke kaam ho gaya magar provider ki TID abhi nahi lagi. TID lagate hi wo "darj" ho jata hai.',
        'Nayi load (LD-) ya bill (BP-) bina Tx ID (Trex ID) ke save nahi hoti, is liye naya "Load proof missing" nahi banta. Purani "saboot baqi" qatarein tab tak rehti hain jab tak un par TID na lag jaye — wo nakaam nahi, sirf purana saboot baqi hai.'
      )
      else mistakes
    end,
    updated_at = now()
where feature_key = 'load-bill' and lang = 'rm';
