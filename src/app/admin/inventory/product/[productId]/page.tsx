import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";

export const dynamic = "force-dynamic";

/**
 * Product ka card (263): ek product, har godam mein.
 *
 * "Para hua" aur "khula" alag hain: manzoor-shuda order ka maal godam
 * mein para to hai magar kisi ke naam ho chuka -- use bech dena wo
 * order tor deta hai. Is liye teen adad sath dikhte hain.
 */
export default async function ProductCardPage({ params }: { params: { productId: string } }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: product }, { data: cards }, { data: batches }, { data: invRows }] = await Promise.all([
    supabase.from("products").select("id, name, pack_size, barcode, internal_barcode, expiry_date, min_stock_threshold").eq("id", params.productId).maybeSingle(),
    supabase.from("v_warehouse_product_card").select("*").eq("product_id", params.productId).order("warehouse_name"),
    supabase.from("v_product_batches").select("*").eq("product_id", params.productId).order("expiry_date", { ascending: true, nullsFirst: false }),
    supabase.from("inventory").select("id, warehouse_id, warehouses(name)").eq("product_id", params.productId),
  ]);
  if (!product) notFound();

  const invIds = (invRows ?? []).map((r) => r.id);
  const whName = new Map((invRows ?? []).map((r: any) => [r.id, (Array.isArray(r.warehouses) ? r.warehouses[0] : r.warehouses)?.name ?? "—"]));
  const { data: moves } = invIds.length
    ? await supabase
        .from("stock_movements")
        .select("id, inventory_id, movement_type, quantity, reference_type, notes, created_at, balance_after")
        .in("inventory_id", invIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as any[] };

  const totalOnHand = (cards ?? []).reduce((s, c) => s + Number(c.on_hand ?? 0), 0);
  const totalReserved = (cards ?? []).reduce((s, c) => s + Number(c.reserved ?? 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${product.name}${product.pack_size ? ` (${product.pack_size})` : ""}`}
        description={t("inv_pc_desc", lang)}
        actions={
          <Link href="/admin/inventory" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            <ArrowLeft className="h-4 w-4" /> {t("inv_pc_back", lang)}
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("inv_pc_on_hand", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">{totalOnHand}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("inv_pc_reserved", lang)}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-amber-700">{totalReserved}</p>
          <p className="text-[11px] text-surface-400">{t("inv_pc_reserved_hint", lang)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("inv_pc_available", lang)}</p>
          <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${totalOnHand - totalReserved <= 0 ? "text-red-600" : "text-emerald-700"}`}>{totalOnHand - totalReserved}</p>
        </Card>
      </div>

      {(cards ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-surface-500">{t("inv_pc_no_stock", lang)}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(cards ?? []).map((c) => {
            const low = Number(c.min_stock_threshold ?? 0) > 0 && Number(c.on_hand ?? 0) <= Number(c.min_stock_threshold);
            const dl = c.days_left == null ? null : Number(c.days_left);
            return (
              <Card key={c.warehouse_id} className={low ? "border-l-4 border-l-red-500" : ""}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 font-medium text-surface-800 dark:text-surface-200">
                    <Boxes className="h-4 w-4 text-surface-400" /> {c.warehouse_name}
                    <span className="text-xs text-surface-400">{c.warehouse_code}</span>
                  </p>
                  {low && <Badge tone="red">{t("inv_low", lang)}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[11px] text-surface-500">{t("inv_pc_on_hand", lang)}</p>
                    <p className="font-semibold tabular-nums">{Number(c.on_hand ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-surface-500">{t("inv_pc_reserved", lang)}</p>
                    <p className="font-semibold tabular-nums text-amber-700">{Number(c.reserved ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-surface-500">{t("inv_pc_available", lang)}</p>
                    <p className={`font-semibold tabular-nums ${Number(c.available ?? 0) <= 0 ? "text-red-600" : "text-emerald-700"}`}>{Number(c.available ?? 0)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500">
                  <span>{t("inv_pc_batches", lang)}: <strong>{Number(c.batch_count ?? 0)}</strong></span>
                  <span>
                    {t("inv_pc_nearest", lang)}:{" "}
                    <strong className={dl != null && dl <= 30 ? "text-red-600" : dl != null && dl <= 90 ? "text-amber-700" : ""}>
                      {c.nearest_expiry ?? "—"}
                      {dl != null && dl <= 90 ? ` (${dl < 0 ? t("inv_expired", lang) : `${dl} ${t("inv_days", lang)}`})` : ""}
                    </strong>
                  </span>
                  <span>{t("inv_pc_last_move", lang)}: <strong>{c.last_movement_at ? new Date(c.last_movement_at).toLocaleDateString("en-PK") : "—"}</strong></span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {(batches ?? []).length > 0 && (
        <Card className="overflow-x-auto">
          <p className="mb-2 text-sm font-medium text-surface-800 dark:text-surface-200">{t("inv_pc_batches", lang)}</p>
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs text-surface-500">
                <th className="py-2">{t("inv_batch", lang)}</th>
                <th className="py-2">{t("inv_warehouse", lang)}</th>
                <th className="py-2">{t("inv_expiry", lang)}</th>
                <th className="py-2 text-right">{t("inv_qty", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {(batches ?? []).map((b) => {
                const dl = b.days_left == null ? null : Number(b.days_left);
                return (
                  <tr key={b.batch_id} className="border-b border-surface-100">
                    <td className="py-2 font-mono text-xs">{b.batch_number}</td>
                    <td className="py-2 text-surface-600">{b.warehouse_name ?? "—"}</td>
                    <td className={`py-2 ${dl != null && dl <= 30 ? "font-medium text-red-600" : dl != null && dl <= 90 ? "text-amber-700" : "text-surface-600"}`}>
                      {b.expiry_date ?? "—"}
                      {dl != null && dl <= 90 ? ` (${dl < 0 ? t("inv_expired", lang) : `${dl} ${t("inv_days", lang)}`})` : ""}
                    </td>
                    <td className="py-2 text-right tabular-nums">{Number(b.remaining_quantity ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <p className="mb-2 text-sm font-medium text-surface-800 dark:text-surface-200">{t("inv_pc_movements", lang)}</p>
        {(moves ?? []).length === 0 ? (
          <p className="text-sm text-surface-400">—</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <tbody>
              {(moves ?? []).map((m: any) => {
                const inbound = ["purchase_in", "transfer_in", "adjustment_increase", "return_in"].includes(m.movement_type);
                return (
                  <tr key={m.id} className="border-b border-surface-100">
                    <td className="py-2 text-xs text-surface-500">{new Date(m.created_at).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td className="py-2 text-xs text-surface-600">{whName.get(m.inventory_id) ?? "—"}</td>
                    <td className="py-2 text-xs">{m.movement_type}{m.reference_type ? ` · ${m.reference_type}` : ""}</td>
                    <td className={`py-2 text-right font-medium tabular-nums ${inbound ? "text-emerald-700" : "text-red-600"}`}>{inbound ? "+" : "−"}{Number(m.quantity)}</td>
                    <td className="py-2 text-right text-xs tabular-nums text-surface-400">{m.balance_after ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
