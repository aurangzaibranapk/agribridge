import Link from "next/link";
import { redirect } from "next/navigation";
import { PieChart, Wallet, ShoppingCart, RotateCcw, Receipt, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { shopWhereIsMyMoney, shopTodayFlow } from "@/lib/pos/shop-360";

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
  searchParams?: { shop_id?: string; date?: string };
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
  const shopId = canPick ? searchParams?.shop_id || me.shop_id || pickableShops[0]?.id || null : me.shop_id;

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

  const [money, flow] = await Promise.all([shopWhereIsMyMoney(shopId), shopTodayFlow(shopId, date)]);

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

      {/* ---- Paisa Kahan Hai? ---- */}
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-surface-500">
        <PieChart className="h-4 w-4" /> Paisa Kahan Hai?
      </h2>
      <div className="mb-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Stock (maal)"
          value={money.stockValueApprox == null ? "—" : `Rs. ${money.stockValueApprox.toLocaleString()}`}
          icon={ShoppingCart}
          tone="blue"
        />
        <StatCard label="Cash/Bank/Digital (lifetime)" value={`Rs. ${money.cashDigitalTotal.toLocaleString()}`} icon={Wallet} tone="green" />
        <StatCard
          label="Customer Receivable (poori BRANCH)"
          value={money.receivableBranchLevel == null ? "—" : `Rs. ${money.receivableBranchLevel.toLocaleString()}`}
          icon={Receipt}
          tone="orange"
        />
      </div>

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
        </ul>
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

      <p className="text-center text-xs text-surface-400">
        Ye Phase 1 hai — Cash Control, Stock ka asal cost, Investment/Withdrawal aur "Aaj Ka Milaan" (poori reconciliation) agle phases mein aayenge.{" "}
        <Link href="/admin/kharche" className="underline">
          Paisa &amp; Khata
        </Link>
      </p>
    </div>
  );
}
