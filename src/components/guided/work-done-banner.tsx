import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import type { Lang } from "@/lib/i18n/translations";

/**
 * Sabz patti: "ye kaam poora hua -- ab agla qadam wahan, us ka."
 *
 * Malik ka kehna (4 September): "jis page ka kaam complete ho neeche
 * green line aaye aur paighaam ke ab is page par is ka kaam hai."
 *
 * Ye patti sirf khushkhabri nahi -- wo do sawal ek sath khatam karti
 * hai jo har staff roz poochta hai: "mera kaam ho gaya?" aur "ab kis
 * ki baari hai?" Doosra sawal ahem tar hai. Kaam ruka nahi hota; agle
 * bande ko pata hi nahi hota ke us ki baari aa gayi.
 *
 * Naam bhi likha jata hai. "Ab warehouse ka kaam hai" se banda ye nahi
 * samajhta ke khabar wahan pahunch bhi gayi ya nahi. Is liye patti ye
 * batati hai ke KHABAR JA CHUKI HAI -- taake banda phone karne ke
 * bajaye apne agle kaam par jaye.
 */

export async function WorkDoneBanner({
  recordTable,
  recordId,
  lang,
}: {
  recordTable: string;
  recordId: string;
  lang: Lang;
}) {
  const supabase = createClient();

  // Isi record par jo kaam aage bheja gaya. Sirf khuli qatarein --
  // jo ho chuka us ka elaan karna purani khabar dohrana hai.
  //
  // Embed (features!...) jaan boojh kar nahi. PostgREST ka embed schema
  // cache par chalta hai aur nakaam hone par KHALI lauta deta hai, koi
  // ghalti nahi -- yani patti chup chaap gayab ho jati aur kisi ko
  // pata na chalta. Safhe ka naam alag sawal se aata hai.
  const { data: rows } = await supabase
    .from("work_handoffs")
    .select("id, to_feature, to_route, title, message, to_roles")
    .eq("record_table", recordTable)
    .eq("record_id", recordId)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) return null;

  const { data: feats } = await supabase
    .from("features")
    .select("key, label")
    .in("key", Array.from(new Set(rows.map((r) => r.to_feature))));
  const labelByKey = new Map((feats ?? []).map((f) => [f.key, f.label]));

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const label = labelByKey.get(r.to_feature);

        return (
          <div
            key={r.id}
            className="flex items-start gap-3 rounded-card border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{r.title}</p>
              <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">{r.message}</p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                {t("wd_sent_to", lang)}: {(r.to_roles ?? []).join(", ") || "—"}
              </p>
            </div>
            <Link
              href={r.to_route}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              {label ?? t("wd_open", lang)}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        );
      })}
    </div>
  );
}
