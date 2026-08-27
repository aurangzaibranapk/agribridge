"use client";
import { Award, ThumbsUp, ThumbsDown } from "lucide-react";

interface QuestionScore {
  question: string;
  score: number;
}

interface ScoreData {
  question_scores: QuestionScore[];
  behavior_score: number;
  attitude_score: number;
  communication_score: number;
  cleanliness_score: number;
  total_score: number;
  recommendation: string;
  notes: string | null;
}

export function ScoreChart({ score }: { score: ScoreData }) {
  const maxTotal = (score.question_scores.length + 4) * 5;
  const percentage = maxTotal > 0 ? Math.round((score.total_score / maxTotal) * 100) : 0;

  const softSkills = [
    { label: "Behavior", value: score.behavior_score },
    { label: "Attitude", value: score.attitude_score },
    { label: "Baat Karne Ka Tareeqa", value: score.communication_score },
    { label: "Safai/Suthrapan", value: score.cleanliness_score },
  ];

  return (
    <div className="mt-3 border-t border-surface-100 pt-3 dark:border-surface-800">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-surface-400">
          <Award className="h-3.5 w-3.5" /> Interview Score
        </p>
        <div className="flex items-center gap-1.5">
          <span className="font-display text-lg font-bold text-brand-700 dark:text-brand-300">
            {score.total_score}/{maxTotal}
          </span>
          <span className="text-xs text-surface-400">({percentage}%)</span>
        </div>
      </div>

      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
        <div
          className={`h-full rounded-full ${percentage >= 70 ? "bg-green-500" : percentage >= 50 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="space-y-1.5">
        {score.question_scores.map((q, i) => (
          <ScoreBar key={i} label={`${i + 1}. ${q.question}`} value={q.score} max={5} />
        ))}
        <div className="my-2 border-t border-surface-100 dark:border-surface-800" />
        {softSkills.map((s) => (
          <ScoreBar key={s.label} label={s.label} value={s.value} max={5} />
        ))}
      </div>

      <div className={`mt-3 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${score.recommendation === "hire" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
        {score.recommendation === "hire" ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
        Final Decision: {score.recommendation === "hire" ? "Hire Kiya Gaya" : "Reject Kiya Gaya"}
      </div>
      {score.notes && <p className="mt-2 text-xs text-surface-500">Notes: {score.notes}</p>}
    </div>
  );
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-40 shrink-0 truncate text-surface-600 dark:text-surface-400" title={label}>{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right font-medium text-surface-700 dark:text-surface-300">{value}/{max}</span>
    </div>
  );
}