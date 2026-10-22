/** Home cards ke hisaab. Numbers sirf asal series se. Kami ho to null, sifar nahi. */

export type StepState = "pending" | "active" | "done" | "action";

export type TimelineStep = {
  label: string;
  state: StepState;
  time?: string | null;
  actionLabel?: string | null;
};

const ORDER_STEPS = ["Order mila", "Pack", "Rawana", "Raste mein", "Pohanch gaya"] as const;
const MILK_STEPS = ["MCA ne uthaya", "Chiller check", "Rate laga", "Wallet mein credit"] as const;

const WEEKDAY = ["It", "Pi", "Mn", "Bd", "Jm", "Ju", "Ha"];

export function romanWeekday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const utc = new Date(Date.UTC(year, month - 1, day, 6, 0, 0));
  return WEEKDAY[utc.getUTCDay()] ?? "";
}

/** Pichli value 0 ho to % nahi. Invented growth nahi. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || !(previous > 0) || !Number.isFinite(current)) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function filled(value: unknown): boolean {
  return value != null && value !== "";
}

export function orderTimeline(status: string | null | undefined, at?: string | null): TimelineStep[] {
  const key = String(status ?? "").toLowerCase();
  if (key === "cancelled" || key === "rejected") {
    return ORDER_STEPS.map((label, index) => ({
      label,
      state: index === 0 ? "action" : "pending",
      actionLabel: index === 0 ? "Action chahiye" : null,
    }));
  }
  const rank: Record<string, number> = {
    draft: 0,
    submitted: 0,
    sales_verified: 0,
    finance_verified: 0,
    approved: 1,
    processing: 1,
    dispatched: 2,
    in_transit: 3,
    delivered: 4,
    grn_submitted: 4,
    completed: 4,
  };
  const atRank = rank[key] ?? -1;
  return ORDER_STEPS.map((label, index) => {
    if (atRank < 0) return { label, state: index === 0 ? "active" : "pending" };
    if (atRank === 4) return { label, state: "done", time: at ?? null };
    if (index < atRank) return { label, state: "done", time: at ?? null };
    if (index === atRank) return { label, state: "active" };
    return { label, state: "pending" };
  });
}

export function milkTimeline(row: {
  status?: string | null;
  fat_percentage?: unknown;
  rate_per_liter?: unknown;
  total_amount?: unknown;
  entry_date?: string | null;
} | null): TimelineStep[] {
  if (!row) {
    return MILK_STEPS.map((label, index) => ({ label, state: index === 0 ? "active" : "pending" }));
  }
  if (String(row.status ?? "") === "rejected") {
    return MILK_STEPS.map((label, index) => ({
      label,
      state: index === 0 ? "done" : index === 1 ? "action" : "pending",
      time: index === 0 ? row.entry_date ?? null : null,
      actionLabel: index === 1 ? "Action chahiye" : null,
    }));
  }
  const flags = [
    true,
    filled(row.fat_percentage),
    filled(row.rate_per_liter) && filled(row.total_amount),
    String(row.status ?? "") === "verified",
  ];
  const active = flags.findIndex((ok) => !ok);
  return MILK_STEPS.map((label, index) => ({
    label,
    state: active < 0 || index < active ? "done" : index === active ? "active" : "pending",
    time: active < 0 || index < active ? row.entry_date ?? null : null,
  }));
}

export function approvalTimeline(items: { label: string; count: number }[], readable: boolean): TimelineStep[] {
  if (!readable) {
    return [{ label: "Manzoori nahi khuli", state: "pending" }];
  }
  if (!items.length) {
    return [
      { label: "Doodh ki tasdeeq", state: "done" },
      { label: "Orders", state: "done" },
      { label: "Kharcha", state: "done" },
    ];
  }
  return items.slice(0, 4).map((item, index) => ({
    label: `${item.label} · ${item.count}`,
    state: index === 0 ? "action" : "pending",
    actionLabel: index === 0 ? "Action chahiye" : null,
  }));
}

export function timelineProgress(steps: TimelineStep[]): number {
  if (!steps.length) return 0;
  const done = steps.filter((step) => step.state === "done").length;
  return done / steps.length;
}

export function timelineFinished(steps: TimelineStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.state === "done");
}
