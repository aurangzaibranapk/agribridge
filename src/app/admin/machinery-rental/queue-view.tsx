import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";

/**
 * Machinery ka kaam -- qatar ke hisaab se.
 *
 * Malik ki fehrist mein Machinery ke neeche chhe cheezein hain: Booking,
 * Machine Assignment, Harvest Schedule, Fuel/Expense, Work Completion,
 * Final Bill/Payment. Ye alag KAAM nahi hain -- ek hi booking ke chhe
 * QADAM hain, aur wo silsila pehle se bana hua hai (116).
 *
 * Jo cheez waqai nahi thi wo ye: staff ko nazar hi nahi aata tha ke
 * "mere intezar mein kya para hai". Booking ki poori fehrist mein sab
 * kuch ek sath hota hai, aur machine bhejne wale ko un mein se apni
 * qatar dhoondni paRti thi.
 *
 * Har qatar ka apna raasta hai, ek hi safhe ke bajaye. Wajah ijazat hai:
 * jo banda machine bhejta hai usay bill banane ki ijazat dena zaroori
 * nahi -- aur alag raaste hi alag ijazat bana sakte hain.
 *
 * Fehrist khud banti hai (v_machinery_queue). Booking jis qadam par khari
 * hai, usi qatar mein aa jati hai, aur agla qadam hote hi nikal jati
 * hai. Hath se banai fehrist wo booking bhool jati hai jise koi update
 * karna bhool gaya -- aur wohi booking sab se zyada tawajjo maangti hai.
 */
export type QueueKey = "rate_bhejna" | "tasdeeq_ka_intezar" | "machine_bhejna" | "kaam_darj_karna" | "bill_banana" | "paisa_lena";

const TITLE: Record<QueueKey, TranslationKey> = {
  rate_bhejna: "mq_rate_send",
  tasdeeq_ka_intezar: "mq_awaiting_confirm",
  machine_bhejna: "mq_dispatch",
  kaam_darj_karna: "mq_work",
  bill_banana: "mq_bill",
  paisa_lena: "mq_payment",
};

const HINT: Record<QueueKey, TranslationKey> = {
  rate_bhejna: "mq_rate_send_hint",
  tasdeeq_ka_intezar: "mq_awaiting_confirm_hint",
  machine_bhejna: "mq_dispatch_hint",
  kaam_darj_karna: "mq_work_hint",
  bill_banana: "mq_bill_hint",
  paisa_lena: "mq_payment_hint",
};

export async function MachineryQueue({
  queues,
  title,
  byDate = false,
}: {
  queues: QueueKey[];
  title: TranslationKey;
  /** Schedule wala roop: tarteeb tareekh ki, qatar ki nahi. */
  byDate?: boolean;
}) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const { data } = await supabase
    .from("v_machinery_queue")
    .select("*")
    .in("queue", queues)
    // Schedule par tareekh ki tarteeb -- agla kaam pehle. Baqi qataron
    // mein: jis ki tareekh guzar chuki wo sab se upar, phir sab se
    // purani. Ye tarteeb jaan boojh kar hai: qatar mein sab barabar nahi
    // hote.
    .order(byDate ? "preferred_date" : "tareekh_guzar_gayi", {
      ascending: byDate,
      nullsFirst: false,
    })
    .order("din_purani", { ascending: false });

  const rows = data ?? [];
  const byQueue = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = r.queue ?? "";
    byQueue.set(k, [...(byQueue.get(k) ?? []), r]);
  }

  return (
    <div>
      <PageHeader title={t(title, lang)} description={t("mq_subtitle", lang)} />

      {rows.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-surface-500">{t("mq_empty", lang)}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {queues
            .filter((q) => (byQueue.get(q) ?? []).length > 0)
            .map((q) => (
              <Card key={q} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-2 dark:border-surface-800">
                  <div>
                    <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
                      {t(TITLE[q], lang)}
                    </h2>
                    <p className="text-xs text-surface-500">{t(HINT[q], lang)}</p>
                  </div>
                  <Badge tone="blue">{(byQueue.get(q) ?? []).length}</Badge>
                </div>

                <div className="space-y-2">
                  {(byQueue.get(q) ?? []).map((b) => (
                    <Link
                      key={b.id}
                      href={`/admin/machinery-rental/booking/${b.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 p-3 transition hover:border-brand-400 dark:border-surface-700"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-brand-700 dark:text-brand-300">{b.booking_number}</span>
                          <span className="text-sm text-surface-800 dark:text-surface-100">{b.farmer_name}</span>
                          {b.tareekh_guzar_gayi && (
                            <Badge tone="red">
                              <AlertTriangle className="mr-1 inline h-3 w-3" />
                              {t("mq_date_passed", lang)}
                            </Badge>
                          )}
                          {/* "Khet tayyar nahi" machine bhejne se PEHLE
                              dekhna hota hai -- baad mein wo machine
                              khali wapas aati hai. */}
                          {q === "machine_bhejna" && b.field_ready === "no" && (
                            <Badge tone="amber">{t("mq_field_not_ready", lang)}</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-surface-500">
                          {[
                            b.machine_type_requested,
                            b.crop_type,
                            b.harvest_area ? `${b.harvest_area} acre` : null,
                            b.location_address,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="mt-0.5 text-xs text-surface-400">
                          {b.preferred_date && (
                            <>
                              <CalendarClock className="mr-1 inline h-3 w-3" />
                              {b.preferred_date} ·{" "}
                            </>
                          )}
                          {b.din_purani} {t("mq_days_old", lang)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-surface-400" />
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
