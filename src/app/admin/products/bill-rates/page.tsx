import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { NewBillForm } from "./new-bill-form";

export const dynamic = "force-dynamic";

const ALLOWED = ["owner", "super_admin", "admin", "warehouse"];

/**
 * Supplier ke bill se trade rate.
 *
 * Dabbe par trade rate likha hi nahi hota -- dabbe par MRP hoti hai.
 * Jis rate par maal hamein mila wo sirf supplier ke bill par hota hai,
 * is liye lagat ka raasta yahin se guzarta hai.
 */
export default async function BillRatesPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !ALLOWED.includes(me.role)) {
    return (
      <div>
        <PageHeader title={t("pf_bill_title", lang)} />
        <Card>
          <p className="text-sm text-surface-600">
            {t("pf_bill_gate", lang)}
          </p>
        </Card>
      </div>
    );
  }

  const [{ data: bills }, { data: suppliers }, { count: pendingCount }] = await Promise.all([
    supabase
      .from("supplier_bill_reads")
      .select("id, bill_number, bill_date, supplier_name_raw, bill_total, status, created_at, suppliers(name)")
      .neq("status", "discarded")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("trade_rate_pending", true)
      .eq("is_deleted", false),
  ]);

  const ids = (bills ?? []).map((b) => b.id);
  const { data: lineRows } = ids.length
    ? await supabase.from("supplier_bill_lines").select("bill_read_id, status").in("bill_read_id", ids)
    : { data: [] };

  const tally = new Map<string, { total: number; ready: number; applied: number }>();
  for (const l of lineRows ?? []) {
    const row = tally.get(l.bill_read_id) ?? { total: 0, ready: 0, applied: 0 };
    if (l.status !== "skipped") row.total += 1;
    if (l.status === "ready") row.ready += 1;
    if (l.status === "applied") row.applied += 1;
    tally.set(l.bill_read_id, row);
  }

  return (
    <div>
      <PageHeader
        title={t("pf_bill_title", lang)}
        description={t("pf_bill_desc", lang)}
      />

      {(pendingCount ?? 0) > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            <strong>{pendingCount}</strong> {t("pf_bill_pending_note", lang)}
          </p>
        </Card>
      )}

      <NewBillForm suppliers={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))} />

      <Card className="mt-4">
        <h2 className="mb-2 text-sm font-semibold">{t("pf_bill_past", lang)}</h2>
        {(bills ?? []).length === 0 ? (
          <p className="text-sm text-surface-500">{t("pf_bill_none", lang)}</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {(bills ?? []).map((b) => {
              const c = tally.get(b.id) ?? { total: 0, ready: 0, applied: 0 };
              const supplierName =
                (b as unknown as { suppliers?: { name?: string } }).suppliers?.name ?? b.supplier_name_raw;
              return (
                <li key={b.id}>
                  <Link
                    href={`/admin/products/bill-rates/${b.id}`}
                    className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-surface-50"
                  >
                    <ReceiptText className="h-4 w-4 shrink-0 text-surface-400" />
                    <span className="font-medium">{supplierName ?? t("pf_bill_no_name", lang)}</span>
                    {b.bill_number && <span className="text-xs text-surface-500">#{b.bill_number}</span>}
                    <span className="text-xs text-surface-400">
                      {new Date(b.bill_date ?? b.created_at).toLocaleDateString("en-GB")}
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-xs text-surface-500">{c.total} {t("pf_rows", lang)}</span>
                      {b.status === "applied" ? (
                        <Badge tone="green">{t("pf_bill_applied_n", lang).replace("{n}", String(c.applied))}</Badge>
                      ) : c.ready > 0 ? (
                        <Badge tone="amber">{c.ready} {t("pf_ready", lang)}</Badge>
                      ) : (
                        <Badge tone="gray">{t("pf_bill_to_check", lang)}</Badge>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
