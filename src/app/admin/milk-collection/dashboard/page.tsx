import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { buildIssues, type DispatchRow, type MasterChiller, type TotalRow } from "@/lib/milk-admin-issues";
import { TrendChart, CarrierDonut, ChillerBars } from "./dashboard-charts";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["owner", "super_admin", "admin"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtL(v: number): string {
  return `${v.toLocaleString("en-PK", { maximumFractionDigits: 1 })} L`;
}

export default async function MilkAdminDashboard({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const gate = await requireAction("milk-collection.chiller", "view");
  if ("error" in gate) return <div className="p-8 text-center text-surface-400">{gate.error}</div>;
  if (!ADMIN_ROLES.includes(gate.caller.role)) {
    return <div className="p-8 text-center text-surface-400">Ye dashboard sirf Admin ke liye hai.</div>;
  }

  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : aajKaKhana();
  const start = addDays(date, -6);
  const db = createClient() as any;

  const [{ data: masterRows }, { data: totalRows }, { data: dispatchRows }, { data: carrierRows }] = await Promise.all([
    db.from("milk_chiller_master").select("branch_id, name, branches(name)").eq("is_active", true).order("sort_no"),
    db.from("milk_chiller_totals").select("branch_id, entry_date, shift, chiller_no, gross_liters").gte("entry_date", start).lte("entry_date", date).limit(5000),
    db.from("milk_dispatches").select("id, branch_id, dispatch_date, shift, destination, dispatched_liters, received_liters, carrier_id").gte("dispatch_date", start).lte("dispatch_date", date).limit(2000),
    db.from("milk_carriers").select("id, name"),
  ]);

  const masters: MasterChiller[] = ((masterRows ?? []) as any[]).map((m) => ({
    branchId: m.branch_id,
    branchName: Array.isArray(m.branches) ? m.branches[0]?.name ?? "" : m.branches?.name ?? "",
    name: m.name,
  }));
  const totals: TotalRow[] = ((totalRows ?? []) as any[]).map((t) => ({
    branchId: t.branch_id,
    entryDate: t.entry_date,
    shift: t.shift,
    chillerNo: t.chiller_no,
    grossL: Number(t.gross_liters),
  }));
  const dispatches: DispatchRow[] = ((dispatchRows ?? []) as any[]).map((d) => ({
    id: d.id,
    branchId: d.branch_id,
    dispatchDate: d.dispatch_date,
    shift: d.shift,
    grossL: Number(d.dispatched_liters),
    receivedL: d.received_liters == null ? null : Number(d.received_liters),
    destination: d.destination,
    carrierId: d.carrier_id ?? null,
  }));
  const carrierName = new Map(((carrierRows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // Saat din ka trend
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const trend = days.map((d) => ({
    date: d.slice(5),
    aaya: Math.round(totals.filter((t) => t.entryDate === d).reduce((s, t) => s + t.grossL, 0) * 10) / 10,
    gaya: Math.round(dispatches.filter((x) => x.dispatchDate === d).reduce((s, x) => s + x.grossL, 0) * 10) / 10,
  }));
  const today = trend[trend.length - 1];
  const carrierSums = new Map<string, number>();
  for (const d of dispatches) {
    const key = d.carrierId ?? "none";
    carrierSums.set(key, (carrierSums.get(key) ?? 0) + d.grossL);
  }
  const donut = [...carrierSums.entries()].map(([id, value]) => ({
    name: id === "none" ? "Chuna nahi" : carrierName.get(id) ?? "—",
    value: Math.round(value * 10) / 10,
  }));
  const chillerBars = masters
    .map((m) => ({
      name: m.name,
      aaya: Math.round(totals.filter((t) => t.branchId === (m as any).branchId && t.entryDate === date && t.chillerNo === m.name).reduce((s, t) => s + t.grossL, 0) * 10) / 10,
      gaya: 0,
    }))
    .filter((c) => c.aaya > 0);

  const issues = buildIssues({ date, masters, totals, dispatches });

  return (
    <div className="space-y-6">
      <PageHeader title="Doodh ka Admin Dashboard" description={`${start} se ${date} tak · sab branches`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href={`/admin/milk-collection/control-room?date=${date}`} className="rounded-lg border bg-white p-4 hover:shadow">
          <div className="text-xs text-surface-500">Aaj ka aaya</div>
          <div className="mt-1 text-2xl font-semibold">{fmtL(today.aaya)}</div>
        </Link>
        <Link href={`/admin/milk-collection/control-room?date=${date}`} className="rounded-lg border bg-white p-4 hover:shadow">
          <div className="text-xs text-surface-500">Aaj ka gaya</div>
          <div className="mt-1 text-2xl font-semibold">{fmtL(today.gaya)}</div>
        </Link>
        <Link href={`/admin/milk-collection/control-room?date=${date}`} className="rounded-lg border bg-white p-4 hover:shadow">
          <div className="text-xs text-surface-500">Farq (aaya − gaya)</div>
          <div className="mt-1 text-2xl font-semibold">{fmtL(today.aaya - today.gaya)}</div>
        </Link>
        <Link href="#dhyan" className="rounded-lg border border-red-200 bg-red-50 p-4 hover:shadow">
          <div className="text-xs text-red-700">Dhyan dein</div>
          <div className="mt-1 text-2xl font-semibold text-red-800">{issues.length}</div>
        </Link>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Aaya aur gaya: 7 din</h2>
        <TrendChart data={trend} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-surface-600">Kis ne uthaya (carrier)</h2>
          {donut.length > 0 ? <CarrierDonut data={donut} /> : <EmptyState title="Is hafte koi dispatch nahi" />}
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-surface-600">Chiller wise (aaj, aaya)</h2>
          {chillerBars.length > 0 ? <ChillerBars data={chillerBars} /> : <EmptyState title="Aaj ka chiller total nahi" />}
        </Card>
      </div>

      <Card className="p-4" >
        <h2 id="dhyan" className="mb-3 text-sm font-semibold text-surface-600">Dhyan dein ({issues.length})</h2>
        {issues.length === 0 ? (
          <p className="text-sm text-surface-500">Is din koi issue nahi.</p>
        ) : (
          <ul className="divide-y">
            {issues.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <div className={`text-sm font-semibold ${i.level === "bad" ? "text-red-800" : "text-amber-800"}`}>{i.title}</div>
                  <div className="text-xs text-surface-500">{i.detail}</div>
                </div>
                <Link href={i.href} className="rounded border px-3 py-1 text-xs font-semibold hover:bg-surface-50">Detail →</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
