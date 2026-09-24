import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { RemindersClient } from "./reminders-client";

export const dynamic = "force-dynamic";

/**
 * Payment ki yaad dahani -- kis ko jani hai, aur kis ko ja chuki hai.
 *
 * Dono baatein ek hi safhe par, jaan boojh kar. Alag alag hon to banda
 * pehli fehrist dekh kar paighaam bhejta hai aur ye nahi dekhta ke wo
 * pehle hi ja chuka hai -- aur kisan ko ek hi din teen paighaam chale
 * jate hain.
 *
 * Adad kahin haath se nahi rakhe: wada, baqi, aakhri paighaam -- teenon
 * asal records se nikalte hain (164).
 */
export default async function PaymentRemindersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: due }, { data: sent }] = await Promise.all([
    supabase.from("v_machinery_payment_due").select("*").order("payment_promise_date", { nullsFirst: false }),
    supabase
      .from("machinery_payment_reminders")
      .select("id, booking_id, phone, amount, promise_date, status, error, created_at, sent_by")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const bookingNumbers = new Map<string, { number: string; farmer: string }>();
  (due ?? []).forEach((d) =>
    bookingNumbers.set(d.booking_id as string, {
      number: (d.booking_number as string) ?? "-",
      farmer: (d.farmer_name as string) ?? "-",
    })
  );

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/machinery-rental" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("mc_back", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mr_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mr_subtitle", lang)}</p>
      </div>

      <RemindersClient
        due={(due ?? []).map((d) => ({
          bookingId: d.booking_id as string,
          bookingNumber: (d.booking_number as string) ?? "-",
          farmerId: (d.farmer_id as string | null) ?? null,
          farmerName: (d.farmer_name as string | null) ?? "-",
          phone: (d.farmer_phone as string | null) ?? null,
          village: (d.village as string | null) ?? null,
          outstanding: Number(d.baqi ?? 0),
          promiseDate: (d.payment_promise_date as string | null) ?? null,
          promiseArrived: Boolean(d.wada_aa_gaya),
          lastReminder: (d.aakhri_reminder as string | null) ?? null,
          reminderCount: Number(d.kitne_reminder ?? 0),
          lastStatus: (d.aakhri_halat as string | null) ?? null,
        }))}
        sent={(sent ?? []).map((r) => ({
          id: r.id as string,
          bookingId: r.booking_id as string,
          bookingNumber: bookingNumbers.get(r.booking_id as string)?.number ?? "-",
          farmerName: bookingNumbers.get(r.booking_id as string)?.farmer ?? "-",
          phone: (r.phone as string | null) ?? null,
          amount: Number(r.amount ?? 0),
          status: r.status as string,
          error: (r.error as string | null) ?? null,
          sentAt: r.created_at as string,
          bySystem: r.sent_by === null,
        }))}
      />
    </div>
  );
}
