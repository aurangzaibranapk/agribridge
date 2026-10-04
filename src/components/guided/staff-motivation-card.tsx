import { Sparkles, Target } from "lucide-react";
import { buildStaffMotivation } from "@/lib/staff-motivation";

interface StaffMotivationCardProps {
  name?: string | null;
  score?: number | null;
  role?: string | null;
  language?: string | null;
  salesAmount?: number | null;
  targetAmount?: number | null;
}

const TONE: Record<string, string> = {
  focus: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
  improving: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20",
  good: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20",
  excellent: "border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/20",
};

export function StaffMotivationCard(props: StaffMotivationCardProps) {
  // Motivation card poore ERP mein ek hi visual standard rakhta hai:
  // Urdu, RTL aur readable typography. User ka score/sales phir bhi
  // props ke mutabiq personal rehta hai.
  const motivation = buildStaffMotivation({ ...props, language: "ur" });
  return (
    <section className={`staff-motivation-card mb-4 min-h-[112px] rounded-card border px-5 py-4 ${TONE[motivation.tone] ?? TONE.focus}`} aria-label="Daily staff motivation" dir="rtl">
      <div className="flex min-h-[78px] items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-full bg-white/80 p-2.5 text-emerald-700 shadow-sm dark:bg-surface-900/70 dark:text-emerald-300">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] font-bold leading-7 text-surface-900 dark:text-surface-100">{motivation.title}</h2>
            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-surface-500">
              <Target className="h-3.5 w-3.5" aria-hidden="true" /> روزانہ
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[15px] leading-7 text-surface-700 dark:text-surface-200">{motivation.message}</p>
          <p className="mt-1 text-[14px] font-bold leading-6 text-surface-800 dark:text-surface-100">{motivation.action}</p>
        </div>
      </div>
    </section>
  );
}
