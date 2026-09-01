import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

/**
 * Is kisan par kya kya badla gaya.
 *
 * Sirf "kisi ne update kiya" likhna kaafi nahi tha. Asal sawal hafte
 * baad aata hai -- "is ka number pehle kya tha? kis ne badla?" -- aur
 * us ka jawab kahin nahi hota tha.
 *
 * Yahan sirf badle hue khane aate hain, poori qatar nahi: poori qatar
 * dikhane ka matlab hota ke aadmi ko do qataron ka milan khud karna
 * pare, aur wo koi nahi karta.
 */
export async function FarmerChangeHistory({ farmerId }: { farmerId: string }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("v_record_changes")
    .select("*")
    .eq("module", "farmers")
    .eq("record_id", farmerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("at_what_changed", lang)}</h2>
      <ul className="space-y-3">
        {rows.map((r) => {
          const changes = (r.changes ?? {}) as Record<string, { pehle: unknown; ab: unknown }>;
          return (
            <li key={r.id as string} className="border-b border-surface-100 pb-3 last:border-0 last:pb-0">
              <p className="text-xs text-surface-500">
                {new Date(r.created_at as string).toLocaleString()} · {r.actor_name as string}
                {r.actor_role ? ` (${r.actor_role})` : ""}
              </p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {Object.entries(changes).map(([field, v]) => (
                  <li key={field} className="text-surface-700 dark:text-surface-300">
                    <span className="font-medium">{field}:</span>{" "}
                    <span className="text-surface-500 line-through">{show(v.pehle)}</span>{" "}
                    <span aria-hidden>→</span> <span className="text-surface-900 dark:text-surface-100">{show(v.ab)}</span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Khali khane ko "—" dikhaya jata hai. "null" likh dena us bande ke
// liye koi matlab nahi rakhta jo ye fehrist parh raha hai.
function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "haan" : "nahi";
  return String(v);
}
