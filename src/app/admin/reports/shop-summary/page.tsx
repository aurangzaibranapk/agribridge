import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { shopZeroLeakageSnapshot } from "@/lib/pos/shop-zero-leakage";
import {
  ShoppingCart, Banknote, CreditCard, TrendingUp, Package,
  ReceiptText, Truck, FileText, ArrowDownToLine, AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

const rs = (v: number | null | undefined) =>
  v == null ? "—" : `Rs ${Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

const METHOD_ICON: Record<string, string> = {
  cash: "💵", bank_transfer: "🏦", jazzcash: "📱", easypaisa: "📲",
  qr: "📷", khata: "📒", card: "💳", kisan_card: "🌾",
};
const METHOD_LABEL: Record<string, string> = {
  cash: "Cash (Naqad)", bank_transfer: "Bank Transfer", jazzcash: "JazzCash",
  easypaisa: "Easypaisa", qr: "QR Code", khata: "Khata / Udhaar",
  card: "Card", kisan_card: "Kisan Card",
};

export default async function ShopSummaryPage({
  searchParams,
}: {
  searchParams?: { shop_id?: string; period?: string; from?: string; to?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role, branch_id, shop_id").eq("id", user.id).maybeSingle();
  if (!me) redirect("/login");

  const canView = UNRESTRICTED_ROLES.includes(me.role) || me.role === "manager" || (await canDo("shop-360", "view"));
  if (!canView) {
    return <Card><p className="py-4 text-center text-sm text-surface-500">Is safhe ki ijazat nahi.</p></Card>;
  }

  const service = createServiceClient();
  const broad = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance";

  let shops: { id: string; name: string; branchName: string | null }[] = [];
  if (broad) {
    const { data } = await service
      .from("shops")
      .select("id, name, branches(name)")
      .eq("is_active", true)
      .order("name");
    shops = (data ?? []).map((s: unknown) => {
      const row = s as { id: string; name: string; branches?: { name?: string } | { name?: string }[] | null };
      const br = Array.isArray(row.branches) ? row.branches[0] : row.branches;
      return { id: row.id, name: row.name, branchName: br?.name ?? null };
    });
  } else if (me.role === "manager" && me.branch_id) {
    const { data } = await service
      .from("shops")
      .select("id, name, branches(name)")
      .eq("branch_id", me.branch_id)
      .eq("is_active", true)
      .order("name");
    shops = (data ?? []).map((s: unknown) => {
      const row = s as { id: string; name: string; branches?: { name?: string } | { name?: string }[] | null };
      const br = Array.isArray(row.branches) ? row.branches[0] : row.branches;
      return { id: row.id, name: row.name, branchName: br?.name ?? null };
    });
  } else if (me.shop_id) {
    const { data } = await service
      .from("shops")
      .select("id, name, branches(name)")
      .eq("id", me.shop_id)
      .maybeSingle();
    if (data) {
      const row = data as unknown as { id: string; name: string; branches?: { name?: string } | null };
      shops = [{ id: row.id, name: row.name, branchName: (row.branches as { name?: string } | null)?.name ?? null }];
    }
  }

  const allowed = new Set(shops.map((s) => s.id));
  const requested = searchParams?.shop_id ?? null;
  const shopId = broad
    ? requested || me.shop_id || shops[0]?.id || null
    : me.role === "manager"
    ? requested && allowed.has(requested) ? requested : me.shop_id || shops[0]?.id || null
    : me.shop_id;

  if (!shopId) {
    return (
      <div>
        <PageHeader title="Shop Summary" description="Ek shop ki poori roz ki khidmat" />
        <Card><p className="py-4 text-center text-sm text-surface-400">Koi shop assign nahi — Admin se raabta karein.</p></Card>
      </div>
    );
  }

  const selectedShop = shops.find((s) => s.id === shopId);
  const today = new Date().toISOString().slice(0, 10);
  const period = searchParams?.period || "day";
  const d = new Date();
  const weekStart = new Date(d.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = period === "custom" ? searchParams?.from || today
    : period === "week" ? weekStart
    : period === "month" ? monthStart
    : today;
  const to = period === "custom" ? searchParams?.to || today : today;

  // Core snapshot (sales, stock, cash, deposits)
  const snap = await shopZeroLeakageSnapshot(shopId, from, to);

  // Supplier bills linked to this shop's warehouse
  const { data: wh } = await service.from("warehouses").select("id").eq("shop_id", shopId).maybeSingle();
  let billCount = 0;
  let billTotal = 0;
  if (wh?.id) {
    const { data: bills } = await service
      .from("purchases")
      .select("total_amount, status")
      .eq("warehouse_id", wh.id)
      .neq("status", "cancelled")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`);
    const validBills = bills ?? [];
    billCount = validBills.length;
    billTotal = (validBills as { total_amount?: number | null }[]).reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
  }

  // Payment method breakdown
  const cashMethod = snap.flow.sales.byMethod.find((x) => x.method === "cash")?.sales ?? 0;
  const khataMethod = snap.flow.sales.byMethod
    .filter((x) => ["khata", "credit", "customer_credit", "udhaar"].includes(x.method))
    .reduce((s, x) => s + x.sales, 0);
  const digital = snap.flow.sales.byMethod
    .filter((x) => !["cash", "khata", "credit", "customer_credit", "udhaar"].includes(x.method))
    .reduce((s, x) => s + x.sales, 0);

  const periodLabel = period === "day" ? "Aaj" : period === "week" ? "Is Hafte" : period === "month" ? "Is Mahine" : `${from} – ${to}`;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${selectedShop?.name ?? "Shop"} — Roz ka Jaiza`}
        description={`${selectedShop?.branchName ? `${selectedShop.branchName} · ` : ""}Sale, Load, Bill, Recovery — sab ek jagah`}
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-end gap-2 rounded-xl border border-surface-200 bg-white px-4 py-3 dark:border-surface-700 dark:bg-surface-900">
        {shops.length > 1 && (
          <label className="flex items-center gap-2 text-xs font-medium text-surface-600 dark:text-surface-400">
            Shop
            <select name="shop_id" defaultValue={shopId} className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800">
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.branchName ? ` (${s.branchName})` : ""}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-xs font-medium text-surface-600 dark:text-surface-400">
          Waqt
          <select name="period" defaultValue={period} className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800">
            <option value="day">Aaj</option>
            <option value="week">Pichle 7 Din</option>
            <option value="month">Is Mahina</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {period === "custom" && (
          <>
            <input type="date" name="from" defaultValue={from} max={today} className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800" />
            <input type="date" name="to" defaultValue={to} max={today} className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800" />
          </>
        )}
        <button className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">
          Apply
        </button>
        <span className="ml-auto text-xs text-surface-400">{periodLabel}</span>
      </form>

      {/* Section 1: Sale Summary */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Sale — {periodLabel}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <ShoppingCart className="h-5 w-5 text-brand-600" />
            <p className="mt-2 text-xs text-surface-500">Kul Sale</p>
            <p className="text-2xl font-bold tabular-nums">{rs(snap.flow.sales.total)}</p>
          </Card>
          <Card>
            <Banknote className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-xs text-surface-500">Cash (Naqad)</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{rs(cashMethod)}</p>
          </Card>
          <Card>
            <CreditCard className="h-5 w-5 text-blue-600" />
            <p className="mt-2 text-xs text-surface-500">Digital (QR / Easypaisa / JazzCash)</p>
            <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400">{rs(digital)}</p>
          </Card>
          <Card>
            <ReceiptText className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-xs text-surface-500">Khata / Udhaar</p>
            <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400">{rs(khataMethod)}</p>
            <p className="mt-1 text-[11px] text-surface-400">Credit sale — paisa abhi nahi aaya</p>
          </Card>
        </div>
      </div>

      {/* Payment method breakdown */}
      {snap.flow.sales.byMethod.length > 0 && (
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Tareeqa-e-Adaigi — {periodLabel}</p>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {snap.flow.sales.byMethod
              .filter((r) => r.sales > 0)
              .sort((a, b) => b.sales - a.sales)
              .map((row) => {
                const isKhata = ["khata", "credit", "customer_credit", "udhaar"].includes(row.method);
                return (
                  <div key={row.method} className="flex items-center justify-between py-2.5">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-base">{METHOD_ICON[row.method] ?? "💱"}</span>
                      <span>{METHOD_LABEL[row.method] ?? row.label ?? row.method}</span>
                      {isKhata && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Udhaar</span>}
                    </span>
                    <span className={`font-semibold tabular-nums ${isKhata ? "text-amber-700 dark:text-amber-400" : "text-surface-900 dark:text-surface-100"}`}>
                      {rs(row.sales)}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* Section 2: Recovery + Outstanding */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Wasooli aur Baqi — {periodLabel}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <p className="mt-2 text-xs text-surface-500">Recovery — Cash Aaya</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {rs(snap.cash.cashRecoveryToday ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-surface-400">Purani khata par naqad wasooli</p>
          </Card>
          <Card>
            <ArrowDownToLine className="h-5 w-5 text-surface-500" />
            <p className="mt-2 text-xs text-surface-500">Collection Outstanding</p>
            <p className={`text-2xl font-bold tabular-nums ${snap.deposits.outstanding > 0 ? "text-amber-700 dark:text-amber-400" : "text-surface-900 dark:text-surface-100"}`}>
              {rs(snap.deposits.outstanding)}
            </p>
            <p className="mt-1 text-[11px] text-surface-400">Collected cash jo Finance tak nahi pohoncha</p>
          </Card>
          <Card>
            <Package className="h-5 w-5 text-surface-500" />
            <p className="mt-2 text-xs text-surface-500">Stock Value (Current)</p>
            <p className="text-2xl font-bold tabular-nums">
              {snap.stock.value == null ? <span className="text-surface-400">—</span> : rs(snap.stock.value)}
            </p>
            <p className="mt-1 text-[11px] text-surface-400">Selling rate par · {snap.stock.quantity.toLocaleString()} items</p>
          </Card>
        </div>
      </div>

      {/* Section 3: Load received (stock in) + Supplier Bills */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">Load aur Bill — {periodLabel}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <Truck className="h-5 w-5 text-purple-600" />
            <p className="mt-2 text-xs text-surface-500">Stock Load (Maal Aaya)</p>
            <p className="text-2xl font-bold tabular-nums text-purple-700 dark:text-purple-400">
              {snap.stockSaleMatch.stockInValue == null ? "—" : rs(snap.stockSaleMatch.stockInValue)}
            </p>
            <p className="mt-1 text-[11px] text-surface-400">Purchase price par stock in (FIFO batches)</p>
          </Card>
          <Card>
            <FileText className="h-5 w-5 text-orange-600" />
            <p className="mt-2 text-xs text-surface-500">Supplier Bill</p>
            <p className="text-2xl font-bold tabular-nums text-orange-700 dark:text-orange-400">{rs(billTotal)}</p>
            <p className="mt-1 text-[11px] text-surface-400">{billCount} bill{billCount !== 1 ? "ain" : ""} is waqt mein</p>
          </Card>
        </div>
      </div>

      {/* Cash control summary */}
      <Card>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-500">Cash Control — Shifts</p>
        <div className="grid gap-4 sm:grid-cols-3 text-center">
          <div>
            <p className="text-xs text-surface-400">Expected Cash</p>
            <p className="text-xl font-bold tabular-nums">{rs(snap.cash.expectedCashClosed)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-400">Counted Cash</p>
            <p className="text-xl font-bold tabular-nums">{rs(snap.cash.countedCashClosed)}</p>
          </div>
          <div>
            <p className="text-xs text-surface-400">Farq</p>
            <p className={`text-xl font-bold tabular-nums ${Math.abs(snap.cash.fullDifference) >= 1 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {snap.cash.fullDifference === 0 ? "✓ Zero" : rs(snap.cash.fullDifference)}
            </p>
          </div>
        </div>
        {snap.cash.openShiftsCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {snap.cash.openShiftsCount} shift abhi bhi khuli hai — final count tak farq pakka nahi.
          </div>
        )}
      </Card>
    </div>
  );
}
