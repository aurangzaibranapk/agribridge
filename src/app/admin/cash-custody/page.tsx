import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { canOpenCustodyDesk, holdDuration, rs, statusLabel } from "@/lib/cash-custody/chain";
import { loadCustodyBoard, loadCustodyViewer } from "@/lib/cash-custody/load";

export const dynamic = "force-dynamic";

/**
 * Kis ke paas kitna cash hai — ledger (1030) — aur POS se nikli cash
 * ka silsila: kahan se aayi, ab kis ke paas, kahan atki.
 */
export default async function CashCustodyPage() {
  const lang = getLanguageFromCookies("rm");
  const viewer = await loadCustodyViewer();
  if (!viewer) redirect("/login");
  if (!canOpenCustodyDesk(viewer.role)) redirect("/admin/my-work");

  const supabase = createClient();
  const [{ data: rows }, board] = await Promise.all([
    supabase.from("v_cash_custody").select("*").order("cash_paas_hai", { ascending: false }),
    loadCustodyBoard(viewer),
  ]);

  const people = rows ?? [];
  const total = people.reduce((s, r) => s + Number(r.cash_paas_hai ?? 0), 0);
  const stuck = board.items.filter((p) => p.overdue);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/cash-handover" className="text-sm text-surface-500 hover:text-brand-700">
          ← {t("ch_title", lang)}
        </Link>
        <h1 className="mt-1 font-display text-xl font-semibold text-surface-900 dark:text-white">
          {t("mcus_title", lang)}
        </h1>
        <p className="text-sm text-surface-500">{t("mcus_subtitle", lang)}</p>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-surface-900">POS cash — kahan se, kis ke paas, kahan atki</h2>
            <p className="text-sm text-surface-500">
              Har dukan ki band shift. Jama aur Finance ki tasdeeq ke baghair 1 din par laal. Timeline par har zimmedar aur waqt.
              {viewer.role === "manager" ? " Aap sirf apni branch dekh rahe hain." : ""}
            </p>
          </div>
          <p className="text-sm font-medium text-red-700">{stuck.length} ek din se verify nahi</p>
        </div>
        {board.error && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Silsila load nahi hua: {board.error}. Migration 717 Testing par pehle, Live par backup ke baad.
          </p>
        )}
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card">
          {board.items.length === 0 && !board.error ? (
            <p className="px-4 py-8 text-center text-sm text-surface-400">Koi POS cash verify ke baghair nahi pari.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left">
                  <th className="px-3 py-2 text-xs font-medium uppercase text-surface-500">Kahan se</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase text-surface-500">Ab kis ke paas</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-surface-500">Raqam</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase text-surface-500">Kitni der</th>
                </tr>
              </thead>
              <tbody>
                {board.items.map((p) => (
                  <tr key={p.id} className={`border-b border-surface-100 last:border-0 ${p.overdue ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-3">
                      <Link href={`/admin/cash-custody/packet/${p.id}`} className="font-medium text-brand-700 hover:underline">
                        {p.shopName ?? p.branchName ?? "Shop"} · {p.shiftNumber ?? "shift"}
                      </Link>
                      <p className="text-xs text-surface-500">{p.originName ?? "—"} · {statusLabel(p.status)}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-surface-800">{p.holderName ?? "—"}</p>
                      <p className="text-xs text-surface-400">{p.staff_confirmed_at ? "Staff copy confirm" : "Staff copy baqi"}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{rs(Number(p.amount))}</td>
                    <td className="px-3 py-3 text-xs">
                      <p>{holdDuration(p.holder_since, null)}</p>
                      {p.overdue && <p className="font-medium text-red-700">1 din se jama verify nahi</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">{t("cc_total", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-amber-800">Rs {total.toLocaleString()}</p>
          <p className="mt-1 text-xs text-amber-800">Ye ledger ka 1030 hai — kisi ke naam par cash. Upar wala silsila POS ki physical cash hai jab tak bank verify na ho.</p>
        </div>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card">
          {people.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-surface-400">{t("cc_empty", lang)}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left">
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">{t("cc_person", lang)}</th>
                  <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-surface-500">{t("cc_amount", lang)}</th>
                  <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-500">{t("cc_last_move", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {people.map((r) => (
                  <tr key={r.profile_id as string} className="border-b border-surface-100 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-surface-800">{r.full_name ?? "—"}</p>
                      <p className="text-xs text-surface-400">{r.role ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-display font-semibold text-amber-700">
                      Rs {Number(r.cash_paas_hai ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">
                      {r.aakhri_harkat ? new Date(r.aakhri_harkat as string).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
