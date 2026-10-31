import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { canSeeHandoverRate } from "@/lib/milk-handover";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { dispatchTotals, carrierTotals, type CarrierLineInput } from "@/lib/milk-carrier";
import { CarrierForm, type CarrierOption } from "./carrier-form";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];
const PICK_BRANCH = ["owner", "super_admin", "admin"];

const DEST_LABEL: Record<string, string> = { company: "Company", vendor: "Vendor", party: "Party" };

function fmtL(v: number | null): string {
  return v == null ? "—" : `${v.toFixed(3)} L`;
}
function fmtN(v: number | null, d = 3): string {
  return v == null ? "—" : v.toFixed(d);
}
function fmtRs(v: number | null): string {
  return v == null ? "—" : `Rs ${Math.round(v).toLocaleString("en-PK")}`;
}

export default async function CarrierPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const gate = await requireAction("milk-collection.chiller", "view");
  if ("error" in gate) return <div className="p-8 text-center text-surface-400">{gate.error}</div>;
  const { role, branchId: ownBranch } = gate.caller;
  if (!ROLES.includes(role)) return <div className="p-8 text-center text-surface-400">Aapko is kaam ki ijazat nahi hai.</div>;

  const supabase = createClient();
  const db = supabase as any;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : aajKaKhana();
  const canPick = PICK_BRANCH.includes(role);
  const canRate = canSeeHandoverRate(role);

  const { data: branchRows } = await supabase.from("branches").select("id, name, is_main_branch").order("is_main_branch", { ascending: false }).order("name");
  const branches = branchRows ?? [];
  const requested = params.branch && /^[0-9a-f-]{36}$/i.test(params.branch) ? params.branch : null;
  const allBranches = canPick && params.branch === "all";
  const branchId = allBranches
    ? null
    : canPick
      ? requested ?? ownBranch ?? branches.find((b) => b.is_main_branch)?.id ?? branches[0]?.id ?? null
      : ownBranch;

  let dq = db.from("milk_dispatches").select("id, destination, shift, mcc_name, carrier_id, carrier_rate").eq("dispatch_date", date).limit(500);
  if (branchId) dq = dq.eq("branch_id", branchId);
  const [{ data: dispatchRows, error: dErr }, { data: carrierRows, error: cErr }] = await Promise.all([
    dq,
    db.from("milk_carriers").select("id, name, is_active").order("name"),
  ]);
  const dispatches = (dispatchRows ?? []) as { id: string; destination: string; shift: string; mcc_name: string | null; carrier_id: string | null; carrier_rate: number | null }[];
  const carriers: CarrierOption[] = ((carrierRows ?? []) as { id: string; name: string; is_active: boolean }[])
    .filter((c) => c.is_active || c.id)
    .map((c) => ({ id: c.id, name: c.name }));
  const carrierName = new Map(carriers.map((c) => [c.id, c.name]));

  const ids = dispatches.map((d) => d.id);
  const { data: lineRows, error: lErr } = ids.length
    ? await db.from("milk_dispatch_lines").select("dispatch_id, gross_volume_l, adjusted_volume_l, fat_percentage, snf_percentage, lr, ts_percentage").in("dispatch_id", ids).limit(5000)
    : { data: [], error: null };
  const linesBy = new Map<string, CarrierLineInput[]>();
  for (const l of (lineRows ?? []) as ({ dispatch_id: string } & CarrierLineInput)[]) {
    const arr = linesBy.get(l.dispatch_id) ?? [];
    arr.push(l);
    linesBy.set(l.dispatch_id, arr);
  }

  const rows = dispatches.map((d) => {
    const lines = linesBy.get(d.id) ?? [];
    const totals = dispatchTotals(lines, canRate ? d.carrier_rate : null);
    return { d, lines: lines.length, totals };
  });

  const byCarrier = new Map<string, { totals: ReturnType<typeof dispatchTotals>; lines: number }[]>();
  for (const r of rows) {
    const key = r.d.carrier_id ?? "";
    const arr = byCarrier.get(key) ?? [];
    arr.push({ totals: r.totals, lines: r.lines });
    byCarrier.set(key, arr);
  }
  const anyError = dErr || cErr || lErr;

  return (
    <div className="space-y-6">
      <PageHeader title="Doodh kis ne uthaya (carrier)" description={`${date} · ${allBranches ? "Sab branches" : branches.find((b) => b.id === branchId)?.name ?? ""}`} />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col text-sm">
          Tareekh
          <input type="date" name="date" defaultValue={date} className="rounded border px-2 py-1" />
        </label>
        {canPick && (
          <label className="flex flex-col text-sm">
            Branch
            <select name="branch" defaultValue={allBranches ? "all" : branchId ?? ""} className="rounded border px-2 py-1">
              <option value="all">Sab branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded bg-surface-900 px-3 py-1.5 text-sm text-white">Dekhein</button>
      </form>

      {anyError && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Kuch data nahi mila. Carrier ka hisaab abhi poora nahi. Migration 732, 734 ya 731 is database par check karein.
        </div>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Carrier wise khata</h2>
        {byCarrier.size === 0 ? (
          <EmptyState title="Is din koi dispatch nahi" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-surface-500">
                <th className="px-3 py-2">Carrier</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">Adjusted</th>
                <th className="px-3 py-2 text-right">FAT</th>
                <th className="px-3 py-2 text-right">SNF</th>
                <th className="px-3 py-2 text-right">LR</th>
                <th className="px-3 py-2 text-right">TS</th>
                {canRate && <th className="px-3 py-2 text-right">Amount (Rs)</th>}
              </tr>
            </thead>
            <tbody>
              {[...byCarrier.entries()].map(([key, items]) => {
                const c = carrierTotals(items);
                const name = key ? carrierName.get(key) ?? "—" : "Chuna nahi gaya";
                return (
                  <tr key={key || "none"} className="border-t border-surface-100">
                    <td className="px-3 py-2 font-medium">{name}{c.unratedCount > 0 ? <span className="ml-2 text-xs text-amber-700">{c.unratedCount} par rate nahi</span> : null}</td>
                    <td className="px-3 py-2 text-right">{fmtL(c.grossL)}</td>
                    <td className="px-3 py-2 text-right">{fmtL(c.adjustedL)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(c.fat, 2)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(c.snf)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(c.lr, 2)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(c.ts)}</td>
                    {canRate && <td className="px-3 py-2 text-right">{fmtRs(c.amount)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Har dispatch: kis ne uthaya</h2>
        {rows.length === 0 ? (
          <EmptyState title="Is din koi dispatch nahi" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-surface-500">
                  <th className="px-3 py-2">Manzil</th>
                  <th className="px-3 py-2">Shift</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Adjusted</th>
                  <th className="px-3 py-2 text-right">FAT</th>
                  <th className="px-3 py-2 text-right">SNF</th>
                  <th className="px-3 py-2 text-right">LR</th>
                  <th className="px-3 py-2 text-right">TS</th>
                  {canRate && <th className="px-3 py-2 text-right">Rate</th>}
                  {canRate && <th className="px-3 py-2 text-right">Amount</th>}
                  <th className="px-3 py-2">Carrier</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ d, totals }) => (
                  <tr key={d.id} className="border-t border-surface-100 align-top">
                    <td className="px-3 py-2">{DEST_LABEL[d.destination] ?? d.destination}{d.mcc_name ? <div className="text-xs text-surface-500">{d.mcc_name}</div> : null}</td>
                    <td className="px-3 py-2">{d.shift === "morning" ? "Subah" : d.shift === "evening" ? "Shaam" : d.shift}</td>
                    <td className="px-3 py-2 text-right">{fmtL(totals.grossL)}</td>
                    <td className="px-3 py-2 text-right">{fmtL(totals.adjustedL)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(totals.fat, 2)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(totals.snf)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(totals.lr, 2)}</td>
                    <td className="px-3 py-2 text-right">{fmtN(totals.ts)}</td>
                    {canRate && <td className="px-3 py-2 text-right">{d.carrier_rate == null ? "—" : `Rs ${d.carrier_rate}`}</td>}
                    {canRate && <td className="px-3 py-2 text-right">{fmtRs(totals.amount)}</td>}
                    <td className="px-3 py-2">
                      <CarrierForm
                        dispatchId={d.id}
                        carriers={carriers}
                        currentCarrierId={d.carrier_id}
                        currentRate={canRate ? d.carrier_rate : null}
                        showRate={canRate}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!canRate && <p className="mt-2 text-xs text-surface-500">Rate aur amount sirf Owner/Admin ko dikhte hain.</p>}
          </div>
        )}
      </Card>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/milk-collection/control-room" className="rounded border px-3 py-1.5 hover:bg-surface-50">Doodh Control Room</Link>
      </nav>
    </div>
  );
}
