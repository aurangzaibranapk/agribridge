import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { RateCardClient } from "./rate-card-client";

export const dynamic = "force-dynamic";

/**
 * Rate card -- fasal aur machine ke hisaab se default rate (177).
 *
 * Ab tak har booking par rate naye sire se likha jata tha. Pichli
 * booking se andaza aa jata tha, magar wo PICHLI booking ka rate hota
 * tha -- kisi doosri fasal ka, kisi doosri machine ka.
 *
 * Ye safha sirf DEFAULT tay karta hai. Booking par rate ka malik wohi
 * hai jo pehle tha, aur staff wahan jo marzi likhe -- upar ya neeche.
 */
export default async function RateCardPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: cards }, { data: crops }] = await Promise.all([
    supabase
      .from("machinery_rate_cards")
      .select("*")
      .order("harvest_type")
      .order("effective_from", { ascending: false }),
    supabase.from("crops").select("key, label, label_en, label_ur").eq("is_active", true).order("sort_order"),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  // Rate karobar ka faisla hai, roz ka indraj nahi. Yehi rok database
  // par bhi lagi hui hai -- yahan wo sirf screen par nazar aati hai.
  const canEdit = ["owner", "super_admin", "admin"].includes(me?.role ?? "");

  const cropLabel = (c: { key: string; label: string; label_en: string | null; label_ur: string | null }) =>
    lang === "en" ? c.label_en || c.label : lang === "ur" ? c.label_ur || c.label : c.label;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mrc_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mrc_subtitle", lang)}</p>
      </div>

      {/* Ye jumla safhe par is liye hai ke rate card ko "bill ka rate"
          samajh lena sab se aasan ghalti hai -- aur sab se mehngi. */}
      <div className="rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
        {t("mrc_not_owner", lang)}
      </div>

      <RateCardClient
        cards={(cards ?? []).map((c) => ({
          id: c.id,
          crop_key: c.crop_key,
          machine_type: c.machine_type,
          harvest_type: c.harvest_type as "sabit" | "kutra",
          rate: Number(c.rate),
          effective_from: c.effective_from,
          is_active: c.is_active,
          notes: c.notes,
        }))}
        crops={(crops ?? []).map((c) => ({ key: c.key, label: cropLabel(c) }))}
        canEdit={canEdit}
      />
    </div>
  );
}
