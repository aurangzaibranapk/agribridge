import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { ReturnActions } from "./return-actions";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const HQ_ROLES = ["super_admin", "admin", "owner"];

const STATUS_LABEL: Record<string, string> = {
  pending: "HQ ke intezar mein",
  received: "HQ ne receive kar liya",
  rejected: "Reject hua",
};

const REASON_LABEL: Record<string, string> = {
  damaged: "Maal kharab tha",
  unsold: "Bika nahi",
  both: "Kharab + Bika nahi",
};

function statusTone(status: string) {
  if (status === "received") return "green" as const;
  if (status === "rejected") return "red" as const;
  return "amber" as const;
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: ret } = await supabase
    .from("agri_order_returns")
    .select("*, branches(name), agri_orders(order_number)")
    .eq("id", id)
    .maybeSingle();

  if (!ret) return <div className="p-8 text-center text-surface-400">{t("ar_not_found", lang)}</div>;

  const { data: items } = await supabase
    .from("agri_order_return_items")
    .select("*")
    .eq("return_id", id)
    .order("created_at");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
  const role = profile?.role ?? "";
  const canReceive = HQ_ROLES.includes(role) || role === "warehouse";

  const branchRel: any = (ret as any).branches;
  const branchName = Array.isArray(branchRel) ? branchRel[0]?.name : branchRel?.name;
  const orderRel: any = (ret as any).agri_orders;
  const orderNumber = Array.isArray(orderRel) ? orderRel[0]?.order_number : orderRel?.order_number;

  return (
    <div>
      <PageHeader title={ret.return_number} description={`${branchName ?? "Shop"} se return`} />

      <div className="mb-4 flex items-center gap-3">
        <Badge tone={statusTone(ret.status)}>{STATUS_LABEL[ret.status] ?? ret.status}</Badge>
        <span className="font-display text-lg font-bold text-surface-900 dark:text-white">Rs {Number(ret.total_amount).toLocaleString()}</span>
      </div>

      {ret.status === "pending" && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Maal abhi HQ ne receive nahi kiya. Receive karte hi shop ka stock kam, HQ ka stock zyada, aur Rs {Number(ret.total_amount).toLocaleString()} shop ke khate se kam ho jayega.
        </div>
      )}
      {ret.status === "received" && (
        <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
          Maal HQ ko mil gaya. Rs {Number(ret.total_amount).toLocaleString()} shop ke khate se kam ho chuka hai.
        </div>
      )}
      {ret.status === "rejected" && ret.rejection_reason && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Reject wajah: {ret.rejection_reason}</div>
      )}

      {canReceive && ret.status === "pending" && <ReturnActions returnId={ret.id} />}

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_product", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_reason", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_qty", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_rate", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_total", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((i) => (
                  <tr key={i.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{i.product_name}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{i.item_reason === "unsold" ? "Bika nahi" : "Kharab"}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{Number(i.return_qty)}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {Number(i.unit_price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {Number(i.line_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("c_detail", lang)}</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-surface-500">{t("c_shop", lang)}</span><span>{branchName ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">{t("c_reason", lang)}</span><span>{REASON_LABEL[ret.reason] ?? ret.reason}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">{t("c_order", lang)}</span><span>{orderNumber ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-surface-500">{t("ar_created", lang)}</span><span>{new Date(ret.created_at).toLocaleDateString()}</span></div>
              {ret.received_at && (
                <div className="flex justify-between"><span className="text-surface-500">{t("ar_received", lang)}</span><span>{new Date(ret.received_at).toLocaleDateString()}</span></div>
              )}
            </div>
            {ret.notes && <p className="mt-2 rounded-lg bg-surface-50 p-2 text-xs text-surface-600 dark:bg-surface-800">{ret.notes}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
