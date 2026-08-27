import { Award } from "lucide-react";
import type { CreditScoreResult } from "@/lib/utils/credit-score";

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  green: { bg: "bg-green-50", text: "text-green-700", ring: "border-green-200" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "border-blue-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "border-amber-200" },
  red: { bg: "bg-red-50", text: "text-red-700", ring: "border-red-200" },
};

export function CreditScoreCard({ result }: { result: CreditScoreResult }) {
  const colors = COLOR_MAP[result.gradeColor];

  return (
    <div className={`rounded-card border ${colors.ring} ${colors.bg} p-4 shadow-card`}>
      <div className="flex items-center justify-between">
        <h3 className={`flex items-center gap-2 text-sm font-semibold ${colors.text}`}>
          <Award className="h-4 w-4" /> Kisan Credit Score
        </h3>
        <div className="text-right">
          <p className={`text-2xl font-bold ${colors.text}`}>{result.score}/100</p>
          <p className={`text-xs font-medium ${colors.text}`}>Grade {result.grade} - {result.gradeLabel}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {result.breakdown.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-32 shrink-0 text-surface-600">{b.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/60">
              <div className="h-full rounded-full bg-current opacity-70" style={{ width: `${(b.points / b.max) * 100}%`, color: colors.text.replace("text-", "") }} />
            </div>
            <span className="w-10 shrink-0 text-right text-surface-500">{b.points}/{b.max}</span>
          </div>
        ))}
      </div>
    </div>
  );
}