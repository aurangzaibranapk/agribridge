import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { buildDayReport, dispatchAlerts, type ChillerLine } from "@/lib/milk-control-room";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];
const PICK_BRANCH = ["owner", "super_admin", "admin"];

const LINKS = [
  { href: "/admin/milk-collection/chiller", label: "Chiller — din ka total darj karein" },
  { href: "/admin/milk-collection/verify", label: "Doodh ki Tasdeeq" },
  { href: "/admin/milk-collection/handover", label: "Handover — Company / Vendor / Party" },
  { href: "/admin/milk-collection/billing", label: "Farmer ka Bill" },
  { href: "/admin/milk-collection/routes", label: "Route aur Kami" },
];

function fmtL(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(3)} L`;
}

function fmtRs(value: number | null): string {
  return value == null ? "—" : `Rs ${Math.round(value).toLocaleString("en-PK")}`;
}

function fmtN(value: number | null, digits = 3): string {
  return value == null ? "—" : value.toFixed(digits);
}

function Kpi({ label, value, sub, href, tone }: { label: string; value: string; sub?: string; href?: string; tone?: "warn" | "normal" }) {
  const body = (
    <div className={`h-full rounded-lg border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-surface-200 bg-white"}`}>
      <div className="text-xs text-surface-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-surface-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-surface-500">{sub}</div> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ChillerRow({ c }: { c: ChillerLine }) {
  return (
    <tr className="border-t border-surface-100">
      <td className="px-3 py-2 font-medium">{c.chillerNo}</td>
      <td className="px-3 py-2">{c.shift === "morning" ? "Subah" : c.shift === "evening" ? "Shaam" : "—"}</td>
      <td className="px-3 py-2 text-right">{fmtL(c.grossL)}</td>
      <td className="px-3 py-2 text-right">{fmtN(c.fat, 2)}</td>
      <td className="px-3 py-2 text-right">{fmtN(c.lr, 2)}</td>
      <td className="px-3 py-2 text-right">{fmtN(c.snf)}</td>
      <td className="px-3 py-2 text-right">{fmtN(c.ts)}</td>
      <td className="px-3 py-2 text-right">{fmtL(c.adjustedL)}</td>
    </tr>
  );
}

export default async function MilkControlRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const gate = await requireAction("milk-collection.chiller", "view");
  if ("error" in gate) {
    return <div className="p-8 text-center text-surface-400">{gate.error}</div>;
  }
  const { role, branchId: ownBranch } = gate.caller;
  if (!ROLES.includes(role)) {
    return <div className="p-8 text-center text-surface-400">Aapko is kaam ki ijazat nahi hai.</div>;
  }

  const supabase = createClient();
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : aajKaKhana();
  const canPick = PICK_BRANCH.includes(role);

  const { data: branchRows } = await supabase
    .from("branches")
    .select("id, name, is_main_branch")
    .order("is_main_branch", { ascending: false })
    .order("name");
  const branches = branchRows ?? [];
  const requested = params.branch && /^[0-9a-f-]{36}$/i.test(params.branch) ? params.branch : null;
  const branchId = canPick
    ? requested ?? ownBranch ?? branches.find((b) => b.is_main_branch)?.id ?? branches[0]?.id ?? null
    : ownBranch;
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "Sab branches";

  let chillerQ = supabase
    .from("milk_chiller_totals")
    .select("chiller_no, shift, gross_liters, fat_percentage, lr, snf_percentage, ts_percentage, adjusted_liters")
    .eq("entry_date", date)
    .limit(200);
  let entryQ = supabase
    .from("milk_entries")
    .select("shift, quantity_liters, status, total_amount")
    .eq("entry_date", date)
    .limit(5000);
  let dispatchQ = supabase
    .from("milk_dispatches")
    .select("id, shift, destination, dispatched_liters, received_liters, shortage_percentage")
    .eq("dispatch_date", date)
    .limit(500);
  if (branchId) {
    chillerQ = chillerQ.eq("branch_id", branchId);
    entryQ = entryQ.eq("branch_id", branchId);
    dispatchQ = dispatchQ.eq("branch_id", branchId);
  }

  const [{ data: chillerRows, error: chillerErr }, { data: entryRows, error: entryErr }, { data: dispatchRows, error: dispatchErr }, { data: balanceRows, error: balanceErr }] =
    await Promise.all([
      chillerQ,
      entryQ,
      dispatchQ,
      supabase.from("milk_farmer_balances").select("balance_due"),
    ]);

  const report = chillerErr || entryErr ? null : buildDayReport({ chillers: chillerRows ?? [], entries: entryRows ?? [] });
  const alerts = dispatchErr ? null : dispatchAlerts(dispatchRows ?? []);
  const dispatchList = dispatchErr ? null : dispatchRows ?? [];
  const destOut = (dest: string) =>
    dispatchList == null
      ? null
      : dispatchList
          .filter((d) => d.destination === dest)
          .reduce((s, d) => s + Number(d.dispatched_liters ?? 0), 0);
  const companyOut = destOut("company");
  const vendorOut = destOut("vendor");
  const partyOut = destOut("party");
  const totalOut = dispatchList == null ? null : (companyOut ?? 0) + (vendorOut ?? 0) + (partyOut ?? 0);
  const baqaya = balanceErr || !balanceRows
    ? null
    : balanceRows.reduce((s: number, r: { balance_due: number | string | null }) => s + Number(r.balance_due ?? 0), 0);

  const chillerGross = report?.chillerTotal.grossL ?? null;
  const chillerVsOut = chillerGross == null || totalOut == null ? null : Math.round((chillerGross - totalOut) * 1000) / 1000;
  const anyError = chillerErr || entryErr || dispatchErr || balanceErr;

  return (
    <div className="space-y-6">
      <PageHeader title="Doodh Control Room" description={`${date} · ${branchName}`} />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col text-sm">
          Tareekh
          <input type="date" name="date" defaultValue={date} className="rounded border px-2 py-1" />
        </label>
        {canPick && (
          <label className="flex flex-col text-sm">
            Branch
            <select name="branch" defaultValue={branchId ?? ""} className="rounded border px-2 py-1">
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
          Kuch data nahi mila. Jis hisse ka data nahi, us ki ginti "—" hai, sifar nahi.
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Chiller ka total (aaya)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Gross litre" value={fmtL(chillerGross)} sub={report ? `${report.chillerTotal.count} chiller darj` : undefined} href="/admin/milk-collection/chiller" />
          <Kpi label="Adjusted litre" value={fmtL(report ? report.chillerTotal.adjustedL : null)} />
          <Kpi label="SNF (wazan se ausat)" value={fmtN(report?.chillerTotal.snfAvg ?? null)} />
          <Kpi label="FAT (wazan se ausat)" value={fmtN(report?.chillerTotal.fatAvg ?? null, 2)} />
        </div>
      </section>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Chiller wise</h2>
        {report && report.chillers.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-surface-500">
                <th className="px-3 py-2">Chiller</th>
                <th className="px-3 py-2">Shift</th>
                <th className="px-3 py-2 text-right">Gross</th>
                <th className="px-3 py-2 text-right">FAT</th>
                <th className="px-3 py-2 text-right">LR</th>
                <th className="px-3 py-2 text-right">SNF</th>
                <th className="px-3 py-2 text-right">TS</th>
                <th className="px-3 py-2 text-right">Adjusted</th>
              </tr>
            </thead>
            <tbody>
              {report.chillers.map((c) => (
                <ChillerRow key={`${c.shift}-${c.chillerNo}`} c={c} />
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="Is din ka chiller total darj nahi hai" description="Chiller page par gross, FAT aur LR likhein." action={<Link href="/admin/milk-collection/chiller" className="text-sm underline">Chiller kholen</Link>} />
        )}
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Farmer ka hisaab</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Farmer ko dena hai (is din)"
            value={fmtRs(report ? report.farmer.payableRs : null)}
            sub={report ? `${fmtL(report.farmer.litersPayable)} · tasdeeq/rate shuda entries` : undefined}
            href="/admin/milk-collection/verify"
          />
          <Kpi
            label="Farmer entries (litre, is din)"
            value={fmtL(report ? report.farmer.litersAll : null)}
            sub={report ? `${report.farmer.entries} entries` : undefined}
            href="/admin/milk-collection"
          />
          <Kpi
            label="FAT ka intezar"
            value={report ? String(report.farmer.pendingFat) : "—"}
            href="/admin/milk-collection/chiller"
            tone={report && report.farmer.pendingFat > 0 ? "warn" : "normal"}
          />
          <Kpi
            label="Kul baqaya (sab farmers, aaj tak)"
            value={fmtRs(baqaya)}
            sub="Adaigi is din ki alag nahi dikhti; ye kul baqaya hai"
            href="/admin/milk-collection/billing"
          />
        </div>
        {report && (
          <p className="mt-2 text-xs text-surface-500">
            Average rate: {report.farmer.avgRatePerL == null ? "—" : `Rs ${report.farmer.avgRatePerL} / L`} · Rad: {report.farmer.rejected} · Tasdeeq baqi: {report.farmer.priced}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Company ka hisaab (dispatch)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Company ko gaya" value={fmtL(companyOut)} href="/admin/milk-collection/handover/company" />
          <Kpi label="Vendor ko gaya" value={fmtL(vendorOut)} href="/admin/milk-collection/handover/vendor" />
          <Kpi label="Party ko gaya" value={fmtL(partyOut)} href="/admin/milk-collection/handover/party" />
          <Kpi label="Kul gaya" value={fmtL(totalOut)} sub="Rupay ka hisaab handover slip par" href="/admin/milk-collection/handover" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Farq</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Kpi
            label="Chiller − Company/Vendor/Party (gaya)"
            value={fmtL(chillerVsOut)}
            sub={chillerVsOut == null ? "Total ya dispatch nahi, farq nahi nikal sakte" : "Musbat = chiller par zyada aaya"}
            tone={chillerVsOut != null && Math.abs(chillerVsOut) > 0 ? "warn" : "normal"}
          />
          <Kpi
            label="Chiller − Farmer entries (litre)"
            value={fmtL(report ? report.farmerVsChillerL : null)}
            sub="Musbat = chiller par doodh zyada, farmer entries kam"
            tone={report && report.farmerVsChillerL != null && report.farmerVsChillerL !== 0 ? "warn" : "normal"}
          />
        </div>
      </section>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Dispatch: raseed aur kami</h2>
        {alerts && alerts.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border-t border-surface-100 pt-2">
                <span className="font-medium">{a.destination ?? "—"}</span>
                <span className="text-surface-500">{a.shift ?? "—"}</span>
                <span>{fmtL(a.dispatchedLiters)}</span>
                {a.kind === "raseed_baqi" ? (
                  <span className="text-amber-700">raseed baqi</span>
                ) : (
                  <span className="text-red-700">kami {a.shortagePercentage}%</span>
                )}
              </li>
            ))}
          </ul>
        ) : alerts ? (
          <p className="text-sm text-surface-500">Is din koi raseed baqi ya kami nahi.</p>
        ) : (
          <EmptyState title="Dispatch ka hisaab nahi mil saka" />
        )}
      </Card>

      <nav className="flex flex-wrap gap-2 text-sm">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded border px-3 py-1.5 hover:bg-surface-50">
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
