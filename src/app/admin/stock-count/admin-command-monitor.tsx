import { Card } from "@/components/ui/layout-primitives";
import { CheckCircle2, Clock3, MessageSquareText, Users } from "lucide-react";

export interface StockCountCommandRow {
  id: string;
  warehouseName: string;
  staffName: string;
  commandAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalProducts: number;
  countedProducts: number;
  status: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusText(status: string): string {
  if (status === "assigned") return "Command assigned / response pending";
  if (status === "posted") return "Final posted";
  if (status === "verified") return "Manager verified";
  if (status === "counting") return "Response pending / counting";
  return status || "—";
}

export function AdminCommandMonitor({ rows }: { rows: StockCountCommandRow[] }) {
  const total = rows.length;
  const active = rows.filter((r) => r.status === "counting" || r.status === "verified").length;
  const completed = rows.filter((r) => r.status === "posted").length;
  const products = rows.reduce((sum, r) => sum + r.totalProducts, 0);
  const counted = rows.reduce((sum, r) => sum + r.countedProducts, 0);

  return (
    <Card className="border-brand-200 bg-brand-50/30 dark:border-brand-900/40 dark:bg-brand-950/10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">Admin Stock Count Command Monitor</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-surface-500 dark:text-surface-400">
            Kis staff ko kis godam ki ginti di gayi, command/assignment kab record hui, response kitna aaya aur final status kya hai.
            Yahan actual SMS ka jhoota time nahi—database mein saved assignment aur count response hi dikhaya jata hai.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            ["Commands", total],
            ["Active", active],
            ["Completed", completed],
            ["Products", `${counted}/${products}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm dark:border-surface-800 dark:bg-surface-900">
              <p className="text-[10px] uppercase tracking-wide text-surface-400">{label}</p>
              <p className="mt-0.5 font-semibold tabular-nums text-surface-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 bg-white/70 px-4 py-8 text-center text-sm text-surface-500 dark:border-surface-700 dark:bg-surface-900/50">
          Abhi koi stock-count command ya response record nahi mila.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-surface-50 text-left text-[11px] uppercase tracking-wide text-surface-500 dark:bg-surface-800/70">
              <tr>
                <th className="px-3 py-2">Staff / Godam</th>
                <th className="px-3 py-2">Command / assignment</th>
                <th className="px-3 py-2">Response started</th>
                <th className="px-3 py-2">Work</th>
                <th className="px-3 py-2">Response / status</th>
                <th className="px-3 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const progress = row.totalProducts > 0 ? Math.round((row.countedProducts / row.totalProducts) * 100) : 0;
                const done = row.status === "posted";
                return (
                  <tr key={row.id} className="border-t border-surface-100 dark:border-surface-800">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-surface-900 dark:text-white">{row.staffName}</p>
                      <p className="text-xs text-surface-500">{row.warehouseName}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-surface-600 dark:text-surface-300">
                      <span className="flex items-center gap-1"><MessageSquareText className="h-3.5 w-3.5 text-brand-600" /> {formatDate(row.commandAt)}</span>
                    </td>
                    <td className="px-3 py-3 text-xs text-surface-600 dark:text-surface-300">
                      <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-surface-400" /> {formatDate(row.startedAt)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold tabular-nums text-surface-900 dark:text-white">{row.countedProducts} / {row.totalProducts}</p>
                      <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                        <div className={`h-full rounded-full ${done ? "bg-emerald-600" : "bg-brand-600"}`} style={{ width: `${progress}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-surface-400">{progress}% complete</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                        {statusText(row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-surface-600 dark:text-surface-300">{formatDate(row.completedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
