import { COMPLAINT_STAGE_META, COMPLAINT_STAGE_ORDER, complaintStageOf, stagePercent, type ComplaintStage } from "@/lib/support/complaint-stage";

export interface StageMark {
  stage: string;
  actor: string;
  at: string;
  note: string | null;
}

export function ComplaintProgress({ stage, percent, log }: { stage: string | null; percent: number | null; log: StageMark[] }) {
  const current = complaintStageOf(stage) ?? "received";
  const rejected = current === "rejected";
  const pct = percent ?? stagePercent(current);
  const index = rejected ? -1 : COMPLAINT_STAGE_ORDER.indexOf(current as (typeof COMPLAINT_STAGE_ORDER)[number]);
  return (
    <div className="mt-3 rounded-xl border border-[#e4eaf2] bg-[#f8fafc] p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-[#14233a]">
          {COMPLAINT_STAGE_META[current].en} / {COMPLAINT_STAGE_META[current].rm}
          <span className="ml-1 font-normal text-[#607089]">{COMPLAINT_STAGE_META[current].ur}</span>
        </span>
        <span className="font-semibold text-[#1a3f86]">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e4eaf2]">
        <div className={`h-full rounded-full ${rejected ? "bg-[#c03636]" : current === "completed" ? "bg-[#1d8a4e]" : "bg-[#1a3f86]"}`} style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-3 grid grid-cols-5 gap-1">
        {COMPLAINT_STAGE_ORDER.map((key, i) => {
          const meta = COMPLAINT_STAGE_META[key];
          const hit = log.filter((row) => complaintStageOf(row.stage) === key);
          const last = hit[hit.length - 1];
          const done = !rejected && i <= index;
          return (
            <li key={key} className="min-w-0">
              <div className={`h-1 rounded-full ${done ? "bg-[#1a3f86]" : "bg-[#e4eaf2]"}`} />
              <p className={`mt-1 text-[10px] leading-tight ${done ? "font-semibold text-[#14233a]" : "text-[#90a0b4]"}`}>{meta.en}</p>
              <p className="text-[10px] text-[#607089]">{meta.rm}</p>
              {last && <p className="mt-0.5 text-[9px] text-[#607089]">{last.actor} · {last.at}</p>}
            </li>
          );
        })}
      </ol>
      {rejected && <p className="mt-2 text-[11px] font-semibold text-[#c03636]">Rejected / Wapas</p>}
    </div>
  );
}

export function stageLogFromHistory(history: { event: string; to: string | null; note: string | null; actor: string; at: string }[]): StageMark[] {
  return history
    .filter((row) => row.to && complaintStageOf(row.to))
    .map((row) => ({ stage: complaintStageOf(row.to) as ComplaintStage, actor: row.actor, at: row.at, note: row.note }));
}
