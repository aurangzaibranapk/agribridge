import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/form";
import { formatDateTime } from "@/lib/utils/format";
import { DealerOrderActions } from "@/app/admin/dealer-orders/dealer-order-actions";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function DealerOrdersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: dealer } = await supabase.from("dealers").select("id, business_name").eq("user_id", user.id).single();
  if (!dealer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600">{t("at_no_dealer_link", lang)}</p>
      </div>
    );
  }

  const { data: rawOrders } = await supabase
    .from("bridge_orders")
    .select("id, order_number, status, district, tehsil, subtotal, dealer_payout_amount, placed_at, bridge_order_items(quantity, unit_price, products(name))")
    .eq("assigned_dealer_id", dealer.id)
    .order("placed_at", { ascending: false });

  const orders = (rawOrders ?? []).map((o: any) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    district: o.district,
    tehsil: o.tehsil,
    subtotal: Number(o.subtotal),
    payout: Number(o.dealer_payout_amount),
    placed_at: o.placed_at,
    items: (o.bridge_order_items ?? []).map((item: any) => ({
      product_name: Array.isArray(item.products) ? item.products[0]?.name : item.products?.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  }));

  function statusTone(status: string) {
  const lang = getLanguageFromCookies("rm");
    if (["delivered", "settled"].includes(status)) return "green" as const;
    if (status === "assigned") return "amber" as const;
    if (status === "dealer_rejected") return "red" as const;
    return "blue" as const;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link href="/admin/pos" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">{t("at_back_to_pos", lang)}</Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">{t("at_my_orders", lang)}</h1>
      <p className="mt-1 text-surface-500">{t("at_dealer_orders_note", lang)}</p>

      <div className="mt-6 space-y-3">
        {orders.length === 0 ? (
          <p className="rounded-card border border-dashed border-surface-200 bg-white p-8 text-center text-sm text-surface-400">{t("at_no_orders", lang)}</p>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-surface-400">{o.order_number}</p>
                  <p className="mt-1 text-sm font-medium text-surface-800 dark:text-surface-200">
                    Deliver to: {[o.district, o.tehsil].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-surface-400">{formatDateTime(o.placed_at)}</p>
                </div>
                <Badge tone={statusTone(o.status)}>{o.status.replace("_", " ")}</Badge>
              </div>

              <div className="mt-3 space-y-1 border-t border-surface-100 pt-3 dark:border-surface-800">
                {o.items.map((item: any, idx: number) => (
                  <p key={idx} className="text-sm text-surface-600 dark:text-surface-400">
                    {item.product_name} x {item.quantity} @ Rs {item.unit_price}
                  </p>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-surface-100 pt-3 dark:border-surface-800">
                <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                  Your Payout: Rs {o.payout.toLocaleString()}
                </span>
                <DealerOrderActions orderId={o.id} status={o.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}