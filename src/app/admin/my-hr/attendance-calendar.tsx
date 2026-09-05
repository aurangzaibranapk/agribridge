"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/layout-primitives";

/**
 * Hazri ka calendar -- ek mahina, ek nazar.
 *
 * Jis din ka koi indraj hi nahi, wo KHALI rehta hai -- "hazir" nahi.
 * Chhutti wale din, aane wale din aur wo din jin par kisi ne hazri lagai
 * hi nahi -- teenon alag cheezein hain. Khali din ko "hazir" rang dena
 * wohi ghalti hai jis se is project mein bar bar ghalat adad nikle.
 */

const TONE: Record<string, { dot: string; cell: string; label: string }> = {
  present: { dot: "bg-emerald-400", cell: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300", label: "Hazir" },
  half_day: { dot: "bg-amber-300", cell: "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300", label: "Aadha din" },
  leave: { dot: "bg-blue-300", cell: "bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-300", label: "Chhutti" },
  absent: { dot: "bg-red-300", cell: "bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-300", label: "Ghair-hazir" },
};

const DIN = ["Itwar", "Peer", "Mangal", "Budh", "Jumerat", "Juma", "Hafta"];

export function AttendanceCalendar({ rows }: { rows: { date: string; status: string }[] }) {
  const aaj = new Date();
  const [mahina, setMahina] = useState(() => new Date(aaj.getFullYear(), aaj.getMonth(), 1));

  const byDate = new Map(rows.map((r) => [r.date, r.status]));

  const saal = mahina.getFullYear();
  const m = mahina.getMonth();
  const pehlaDin = new Date(saal, m, 1).getDay();
  const kulDin = new Date(saal, m + 1, 0).getDate();

  const khane: (number | null)[] = [
    ...Array.from({ length: pehlaDin }, () => null),
    ...Array.from({ length: kulDin }, (_, i) => i + 1),
  ];

  const ginti: Record<string, number> = { present: 0, half_day: 0, leave: 0, absent: 0 };
  for (let d = 1; d <= kulDin; d++) {
    const key = `${saal}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const st = byDate.get(key);
    if (st && ginti[st] != null) ginti[st] += 1;
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-surface-900 dark:text-white">
          Hazri — {mahina.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMahina(new Date(saal, m - 1, 1))}
            className="rounded-md border border-surface-200 p-1 text-surface-500 hover:bg-surface-50 dark:border-surface-700"
            aria-label="pichla mahina"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMahina(new Date(saal, m + 1, 1))}
            className="rounded-md border border-surface-200 p-1 text-surface-500 hover:bg-surface-50 dark:border-surface-700"
            aria-label="agla mahina"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DIN.map((d) => (
          <div key={d} className="pb-1 text-[10px] font-medium uppercase tracking-wide text-surface-400">
            {d.slice(0, 3)}
          </div>
        ))}
        {khane.map((d, i) => {
          if (d == null) return <div key={`x${i}`} />;
          const key = `${saal}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const st = byDate.get(key);
          const tone = st ? TONE[st] : null;
          return (
            <div
              key={key}
              title={tone?.label ?? "koi indraj nahi"}
              className={`rounded-md py-1.5 text-xs ${
                tone?.cell ?? "text-surface-400 dark:text-surface-600"
              }`}
            >
              {d}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-surface-100 pt-2 dark:border-surface-800">
        {Object.entries(TONE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-surface-600 dark:text-surface-400">
            <span className={`h-2 w-2 rounded-full ${v.dot}`} />
            {v.label} ({ginti[k]})
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-surface-400">
          <span className="h-2 w-2 rounded-full border border-surface-300" />
          Khali din = koi indraj nahi
        </span>
      </div>
    </Card>
  );
}
