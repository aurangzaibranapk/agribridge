import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadCostSheet } from "@/lib/milk-cost-per-liter";
import { AlertTriangle, Droplet } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance", "milk_collection"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function rs(value: number | null): string {
  if (value == null) return "—";
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function CostPerLiterPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; branch_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha aap ke liye nahi hai.</div>;
  }

  const now = new Date();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const year = params.year ? Number(params.year) : now.getFullYear();
  const branchId = params.branch_id || null;

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .order("is_main_branch", { ascending: false })
    .order("name");

  const sheet = await loadCostSheet(month, year, branchId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fi Litre Kharcha"
        description="Ek litre doodh chiller tak lane aur thanda rakhne mein kitna lagta hai."
      />

      <Card className="p-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className="text-xs text-surface-500">Mahina</label>
            <select name="month" defaultValue={month} className="mt-1 rounded-lg border border-surface-200 p-2 text-sm">
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500">Saal</label>
            <input
              name="year"
              type="number"
              defaultValue={year}
              className="mt-1 w-24 rounded-lg border border-surface-200 p-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500">Branch</label>
            <select
              name="branch_id"
              defaultValue={branchId ?? ""}
              className="mt-1 rounded-lg border border-surface-200 p-2 text-sm"
            >
              <option value="">Sab</option>
              {(branches ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-lg border border-surface-300 px-3 py-2 text-sm">
            Dikhayein
          </button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-surface-500">
            <Droplet className="h-3 w-3" /> Doodh
          </p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
            {Math.round(sheet.liters).toLocaleString()} L
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Kisanon ko diya</p>
          <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">{rs(sheet.milkPurchase)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-surface-500">Chalane ka kharcha</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{rs(sheet.runningCost)}</p>
          <p className="text-xs text-surface-400">doodh ke daam ke ilawa</p>
        </Card>
        <Card className="p-4 ring-2 ring-brand-500">
          <p className="text-xs text-surface-500">Fi litre chalane ka kharcha</p>
          <p className="mt-1 text-2xl font-bold text-brand-700 dark:text-brand-400">
            {sheet.perLiterRunning == null ? "—" : `Rs ${(Math.round(sheet.perLiterRunning * 100) / 100).toFixed(2)}`}
          </p>
          <p className="text-xs text-surface-400">
            Doodh ke daam ke sath: {sheet.perLiterTotal == null ? "—" : `Rs ${sheet.perLiterTotal.toFixed(2)}`}
          </p>
        </Card>
      </div>

      {sheet.missing.length > 0 && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <p className="flex items-start gap-1.5 text-xs text-amber-900 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              In khanon mein is mahine koi entry nahi hui: <strong>{sheet.missing.join(", ")}</strong>.
              <br />
              In ka matlab sifar nahi — matlab ye ke abhi darj nahi huye. Jab tak ye nahi bharte, fi litre
              kharcha asal se kam nazar aayega.
            </span>
          </p>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
            <tr>
              <th className="px-4 py-2 font-medium">Kharcha</th>
              <th className="px-4 py-2 font-medium">Kahan se</th>
              <th className="px-4 py-2 text-right font-medium">Raqam</th>
              <th className="px-4 py-2 text-right font-medium">Fi litre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {sheet.lines.map((line) => (
              <tr key={line.key} className={line.entries === 0 ? "opacity-50" : ""}>
                <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">{line.label}</td>
                <td className="px-4 py-2.5 text-xs text-surface-500">
                  {line.source}
                  {line.entries === 0 && <span className="ml-1 text-amber-600">— darj nahi hua</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-surface-700 dark:text-surface-300">{rs(line.amount)}</td>
                <td className="px-4 py-2.5 text-right text-surface-500">
                  {sheet.liters > 0 ? `Rs ${(line.amount / sheet.liters).toFixed(2)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-surface-300 dark:border-surface-700">
            <tr>
              <td colSpan={2} className="px-4 py-2.5 font-semibold text-surface-900 dark:text-white">
                Chalane ka kul kharcha
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-surface-900 dark:text-white">
                {rs(sheet.runningCost)}
              </td>
              <td className="px-4 py-2.5 text-right font-bold text-brand-700 dark:text-brand-400">
                {sheet.perLiterRunning == null ? "—" : `Rs ${sheet.perLiterRunning.toFixed(2)}`}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="px-4 py-2.5 text-surface-600 dark:text-surface-400">
                Doodh ka daam bhi mila kar
              </td>
              <td className="px-4 py-2.5 text-right text-surface-700 dark:text-surface-300">{rs(sheet.totalCost)}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-surface-700 dark:text-surface-300">
                {sheet.perLiterTotal == null ? "—" : `Rs ${sheet.perLiterTotal.toFixed(2)}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>

      <p className="px-1 text-xs text-surface-400">
        Maintenance sirf manzoor shuda ginta hai — jo faisle ke intezar mein hai wo abhi shaamil nahi,
        warna mahine ka hisaab har roz badalta rehta.
      </p>
    </div>
  );
}
