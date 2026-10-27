import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { canSeeSalesSecrets, shouldUseMeriDukan } from "@/lib/reports/sales-secrets";
import { SALE_BUCKETS, loadSalesAnalytics, rsPlain, type AnalyticsNumbers } from "@/lib/reports/sales-analytics";
import { formatPktDate } from "@/lib/public/today-rates";

export const dynamic = "force-dynamic";

const BUCKET_LABEL: Record<(typeof SALE_BUCKETS)[number], string> = {
  khaad: "Khaad",
  beej: "Beej",
  doodh: "Doodh",
  karyana: "Karyana",
};

const JUMPS = [
  { href: "/admin/reports/sales/analytics", label: "Sales" },
  { href: "/admin/reports/inventory", label: "Stock" },
  { href: "/admin/reports/sales", label: "Orders" },
  { href: "/admin/reports/milk", label: "Doodh" },
];

export default async function SalesAnalyticsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role, shop_id").eq("id", user?.id ?? "").maybeSingle();
  const showProfit = canSeeSalesSecrets(me?.role);
  const shopId = !showProfit && me?.shop_id ? String(me.shop_id) : null;
  const staffWithoutShop = shouldUseMeriDukan(me?.role) && !shopId;

  const loaded = staffWithoutShop
    ? null
    : await loadSalesAnalytics(supabase, { shopId, showProfit });

  let shopName: string | null = null;
  if (shopId) {
    const { data: shop } = await supabase.from("shops").select("name").eq("id", shopId).maybeSingle();
    shopName = shop?.name ?? null;
  }

  return (
    <div>
      <PageHeader
        title="Sales Dashboard — Aaj"
        description="Kisan ka Wasela · aaj ki bikri, category, orders, aur kam stock. Waqt Pakistan ka hai. Khali din par Rs 0 — sample number nahi."
        actions={
          <Link href="/admin/reports/sales" className="text-sm font-semibold text-emerald-800 hover:underline dark:text-emerald-300">
            Poori sale report
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {JUMPS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${item.href.endsWith("/analytics") ? "bg-emerald-700 text-white" : "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {staffWithoutShop && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Aap ki dukan assign nahi. Company ki poori bikri yahan nahi dikhai jati.
        </p>
      )}

      {loaded && !loaded.ok && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Aaj ki bikri nahi mili: {loaded.message}
        </p>
      )}

      {loaded && loaded.ok && (
        <Dashboard
          label={loaded.label}
          shopName={shopName}
          showProfit={showProfit}
          numbers={loaded.numbers}
          low={loaded.low}
          lowMessage={loaded.lowMessage}
        />
      )}
    </div>
  );
}

function Dashboard({
  label,
  shopName,
  showProfit,
  numbers,
  low,
  lowMessage,
}: {
  label: string;
  shopName: string | null;
  showProfit: boolean;
  numbers: AnalyticsNumbers;
  low: { tracked: boolean; rows: { id: string; line: string }[] } | null;
  lowMessage: string | null;
}) {
  const max = Math.max(...SALE_BUCKETS.map((k) => numbers.buckets[k]), numbers.buckets.aur, 0);
  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-500">
        {formatPktDate(label)}
        {shopName ? ` · ${shopName}` : showProfit ? " · tamam dukanein" : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Sales" value={rsPlain(numbers.total)} />
        <Stat label="Aaj ke orders" value={String(numbers.orders)} />
        <Stat
          label="Munafa"
          value={!showProfit ? "Sirf owner / admin" : numbers.munafa == null ? "—" : rsPlain(numbers.munafa)}
          hint={!showProfit ? "Kharid ki qeemat staff ko nahi dikhti." : numbers.munafa == null ? "In bills par cost darj nahi — sifar nahi likha." : numbers.munafaGap ? "Kuch bills par cost darj nahi. Yahan sirf darj shuda munafa hai." : undefined}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
          <h2 className="text-sm font-semibold text-surface-900 dark:text-white">Category wise</h2>
          <ul className="mt-3 space-y-3">
            {SALE_BUCKETS.map((key) => (
              <Bar key={key} label={BUCKET_LABEL[key]} amount={numbers.buckets[key]} max={max} />
            ))}
            {numbers.buckets.aur > 0 && <Bar label="Aur" amount={numbers.buckets.aur} max={max} />}
          </ul>
          {numbers.linesMissing && (
            <p className="mt-3 text-xs text-amber-800">Bill hai, line items nahi mile. Category khali hai — total bill se hai.</p>
          )}
          {!numbers.linesMissing && numbers.orders > 0 && Math.abs(numbers.itemTotal - numbers.total) > 1 && (
            <p className="mt-3 text-xs text-surface-500">
              Lines {rsPlain(numbers.itemTotal)} · bill total {rsPlain(numbers.total)}. Farq discount ya missing line ho sakta hai.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Low stock
          </h2>
          {lowMessage && <p className="mt-3 text-sm text-red-700">Stock nahi mila: {lowMessage}</p>}
          {!lowMessage && low && !low.tracked && (
            <p className="mt-3 text-sm text-surface-500">Hadd (min stock) lagi hi nahi — is liye “0 cheezein kam” nahi likha.</p>
          )}
          {!lowMessage && low?.tracked && low.rows.length === 0 && (
            <p className="mt-3 text-sm text-surface-600">Jis cheez par hadd lagi hai, koi us se neeche nahi.</p>
          )}
          {!lowMessage && low && low.rows.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-surface-800 dark:text-surface-100">
              {low.rows.map((row) => (
                <li key={row.id}>{row.line}</li>
              ))}
            </ul>
          )}
          <Link href="/admin/inventory" className="mt-4 inline-block text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300">
            Stock kholen
          </Link>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 dark:border-surface-800 dark:bg-surface-900">
      <p className="text-xs font-medium text-surface-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-surface-900 dark:text-white">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-4 text-surface-500">{hint}</p>}
    </div>
  );
}

function Bar({ label, amount, max }: { label: string; amount: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((amount / max) * 100)) : 0;
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="text-surface-700 dark:text-surface-200">{label}</span>
        <span className="font-medium text-surface-900 dark:text-white">{rsPlain(amount)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: amount > 0 ? `${width}%` : "0%" }} />
      </div>
    </li>
  );
}
