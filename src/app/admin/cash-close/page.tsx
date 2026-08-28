import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { CountingSheet } from "./counting-sheet";
import {
  expectedCash,
  recentClosings,
  missingClosings,
  unattributedCash,
  DIFFERENCE_ALERT_THRESHOLD,
} from "@/lib/ledger/cash-close";
import { AlertTriangle, CalendarX2, CheckCircle2, HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];
/** Ginti wohi karta hai jo mauqe par hai. Finance dekhta hai, ginta nahi. */
const CAN_COUNT = ["owner", "super_admin", "admin", "manager"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function CashClosePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">
        Ye safha sirf Manager, Finance aur Admin ke liye hai.
      </div>
    );
  }

  const seesAllBranches = me.role !== "manager";

  let branchQuery = supabase.from("branches").select("id, name").eq("is_active", true).order("name");
  if (!seesAllBranches && me.branch_id) branchQuery = branchQuery.eq("id", me.branch_id);
  const { data: branchRows } = await branchQuery;

  const today = new Date().toISOString().slice(0, 10);

  // Har branch ka "hona kitna chahiye" server par ginta hai -- form is
  // adad ko chhoo bhi nahi sakta.
  const [closings, missing, orphanCash] = await Promise.all([
    recentClosings(30, seesAllBranches ? null : me.branch_id),
    missingClosings(30),
    unattributedCash(),
  ]);

  const countedTodayBy = new Map(
    closings.filter((c) => c.closeDate === today).map((c) => [c.branchId, c.counted])
  );

  const branches = await Promise.all(
    (branchRows ?? []).map(async (b) => ({
      id: b.id,
      name: b.name,
      expected: await expectedCash(b.id, today),
      alreadyCounted: countedTodayBy.get(b.id) ?? null,
    }))
  );

  const doneToday = new Set(countedTodayBy.keys());
  const pendingToday = branches.filter((b) => !doneToday.has(b.id));
  const canCount = CAN_COUNT.includes(me.role);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Raat ki Cash Ginti"
        description="Ledger batata hai kitna hona chahiye. Ginti batati hai kitna hai. Farq wahin darj hota hai — chhupta nahi."
      />

      {/* ---- Aaj ki haalat ---- */}
      <Card
        className={`p-4 ${
          pendingToday.length === 0
            ? "border-l-4 border-l-green-500"
            : "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {pendingToday.length === 0 ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {pendingToday.length === 0
                ? "Aaj sab branches ki ginti ho chuki hai"
                : `${pendingToday.length} branch ki aaj ki ginti baqi hai`}
            </p>
            {pendingToday.length > 0 && (
              <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
                {pendingToday.map((b) => b.name).join(", ")}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Bina branch ka cash ---- */}
      {orphanCash !== 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
          <p className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{rs(orphanCash)}</strong> aisa cash hai jo kisi branch ke naam darj nahi.
              <span className="mt-0.5 block text-xs font-normal">
                Har branch sirf apna cash ginti hai, is liye ye raqam kisi ki bhi ginti mein nahi aati —
                yani is par kabhi farq nahi nikalta. Jab tak ye sifar nahi hota, roz ki ginti poori nahi
                kehlati.
              </span>
            </span>
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ---- Ginti ka form ---- */}
        <div>
          {canCount ? (
            branches.length === 0 ? (
              <Card className="p-4">
                <EmptyState
                  title="Koi branch nahi mili"
                  description="Pehle Admin → Branches mein branch banayein."
                />
              </Card>
            ) : (
              <Card className="p-4">
                <CountingSheet branches={branches} today={today} />
              </Card>
            )
          ) : (
            <Card className="p-4">
              <p className="text-sm text-surface-500">
                Ginti branch manager karta hai. Aap yahan sirf dekh sakte hain — ginne wala aur jaanchne
                wala ek shakhs ho to jaanch ka koi matlab nahi rehta.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {/* ---- Chhoot gaye din ---- */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              <CalendarX2 className="h-4 w-4" />
              Jin dinon cash hila magar ginti nahi hui
            </div>
            {missing.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-green-700 dark:text-green-400">
                Koi din chhoota nahi — pichhle 30 din poore hain.
              </p>
            ) : (
              <>
                <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
                  Jis din ginti nahi hui, us din ka farq kabhi maloom nahi hoga. Ye fehrist khali honi
                  chahiye.
                </p>
                <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                  {missing.map((m) => (
                    <li
                      key={`${m.branchId}-${m.closeDate}`}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="text-surface-700 dark:text-surface-300">{m.branchName}</span>
                      <span className="text-surface-500">{m.closeDate}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* ---- Pichhli gintiyan ---- */}
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              Pichhli gintiyan
            </div>
            {closings.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-surface-400">Abhi koi ginti nahi hui.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">Tareekh</th>
                      <th className="px-4 py-2 font-medium">Branch</th>
                      <th className="px-4 py-2 text-right font-medium">Hona chahiye</th>
                      <th className="px-4 py-2 text-right font-medium">Gina gaya</th>
                      <th className="px-4 py-2 text-right font-medium">Farq</th>
                      <th className="px-4 py-2 font-medium">Wajah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {closings.map((c) => {
                      const big = Math.abs(c.difference) >= DIFFERENCE_ALERT_THRESHOLD;
                      return (
                        <tr
                          key={c.id}
                          className={big ? "bg-red-50/60 dark:bg-red-950/10" : ""}
                        >
                          <td className="px-4 py-2 text-xs text-surface-500">{c.closeDate}</td>
                          <td className="px-4 py-2 text-surface-800 dark:text-surface-200">
                            {c.branchName}
                            {c.countedByName && (
                              <span className="block text-xs text-surface-400">{c.countedByName}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                            {rs(c.expected)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                            {rs(c.counted)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-medium tabular-nums ${
                              c.difference === 0
                                ? "text-green-700 dark:text-green-400"
                                : "text-red-700 dark:text-red-400"
                            }`}
                          >
                            {c.difference === 0
                              ? "—"
                              : `${c.difference < 0 ? "−" : "+"}${rs(Math.abs(c.difference))}`}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2 text-xs text-surface-500">
                            {c.reason ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="px-1 text-xs text-surface-400">
        Farq hamesha &quot;Cash ka farq&quot; (6100) khate mein jata hai — kisi kharche mein adjust nahi
        hota. Chhota chhota farq bhi wahin jama hota rehta hai, taake mahine ke aakhir mein us par sawal
        kiya ja sake.
      </p>
    </div>
  );
}
