import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

export const dynamic = "force-dynamic";

/**
 * Arhti Board -- hamara paisa is waqt kis ke paas khara hai.
 *
 * Malik ka sawal do hisson mein hai, aur dono ka jawab yahan alag alag
 * hai:
 *
 *   ARHTI KI TARAF  -- kis ke zimme kitna, aur kitne din se
 *   KISAN KI TARAF  -- ye raqam thi kis ki, aur ab kahan hai
 *
 * Doosra sawal isliye zaroori hai ke kisan ke khate se wo raqam SAAF ho
 * chuki hoti hai -- wohi to maqsad tha. Agar us ke baad kahin ye likha
 * hua na ho ke wo kahan gayi, to teen mahine baad koi nahi bata sakta ke
 * us kisan ka wo aTharah hazaar tha kya, aur gaya kahan.
 *
 * DIN GINE JATE HAIN. "Rs 63,125 baqi" akela ye nahi batata ke wo kal ka
 * hai ya chhe mahine purana -- aur baat karte waqt farq isi se parta
 * hai.
 *
 * ADAD YAHAN DOBARA NAHI GINE JATE: dono view (v_crop_lifter_balances
 * aur v_crop_lift_trace) wohi qaida parhti hain jo bill banate waqt laga
 * tha.
 */
export default async function ArhtiBoardPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const [{ data: balances }, { data: trace }, { data: recent }] = await Promise.all([
    supabase.from("v_crop_lifter_balances").select("*").order("baqi", { ascending: false }),
    supabase.from("v_crop_lift_trace").select("*").order("din", { ascending: false }),
    supabase
      .from("crop_lifter_payments")
      .select("amount, payment_date, crop_lifters(name)")
      .order("payment_date", { ascending: false })
      .limit(10),
  ]);

  const rows = (balances ?? []).map((b: any) => ({
    id: b.lifter_id as string,
    name: (b.name as string) ?? "—",
    phone: (b.phone as string) ?? "",
    village: (b.village as string) ?? "",
    kattai: Number(b.kattai_ka_zimma ?? 0),
    purana: Number(b.purana_baqi_ka_zimma ?? 0),
    commission: Number(b.commission_bana ?? 0),
    diya: Number(b.diya ?? 0),
    baqi: Number(b.baqi ?? 0),
    bookings: Number(b.uthai_hui_bookings ?? 0),
    active: b.is_active as boolean,
  }));

  const lines = (trace ?? []).map((t: any) => ({
    liftId: t.lift_id as string,
    bookingId: t.booking_id as string,
    bookingNumber: (t.booking_number as string) ?? "—",
    farmerId: t.farmer_id as string | null,
    farmerName: (t.farmer_name as string) ?? "—",
    village: (t.village as string) ?? "",
    lifterId: t.lifter_id as string,
    lifterName: (t.lifter_name as string) ?? "—",
    kattai: Number(t.kattai ?? 0),
    purana: Number(t.purana ?? 0),
    commission: Number(t.commission ?? 0),
    kul: Number(t.kul ?? 0),
    reliable: t.farmer_old_due_reliable as boolean | null,
    din: Number(t.din ?? 0),
  }));

  // Sab se purana kis ke paas -- ye wo adad hai jis par sab se pehle
  // baat karni hoti hai.
  const oldestDays = lines.reduce((m, l) => Math.max(m, l.din), 0);

  const kulBaqi = rows.reduce((s, r) => s + r.baqi, 0);
  const kulKattai = rows.reduce((s, r) => s + r.kattai, 0);
  const kulPurana = rows.reduce((s, r) => s + r.purana, 0);
  const kulCommission = rows.reduce((s, r) => s + r.commission, 0);
  const zimmedar = rows.filter((r) => r.baqi > 0).length;

  // Ek arhti ke paas sab se purani raqam kitne din se.
  const oldestBy = new Map<string, number>();
  lines.forEach((l) => oldestBy.set(l.lifterId, Math.max(oldestBy.get(l.lifterId) ?? 0, l.din)));

  return (
    <div>
      <PageHeader
        title={t("ar_board_title", lang)}
        description={t("ar_board_subtitle", lang)}
      />

      <div className="mb-2">
        <Link href="/admin/machinery-rental/lifters" className="text-sm text-brand-600 hover:underline">
          ← {t("ar_lifters_list", lang)}
        </Link>
      </div>

      {/* Sab se upar wohi ek adad jis ke liye ye safha bana hai. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs font-medium uppercase tracking-wide text-red-600">{t("ar_money_with_them", lang)}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-red-700">
            Rs {kulBaqi.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-red-700/70">{t("ar_held_by_n", lang).replace("{n}", String(zimmedar))}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ar_kattai_zimma", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums">Rs {kulKattai.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("ar_farmers_old_dues", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums">Rs {kulPurana.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">{t("ar_our_commission", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold tabular-nums text-green-700">
            Rs {kulCommission.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Sab se purana kitne din ka -- ye "kul baqi" se ziyada kaam ka
          adad hai, aur akele khare adad se kabhi nazar nahi aata. */}
      {oldestDays > 0 && (
        <p className="mb-6 rounded-card border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          {t("ar_oldest_line", lang).replace("{n}", String(oldestDays))}
        </p>
      )}

      {/* ---- Arhti ki taraf ---- */}
      <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("ar_who_holds", lang)}</h2>
      <div className="mb-8 overflow-x-auto rounded-card border border-surface-200 dark:border-surface-800">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-900">
            <tr>
              <th className="px-3 py-2 text-left">{t("ar_arhti", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_kattai", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_purana_baqi", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_commission", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_paid", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_standing", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_since", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.baqi !== 0 || r.bookings > 0).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-surface-400">{t("ar_nothing_held", lang)}</td>
              </tr>
            )}
            {rows
              .filter((r) => r.baqi !== 0 || r.bookings > 0)
              .map((r) => (
                <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/machinery-rental/lifters/${r.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <p className="text-xs text-surface-400">
                      {[r.village, r.phone].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                    {r.kattai ? `Rs ${r.kattai.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                    {r.purana ? `Rs ${r.purana.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                    {r.commission ? `Rs ${r.commission.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-surface-500">
                    {r.diya ? `Rs ${r.diya.toLocaleString()}` : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-semibold tabular-nums ${
                      r.baqi > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    Rs {r.baqi.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-surface-500">
                    {/* Jis ke zimme kuch nahi, us ke saamne din likhna
                        bemaani hai -- wahan "—" hi theek hai. */}
                    {r.baqi > 0 && oldestBy.has(r.id) ? `${oldestBy.get(r.id)} ${t("ar_days", lang)}` : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
          {kulBaqi !== 0 && (
            <tfoot className="border-t-2 border-surface-300 bg-surface-50 dark:border-surface-700 dark:bg-surface-900">
              <tr className="font-semibold">
                <td className="px-3 py-2">{t("ar_total", lang)}</td>
                <td className="px-3 py-2 text-right tabular-nums">Rs {kulKattai.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">Rs {kulPurana.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">Rs {kulCommission.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  Rs {rows.reduce((s, r) => s + r.diya, 0).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-red-700">Rs {kulBaqi.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ---- Kisan ki taraf: paise ka peecha ---- */}
      <h2 className="mb-1 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("ar_trace_title", lang)}</h2>
      <p className="mb-2 text-xs text-surface-500">{t("ar_trace_note", lang)}</p>
      <div className="overflow-x-auto rounded-card border border-surface-200 dark:border-surface-800">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-xs uppercase tracking-wide text-surface-500 dark:border-surface-800 dark:bg-surface-900">
            <tr>
              <th className="px-3 py-2 text-left">{t("ar_farmer", lang)}</th>
              <th className="px-3 py-2 text-left">{t("ar_booking", lang)}</th>
              <th className="px-3 py-2 text-left">{t("ar_now_with", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_kattai", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_older", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_commission", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_total", lang)}</th>
              <th className="px-3 py-2 text-right">{t("ar_since", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-surface-400">{t("ar_trace_empty", lang)}</td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.liftId} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2">
                  {l.farmerId ? (
                    <Link
                      href={`/admin/machinery-rental/khata/${l.farmerId}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {l.farmerName}
                    </Link>
                  ) : (
                    <span className="font-medium">{l.farmerName}</span>
                  )}
                  {l.village && <p className="text-xs text-surface-400">{l.village}</p>}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/machinery-rental/booking/${l.bookingId}`}
                    className="text-brand-600 hover:underline"
                  >
                    {l.bookingNumber}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/machinery-rental/lifters/${l.lifterId}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {l.lifterName}
                  </Link>
                  {/* Us din ledger adhoora tha -- ye baat qatar par likhi
                      rehti hai, warna baad mein koi nahi bata sakta ke us
                      waqt adad par bharosa tha ya nahi. */}
                  {l.reliable === false && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{t("ar_unreliable_short", lang)}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                  {l.kattai ? `Rs ${l.kattai.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-300">
                  {l.purana ? `Rs ${l.purana.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                  {l.commission ? `Rs ${l.commission.toLocaleString()}` : "—"}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">Rs {l.kul.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-xs text-surface-500">
                  {l.din} {t("ar_days", lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ye qatar par qatar nahi milti -- adaigi poore khate par hoti hai,
          kisi ek booking par nahi. Is liye yahan sirf "kya aaya" likha
          hai, "kis booking ka aaya" nahi: wo jhoot hota. */}
      {(recent ?? []).length > 0 && (
        <>
          <h2 className="mb-1 mt-8 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("ar_recent_recovery", lang)}</h2>
          <p className="mb-2 text-xs text-surface-500">{t("ar_recovery_note", lang)}</p>
          <div className="overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
            {(recent ?? []).map((p: any, i: number) => {
              const l = Array.isArray(p.crop_lifters) ? p.crop_lifters[0] : p.crop_lifters;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-surface-100 px-3 py-2 text-sm last:border-0 dark:border-surface-800"
                >
                  <span className="text-surface-700 dark:text-surface-300">
                    {new Date(p.payment_date).toLocaleDateString()} · {l?.name ?? "—"}
                  </span>
                  <span className="font-medium tabular-nums text-green-700 dark:text-green-400">
                    Rs {Number(p.amount).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
