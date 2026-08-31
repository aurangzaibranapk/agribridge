import Link from "next/link";
import {
  Mail, Handshake, FileText, Users, Wheat, Quote, Tractor, Sprout, Landmark,
  Image as ImageIcon, HelpCircle, Sliders, FolderOpen, FileCode, Menu as MenuIcon, ArrowRight,
  Store, ShoppingCart, TrendingUp, Truck, Building2, ClipboardList, Clock, RefreshCw, CheckCircle2, XCircle,
  CreditCard, Banknote, Wallet, UserCheck, AlertTriangle, Package, PackageX, Boxes, ArrowLeftRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { StatCard } from "@/components/dashboard/stat-card";
import { RequestsChart } from "@/components/dashboard/requests-chart";
import { CategoryStatusChart } from "@/components/dashboard/category-status-chart";
import { AdminWeatherStatCard } from "@/components/dashboard/admin-weather-widget";
import { ForecastWidget } from "@/components/dashboard/forecast-widget";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
export const dynamic = "force-dynamic";
async function statusBreakdown(
  supabase: ReturnType<typeof createClient>,
  table: string,
  namedStatuses: string[]
): Promise<{ status: string; count: number }[]> {
  const [{ count: total }, ...namedCounts] = await Promise.all([
    supabase.from(table).select("id", { count: "exact", head: true }),
    ...namedStatuses.map((status) => supabase.from(table).select("id", { count: "exact", head: true }).eq("status", status)),
  ]);
  const namedTotal = namedCounts.reduce((sum, r) => sum + (r.count ?? 0), 0);
  const other = Math.max((total ?? 0) - namedTotal, 0);
  return [
    ...namedStatuses.map((status, i) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count: namedCounts[i].count ?? 0,
    })),
    { status: "Other", count: other },
  ];
}

type OrderCategory = "pending" | "processing" | "completed" | "cancelled";

function categorizeOrderStatus(status: string): OrderCategory {
  if (status === "staff_verified" || status === "dealer_dispatched") return "processing";
  if (status === "delivered" || status === "settled") return "completed";
  if (status === "dealer_rejected" || status === "farmer_rejected" || status === "cancelled") return "cancelled";
  return "pending";
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const WEBSITE_LINKS = [
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/hero-slides", label: "Hero Slider", icon: Sliders },
  { href: "/admin/testimonials", label: "Testimonials", icon: Quote },
  { href: "/admin/gallery", label: "Gallery", icon: ImageIcon },
  { href: "/admin/media-library", label: "Media Library", icon: FolderOpen },
  { href: "/admin/faqs", label: "FAQ", icon: HelpCircle },
  { href: "/admin/contact-messages", label: "Contact Messages", icon: Mail },
  { href: "/admin/investor-inquiries", label: "Investor Inquiries", icon: Handshake },
  { href: "/admin/static-pages", label: "Static Pages", icon: FileCode },
  { href: "/admin/menus", label: "Menus", icon: MenuIcon },
  { href: "/admin/settings", label: "Website Settings", icon: Sliders },
];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const lang = getLanguageFromCookies("rm");
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "month";
  const { start: rangeStart, end: rangeEnd } = getDateRange(range);
  const supabase = createClient();
  const [
    { count: newContactMessages },
    { count: newInvestorInquiries },
    { count: blogPosts },
    { count: newsletterSubscribers },
    { count: farmers },
    { count: testimonials },
    { count: machineryRequests },
    { count: fertilizerRequests },
    { count: livestockLoans },
  ] = await Promise.all([
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("investor_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("blog_posts").select("id", { count: "exact", head: true }),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("farmers").select("id", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("testimonials").select("id", { count: "exact", head: true }),
    supabase.from("machinery_requests").select("id", { count: "exact", head: true }),
    supabase.from("fertilizer_requests").select("id", { count: "exact", head: true }),
    supabase.from("livestock_loans").select("id", { count: "exact", head: true }),
  ]);
  const [machineryBreakdown, fertilizerBreakdown, livestockBreakdown] = await Promise.all([
    statusBreakdown(supabase, "machinery_requests", ["pending", "approved"]),
    statusBreakdown(supabase, "fertilizer_requests", ["pending", "approved"]),
    statusBreakdown(supabase, "livestock_loans", ["pending", "approved"]),
  ]);
  const overviewData = [
    { name: "Machinery", value: machineryRequests ?? 0 },
    { name: "Fertilizer", value: fertilizerRequests ?? 0 },
    { name: "Livestock", value: livestockLoans ?? 0 },
  ];

  const [
    { count: totalDealers },
    { count: activeDealers },
    { count: totalBuyers },
    { count: totalInvestors },
    { count: totalSuppliers },
    { count: totalBranches },
  ] = await Promise.all([
    supabase.from("dealers").select("id", { count: "exact", head: true }),
    supabase.from("dealers").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("buyers").select("id", { count: "exact", head: true }),
    supabase.from("investors").select("id", { count: "exact", head: true }),
    supabase.from("suppliers").select("id", { count: "exact", head: true }),
    supabase.from("branches").select("id", { count: "exact", head: true }),
  ]);

  const [{ data: bridgeInRange }, { data: produceInRange }] = await Promise.all([
    supabase
      .from("bridge_orders")
      .select("status, subtotal, assigned_dealer_id, dealer_payout_amount")
      .gte("placed_at", rangeStart.toISOString())
      .lte("placed_at", rangeEnd.toISOString()),
    supabase
      .from("produce_orders")
      .select("status, subtotal, buyer_id")
      .gte("placed_at", rangeStart.toISOString())
      .lte("placed_at", rangeEnd.toISOString()),
  ]);

  const orderSummary: Record<OrderCategory, { count: number; amount: number }> = {
    pending: { count: 0, amount: 0 },
    processing: { count: 0, amount: 0 },
    completed: { count: 0, amount: 0 },
    cancelled: { count: 0, amount: 0 },
  };
  [...(bridgeInRange ?? []), ...(produceInRange ?? [])].forEach((o) => {
    const cat = categorizeOrderStatus(o.status);
    orderSummary[cat].count += 1;
    orderSummary[cat].amount += Number(o.subtotal ?? 0);
  });
  const totalOrdersCount =
    orderSummary.pending.count + orderSummary.processing.count + orderSummary.completed.count + orderSummary.cancelled.count;
  const totalOrdersAmount =
    orderSummary.pending.amount + orderSummary.processing.amount + orderSummary.completed.amount + orderSummary.cancelled.amount;

  const [{ data: dealersData }, { data: buyersData }] = await Promise.all([
    supabase.from("dealers").select("id, business_name, current_payable, verification_status"),
    supabase.from("buyers").select("id, business_name"),
  ]);

  const dealerAgg = new Map<string, { orders: number; payout: number }>();
  (bridgeInRange ?? []).forEach((o) => {
    if (!o.assigned_dealer_id) return;
    const cur = dealerAgg.get(o.assigned_dealer_id) ?? { orders: 0, payout: 0 };
    cur.orders += 1;
    cur.payout += Number(o.dealer_payout_amount ?? 0);
    dealerAgg.set(o.assigned_dealer_id, cur);
  });

  const buyerAgg = new Map<string, { orders: number; purchases: number }>();
  (produceInRange ?? []).forEach((o) => {
    if (!o.buyer_id) return;
    const cur = buyerAgg.get(o.buyer_id) ?? { orders: 0, purchases: 0 };
    cur.orders += 1;
    cur.purchases += Number(o.subtotal ?? 0);
    buyerAgg.set(o.buyer_id, cur);
  });

  const topDealers = (dealersData ?? [])
    .map((d) => ({
      id: d.id,
      name: d.business_name,
      outstanding: Number(d.current_payable ?? 0),
      orders: dealerAgg.get(d.id)?.orders ?? 0,
      payout: dealerAgg.get(d.id)?.payout ?? 0,
    }))
    .sort((a, b) => b.payout - a.payout)
    .slice(0, 5);

  const topBuyers = (buyersData ?? [])
    .map((b) => ({
      id: b.id,
      name: b.business_name,
      orders: buyerAgg.get(b.id)?.orders ?? 0,
      purchases: buyerAgg.get(b.id)?.purchases ?? 0,
    }))
    .sort((a, b) => b.purchases - a.purchases)
    .slice(0, 5);

  const pendingDealerVerification = (dealersData ?? []).filter((d) => d.verification_status === "pending").length;
  const totalDealerPayable = (dealersData ?? []).reduce((sum, d) => sum + Number(d.current_payable ?? 0), 0);
  const dealerOrdersThisPeriod = [...dealerAgg.values()].reduce((sum, v) => sum + v.orders, 0);
  const buyerOrdersThisPeriod = [...buyerAgg.values()].reduce((sum, v) => sum + v.orders, 0);
  const buyerPurchasesThisPeriod = [...buyerAgg.values()].reduce((sum, v) => sum + v.purchases, 0);

  const [{ data: productsData }, { data: inventoryRows }, { count: pendingStockTransfers }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, purchase_price, selling_price, is_available, min_stock_threshold, categories(name)")
      .eq("is_deleted", false),
    supabase.from("inventory").select("product_id, quantity_on_hand"),
    supabase.from("stock_transfers").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const stockByProduct = new Map<string, number>();
  (inventoryRows ?? []).forEach((row) => {
    const cur = stockByProduct.get(row.product_id) ?? 0;
    stockByProduct.set(row.product_id, cur + Number(row.quantity_on_hand ?? 0));
  });

  const totalProducts = (productsData ?? []).length;
  const activeProducts = (productsData ?? []).filter((p) => p.is_available).length;
  const outOfStockProducts = (productsData ?? []).filter((p) => (stockByProduct.get(p.id) ?? 0) <= 0).length;
  const totalStockValue = (productsData ?? []).reduce(
    (sum, p) => sum + (stockByProduct.get(p.id) ?? 0) * Number(p.purchase_price ?? 0),
    0
  );
  const lowStockProducts = (productsData ?? [])
    .filter((p) => Number(p.min_stock_threshold) > 0 && (stockByProduct.get(p.id) ?? 0) <= Number(p.min_stock_threshold))
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: (p.categories as unknown as { name: string }[] | null)?.[0]?.name ?? "-",
      current: stockByProduct.get(p.id) ?? 0,
      minStock: Number(p.min_stock_threshold),
    }));

  const [{ data: recentBridgeRaw }, { data: recentProduceRaw }] = await Promise.all([
    supabase
      .from("bridge_orders")
      .select("id, order_number, status, subtotal, placed_at, farmer_id")
      .order("placed_at", { ascending: false })
      .limit(5),
    supabase
      .from("produce_orders")
      .select("id, order_number, status, subtotal, placed_at, buyer_id")
      .order("placed_at", { ascending: false })
      .limit(5),
  ]);

  const farmerIdsForQuery = [...new Set((recentBridgeRaw ?? []).map((o) => o.farmer_id))];
  const buyerIdsForQuery = [...new Set((recentProduceRaw ?? []).map((o) => o.buyer_id))];

  const [{ data: farmerNames }, { data: buyerNames }] = await Promise.all([
    supabase.from("farmers").select("id, full_name").in("id", farmerIdsForQuery.length ? farmerIdsForQuery : ["-"]),
    supabase.from("buyers").select("id, business_name").in("id", buyerIdsForQuery.length ? buyerIdsForQuery : ["-"]),
  ]);

  const farmerNameMap = new Map((farmerNames ?? []).map((f) => [f.id, f.full_name ?? "Farmer"]));
  const buyerNameMap = new Map((buyerNames ?? []).map((b) => [b.id, b.business_name]));

  const recentOrders = [
    ...(recentBridgeRaw ?? []).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      type: "Bridge (Buy)",
      customer: farmerNameMap.get(o.farmer_id) ?? "Farmer",
      amount: Number(o.subtotal ?? 0),
      status: o.status,
      placedAt: o.placed_at as string,
    })),
    ...(recentProduceRaw ?? []).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      type: "Produce (Sell)",
      customer: buyerNameMap.get(o.buyer_id) ?? "Buyer",
      amount: Number(o.subtotal ?? 0),
      status: o.status,
      placedAt: o.placed_at as string,
    })),
  ]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, 8);

  const [{ data: ledgerRows }, { count: pendingCreditRequests }, { data: categoryLimits }] = await Promise.all([
    supabase.from("farmer_credit_ledger").select("farmer_id, ledger_type, amount"),
    supabase.from("credit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("credit_category_limits").select("category, max_amount").order("category"),
  ]);

  let totalCreditGiven = 0;
  let totalRepaid = 0;
  const farmersWithCreditSet = new Set<string>();
  (ledgerRows ?? []).forEach((row) => {
    const amt = Number(row.amount ?? 0);
    if (row.ledger_type === "debit") totalCreditGiven += amt;
    else totalRepaid += amt;
    farmersWithCreditSet.add(row.farmer_id);
  });
  const totalOutstanding = totalCreditGiven - totalRepaid;

  const { data: periodLedgerRows } = await supabase
    .from("farmer_credit_ledger")
    .select("ledger_type, amount")
    .gte("created_at", rangeStart.toISOString())
    .lte("created_at", rangeEnd.toISOString());

  let creditGivenThisPeriod = 0;
  let repaidThisPeriod = 0;
  (periodLedgerRows ?? []).forEach((row) => {
    const amt = Number(row.amount ?? 0);
    if (row.ledger_type === "debit") creditGivenThisPeriod += amt;
    else repaidThisPeriod += amt;
  });

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleCreditRequestsRaw } = await supabase
    .from("credit_requests")
    .select("id, farmer_id, category, total_amount, created_at")
    .eq("status", "pending")
    .lte("created_at", threeDaysAgo)
    .order("created_at", { ascending: true })
    .limit(5);

  const staleFarmerIds = [...new Set((staleCreditRequestsRaw ?? []).map((r) => r.farmer_id))];
  const { data: staleFarmerNames } = await supabase
    .from("farmers")
    .select("id, full_name")
    .in("id", staleFarmerIds.length ? staleFarmerIds : ["-"]);
  const staleFarmerMap = new Map((staleFarmerNames ?? []).map((f) => [f.id, f.full_name ?? "Farmer"]));

  const staleCreditRequests = (staleCreditRequestsRaw ?? []).map((r) => ({
    id: r.id,
    farmerName: staleFarmerMap.get(r.farmer_id) ?? "Farmer",
    category: r.category,
    amount: Number(r.total_amount ?? 0),
    daysPending: Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  return (
    <div>
      <PageHeader title={t("db_title", lang)} description={t("db_business_summary", lang)} />

      <div className="mt-4">
        <DateRangeFilter current={range} />
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Business Summary
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Link href="/admin/dealers" className="block">
            <StatCard label={t("db_total_dealers", lang)} value={String(totalDealers ?? 0)} icon={Store} tone="blue" />
          </Link>
          <Link href="/admin/dealers" className="block">
            <StatCard label={t("db_active_dealers", lang)} value={String(activeDealers ?? 0)} icon={Store} tone="brand" />
          </Link>
          <Link href="/admin/buyers" className="block">
            <StatCard label={t("db_total_buyers", lang)} value={String(totalBuyers ?? 0)} icon={ShoppingCart} tone="orange" />
          </Link>
          <Link href="/admin/investors" className="block">
            <StatCard label={t("db_total_investors", lang)} value={String(totalInvestors ?? 0)} icon={TrendingUp} tone="purple" />
          </Link>
          <Link href="/admin/suppliers" className="block">
            <StatCard label={t("db_total_suppliers", lang)} value={String(totalSuppliers ?? 0)} icon={Truck} tone="warn" />
          </Link>
          <Link href="/admin/branches" className="block">
            <StatCard label={t("db_total_shops", lang)} value={String(totalBranches ?? 0)} icon={Building2} tone="brand" />
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Orders Overview
          </h2>
          <div className="flex gap-3 text-xs">
            <Link href="/admin/bridge-orders" className="text-brand-700 hover:underline">{t("db_bridge_orders", lang)} &rarr;</Link>
            <Link href="/admin/produce-orders" className="text-brand-700 hover:underline">{t("db_produce_orders", lang)} &rarr;</Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label={t("db_total_orders", lang)} value={String(totalOrdersCount)} icon={ClipboardList} tone="brand" />
          <StatCard label={t("db_pending", lang)} value={String(orderSummary.pending.count)} icon={Clock} tone="orange" />
          <StatCard label={t("db_processing", lang)} value={String(orderSummary.processing.count)} icon={RefreshCw} tone="blue" />
          <StatCard label={t("db_completed", lang)} value={String(orderSummary.completed.count)} icon={CheckCircle2} tone="brand" />
          <StatCard label={t("db_cancelled", lang)} value={String(orderSummary.cancelled.count)} icon={XCircle} tone="warn" />
        </div>
        <p className="mt-3 text-xs text-surface-500">
          Total order value in this period: Rs. {totalOrdersAmount.toLocaleString()}
        </p>
      </div>

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Dealer &amp; Buyer Performance (this period)
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label={t("db_pending_dealer_verification", lang)} value={String(pendingDealerVerification)} icon={AlertTriangle} tone="warn" />
          <StatCard label={t("db_total_dealer_payable", lang)} value={`Rs. ${totalDealerPayable.toLocaleString()}`} icon={Wallet} tone="orange" />
          <StatCard label={t("db_dealer_orders", lang)} value={String(dealerOrdersThisPeriod)} icon={Store} tone="blue" />
          <StatCard label={t("db_buyer_orders", lang)} value={String(buyerOrdersThisPeriod)} icon={ShoppingCart} tone="brand" />
          <StatCard label={t("db_buyer_purchases", lang)} value={`Rs. ${buyerPurchasesThisPeriod.toLocaleString()}`} icon={TrendingUp} tone="purple" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">{t("db_top_dealers", lang)}</h3>
            {topDealers.every((d) => d.orders === 0) ? (
              <p className="text-xs text-surface-400">{t("db_no_dealer_orders", lang)}</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-100 text-surface-500">
                    <th className="py-1.5 pr-2">Dealer</th>
                    <th className="py-1.5 pr-2">Orders</th>
                    <th className="py-1.5 pr-2">{t("db_payout", lang)}</th>
                    <th className="py-1.5 pr-2">{t("db_outstanding", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {topDealers.map((d) => (
                    <tr key={d.id} className="border-b border-surface-50 last:border-0">
                      <td className="py-1.5 pr-2 font-medium text-surface-900">{d.name}</td>
                      <td className="py-1.5 pr-2 text-surface-600">{d.orders}</td>
                      <td className="py-1.5 pr-2 text-surface-600">Rs. {d.payout.toLocaleString()}</td>
                      <td className="py-1.5 pr-2 text-surface-600">Rs. {d.outstanding.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">{t("db_top_buyers", lang)}</h3>
            {topBuyers.every((b) => b.orders === 0) ? (
              <p className="text-xs text-surface-400">{t("db_no_buyer_orders", lang)}</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-100 text-surface-500">
                    <th className="py-1.5 pr-2">Buyer</th>
                    <th className="py-1.5 pr-2">Orders</th>
                    <th className="py-1.5 pr-2">{t("db_purchases", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {topBuyers.map((b) => (
                    <tr key={b.id} className="border-b border-surface-50 last:border-0">
                      <td className="py-1.5 pr-2 font-medium text-surface-900">{b.name}</td>
                      <td className="py-1.5 pr-2 text-surface-600">{b.orders}</td>
                      <td className="py-1.5 pr-2 text-surface-600">Rs. {b.purchases.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Inventory Overview
          </h2>
          <Link href="/admin/inventory" className="text-xs text-brand-700 hover:underline">{t("db_view_all", lang)} &rarr;</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Link href="/admin/products" className="block">
            <StatCard label={t("db_total_products", lang)} value={String(totalProducts)} icon={Package} tone="brand" />
          </Link>
          <StatCard label={t("db_active_products", lang)} value={String(activeProducts)} icon={CheckCircle2} tone="blue" />
          <StatCard label={t("db_out_of_stock", lang)} value={String(outOfStockProducts)} icon={PackageX} tone="warn" />
          <StatCard label={t("db_total_stock_value", lang)} value={`Rs. ${totalStockValue.toLocaleString()}`} icon={Boxes} tone="purple" />
          <Link href="/admin/stock-transfers" className="block">
            <StatCard label={t("db_pending_transfers", lang)} value={String(pendingStockTransfers ?? 0)} icon={ArrowLeftRight} tone="orange" />
          </Link>
        </div>

        {lowStockProducts.length > 0 ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-surface-800 dark:bg-surface-900">
            <p className="mb-2 text-xs font-semibold text-red-800 dark:text-red-300">{t("db_low_stock_alert", lang)}</p>
            <ul className="space-y-1 text-xs text-red-800 dark:text-red-300">
              {lowStockProducts.map((p) => (
                <li key={p.id}>
                  {p.name} ({p.category}) — {p.current} in stock, minimum {p.minStock}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-xs text-surface-400">
            Koi minimum-stock threshold set nahi hui abhi tak — Products page mein set karne par yahan alerts aayenge.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Recent Orders
        </h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-surface-400">{t("db_no_orders_yet", lang)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-100 text-xs text-surface-500">
                  <th className="py-2 pr-3">{t("db_order_no", lang)}</th>
                  <th className="py-2 pr-3">{t("db_type", lang)}</th>
                  <th className="py-2 pr-3">{t("db_customer", lang)}</th>
                  <th className="py-2 pr-3">{t("db_amount", lang)}</th>
                  <th className="py-2 pr-3">{t("db_status", lang)}</th>
                  <th className="py-2 pr-3">{t("db_date", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-surface-50 last:border-0">
                    <td className="py-2 pr-3 font-medium text-surface-900">{o.orderNumber}</td>
                    <td className="py-2 pr-3 text-surface-600">{o.type}</td>
                    <td className="py-2 pr-3 text-surface-600">{o.customer}</td>
                    <td className="py-2 pr-3 text-surface-600">Rs. {o.amount.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-surface-600">{o.status}</td>
                    <td className="py-2 pr-3 text-surface-500">{new Date(o.placedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            Farmer Credit
          </h2>
          <Link href="/admin/farmer-credit" className="text-xs text-brand-700 hover:underline">{t("db_view_all", lang)} &rarr;</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label={t("db_total_credit_given", lang)} value={`Rs. ${totalCreditGiven.toLocaleString()}`} icon={CreditCard} tone="blue" />
          <StatCard label={t("db_total_repaid", lang)} value={`Rs. ${totalRepaid.toLocaleString()}`} icon={Banknote} tone="brand" />
          <StatCard label={t("db_outstanding", lang)} value={`Rs. ${totalOutstanding.toLocaleString()}`} icon={Wallet} tone="orange" />
          <StatCard label={t("db_farmers_with_credit", lang)} value={String(farmersWithCreditSet.size)} icon={UserCheck} tone="purple" />
          <Link href="/admin/credit-requests" className="block">
            <StatCard label={t("db_pending_requests", lang)} value={String(pendingCreditRequests ?? 0)} icon={AlertTriangle} tone="warn" />
          </Link>
        </div>
        <p className="mt-3 text-xs text-surface-500">
          This period: credit given Rs. {creditGivenThisPeriod.toLocaleString()}, repaid Rs. {repaidThisPeriod.toLocaleString()}
        </p>

        {categoryLimits && categoryLimits.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-100 pt-3">
            {categoryLimits.map((c) => (
              <span key={c.category} className="rounded-full bg-surface-50 px-3 py-1 text-xs text-surface-600 dark:bg-surface-800">
                {formatCategory(c.category)} max: Rs. {Number(c.max_amount ?? 0).toLocaleString()}
              </span>
            ))}
          </div>
        )}

        {staleCreditRequests.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-surface-800 dark:bg-surface-900">
            <p className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
              Credit Alerts — pending 3+ days
            </p>
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
              {staleCreditRequests.map((r) => (
                <li key={r.id}>
                  {r.farmerName} — {formatCategory(r.category)} — Rs. {r.amount.toLocaleString()} ({r.daysPending} din se pending)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t("db_new_contact_messages", lang)} value={String(newContactMessages ?? 0)} icon={Mail} tone="warn" />
        <StatCard label={t("db_new_investor_inquiries", lang)} value={String(newInvestorInquiries ?? 0)} icon={Handshake} tone="warn" />
        <StatCard label={t("db_registered_farmers", lang)} value={String(farmers ?? 0)} icon={Wheat} tone="brand" />
        <StatCard label={t("db_machinery_requests", lang)} value={String(machineryRequests ?? 0)} icon={Tractor} tone="orange" />
        <StatCard label={t("db_fertilizer_requests", lang)} value={String(fertilizerRequests ?? 0)} icon={Sprout} tone="blue" />
        <StatCard label={t("db_livestock_loans", lang)} value={String(livestockLoans ?? 0)} icon={Landmark} tone="purple" />
        <StatCard label={t("db_blog_posts", lang)} value={String(blogPosts ?? 0)} icon={FileText} />
        <StatCard label={t("db_newsletter_subscribers", lang)} value={String(newsletterSubscribers ?? 0)} icon={Users} />
        <StatCard label={t("db_testimonials", lang)} value={String(testimonials ?? 0)} icon={Quote} />
        <AdminWeatherStatCard />
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Website Management - Quick Links
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {WEBSITE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-lg border border-surface-100 px-3 py-2.5 text-sm text-surface-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 dark:border-surface-800 dark:text-surface-300 dark:hover:bg-brand-950/30"
            >
              <span className="flex items-center gap-2">
                <link.icon className="h-4 w-4" /> {link.label}
              </span>
              <ArrowRight className="h-3.5 w-3.5 opacity-50" />
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:bg-surface-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Service Requests Overview
        </h2>
        <RequestsChart data={overviewData} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-orange-200 bg-orange-50 p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">{t("db_machinery_status", lang)}</h3>
          <CategoryStatusChart data={machineryBreakdown} color="#ea580c" />
        </div>
        <div className="rounded-card border border-blue-200 bg-blue-50 p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">{t("db_fertilizer_status", lang)}</h3>
          <CategoryStatusChart data={fertilizerBreakdown} color="#2563eb" />
        </div>
        <div className="rounded-card border border-purple-200 bg-purple-50 p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-2 text-sm font-semibold text-surface-800 dark:text-surface-100">{t("db_livestock_status", lang)}</h3>
          <CategoryStatusChart data={livestockBreakdown} color="#9333ea" />
        </div>
      </div>
      <div className="mt-4">
        <ForecastWidget title="5-Din Ka Mausam Forecast" />
      </div>
    </div>
  );
}