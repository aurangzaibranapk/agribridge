import { Award, Hourglass } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import {
  MIN_MEANINGFUL_EVENTS,
  MIN_RELATIONSHIP_DAYS,
  type CreditScoreResult,
} from "@/lib/utils/credit-score";

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  green: { bg: "bg-green-50", text: "text-green-700", ring: "border-green-200" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", ring: "border-blue-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "border-amber-200" },
  red: { bg: "bg-red-50", text: "text-red-700", ring: "border-red-200" },
};

/**
 * Kisan ka score -- aur jab tak saboot na ho, us ki jagah sach.
 *
 * "Score ban raha hai" ko laal nahi rakha gaya. Laal rang ilzam ka rang
 * hai; yahan kisi ne kuch ghalat nahi kiya, bas abhi record hi nahi
 * bana. Is liye ye khana neutral rehta hai aur saaf batata hai ke kitna
 * baqi hai -- taake banda ye na samjhe ke us par koi nishan lag gaya
 * hai.
 */
export function CreditScoreCard({ result }: { result: CreditScoreResult }) {
  const lang = getLanguageFromCookies("ur");
  if (result.state === "building") {
    const daysLeft = Math.max(0, MIN_RELATIONSHIP_DAYS - result.relationshipDays);
    const eventsLeft = Math.max(0, MIN_MEANINGFUL_EVENTS - result.meaningfulEventCount);

    return (
      <div className="rounded-card border border-surface-200 bg-surface-50 p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <Hourglass className="h-4 w-4" />{t("pm_kisan_score", lang)}</h3>
          <p className="text-sm font-semibold text-surface-600">{t("pm_score_building", lang)}</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-surface-500">{t("pm_score_building_msg", lang)}</p>
        <ul className="mt-3 space-y-1.5 text-xs text-surface-600">
          <li className="flex items-center justify-between gap-2">
            <span>{t("pm_time_with_us", lang)}</span>
            <span className="font-medium">
              {daysLeft === 0 ? "poora ho gaya" : `${daysLeft} din aur`}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>{t("pm_recorded_work", lang)}</span>
            <span className="font-medium">
              {eventsLeft === 0 ? "poore ho gaye" : `${eventsLeft} aur`}
            </span>
          </li>
        </ul>
      </div>
    );
  }

  const colors = COLOR_MAP[result.gradeColor];

  return (
    <div className={`rounded-card border ${colors.ring} ${colors.bg} p-4 shadow-card`}>
      <div className="flex items-center justify-between">
        <h3 className={`flex items-center gap-2 text-sm font-semibold ${colors.text}`}>
          <Award className="h-4 w-4" />{t("pm_kisan_score", lang)}</h3>
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
