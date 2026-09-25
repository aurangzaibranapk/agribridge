import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { SalaryPlannerClient, type ShopRow } from "./salary-client";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Salary Planner" };

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export default async function SalaryPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branch_id?: string }>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const canView =
    UNRESTRICTED_ROLES.includes(me.role) ||
    me.role === "manager" ||
    me.role === "finance";
  if (!canView) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-8 text-center dark:border-surface-700 dark:bg-surface-900">
        <p className="text-surface-500">Is safhe ki ijazat nahi.</p>
      </div>
    );
  }

  const params = await searchParams;
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = params.month ?? defaultMonth;
  const { from, to } = monthBounds(month);

  const service = createServiceClient();
  const broad = UNRESTRICTED_ROLES.includes(me.role) || me.role === "finance";

  // Fetch branches for filter
  const { data: branches } = await service
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  // Fetch shops (scope to branch if restricted)
  let shopsQuery = service
    .from("shops")
    .select("id, name, business_type, branch_id, branches(name)")
    .eq("is_active", true)
    .order("name");
  if (!broad && me.branch_id) {
    shopsQuery = shopsQuery.eq("branch_id", me.branch_id);
  } else if (params.branch_id) {
    shopsQuery = shopsQuery.eq("branch_id", params.branch_id);
  }
  const { data: rawShops } = await shopsQuery;
  const shops = (rawShops ?? []).map((s: any) => {
    const br = Array.isArray(s.branches) ? s.branches[0] : s.branches;
    return { id: s.id as string, name: s.name as string, branchName: (br?.name ?? null) as string | null, branch_id: s.branch_id as string };
  });

  // Staff count per branch
  const branchIds = [...new Set(shops.map((s) => s.branch_id))];
  const staffMap: Record<string, number> = {};
  if (branchIds.length > 0) {
    const { data: staffRows } = await service
      .from("profiles")
      .select("branch_id")
      .in("branch_id", branchIds)
      .eq("is_active", true)
      .not("role", "in", '("owner","super_admin","admin")');
    (staffRows ?? []).forEach((p: any) => {
      staffMap[p.branch_id] = (staffMap[p.branch_id] ?? 0) + 1;
    });
  }

  // Sales + expenses per shop
  const shopRows: ShopRow[] = await Promise.all(
    shops.map(async (shop) => {
      const [salesRes, expRes] = await Promise.all([
        service
          .from("pos_sales")
          .select("total_amount, total_cogs, profit")
          .eq("shop_id", shop.id)
          .gte("created_at", from)
          .lte("created_at", to + "T23:59:59"),
        service
          .from("company_expense_requests")
          .select("category, amount")
          .eq("shop_id", shop.id)
          .eq("status", "approved")
          .gte("approved_at", from)
          .lte("approved_at", to + "T23:59:59")
          .in("category", ["rent", "utility_bill", "maintenance", "other"]),
      ]);

      const revenue = (salesRes.data ?? []).reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0);
      const grossProfit = (salesRes.data ?? []).reduce((s, r: any) => s + Number(r.profit ?? 0), 0);
      const opex = (expRes.data ?? []).reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
      const netProfit = grossProfit - opex;

      return {
        id: shop.id,
        name: shop.name,
        branchName: shop.branchName,
        revenue,
        grossProfit,
        opex,
        netProfit,
        staffCount: staffMap[shop.branch_id] ?? 0,
      };
    })
  );

  const monthLabel = new Date(
    Number(month.split("-")[0]),
    Number(month.split("-")[1]) - 1,
    1
  ).toLocaleDateString("ur-PK", { year: "numeric", month: "long" });

  return (
    <div>
      <PageHeader
        title="Salary Planner"
        description={`System data se: sale, munafa, kharche — aur salary ki sifarish`}
      />

      {/* Filters */}
      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
            Mahina
          </label>
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
          />
        </div>
        {broad && (branches ?? []).length > 1 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
              Branch
            </label>
            <select
              name="branch_id"
              defaultValue={params.branch_id ?? ""}
              className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
            >
              <option value="">Sab Branches</option>
              {(branches ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Dikhao
        </button>
      </form>

      <p className="mb-4 text-sm font-medium text-surface-600 dark:text-surface-400">
        Mahina: <span className="font-semibold text-surface-800 dark:text-surface-200">{monthLabel}</span>
        {" · "}{shopRows.length} dukanen
      </p>

      <SalaryPlannerClient shops={shopRows} month={month} />
    </div>
  );
}
