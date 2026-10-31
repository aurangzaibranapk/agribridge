import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { loadHandoverDay } from "@/lib/milk-handover-page";
import { summarizeEntries, dispatchAlerts, type ShiftCounts } from "@/lib/milk-control-room";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];
const PICK_BRANCH = ["owner", "super_admin", "admin"];

const LINKS = [
  { href: "/admin/milk-collection/chiller", label: "Chiller — din ka doodh" },
  { href: "/admin/milk-collection/verify", label: "Doodh ki Tasdeeq" },
  { href: "/admin/milk-collection/handover", label: "Handover — Roz ka khulasa" },
  { href: "/admin/milk-collection/routes", label: "Route aur Kami" },
  { href: "/admin/milk-collection/dispatch", label: "Dispatch" },
];

function fmtL(value: number): string {
  return `${value.toFixed(3)} L`;
}

function fmtN(value: number | null): string {
  return value == null ? "—" : String(value);
}

function Kpi({ label, value, href, tone }: { label: string; value: string; href?: string; tone?: "warn" | "normal" }) {
  const body = (
    <div className={`rounded-lg border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-surface-200 bg-white"}`}>
      <div className="text-xs text-surface-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-surface-900">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ShiftRow({ label, c }: { label: string; c: ShiftCounts }) {
  return (
    <tr className="border-t border-surface-100">
      <td className="px-3 py-2 font-medium">{label}</td>
      <td className="px-3 py-2 text-right">{c.entries}</td>
      <td className="px-3 py-2 text-right">{fmtL(c.liters)}</td>
      <td className="px-3 py-2 text-right">{c.pendingFat}</td>
      <td className="px-3 py-2 text-right">{c.priced}</td>
      <td className="px-3 py-2 text-right">{c.verified}</td>
      <td className="px-3 py-2 text-right">{c.rejected}</td>
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

  let entriesQuery = supabase
    .from("milk_entries")
    .select("shift, quantity_liters, status")
    .eq("entry_date", date)
    .limit(5000);
  let dispatchQuery = supabase
    .from("milk_dispatches")
    .select("id, shift, destination, dispatched_liters, received_liters, shortage_percentage")
    .eq("dispatch_date", date)
    .limit(500);
  if (branchId) {
    entriesQuery = entriesQuery.eq("branch_id", branchId);
    dispatchQuery = dispatchQuery.eq("branch_id", branchId);
  }

  const [{ data: entryRows, error: entryErr }, { data: dispatchRows, error: dispatchErr }, day] = await Promise.all([
    entriesQuery,
    dispatchQuery,
    loadHandoverDay({ date, branchId }),
  ]);

  const summary = entryErr ? null : summarizeEntries(entryRows ?? []);
  const alerts = dispatchErr ? null : dispatchAlerts(dispatchRows ?? []);
  const out = day.summary;
  // Jis manzil par slip nahi, us ka gaya 0 hai (wahi usool jo handover par hai).
  const gayaL = (out.company.grossL ?? 0) + (out.vendor.grossL ?? 0) + (out.party.grossL ?? 0);

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "Sab branches";

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

      {(entryErr || dispatchErr || day.error) && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Kuch data nahi mila, is liye us hisse ki ginti khaali (—) hai. Sifar nahi.
          {day.error ? ` ${day.error}` : ""}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Aaj ka hisaab (Chiller → Handover)</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Aaya (chiller ka total)" value={out.inL == null ? "—" : fmtL(out.inL)} href="/admin/milk-collection/chiller" />
          <Kpi label="Gaya (Company + Vendor + Party)" value={fmtL(gayaL)} href="/admin/milk-collection/handover" />
          <Kpi label="Farq" value={out.varianceL == null ? "—" : fmtL(out.varianceL)} />
          <Kpi label="Entries (kul)" value={summary ? String(summary.total.entries) : "—"} href="/admin/milk-collection/verify" />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-surface-600">Kaam jo baaqi hain</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="FAT ka intezar"
            value={fmtN(summary?.total.pendingFat ?? null)}
            href="/admin/milk-collection/chiller"
            tone={summary && summary.total.pendingFat > 0 ? "warn" : "normal"}
          />
          <Kpi
            label="Tasdeeq baqi (rate lag gaya)"
            value={fmtN(summary?.total.priced ?? null)}
            href="/admin/milk-collection/verify"
            tone={summary && summary.total.priced > 0 ? "warn" : "normal"}
          />
          <Kpi label="Rad kiye gaye" value={fmtN(summary?.total.rejected ?? null)} href="/admin/milk-collection/routes" />
          <Kpi
            label="Raseed baqi (dispatch)"
            value={alerts ? String(alerts.filter((a) => a.kind === "raseed_baqi").length) : "—"}
            href="/admin/milk-collection/handover"
            tone={alerts && alerts.some((a) => a.kind === "raseed_baqi") ? "warn" : "normal"}
          />
        </div>
      </section>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Shift wise</h2>
        {summary ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-surface-500">
                <th className="px-3 py-2">Shift</th>
                <th className="px-3 py-2 text-right">Entries</th>
                <th className="px-3 py-2 text-right">Litre</th>
                <th className="px-3 py-2 text-right">FAT baqi</th>
                <th className="px-3 py-2 text-right">Tasdeeq baqi</th>
                <th className="px-3 py-2 text-right">Tasdeeq shuda</th>
                <th className="px-3 py-2 text-right">Rad</th>
              </tr>
            </thead>
            <tbody>
              <ShiftRow label="Subah" c={summary.byShift.morning} />
              <ShiftRow label="Shaam" c={summary.byShift.evening} />
              <ShiftRow label="Kul" c={summary.total} />
            </tbody>
          </table>
        ) : (
          <EmptyState title="Shift ka hisaab nahi mil saka" />
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Dispatch aur kami</h2>
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
