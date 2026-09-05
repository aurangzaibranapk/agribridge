import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { PurchaseForm } from "@/app/admin/purchases/purchase-form";
import { ReceiveButton } from "@/app/admin/purchases/receive-button";
import { DeletePurchaseButton } from "@/app/admin/purchases/delete-purchase-button";
import { NextStepStrip, purchaseSteps } from "@/components/guided/next-step";
import { getUiMode } from "@/lib/access/ui-mode";
import { ReviewBadge, ReviewPanel, type PurchaseComment } from "@/app/admin/purchases/review-panel";
export const dynamic = "force-dynamic";

/** Halat database mein angrezi mein rehti hai; screen ka lafz yahan se. */
const PURCHASE_STATUS: Record<string, TranslationKey> = {
  pending: "pu_s_pending",
  received: "pu_s_received",
  cancelled: "pu_s_cancelled",
};
export default async function AdminPurchasesPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, branches(name)")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const isAdminLevel = profile?.role === "super_admin" || profile?.role === "admin" || profile?.role === "owner";
  const staffBranchRel: any = (profile as any)?.branches;
  const staffBranchName = Array.isArray(staffBranchRel) ? staffBranchRel[0]?.name : staffBranchRel?.name;

  const [{ data: purchases }, { data: suppliers }, { data: products }, { data: branches }] = await Promise.all([
    supabase
      .from("purchases")
      .select(
        "id, purchase_number, purchase_date, status, total_amount, invoice_total, review_status, suppliers(name), branches(name), purchase_items(id, quantity, unit_cost, products(name, pack_size, sale_rate_pending)), purchase_comments(id, kind, body, created_at, profiles(full_name))"
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("products")
      .select("id, name, pack_size, purchase_price")
      .eq("is_deleted", false)
      .order("name"),
    isAdminLevel
      ? supabase.from("branches").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // Kaam kis ke haath mein gaya -- isi safhe par sabz patti ke liye
  // (290). Ek hi sawal se sab purchases ka; har qatar par alag sawal
  // chalane se safha bhaari ho jata hai.
  const purchaseIds = (purchases ?? []).map((p: any) => p.id as string);
  const { data: handoffRows } = purchaseIds.length
    ? await supabase
        .from("work_handoffs")
        .select("record_id, to_route, title, message, to_roles")
        .eq("record_table", "purchases")
        .eq("status", "open")
        .in("record_id", purchaseIds)
    : { data: [] as any[] };

  const handoffByPurchase = new Map<string, { route: string; title: string; message: string; roles: string[] }>();
  for (const h of handoffRows ?? []) {
    const id = String(h.record_id ?? "");
    if (!id || handoffByPurchase.has(id)) continue;
    handoffByPurchase.set(id, {
      route: String(h.to_route ?? ""),
      title: String(h.title ?? ""),
      message: String(h.message ?? ""),
      roles: (h.to_roles ?? []) as string[],
    });
  }

  const normalizedPurchases = (purchases ?? []).map((p: any) => ({
    id: p.id,
    purchase_number: p.purchase_number,
    purchase_date: p.purchase_date,
    status: p.status,
    total_amount: p.total_amount,
    invoice_total: p.invoice_total as number | null,
    review_status: (p.review_status as string) ?? "approved",
    // Product setup baqi = is purchase ki koi cheez bina sale rate ke.
    setupPending: ((p.purchase_items ?? []) as any[]).some((i) => {
      const rel = Array.isArray(i.products) ? i.products[0] : i.products;
      return Boolean(rel?.sale_rate_pending);
    }),
    // Baat ka silsila (259), purane pehle.
    comments: ((p.purchase_comments ?? []) as any[])
      .map((c) => {
        const who = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        return {
          id: c.id as string,
          kind: c.kind as string,
          body: c.body as string,
          author: (who?.full_name as string) ?? "—",
          created_at: c.created_at as string,
        } as PurchaseComment;
      })
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    // Ginti ke liye lines (256) -- sirf pending par kaam aati hain.
    items: ((p.purchase_items ?? []) as any[]).map((i) => {
      const rel = Array.isArray(i.products) ? i.products[0] : i.products;
      return {
        id: i.id as string,
        name: (rel?.name as string) ?? "Product",
        pack_size: (rel?.pack_size as string | null) ?? null,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      };
    }),
    supplier_name: Array.isArray(p.suppliers) ? p.suppliers[0]?.name : p.suppliers?.name,
    branch_name: Array.isArray(p.branches) ? p.branches[0]?.name : p.branches?.name,
  }));

  function statusTone(status: string) {
    if (status === "received") return "green" as const;
    if (status === "pending") return "amber" as const;
    if (status === "cancelled") return "red" as const;
    return "gray" as const;
  }

  return (
    <div>
      <PageHeader title={t("pu_title", lang)} description={t("pu_subtitle", lang)} />
      {/* Andar aane ke teenon raaste ek jagah (naqsha 4 September) --
          yahan sirf link hai, kaam wahi purana. */}
      <Link
        href="/admin/purchases/new"
        className="mb-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        + {t("np_title", lang)}
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {normalizedPurchases.length === 0 ? (
            <EmptyState title={t("pu_empty", lang)} />
          ) : (
            <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_po_no", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_supplier", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_branch", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_date", lang)}</th>
                    <th className="px-4 py-3 text-right font-medium text-surface-500">{t("pu_amount", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_status", lang)}</th>
                    <th className="px-4 py-3 font-medium text-surface-500">{t("pu_action", lang)}</th>
                    {isAdminLevel && <th className="px-4 py-3 font-medium text-surface-500">{t("pu_delete", lang)}</th>}
                  </tr>
                </thead>
                <tbody>
                  {normalizedPurchases.map((p) => [
                    <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{p.purchase_number}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{p.supplier_name ?? "-"}</td>
                      <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{p.branch_name ?? "-"}</td>
                      <td className="px-4 py-3 text-surface-500">{p.purchase_date}</td>
                      <td className="px-4 py-3 text-right font-semibold text-surface-800 dark:text-surface-200">
                        Rs {Number(p.total_amount).toLocaleString()}
                        {p.invoice_total != null && Number(p.invoice_total) !== Number(p.total_amount) && (
                          <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-400">
                            {t("grn_discrepancy", lang)}: Rs {Number(p.invoice_total).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge tone={statusTone(p.status)}>{t(PURCHASE_STATUS[p.status] ?? "pu_status", lang)}</Badge>
                          {/* Manzoori ka darja sirf jab abhi receive na hui ho (259). */}
                          {p.status === "pending" && p.review_status !== "approved" && <ReviewBadge status={p.review_status} />}
                        </div>
                        {/* Agla qadam -- ek hi shakl har purchase par (Guided ERP, B). */}
                        <div className="mt-1.5">
                          <NextStepStrip
                            compact
                            steps={purchaseSteps(
                              p,
                              { draft: t("ns_p_draft", lang), approval: t("ns_p_approval", lang), receive: t("ns_p_receive", lang), setup: t("ns_p_setup", lang), ready: t("ns_p_ready", lang) },
                              p.setupPending
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          {p.status === "pending" && p.review_status === "approved" && (
                            <ReceiveButton purchaseId={p.id} purchaseNumber={p.purchase_number} items={p.items} />
                          )}
                          {p.status === "pending" && (
                            <ReviewPanel
                              purchaseId={p.id}
                              purchaseNumber={p.purchase_number}
                              reviewStatus={p.review_status}
                              comments={p.comments}
                              canApprove={isAdminLevel}
                            />
                          )}
                        </div>
                      </td>
                      {isAdminLevel && (
                        <td className="px-4 py-3">
                          <DeletePurchaseButton purchaseId={p.id} purchaseNumber={p.purchase_number} />
                        </td>
                      )}
                    </tr>,
                    // Sabz patti: kaam poora hua, aur ab kis ke paas hai.
                    // Do sawal jo har staff roz poochta hai -- "mera kaam
                    // ho gaya?" aur "ab kis ki baari hai?" -- dono ka
                    // jawab usi jagah, bina kisi se poochhe.
                    handoffByPurchase.has(p.id) ? (
                      <tr key={`${p.id}-handoff`} className="bg-emerald-50/60 dark:bg-emerald-950/20">
                        <td colSpan={isAdminLevel ? 7 : 6} className="border-l-4 border-l-emerald-600 px-4 py-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                              {handoffByPurchase.get(p.id)!.title}
                            </span>
                            <span className="text-xs text-emerald-800 dark:text-emerald-300">
                              {handoffByPurchase.get(p.id)!.message}
                            </span>
                            <span className="text-xs text-emerald-700 dark:text-emerald-400">
                              · {t("wd_sent_to", lang)}: {handoffByPurchase.get(p.id)!.roles.join(", ") || "—"}
                            </span>
                            <Link
                              href={handoffByPurchase.get(p.id)!.route}
                              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              {t("wd_open", lang)}
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ) : null,
                  ]).flat()}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <PurchaseForm
          suppliers={suppliers ?? []}
          products={products ?? []}
          isAdminLevel={isAdminLevel}
          branches={branches ?? []}
          staffBranchName={staffBranchName ?? null}
          uiMode={await getUiMode()}
        />
      </div>
    </div>
  );
}