import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsClient } from "@/components/reports/reports-client";
import { PageHeader } from "@/components/ui/layout-primitives";
import Link from "next/link";
import { TrendingUp, ShoppingCart, Boxes, Landmark, CreditCard, Droplet, Wheat, ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const REPORT_LINKS = [
  { href: "/admin/reports/sales", label: "Sales", icon: TrendingUp },
  { href: "/admin/reports/purchases", label: "Purchases", icon: ShoppingCart },
  { href: "/admin/reports/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/reports/finance", label: "Finance", icon: Landmark },
  { href: "/admin/reports/credit", label: "Credit", icon: CreditCard },
  { href: "/admin/reports/milk", label: "Milk", icon: Droplet },
  { href: "/admin/reports/procurement", label: "Procurement", icon: Wheat },
];

export default async function ReportsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: dealer } = await supabase
    .from("dealers")
    .select("id, business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (dealer) {
    const [{ data: summary }, { data: aging }] = await Promise.all([
      supabase.rpc("get_daily_sales_summary"),
      supabase.rpc("get_khata_aging"),
    ]);
    return (
      <ReportsClient
        dealerName={dealer.business_name}
        summary={summary?.[0] ?? null}
        aging={aging ?? []}
      />
    );
  }

  return (
    <div>
      <PageHeader title={t("rr_reports", lang)} description="Business-wide reports across every module" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_LINKS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-5 shadow-card transition hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900"
          >
            <span className="flex items-center gap-3">
              <r.icon className="h-5 w-5 text-brand-600" />
              <span className="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">{r.label} Report</span>
            </span>
            <ArrowRight className="h-4 w-4 text-surface-400" />
          </Link>
        ))}
      </div>
    </div>
  );
}