import Link from "next/link";
import { redirect } from "next/navigation";
import { PieChart, Wallet, ShoppingCart, RotateCcw, Receipt, AlertTriangle, Banknote, PiggyBank } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { shopWhereIsMyMoney, shopTodayFlow, shopCashControl, shopCollectionOutstanding, shopInvestmentPosition, shopStockPosition } from "@/lib/pos/shop-360";

export const dynamic = "force-dynamic";

/**
 * Shop 360 — Business Position (Phase 1).
 *
 * Malik ka poora spec (8 September, raat): "Maine is shop mein total
 * kitna paisa lagaya tha, aaj mera paisa kis kis jagah pada hai..."
 * Phase 1 (confirmed order): Paisa Kahan Hai + Aaj ki Sale + Recovery +
 * Expense. Baqi phases baad mein.
 */
export default async function Shop360Page({
  searchParams,
}: {
  searchParams?: { shop_id?: string; date?: string; period?: string; match_from?: string; match_to?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const canView = UNRESTRICTED_ROLES.includes(me.role) || (await canDo("shop-360", "view"));
  if (!canView) {
    return (
      <div>
        <PageHeader title="Meri Dukan — Pura Hisaab" />
        <Card>
          <p className="text-sm text-surface-600">Aapko is safhe ki ijazat nahi hai.</p>
        </Card>
      </div>
    );
  }

  const service = createServiceClient();
  const isUnrestricted = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance";

  // Kaun si shops chun sakta hai -- role ke hisaab se.
  let pickableShops: { id: string; name: string }[] = [];
  if (isUnrestricted) {
    const { data } = await service.from("shops").select("id, name").eq("is_active", true).order("name");
    pickableShops = data ?? [];
  } else if (me.role === "manager" && me.branch_id) {
    const { data } = await service.from("shops").select("id, name").eq("branch_id", me.branch_id).eq("is_active", true).order("name");
    pickableShops = data ?? [];
  }

  const canPick = pickableShops.length > 0;
  // `?shop_id=` sirf UNRESTRICTED ke liye khula chhorna theek hai (un ka
  // scope "all" hi hai). Manager ke liye ye check zaroori hai -- warna
  // URL mein doosri branch ki shop ki id daal kar us ka poora maali data
  // dekha ja sakta tha (own_branch ka matlab hi ye tha ke ROK lage).
  const requestedShopId = searchParams?.shop_id || null;
  const allowedIds = new Set(pickableShops.map((s) => s.id));
  const shopId = isUnrestricted
    ? requestedShopId || me.shop_id || pickableShops[0]?.id || null
    : canPick
      ? (requestedShopId && allowedIds.has(requestedShopId) ? requestedShopId : me.shop_id || pickableShops[0]?.id || null)
      : me.shop_id;

  if (!shopId) {
    return (
      <div>
        <PageHeader title="Meri Dukan — Pura Hisaab" description="Ek shop ka poora hisaab ek jagah" />
        <EmptyState
          title="Aap ki profile mein koi shop assign nahi hai"
          description={'Admin → Users par jaa kar aap ko ek shop assign karni hogi, tab hi ye safha aap ki shop ka hisaab dikha sakega.'}
        />
      </div>
    );
  }

  const { data: shop } = await service.from("shops").select("name, branch_id, branches(name)").eq("id", shopId).maybeSingle();
  const shopName = shop?.name ?? "—";
  const branchName = (shop as unknown as { branches?: { name?: string } })?.branches?.name ?? null;

  const today = new Date().toISOString().slice(0, 10);
  const date = searchParams?.date || today;

  // Full Cash Match ka apna period -- Aaj / Is Hafte / Is Mahine / Custom.
  // Malik: "selected Day/Week/Month/Custom Range par ye sab accounted hon."
  const period = searchParams?.period || "day";
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const matchFrom =
    period === "custom"
      ? searchParams?.match_from || today
      : period === "week"
        ? daysAgo(6)
        : period === "month"
          ? monthStart
          : today;
  const matchTo = period === "custom" ? searchParams?.match_to || today : today;

  const [money, flow, cashControl, outstanding, investment, stock] = await Promise.all([
    shopWhereIsMyMoney(shopId),
    shopTodayFlow(shopId, date),
    shopCashControl(shopId, matchFrom, matchTo),
    shopCollectionOutstanding(shopId),
    shopInvestmentPosition(shopId),
    shopStockPosition(shopId, date, date),
  ]);

  /**
   * Needs Attention (Phase 5) -- maujooda numbers se hi, koi nayi
   * ginti nahi. Sifar/khali kabhi "sab theek hai" nahi -- ginti na ho
   * to chip hi nahi banta.
   */
  const alerts: { key: string; label: string; tone: "red" | "amber"; href: string }[] = [];
  if (cashControl.openShiftsCount > 0) {
    alerts.push({ key: "open-shift", label: `${cashControl.openShiftsCount} shift khuli hai`, tone: "amber", href: "/admin/pos" });
  }
  if (cashControl.openShiftsCount === 0 && Math.abs(cashControl.fullDifference) >= 1) {
    alerts.push({
      key: "cash-diff",
      label: `Cash farq Rs ${Math.abs(cashControl.fullDifference).toLocaleString()}`,
      tone: "red",
      href: "/admin/reports/pos-shifts",
    });
  }
  if (outstanding.pendingDeposits > 0) {
    alerts.push({
      key: "pending-deposit",
      label: `Rs ${outstanding.pendingDeposits.toLocaleString()} deposit tasdeeq ka intezar`,
      tone: "amber",
      href: "/admin/finance/pos-deposits",
    });
  }
  if (outstanding.outstanding > 0) {
    alerts.push({
      key: "cash-outstanding",
      label: `Rs ${outstanding.outstanding.toLocaleString()} bank jama baqi`,
      tone: "amber",
      href: "/admin/my-collection",
    });
  }
  if (stock.outOfStockCount > 0) {
    alerts.push({ key: "out-of-stock", label: `${stock.outOfStockCount} item out of stock`, tone: "red", href: "/admin/products" });
  }
  if (stock.lowStockCount > 0) {
    alerts.push({ key: "low-stock", label: `${stock.lowStockCount} item low stock`, tone: "amber", href: "/admin/products" });
  }

  return (
    <div>
      <PageHeader
        title={`${shopName} — Pura Hisaab`}
        description={branchName ? `${branchName} · Shop 360 — Business Position` : "Shop 360 — Business Position"}
      />

      {canPick && pickableShops.length > 1 && (
        <form method="GET" className="mb-4 flex items-end gap-2 text-sm">
          <div>
            <label className="mb-1 block text-[11px] text-surface-500">Shop</label>
            <select
              name="shop_id"
              defaultValue={shopId}
              className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
            >
              {pickableShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="date" value={date} />
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            Dekhein
          </button>
        </form>
      )}

      {/* ---- Needs Attention (Phase 5) ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {alerts.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
            Sab saaf — kuch bhi tawajjo nahi chahta.
          </span>
        ) : (
          alerts.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium ${
                a.tone === "red" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"
              }`}
            >
              {a.label}
            </Link>
          ))
        )}
      </div>

      {/* ---- Paisa Kahan Hai? ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <PieChart className="h-4 w-4" /> Paisa Kahan Hai?
      </h2>
      <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/reports/inventory">
          <StatCard
            label="Stock (maal, FIFO cost)"
            value={money.stockValueApprox == null ? "—" : `Rs. ${money.stockValueApprox.toLocaleString()}`}
            icon={ShoppingCart}
            tone="blue"
          />
        </Link>
        <Link href="/admin/kharche">
          <StatCard label="Cash/Bank/Digital (lifetime)" value={`Rs. ${money.cashDigitalTotal.toLocaleString()}`} icon={Wallet} tone="green" />
        </Link>
        <Link href="/admin/crm">
          <StatCard
            label="Customer Receivable (poori BRANCH)"
            value={money.receivableBranchLevel == null ? "—" : `Rs. ${money.receivableBranchLevel.toLocaleString()}`}
            icon={Receipt}
            tone="orange"
          />
        </Link>
        <Link href="/admin/my-collection">
          <StatCard
            label="POS Cash Outstanding (bank jama baqi)"
            value={`Rs. ${outstanding.outstanding.toLocaleString()}`}
            icon={PiggyBank}
            tone="purple"
          />
        </Link>
      </div>
      <p className="mb-2 text-[11px] text-surface-400">Har card apne source safhe par le jata hai — asal transactions wahan.</p>

      <Card className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-surface-400">Cash/Bank/Digital — payment method ke hisaab se (lifetime)</p>
        {money.byPaymentMethod.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-surface-400">
                  <th className="pb-1.5 pr-4">Method</th>
                  <th className="pb-1.5 pr-4 text-right">Sale (lifetime)</th>
                  <th className="pb-1.5 pr-4 text-right">Kharcha/Adaigi</th>
                  <th className="pb-1.5 text-right">Bacha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {money.byPaymentMethod.map((r) => (
                  <tr key={r.method}>
                    <td className="py-1.5 pr-4">{r.label}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">Rs {r.sales.toLocaleString()}</td>
                    <td className="py-1.5 pr-4 text-right tabular-nums text-surface-600 dark:text-surface-300">
                      {r.expenseNet >= 0 ? "+" : ""}Rs {r.expenseNet.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">Rs {r.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-surface-400">Is shop ki abhi tak koi POS sale nahi mili.</p>
        )}
        <ul className="mt-3 space-y-1 text-[11px] leading-snug text-surface-400">
          <li className="flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {money.stockValueNote}</li>
          <li className="flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {money.receivableNote}</li>
          <li className="flex items-start gap-1"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {money.payableNote}</li>
          <li className="flex items-start gap-1">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            POS Cash Outstanding = lifetime cash sale (Rs {outstanding.totalCashCollected.toLocaleString()}) minus Finance-manzoor-shuda bank deposits
            (Rs {outstanding.approvedDeposits.toLocaleString()}) — pending deposits (Rs {outstanding.pendingDeposits.toLocaleString()}) tasdeeq hone tak shamil nahi.
          </li>
        </ul>
      </Card>

      {/* ---- Investment Position ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <PiggyBank className="h-4 w-4" /> Investment Position
      </h2>
      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-[11px] text-surface-400">Investment (lifetime)</p>
            <p className="font-semibold tabular-nums text-emerald-700">Rs {investment.totalInvestment.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Withdrawals (lifetime)</p>
            <p className="font-semibold tabular-nums text-red-700">Rs {investment.totalWithdrawals.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Net Owner Equity</p>
            <p className="font-semibold tabular-nums">Rs {investment.netOwnerEquity.toLocaleString()}</p>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-surface-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {investment.note}
        </p>
        <Link href="/admin/kharche" className="mt-2 inline-block text-xs text-brand-700 underline">
          Entries dekhein — Paisa &amp; Khata →
        </Link>
      </Card>

      {/* ---- Date filter for the day-flow sections ---- */}
      <form method="GET" className="mb-3 flex items-end gap-2 text-sm">
        {canPick && <input type="hidden" name="shop_id" value={shopId} />}
        <div>
          <label className="mb-1 block text-[11px] text-surface-500">Din</label>
          <input
            type="date"
            name="date"
            defaultValue={date}
            className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
          />
        </div>
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Dekhein
        </button>
      </form>

      {/* ---- Cash Control + Full Cash Match (Phase 2A + 2D) ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <Banknote className="h-4 w-4" /> Cash Control — {matchFrom === matchTo ? matchFrom : `${matchFrom} se ${matchTo}`}
      </h2>
      <Card className="mb-4">
        <form method="GET" className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          {canPick && <input type="hidden" name="shop_id" value={shopId} />}
          <input type="hidden" name="date" value={date} />
          <div>
            <label className="mb-1 block text-[11px] text-surface-500">Period</label>
            <select
              name="period"
              defaultValue={period}
              className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800"
            >
              <option value="day">Aaj</option>
              <option value="week">Is Hafte (7 din)</option>
              <option value="month">Is Mahine</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {period === "custom" && (
            <>
              <div>
                <label className="mb-1 block text-[11px] text-surface-500">Se</label>
                <input type="date" name="match_from" defaultValue={matchFrom} className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-surface-500">Tak</label>
                <input type="date" name="match_to" defaultValue={matchTo} className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-800" />
              </div>
            </>
          )}
          <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            Dekhein
          </button>
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-[11px] text-surface-400">Band Shifts</p>
            <p className="font-semibold tabular-nums">{cashControl.closedShiftsCount}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Opening Cash</p>
            <p className="font-semibold tabular-nums">Rs {cashControl.openingCashClosed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Expected Cash (POS Shift ka apna)</p>
            <p className="font-semibold tabular-nums">Rs {cashControl.expectedCashClosed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Physical (Counted) Cash</p>
            <p className="font-semibold tabular-nums">Rs {cashControl.countedCashClosed.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-surface-500">
          <span>Cash Sale: <b className="tabular-nums text-surface-700 dark:text-surface-200">Rs {cashControl.cashSalesToday.toLocaleString()}</b></span>
          <span>Cash Recovery: <b className="tabular-nums text-emerald-700">+Rs {cashControl.cashRecoveryToday.toLocaleString()}</b></span>
          <span>Cash Investment: <b className="tabular-nums text-emerald-700">+Rs {cashControl.cashInvestmentToday.toLocaleString()}</b></span>
          <span>Cash Expense: <b className="tabular-nums text-surface-700 dark:text-surface-200">Rs {cashControl.cashExpensesToday.toLocaleString()}</b></span>
          <span>Cash Withdrawal: <b className="tabular-nums text-red-700">−Rs {cashControl.cashWithdrawalToday.toLocaleString()}</b></span>
        </div>

        <div className="mt-4 rounded-lg border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">Full Cash Match (POS Shift farq − Recovery/Investment + Withdrawal)</p>
          <p className={`mt-1 text-base font-semibold ${Math.abs(cashControl.fullDifference) < 1 && cashControl.openShiftsCount === 0 ? "text-emerald-700" : "text-red-700"}`}>
            {cashControl.openShiftsCount === 0 && Math.abs(cashControl.fullDifference) < 1
              ? "🟢 Sab Mil Gaya — Difference Rs 0"
              : `🔴 Difference: ${cashControl.fullDifference >= 0 ? "+" : ""}Rs ${cashControl.fullDifference.toLocaleString()}`}
          </p>
          {cashControl.openShiftsCount > 0 && (
            <p className="mt-1 text-sm text-amber-700">
              {cashControl.openShiftsCount} shift abhi khuli hai — jab tak band nahi hoti, Full Match honestly incomplete hai (physical count abhi
              nahi hua). Abhi tak ka andaza Rs {cashControl.openShiftsLiveExpected.toLocaleString()}.
            </p>
          )}
        </div>

        <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-surface-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Ye sirf CASH ka match hai — Bank/Digital/Khata ka is shop par koi independent (physically verified/bank-statement) tasdeeq nahi hoti abhi,
          is liye unhein "match" mein shamil nahi kiya — sirf "Paisa Kahan Hai" mein tracked dikhte hain. Stock ka match Phase 2E (FIFO cost) ke
          baad, agar us period mein Stock Count hua ho.
        </p>
        <Link href="/admin/reports/pos-shifts" className="mt-2 inline-block text-xs text-brand-700 underline">
          Har shift ki tafseel dekhein →
        </Link>
      </Card>

      {/* ---- Aaj ki Sale ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <ShoppingCart className="h-4 w-4" /> {date === today ? "Aaj ki Sale" : "Is din ki Sale"} — Rs {flow.sales.total.toLocaleString()}
      </h2>
      <Card className="mb-4">
        {flow.sales.byMethod.length > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {flow.sales.byMethod.map((r) => (
              <span key={r.method}>
                <span className="text-surface-500">{r.label}</span> <b className="tabular-nums">Rs {r.sales.toLocaleString()}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-400">Is din is shop ki koi sale nahi hui.</p>
        )}
      </Card>

      {/* ---- Aaj ki Recovery ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <RotateCcw className="h-4 w-4" /> {date === today ? "Aaj ki Recovery" : "Is din ki Recovery"} — Rs {flow.recovery.total.toLocaleString()}
      </h2>
      <Card className="mb-4">
        {flow.recovery.byMethod.length > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {flow.recovery.byMethod.map((r) => (
              <span key={r.method}>
                <span className="text-surface-500">{r.label}</span> <b className="tabular-nums">Rs {r.sales.toLocaleString()}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-400">Is din koi wasooli darj nahi hui.</p>
        )}
        <p className="mt-2 text-[11px] leading-snug text-surface-400">
          Ye sirf "Paisa &amp; Khata" se darj shuda wasooli hai — Load &amp; Bill se ki gayi wasooli is number mein shamil nahi (wahan shop tag nahi hota).
          Recovery nayi sale nahi — purana udhaar wapas aana hai.
        </p>
      </Card>

      {/* ---- Aaj ka Kharcha ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <Receipt className="h-4 w-4" /> {date === today ? "Aaj ka Kharcha" : "Is din ka Kharcha"} — Rs {flow.expenses.total.toLocaleString()}
      </h2>
      <Card className="mb-4">
        {flow.expenses.byCategory.length > 0 ? (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {flow.expenses.byCategory.map((r) => (
              <span key={r.category}>
                <span className="text-surface-500">{r.categoryLabel}</span> <b className="tabular-nums">Rs {r.amount.toLocaleString()}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-400">Is din koi manzoor-shuda kharcha nahi hai.</p>
        )}
        <p className="mt-2 text-[11px] text-surface-400">Sirf MANZOOR-shuda kharcha ginta hai — manzoori ke intezar wali qatarein shamil nahi.</p>
      </Card>

      {/* ---- Stock Position (Phase 2E) ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <ShoppingCart className="h-4 w-4" /> Stock Position — {date === today ? "aaj" : date}
      </h2>
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-[11px] text-surface-400">Stock Value (FIFO cost)</p>
            <p className="font-semibold tabular-nums">{stock.stockValueFifo == null ? "—" : `Rs ${stock.stockValueFifo.toLocaleString()}`}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Total Qty</p>
            <p className="font-semibold tabular-nums">{stock.stockQuantity.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Received (is din)</p>
            <p className="font-semibold tabular-nums text-emerald-700">+{stock.receivedInPeriod.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] text-surface-400">Sold (is din)</p>
            <p className="font-semibold tabular-nums text-surface-700 dark:text-surface-200">−{stock.soldInPeriod.toLocaleString()}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className={stock.lowStockCount > 0 ? "text-amber-700" : "text-surface-500"}>
            Low Stock: <b className="tabular-nums">{stock.lowStockCount}</b> items
          </span>
          <span className={stock.outOfStockCount > 0 ? "text-red-700" : "text-surface-500"}>
            Out of Stock: <b className="tabular-nums">{stock.outOfStockCount}</b> items
          </span>
        </div>
        <p className="mt-2 text-[11px] text-surface-400">{stock.note}</p>
        <Link href="/admin/reports/inventory" className="mt-2 inline-block text-xs text-brand-700 underline">
          Product-wise stock dekhein →
        </Link>
      </Card>

      <p className="text-center text-xs text-surface-400">
        Phase 1 + 2 (A-E) yahan hai — Cash Control, POS Outstanding, Investment/Withdrawal, Full Cash Match, Stock/FIFO Cost. Baqi (drill-downs,
        alerts, Branch consolidation) agle hisson mein aayenge.{" "}
        <Link href="/admin/kharche" className="underline">
          Paisa &amp; Khata
        </Link>
      </p>
    </div>
  );
}
