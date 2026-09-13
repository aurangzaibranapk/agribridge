"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Radio } from "lucide-react";

/**
 * Safha khud taaza ho jaye — jab database mein kuch badle.
 *
 * =====================================================================
 * MALIK KI FARMAISH (6 September)
 * =====================================================================
 *
 *   *"Bilkul live push hona chahiye, wo bilkul aana chahiye. Hamein to
 *   har kaam realtime mein chahiye na — hamein ye nahi chahiye ke 10 din
 *   ke baad pata chale."*
 *
 * Pehle "realtime" ka matlab sirf itna tha ke safha KHULTE waqt taaza
 * adad aate hain. Khuli hui screen wahin ki wahin khari rehti thi: dukan
 * par kharcha darj hota rehta aur malik ke saamne purana adad laga
 * rehta.
 *
 * =====================================================================
 * NAYA SAFHA NAHI — MAUJOOD SAFHE HI ZINDA HO GAYE
 * =====================================================================
 *
 * Malik ka doosra usool: *"pehle bane ko update karo... ek hi kaam baar
 * baar naye tag naye naam ke sath nahi hone chahiye."*
 *
 * Is liye ye ek CHHOTA component hai, koi naya safha nahi. Jis safhe par
 * ye lag jata hai, wo safha zinda ho jata hai — aur us ke andar ka koi
 * hisaab badalna nahi parta.
 *
 * =====================================================================
 * YE DATA KHUD NAHI PARHTA — SAFHE SE DOBARA PARHWATA HAI
 * =====================================================================
 *
 * Ye sun kar sirf `router.refresh()` chalata hai. Server component apna
 * hisaab dobara lagata hai aur nayi qatarein le aata hai.
 *
 * Wajah ye hai ke har safhe ka hisaab alag hai (kahin ledger se, kahin
 * Cash Book se, kahin dono se). Agar ye component khud qatarein parh kar
 * screen par jorta, to har safhe ka hisaab DO jagah lagta — ek server
 * par, ek yahan — aur wo do adad ek din alag ho jate. Ye ghalti is
 * project mein pehle ho chuki hai (127).
 *
 * =====================================================================
 * HAR TABDEELI PAR FORAN NAHI — CHHOTA SA WAQFA
 * =====================================================================
 *
 * Ek POS ki bikri se kai qatarein ek sath banti hain (sale, items,
 * journal, cash book). Har ek par safha dobara khinchna server par bojh
 * bhi hai aur screen bhi kanpti hai. Is liye tabdeeliyan jama hoti hain
 * aur thora ruk kar EK dafa safha taaza hota hai.
 */
export function LiveRefresh({
  tables,
  label = "Live",
  waqfaMs = 1500,
}: {
  /** Kin tables par nazar rakhni hai. */
  tables: string[];
  label?: string;
  waqfaMs?: number;
}) {
  const router = useRouter();
  const [zinda, setZinda] = useState(false);
  const [aakhri, setAakhri] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`live-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`);

    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setAakhri(new Date());
          router.refresh();
        }, waqfaMs);
      });
    }

    channel.subscribe((status) => {
      // "Live" ka nishan sirf us waqt jab waqai judaav ho.
      //
      // Jhoota nishan sab se mehnga hota hai: banda "Live" dekh kar
      // yaqeen kar leta hai ke adad taaza hain, aur adad wahin ke wahin
      // khare rehte hain. Is liye judaav toot-te hi nishan bhi chala
      // jata hai.
      setZinda(status === "SUBSCRIBED");
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), waqfaMs]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        zinda
          ? "bg-emerald-50 text-emerald-700 dark:bg-surface-800 dark:text-emerald-400"
          : "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400"
      }`}
      title={
        zinda
          ? "Safha khud taaza hota rehta hai — kuch badla to foran nazar aayega."
          : "Live judaav nahi mila. Adad safha kholte waqt ke hain; taza karne ke liye safha refresh karein."
      }
    >
      <Radio className={`h-3 w-3 ${zinda ? "animate-pulse" : ""}`} />
      {zinda ? label : "Live nahi"}
      {aakhri && zinda && <span className="text-[10px] opacity-70">{aakhri.toLocaleTimeString()}</span>}
    </span>
  );
}
