import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { Wallet, FileText, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/**
 * Supplier ka bill aur dena.
 *
 * Ye adad ab 139 ke baad asal hisaab se aata hai. Us se pehle
 * suppliers.current_payable teen jagah se haath se ghataya jata tha aur
 * kahin se barhta hi nahi tha -- yani jis adad par ye faisla hota hai ke
 * kis supplier ko paisa bhejna hai, wo kisi hisaab se nahi banta tha.
 *
 * Safhe par teenon adad sath dikhaye jate hain (kharida / ada kiya /
 * baqi), sirf baqi nahi. Ek akela adad dekh kar ye nahi kaha ja sakta ke
 * wo durust hai; teen sath hon to ghalati khud nazar aa jati hai.
 */
export default async function SupplierBillsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: suppliers }, { data: mismatch }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, name, company_name, phone_number, current_payable, credit_limit, status")
      .eq("is_active", true)
      .order("current_payable", { ascending: false }),
    // Agar ye khali na ho to screen par likha hua adad asal hisaab se hat
    // chuka hai -- us soorat mein chhupana nahi, saamne rakhna hai.
    supabase.from("v_supplier_payable_check").select("supplier_name, yaad_kiya_hua, asal_hisaab, farq"),
  ]);

  const ids = (suppliers ?? []).map((s) => s.id);

  const [{ data: purchases }, { data: payments }] = await Promise.all([
    ids.length
      ? supabase.from("purchases").select("supplier_id, total_amount, status").in("supplier_id", ids)
      : Promise.resolve({ data: [] as { supplier_id: string | null; total_amount: number; status: string }[] }),
    ids.length
      ? supabase.from("supplier_payments").select("supplier_id, amount").in("supplier_id", ids)
      : Promise.resolve({ data: [] as { supplier_id: string | null; amount: number }[] }),
  ]);

  const bought = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const p of purchases ?? []) {
    if (!p.supplier_id) continue;
    const target = p.status === "received" ? bought : p.status === "pending" ? pending : null;
    if (target) target.set(p.supplier_id, (target.get(p.supplier_id) ?? 0) + Number(p.total_amount ?? 0));
  }
  const paid = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!p.supplier_id) continue;
    paid.set(p.supplier_id, (paid.get(p.supplier_id) ?? 0) + Number(p.amount ?? 0));
  }

  const rows = (suppliers ?? []).map((s) => ({
    ...s,
    payable: Number(s.current_payable ?? 0),
    bought: bought.get(s.id) ?? 0,
    paid: paid.get(s.id) ?? 0,
    pending: pending.get(s.id) ?? 0,
  }));

  const totalPayable = rows.reduce((sum, r) => sum + r.payable, 0);
  const owed = rows.filter((r) => r.payable > 0);
  const overLimit = rows.filter((r) => Number(r.credit_limit ?? 0) > 0 && r.payable > Number(r.credit_limit));

  return (
    <div className="space-y-4">
      <PageHeader title={t("sb_title", lang)} description={t("sb_subtitle", lang)} />

      {(mismatch ?? []).length > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{(mismatch ?? []).length}</strong> {t("sb_mismatch", lang)}
              <span className="mt-0.5 block text-xs font-normal">
                {(mismatch ?? [])
                  .slice(0, 3)
                  .map(
                    (m) =>
                      `${m.supplier_name}: ${t("sb_written", lang)} Rs ${Number(m.yaad_kiya_hua ?? 0).toLocaleString()}, ${t("sb_should_be", lang)} Rs ${Number(m.asal_hisaab ?? 0).toLocaleString()}`
                  )
                  .join(" • ")}
              </span>
            </span>
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("sb_total_payable", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            Rs {totalPayable.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-surface-500">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("sb_owed_count", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{owed.length}</p>
        </Card>
        <Card className={`p-4 ${overLimit.length > 0 ? "border-l-4 border-l-amber-500" : ""}`}>
          <div className="flex items-center gap-2 text-surface-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("sb_over_limit", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-amber-600">{overLimit.length}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-4">
          <EmptyState title={t("sb_empty", lang)} description={t("sb_empty_note", lang)} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-2 font-medium">{t("sb_supplier", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("sb_bought", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("sb_paid", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("sb_payable", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("sb_in_transit", lang)}</th>
                <th className="px-4 py-2 font-medium">{t("sb_statement", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {rows.map((r) => {
                const limit = Number(r.credit_limit ?? 0);
                const over = limit > 0 && r.payable > limit;
                return (
                  <tr key={r.id} className={over ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-surface-800 dark:text-surface-200">{r.name}</span>
                      {r.company_name && (
                        <span className="block text-xs text-surface-400">{r.company_name}</span>
                      )}
                      {over && (
                        <span className="mt-0.5 block text-xs font-medium text-amber-700 dark:text-amber-400">
                          {t("sb_limit_crossed", lang)} Rs {limit.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                      Rs {r.bought.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                      Rs {r.paid.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold tabular-nums ${
                        r.payable > 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
                      }`}
                    >
                      Rs {r.payable.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-surface-400">
                      {r.pending > 0 ? `Rs ${r.pending.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/suppliers/${r.id}/statement`}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        {t("sb_open", lang)}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <p className="px-1 text-xs text-surface-400">{t("sb_footer", lang)}</p>
    </div>
  );
}
