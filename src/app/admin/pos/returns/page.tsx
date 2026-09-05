import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { ReturnsClient } from "./returns-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

/**
 * POS ki wapsi ka safha.
 *
 * Do hisse: upar wapsi karne ka form (staff bharta hai, manager ka code
 * bhejta hai), neeche aaj ki wapsiyon ki fehrist -- yehi wo fehrist hai
 * jo manager sham ko dekhta hai.
 *
 * Fehrist sab ko nazar aati hai, sirf manager ko nahi. Ye jaan boojh kar
 * hai: jis staff ke naam par wapsi lagi hai usay bhi maloom hona chahiye
 * ke us ke naam par kya darj hua -- warna ghalat naam par lagi wapsi
 * kabhi pakri nahi jati.
 */
export default async function PosReturnsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, full_name, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const canHoldCode = ["manager", "admin", "owner", "super_admin"].includes(me.role);

  const today = new Date().toISOString().slice(0, 10);

  const canSetWindow = ["owner", "super_admin", "admin"].includes(me.role);

  const [{ data: returns }, { data: attempts }, { data: hasCode }, { data: policy }] = await Promise.all([
    supabase
      .from("v_pos_returns_today")
      .select("*")
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false }),
    supabase
      .from("pos_return_code_attempts")
      .select("id, attempted_at, sale_id, profiles:attempted_by(full_name)")
      .gte("attempted_at", `${today}T00:00:00`)
      .order("attempted_at", { ascending: false })
      .limit(20),
    canHoldCode
      ? supabase.rpc("fn_has_auth_code" as never)
      : Promise.resolve({ data: null }),
    // Miyaad na mile to NULL -- safhe par "—" jayega, sifar nahi.
    // Sifar ka matlab "wapsi bilkul band" hota, jo alag baat hai.
    supabase.from("pos_return_policy").select("window_days").eq("id", 1).maybeSingle(),
  ]);

  const rows = (returns ?? []).map((r: any) => ({
    id: r.id as string,
    returnNumber: r.return_number as string,
    createdAt: r.created_at as string,
    reason: r.reason as string,
    totalAmount: Number(r.total_amount ?? 0),
    cashRefund: Number(r.cash_refund ?? 0),
    khataRefund: Number(r.khata_refund ?? 0),
    bhariKisNe: (r.bhari_kis_ne as string) ?? "—",
    codeKisKa: (r.code_kis_ka as string) ?? "—",
    managerNeKhudKi: Boolean(r.manager_ne_khud_ki),
  }));

  const totalBack = rows.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div>
      <PageHeader
        title={t("pos_returns_title", lang)}
        description={t("pos_returns_subtitle", lang)}
      />

      <div className="space-y-4">
        <ReturnsClient
          canHoldCode={canHoldCode}
          hasCode={Boolean(hasCode)}
          myName={me.full_name ?? ""}
          myId={me.id}
          canSetWindow={canSetWindow}
          windowDays={policy?.window_days === undefined || policy?.window_days === null ? null : Number(policy.window_days)}
          lang={lang}
        />

        {/* Sham ki fehrist */}
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 pb-2 dark:border-surface-800">
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
              {t("pos_returns_today", lang)}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Badge tone="gray">{rows.length} {t("pos_returns_count", lang)}</Badge>
              <Badge tone={totalBack > 0 ? "amber" : "gray"}>Rs {totalBack.toLocaleString()} {t("pos_returned_amount", lang)}</Badge>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-surface-500">{t("pos_no_returns_today", lang)}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 text-left text-xs text-surface-500 dark:border-surface-800">
                    <th className="py-2 pr-3">{t("pos_return_number", lang)}</th>
                    <th className="py-2 pr-3">{t("pos_time", lang)}</th>
                    <th className="py-2 pr-3">{t("pos_amount", lang)}</th>
                    <th className="py-2 pr-3">{t("pos_how_refunded", lang)}</th>
                    <th className="py-2 pr-3">{t("pos_filled_by", lang)}</th>
                    <th className="py-2 pr-3">{t("pos_code_of", lang)}</th>
                    <th className="py-2">{t("pos_reason", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-surface-50 dark:border-surface-900">
                      <td className="py-2 pr-3 font-medium text-brand-700 dark:text-brand-300">{r.returnNumber}</td>
                      <td className="py-2 pr-3 text-surface-500">
                        {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 pr-3 font-medium">Rs {r.totalAmount.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-surface-600 dark:text-surface-300">
                        {[
                          r.cashRefund > 0 ? `${t("pos_cash_paid", lang)} ${r.cashRefund.toLocaleString()}` : null,
                          r.khataRefund > 0 ? `${t("pos_khata_credit", lang)} ${r.khataRefund.toLocaleString()}` : null,
                        ]
                          .filter(Boolean)
                          .join(" + ") || "—"}
                      </td>
                      <td className="py-2 pr-3">{r.bhariKisNe}</td>
                      <td className="py-2 pr-3">
                        {/* Dono naam ek hon to manager ne khud ki -- wo bhi
                            jaiz hai, magar us ka alag dikhna zaroori hai. */}
                        {r.codeKisKa}
                        {r.managerNeKhudKi && <span className="ml-1 text-xs text-surface-400">{t("pos_self", lang)}</span>}
                      </td>
                      <td className="py-2 text-surface-600 dark:text-surface-300">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Ghalat code ki koshishein. Ye khali rehni chahiye. */}
        {(attempts ?? []).length > 0 && (
          <Card className="space-y-2 border-red-200 dark:border-red-900/40">
            <h2 className="font-display text-base font-semibold text-red-700 dark:text-red-400">
              {t("pos_wrong_code_attempts", lang)} — {attempts?.length}
            </h2>
            <p className="text-sm text-surface-600 dark:text-surface-300">
              {t("pos_wrong_code_explain", lang)}
            </p>
            <ul className="space-y-1 text-sm">
              {(attempts ?? []).map((a: any) => (
                <li key={a.id} className="text-surface-700 dark:text-surface-200">
                  {new Date(a.attempted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                  {a.profiles?.full_name ?? t("pos_someone", lang)}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
