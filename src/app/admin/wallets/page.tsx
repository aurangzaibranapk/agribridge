import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { WalletAdjustButton } from "@/app/admin/wallets/wallet-adjustment-modal";
import Link from "next/link";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminWalletsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: wallets } = await supabase
    .from("wallets")
    .select("id, owner_type, owner_id, balance, held_balance")
    .neq("owner_type", "platform")
    .order("balance", { ascending: false });

  const [{ data: farmers }, { data: dealers }, { data: investors }, { data: customers }] = await Promise.all([
    supabase.from("farmers").select("id, full_name"),
    supabase.from("dealers").select("id, business_name"),
    supabase.from("investors").select("id, full_name"),
    supabase.from("customers").select("id, name"),
  ]);

  function ownerName(ownerType: string, ownerId: string): string {
    if (ownerType === "farmer") return farmers?.find((f) => f.id === ownerId)?.full_name ?? "Unknown Farmer";
    if (ownerType === "dealer") return dealers?.find((d) => d.id === ownerId)?.business_name ?? "Unknown Dealer";
    if (ownerType === "investor") return investors?.find((i) => i.id === ownerId)?.full_name ?? "Unknown Investor";
    if (ownerType === "customer") return customers?.find((c) => c.id === ownerId)?.name ?? "Unknown Customer";
    return "Unknown";
  }

  return (
    <div>
      <PageHeader title={t("wl_wallets", lang)} description="Digital wallet balances for Farmers, Dealers, Investors, and Customers" />
      {!wallets || wallets.length === 0 ? (
        <EmptyState title={t("wl_none_found", lang)} />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-3 font-medium text-surface-500">{t("wl_owner", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_type", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("c_balance", lang)}</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">{t("wl_held", lang)}</th>
                <th className="px-4 py-3 font-medium text-surface-500">{t("c_action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => {
                const name = ownerName(w.owner_type, w.owner_id);
                return (
                  <tr key={w.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">{name}</td>
                    <td className="px-4 py-3 capitalize text-surface-600 dark:text-surface-400">{w.owner_type}</td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-700 dark:text-brand-300">
                      Rs {Number(w.balance).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-surface-500">
                      {Number(w.held_balance) > 0 ? `Rs ${Number(w.held_balance).toLocaleString()}` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <WalletAdjustButton walletId={w.id} ownerName={name} />
                        {w.owner_type === "farmer" && (
                          <Link href={`/admin/wallets/${w.owner_id}`} className="text-xs font-medium text-brand-600 hover:underline">{t("c_statement", lang)}</Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}