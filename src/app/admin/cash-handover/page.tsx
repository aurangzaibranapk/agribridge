import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { SendCashForm, ReceiveCard } from "./handover-client";
import { cashInTransit, recentHandovers, TRANSIT_ALERT_DAYS } from "@/lib/ledger/handover";
import { AlertTriangle, CheckCircle2, Send, HandCoins, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "manager", "finance"];

function rs(value: number): string {
  return `Rs ${Math.round(value).toLocaleString()}`;
}

export default async function CashHandoverPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ROLES.includes(me.role)) {
    return (
      <div className="p-8 text-center text-surface-400">
        Ye safha sirf Manager, Finance aur Admin ke liye hai.
      </div>
    );
  }

  const [{ data: peopleRows }, { data: branchRows }, transit, history] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .neq("id", user!.id)
      .order("full_name"),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    cashInTransit(),
    recentHandovers(40),
  ]);

  const people = (peopleRows ?? []).map((p) => ({
    id: p.id,
    name: p.full_name ?? "—",
    role: p.role,
  }));
  const branches = (branchRows ?? []).map((b) => ({ id: b.id, name: b.name }));

  // Mere naam bheja hua cash jo maine abhi wusool nahi kiya.
  const { data: mineRows } = await supabase
    .from("cash_handovers")
    .select("id")
    .eq("to_profile_id", user!.id)
    .eq("status", "sent");
  const mineIds = new Set((mineRows ?? []).map((r) => r.id));
  const awaitingMe = transit.filter((t) => mineIds.has(t.id));

  const transitTotal = transit.reduce((s, t) => s + t.amount, 0);
  const stale = transit.filter((t) => t.daysOld >= TRANSIT_ALERT_DAYS);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cash Haath Badalna"
        description="Dene wala aur lene wala — dono alag alag likhte hain. Jab tak dono ki baat ek na ho, raqam “raaste mein” rehti hai."
      />

      {/* ---- Raaste mein kitna hai ---- */}
      <Card
        className={`p-4 ${
          transit.length === 0
            ? "border-l-4 border-l-green-500"
            : stale.length > 0
              ? "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20"
              : "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {transit.length === 0 ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-surface-900 dark:text-white">
              {transit.length === 0
                ? "Koi raqam raaste mein nahi"
                : `${rs(transitTotal)} abhi raaste mein hai — ${transit.length} handover`}
            </p>
            <p className="mt-0.5 text-xs text-surface-600 dark:text-surface-400">
              {transit.length === 0
                ? "Har bheji hui raqam wusool ho chuki hai."
                : "“Raaste mein” ka matlab ye nahi ke sab theek hai — matlab ye hai ke us raqam ka abhi ek zimmedar hai."}
            </p>
            {stale.length > 0 && (
              <p className="mt-1.5 text-xs font-medium text-red-700 dark:text-red-400">
                In mein se {stale.length} raqam {TRANSIT_ALERT_DAYS}+ din se raaste mein hai. Jitna waqt
                guzarta hai, utna kam mumkin hota jata hai ke wo kabhi mile.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Mere naam aaya hua cash ---- */}
      {awaitingMe.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400">
            <HandCoins className="h-3.5 w-3.5" /> Aap ke naam bheja gaya cash — tasdeeq karein
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {awaitingMe.map((h) => (
              <ReceiveCard
                key={h.id}
                handover={{
                  id: h.id,
                  amount: h.amount,
                  sentBy: h.sentBy,
                  carrier: h.carrier,
                  fromBranch: h.fromBranch,
                  note: h.note,
                  daysOld: h.daysOld,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ---- Bhejne ka form ---- */}
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
            <Send className="h-4 w-4" /> Cash bhejein
          </h2>
          {people.length === 0 ? (
            <EmptyState
              title="Koi doosra shakhs nahi mila"
              description="Cash bhejne ke liye kam az kam ek aur active staff hona zaroori hai — dene aur lene wala ek shakhs nahi ho sakta."
            />
          ) : (
            <SendCashForm people={people} branches={branches} />
          )}
        </Card>

        <div className="space-y-4">
          {/* ---- Raaste wali raqmein ---- */}
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              Abhi raaste mein
            </div>
            {transit.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-green-700 dark:text-green-400">
                Kuch bhi raaste mein nahi.
              </p>
            ) : (
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {transit.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900 dark:text-white">
                        {rs(t.amount)}
                      </p>
                      <p className="truncate text-xs text-surface-500">
                        {t.sentBy ?? "—"} → {t.toPerson ?? "—"}
                        {t.carrier ? ` (${t.carrier} le kar gaya)` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${
                        t.daysOld >= TRANSIT_ALERT_DAYS
                          ? "font-medium text-red-700 dark:text-red-400"
                          : "text-surface-400"
                      }`}
                    >
                      {t.daysOld === 0 ? "aaj" : `${t.daysOld} din`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* ---- Purana record ---- */}
          <Card className="overflow-hidden">
            <div className="border-b border-surface-200 px-4 py-3 text-sm font-semibold text-surface-900 dark:border-surface-800 dark:text-white">
              Pichhle handover
            </div>
            {history.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-surface-400">Abhi koi handover nahi hua.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-surface-200 text-left text-xs text-surface-500 dark:border-surface-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">Kaun → Kaun</th>
                      <th className="px-4 py-2 text-right font-medium">Bheja</th>
                      <th className="px-4 py-2 text-right font-medium">Mila</th>
                      <th className="px-4 py-2 text-right font-medium">Farq</th>
                      <th className="px-4 py-2 font-medium">Wajah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {history.map((h) => (
                      <tr key={h.id} className={h.status === "short" ? "bg-red-50/60 dark:bg-red-950/10" : ""}>
                        <td className="px-4 py-2">
                          <span className="text-surface-800 dark:text-surface-200">
                            {h.sentBy ?? "—"} → {h.toPerson ?? "—"}
                          </span>
                          <span className="block text-xs text-surface-400">
                            {h.sentAt.slice(0, 10)}
                            {h.status === "sent" && " • abhi raaste mein"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                          {rs(h.amount)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                          {h.received === null ? "—" : rs(h.received)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium tabular-nums ${
                            !h.difference
                              ? "text-green-700 dark:text-green-400"
                              : "text-red-700 dark:text-red-400"
                          }`}
                        >
                          {h.difference === null
                            ? "—"
                            : h.difference === 0
                              ? "0"
                              : `${h.difference < 0 ? "−" : "+"}${rs(Math.abs(h.difference))}`}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2 text-xs text-surface-500">
                          {h.reason ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-1.5 px-1 text-xs text-surface-400">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Bheji hui raqam badli nahi ja sakti, aur wusooli sirf wohi shakhs darj kar sakta hai jis ke naam
        bheji gayi ho. Ek hi banda dono taraf likh sake to farq kabhi nahi nikle ga.
      </p>
    </div>
  );
}
