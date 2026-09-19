import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { ReceiveButton } from "@/app/admin/purchases/receive-button";
import { ClipboardCheck } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Receiving (265): ek shortcut, naya GRN nahi. Jo maal godam mein aana
 * hai wo do raaston se aata hai -- supplier ki purchase (manzoor
 * shuda, ginti baqi) aur shop ka order (agri-orders ka GRN). Dono ki
 * fehrist yahan, kaam wahi purane safhon ka.
 */
export default async function ReceivingPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: purchases }, { count: grnQueue }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, purchase_number, purchase_date, total_amount, review_status, suppliers(name), purchase_items(id, quantity, unit_cost, products(name, pack_size))")
      .eq("status", "pending")
      .order("purchase_date", { ascending: true })
      .limit(100),
    supabase.from("agri_orders").select("id", { count: "exact", head: true }).in("status", ["dispatched", "in_transit", "delivered"]),
  ]);

  const rows = (purchases ?? []).map((p: any) => ({
    id: p.id as string,
    number: p.purchase_number as string,
    date: p.purchase_date as string,
    total: Number(p.total_amount ?? 0),
    approved: p.review_status === "approved",
    review: p.review_status as string,
    supplier: (Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers)?.name ?? "—",
    items: ((p.purchase_items ?? []) as any[]).map((i) => {
      const rel = Array.isArray(i.products) ? i.products[0] : i.products;
      return { id: i.id as string, name: (rel?.name as string) ?? "Product", pack_size: (rel?.pack_size as string | null) ?? null, quantity: Number(i.quantity), unit_cost: Number(i.unit_cost) };
    }),
  }));
  const ready = rows.filter((r) => r.approved);
  const waiting = rows.filter((r) => !r.approved);

  return (
    <div className="space-y-4">
      <PageHeader title={t("inv_rc_title", lang)} description={t("inv_rc_desc", lang)} />

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{t("inv_rc_shop_orders", lang)}</p>
          <p className="text-xs text-surface-500">{t("inv_rc_shop_orders_hint", lang)}</p>
        </div>
        <Link href="/admin/purchases/grn" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          <ClipboardCheck className="h-3.5 w-3.5" /> {t("inv_rc_open_grn", lang)} ({grnQueue ?? 0})
        </Link>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("inv_rc_purchases", lang)} <span className="text-surface-400">({ready.length})</span>
        </h2>
        {ready.length === 0 ? (
          <EmptyState title={t("inv_rc_none", lang)} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs uppercase text-surface-500">
                  <th className="py-2">{t("pu_po_no", lang)}</th>
                  <th className="py-2">{t("pu_supplier", lang)}</th>
                  <th className="py-2">{t("pu_date", lang)}</th>
                  <th className="py-2 text-right">{t("pu_amount", lang)}</th>
                  <th className="py-2">{t("pu_action", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {ready.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100">
                    <td className="py-2 font-medium">{r.number}</td>
                    <td className="py-2 text-surface-600">{r.supplier}</td>
                    <td className="py-2 text-surface-500">{r.date}</td>
                    <td className="py-2 text-right tabular-nums">Rs {r.total.toLocaleString()}</td>
                    <td className="py-2"><ReceiveButton purchaseId={r.id} purchaseNumber={r.number} items={r.items} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {waiting.length > 0 && (
        <Card>
          <h2 className="mb-2 font-display text-base font-semibold text-surface-900 dark:text-white">
            {t("inv_rc_waiting", lang)} <span className="text-surface-400">({waiting.length})</span>
          </h2>
          <p className="mb-2 text-xs text-surface-500">{t("inv_rc_waiting_hint", lang)} <Link href="/admin/purchases" className="underline">Purchases</Link></p>
          <ul className="space-y-1 text-sm">
            {waiting.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.number}</span>
                <span className="text-surface-500">{r.supplier}</span>
                <Badge tone={r.review === "sent_back" ? "red" : "amber"}>{t(r.review === "sent_back" ? "pu_rv_sent_back" : "pu_rv_submitted", lang)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
