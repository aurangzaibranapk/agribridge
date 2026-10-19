import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { StatCard } from "@/components/dashboard/stat-card";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { isDateRangeKey, getDateRange, type DateRangeKey } from "@/lib/utils/dashboard-filters";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { canSeeSalesSecrets, cashHealth } from "@/lib/reports/sales-secrets";
import { RecentSalesTable } from "../recent-sales-table";
import { Store, TrendingUp, Wallet, CreditCard, ClipboardList, Package, ShieldCheck, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  khata: "Khata (Udhaar)",
  waseela_card: "Wasela Card",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  qr: "QR Code",
  card: "Card",
  bank_transfer: "Bank Transfer",
  kisan_card: "Kisan Card",
};

/**
 * Meri Dukan Report -- sales staff ka apna safha (17 October).
 *
 * Sirf APNI dukan: bikri, naqad, udhaar, cash-health, haaliya bikri aur
 * stock ki GINTI. Koi qeemat (kharid), kharche, load ki kamai, doosri
 * dukanein ya branch ka kul udhaar yahan nahi -- aur in ki query bhi nahi
 * chalti. Owner/admin `?shop=` se kisi bhi dukan ka ye view dekh sakte hain.
 */
export default async function MeriDukanReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; shop?: string }>;
}) {
  const params = await searchParams;
  const range: DateRangeKey = isDateRangeKey(params.range) ? params.range : "today";
  const { start, end } = getDateRange(range, params.from, params.to);
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, shop_id, full_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const owner = canSeeSalesSecrets(me?.role as string | undefined);
  const { data: shops } = owner
    ? await supabase.from("shops").select("id, name").order("name")
    : { data: [] as { id: string; name: string }[] };
  const shopId: string | null = owner
    ? params.shop || (me?.shop_id as string | null) || shops?.[0]?.id || null
    : ((me?.shop_id as string | null) ?? null);

  if (!shopId) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-900/40 dark:bg-slate-900">
          <Store className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-400" />
          <h1 className="mt-3 font-display text-lg font-semibold text-amber-900 dark:text-amber-200">Aap ki dukan set nahi</h1>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Meri Dukan Report sirf us bande ko nazar aati hai jis ki dukan profile mein set ho. Admin se apni dukan set karwa lein.
          </p>
        </div>
      </div>
    );
  }

  const { data: shop } = await supabase.from("shops").select("id, name, business_type").eq("id", shopId).maybeSingle();

  // Apni dukan ki bikri -- RLS (fn_can_see_sale) bhi yehi daira lagata hai.
  const sales: any[] = [];
  for (let off = 0; off < 20000; off += 1000) {
    const { data } = await supabase
      .from("pos_sales")
      .select("id, total_amount, cash_paid, khata_amount, payment_mode, created_at, created_by, customer_id, crm_customer_id")
      .eq("shop_id", shopId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .range(off, off + 999);
    sales.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const saleIds = sales.map((s) => s.id);
  const byMethod = new Map<string, number>();
  for (let i = 0; i < saleIds.length; i += 300) {
    const { data } = await supabase
      .from("pos_sale_payment_details")
      .select("payment_method, amount")
      .in("sale_id", saleIds.slice(i, i + 300));
    for (const a of (data ?? []) as { payment_method: string; amount: number }[]) {
      const amt = Number(a.amount ?? 0);
      if (amt <= 0) continue;
      const k = PAYMENT_LABELS[a.payment_method] ?? a.payment_method;
      byMethod.set(k, (byMethod.get(k) ?? 0) + amt);
    }
  }
  const methods = [...byMethod.entries()].sort((a, b) => b[1] - a[1]);

  // Stock ki GINTI -- sirf apni dukan ke godam, aur koi qeemat nahi.
  const { data: godam } = await supabase.from("warehouses").select("id").eq("shop_id", shopId);
  const godamIds = (godam ?? []).map((g: any) => g.id);
  const { data: stock } = godamIds.length
    ? await supabase.from("inventory").select("product_id, quantity_on_hand").in("warehouse_id", godamIds)
    : { data: [] as { product_id: string; quantity_on_hand: number }[] };
  const stockUnits = (stock ?? []).reduce((s, r: any) => s + Math.max(0, Number(r.quantity_on_hand ?? 0)), 0);
  const stockLines = new Set((stock ?? []).filter((r: any) => Number(r.quantity_on_hand ?? 0) > 0).map((r: any) => r.product_id)).size;

  const total = sales.reduce((s, x) => s + Number(x.total_amount ?? 0), 0);
  const naqad = sales.reduce((s, x) => s + Number(x.cash_paid ?? 0), 0);
  const udhaar = sales.reduce((s, x) => s + Number(x.khata_amount ?? 0), 0);
  const sehat = cashHealth(total, naqad, udhaar);

  // Haaliya bikri -- cashier aur gahak ka naam (sirf naam, koi balance nahi).
  const recent = sales.slice(0, 50);
  const cashierIds = [...new Set(recent.map((s) => s.created_by).filter(Boolean))];
  const { data: cashiers } = cashierIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", cashierIds)
    : { data: [] as { id: string; full_name: string }[] };
  const cashierMap = new Map((cashiers ?? []).map((c: any) => [c.id, c.full_name]));
  const service = createServiceClient();
  const crmIds = [...new Set(recent.map((s) => s.crm_customer_id).filter(Boolean))];
  const dealerIds = [...new Set(recent.map((s) => s.customer_id).filter(Boolean))];
  const [{ data: crm }, { data: dealer }] = await Promise.all([
    crmIds.length ? service.from("customers").select("id, name").in("id", crmIds) : Promise.resolve({ data: [] as any[] }),
    dealerIds.length ? service.from("dealer_customers").select("id, name").in("id", dealerIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const crmName = new Map((crm ?? []).map((c: any) => [c.id, c.name]));
  const dealerName = new Map((dealer ?? []).map((c: any) => [c.id, c.name]));
  const rows = recent.map((s) => ({
    id: s.id,
    date: s.created_at,
    location: shop?.name ?? "-",
    cashier: cashierMap.get(s.created_by) ?? "-",
    paymentMode: String(s.payment_mode ?? ""),
    amount: Number(s.total_amount ?? 0),
    customer: (s.crm_customer_id ? crmName.get(s.crm_customer_id) : null) ?? (s.customer_id ? dealerName.get(s.customer_id) : null) ?? null,
    has_customer: !!(s.crm_customer_id || s.customer_id),
  }));

  const dateLabel = `${start.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })} — ${end.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div data-testid="meri-dukan-report">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 p-6 text-white shadow-xl dark:from-slate-900 dark:via-[#0b1d3a] dark:to-[#0a2a4a] dark:ring-1 dark:ring-sky-900/60">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Meri Dukan Report</p>
            <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold">
              <Store className="h-6 w-6" /> {shop?.name ?? "Meri Dukan"}
            </h1>
            <p className="mt-1 text-sm text-white/80">{dateLabel} · sirf is dukan ka hisaab</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${sehat.ok ? "bg-white/20" : "bg-red-500/90"}`}>
            {sehat.ok ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {sehat.ok ? "Cash target theek" : "Udhaar zyada hai"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DateRangeFilter current={range} from={params.from} to={params.to} />
        {owner && (shops ?? []).length > 1 && (
          <div className="flex flex-wrap gap-1 text-xs">
            {(shops ?? []).map((s) => (
              <Link
                key={s.id}
                href={`?shop=${s.id}&range=${range}`}
                className={`rounded-full border px-2.5 py-1 ${s.id === shopId ? "border-brand-600 bg-brand-600 text-white" : "border-surface-200 text-surface-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300"}`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Kul bikri" value={rs(total)} icon={TrendingUp} tone="brand" />
        <StatCard label="Naqad aaya" value={rs(naqad)} icon={Wallet} tone="green" />
        <StatCard label="Udhaar diya" value={rs(udhaar)} icon={CreditCard} tone="warn" />
        <StatCard label="Parchiyan" value={sales.length.toLocaleString()} icon={ClipboardList} tone="blue" />
        <StatCard label="Stock ki ginti" value={`${stockUnits.toLocaleString()} units`} icon={Package} tone="purple" />
      </div>
      <p className="mt-2 text-[11px] text-surface-400 dark:text-slate-500">{stockLines.toLocaleString()} products dukan mein maujood hain.</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className={`rounded-2xl border p-5 ${sehat.ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20" : "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"}`}>
          <h2 className={`font-display text-base font-semibold ${sehat.ok ? "text-emerald-900 dark:text-emerald-300" : "text-red-900 dark:text-red-300"}`}>Cash-health check</h2>
          <p className="mt-1 text-xs text-surface-600 dark:text-slate-300">Target: kam az kam 70% naqad sale, zyada se zyada 30% udhaar. Score sirf naqad sale par banta hai.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
              <p className="text-xs text-surface-500">Naqad sale</p>
              <p className={`mt-1 text-2xl font-bold ${sehat.cashOk ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{sehat.cashPct.toFixed(1)}%</p>
              <div className="mt-2 h-2 rounded-full bg-surface-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(100, sehat.cashPct)}%` }} /></div>
            </div>
            <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60">
              <p className="text-xs text-surface-500">Udhaar / Khata</p>
              <p className={`mt-1 text-2xl font-bold ${sehat.udhaarOk ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"}`}>{sehat.udhaarPct.toFixed(1)}%</p>
              <div className="mt-2 h-2 rounded-full bg-surface-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.min(100, sehat.udhaarPct)}%` }} /></div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-semibold text-surface-900 dark:text-slate-100">Payment tareeqe se bikri</h2>
          <p className="mb-3 text-xs text-surface-400">Cash, Khata, EasyPaisa, JazzCash, QR waghaira.</p>
          {methods.length === 0 ? (
            <p className="text-sm text-surface-400">Is arse mein koi bikri nahi hui.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {methods.map(([k, v]) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-surface-700 dark:text-slate-300">{k}</span>
                  <span className="h-2 flex-1 rounded bg-surface-100 dark:bg-slate-800">
                    <span className="block h-2 rounded bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: `${total > 0 ? Math.min(100, (v / total) * 100) : 0}%` }} />
                  </span>
                  <span className="w-28 text-right font-semibold tabular-nums text-surface-900 dark:text-slate-100">{rs(v)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-surface-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 font-display text-base font-semibold text-surface-900 dark:text-slate-100">{t("rs_recent_sales", lang)}</h2>
        <RecentSalesTable rows={rows} lang={lang} />
      </div>
    </div>
  );
}
