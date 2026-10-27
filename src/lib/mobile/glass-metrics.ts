/** Home cards ke hisaab. Numbers sirf asal series se. Kami ho to null, sifar nahi. */

export type StepState = "pending" | "active" | "done" | "action";

export type TimelineStep = {
  label: string;
  state: StepState;
  detail?: string | null;
  time?: string | null;
  actionLabel?: string | null;
};

const ORDER_STEPS = ["Order mila", "Pack hua", "Rawana hua", "Raste mein", "Pohanch gaya"] as const;
const MILK_STEPS = ["MCA ne uthaya", "Chiller par check", "Rate laga", "Wallet mein credit"] as const;
const APPROVAL_STEPS = ["Entry hui", "Check hui", "Manzoor hui", "Khata mein post"] as const;

const WEEKDAY = ["It", "Pi", "Mn", "Bd", "Jm", "Ju", "Ha"];

export function romanWeekday(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const utc = new Date(Date.UTC(year, month - 1, day, 6, 0, 0));
  return WEEKDAY[utc.getUTCDay()] ?? "";
}

/** Pichli value 0 ho, farq sifar ho, 90% ya us se bara ho, ya 300% se aage ho, to badge nahi. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || !(previous > 0) || !Number.isFinite(current)) return null;
  const raw = Math.round(((current - previous) / previous) * 1000) / 10;
  if (raw === 0 || Math.abs(raw) >= 90 || raw > 300 || raw < -300) return null;
  return raw;
}

/** Hazar axis. 180000 → 180. Formatting only; value asal rehti hai. */
export function hazarFigure(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value / 1000));
}

/** Count badge. Farq 0 ho, ya do points na hon, to null. Percent nahi. */
export function countDelta(series: number[]): number | null {
  if (series.length < 2) return null;
  const previous = series[series.length - 2];
  const current = series[series.length - 1];
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return null;
  const delta = Math.round(current - previous);
  return delta === 0 ? null : delta;
}

/** Bar ke upar chhota label: 1.6L, warna Rs. */
export function compactRupee(value: number): string {
  if (!Number.isFinite(value)) return "";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 100000) {
    const lakh = abs / 100000;
    const text = lakh >= 10 ? String(Math.round(lakh)) : lakh.toFixed(1).replace(/\.0$/, "");
    return `${sign}${text}L`;
  }
  if (abs >= 1000) return `${sign}Rs ${Math.round(abs / 1000)}k`;
  return `${sign}Rs ${Math.round(abs)}`;
}

/** Target na ho to null. Ring khali rehti hai, % nahi banate. */
export function monthShare(litres: number | null, target: number | null): number | null {
  if (litres == null || target == null || !(target > 0) || !Number.isFinite(litres)) return null;
  return Math.round((litres / target) * 1000) / 10;
}

/** Target se baqi. Had se aage ho to 0. Target na ho to null. */
export function goalRemaining(actual: number | null, target: number | null): number | null {
  if (actual == null || target == null || !(target > 0) || !Number.isFinite(actual)) return null;
  return Math.max(0, Math.round((target - actual) * 100) / 100);
}

/** Mahine ka aakhri din. Stored deadline na ho to yahi period end hai. */
export function monthEnd(isoDate: string): string | null {
  const [year, month] = isoDate.split("-").map(Number);
  if (!year || !month) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function goalDeadline(stored: string | null | undefined, periodEnd: string | null): string {
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  return periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ? periodEnd : "—";
}

/** Aakhri mahine, purana se naya. Label Angrezi chhota mahina. */
export function monthBuckets(today: string, count = 6): { key: string; label: string }[] {
  const [year, month] = today.split("-").map(Number);
  if (!year || !month) return [];
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: labels[date.getUTCMonth()] });
  }
  return out;
}

/** pct null = poora dash offset, yani ring khali. */
export function ringDashOffset(circumference: number, pct: number | null): number {
  if (!(circumference > 0)) return 0;
  if (pct == null || !Number.isFinite(pct)) return circumference;
  const clamped = Math.max(0, Math.min(100, pct));
  return circumference * (1 - clamped / 100);
}

export function filled(value: unknown): boolean {
  return value != null && value !== "";
}

/** Sirf asal timestamp. Tareekh-only ko ghante ka waqt nahi banaya. */
export function karachiClock(iso: string | null | undefined): string | null {
  if (!iso || /^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit" }).format(date);
}

function orderRank(status: string): number {
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
  return rank[status] ?? -1;
}

export function orderTimeline(
  status: string | null | undefined,
  at?: string | null,
  extra?: { details?: (string | null)[]; times?: (string | null)[] },
): TimelineStep[] {
  const key = String(status ?? "").toLowerCase();
  if (key === "cancelled" || key === "rejected") {
    return ORDER_STEPS.map((label, index) => ({
      label,
      detail: extra?.details?.[index] ?? null,
      state: index === 0 ? "action" : "pending",
      actionLabel: index === 0 ? "Action chahiye" : null,
      time: extra?.times?.[index] ?? (index === 0 ? karachiClock(at) : null),
    }));
  }
  const atRank = orderRank(key);
  return ORDER_STEPS.map((label, index) => {
    const time = extra?.times?.[index] ?? (index === 0 ? karachiClock(at) : null);
    const detail = extra?.details?.[index] ?? null;
    if (atRank < 0) return { label, detail, time: index === 0 ? time : null, state: index === 0 ? "active" : "pending" };
    if (atRank === 4 || index < atRank) return { label, detail, state: "done", time };
    if (index === atRank) return { label, detail, state: "active", time };
    return { label, detail, state: "pending" };
  });
}

export function milkTimeline(row: {
  status?: string | null;
  fat_percentage?: unknown;
  rate_per_liter?: unknown;
  total_amount?: unknown;
  quantity_liters?: unknown;
  route_name?: string | null;
  chiller_name?: string | null;
  collected_at?: string | null;
  fat_at?: string | null;
  verified_at?: string | null;
} | null, actionLabel = "Fat check karwayein"): TimelineStep[] {
  if (!row) {
    return MILK_STEPS.map((label, index) => ({ label, state: index === 0 ? "active" : "pending" }));
  }
  const litres = filled(row.quantity_liters) ? `${row.quantity_liters} L` : null;
  const place = [row.chiller_name || row.route_name, litres].filter(Boolean).join(" · ") || null;
  const fatOk = filled(row.fat_percentage);
  const rateShown = filled(row.rate_per_liter);
  const rateOk = rateShown && filled(row.total_amount);
  const paid = String(row.status ?? "") === "verified";
  const rejected = String(row.status ?? "") === "rejected";
  const needsFat = rejected || !fatOk;
  const amount = Number(row.total_amount);
  const amountText = Number.isFinite(amount) ? Math.round(amount).toLocaleString("en-PK") : String(row.total_amount ?? "");
  const states: StepState[] = needsFat
    ? ["done", "action", "pending", "pending"]
    : !rateOk
      ? ["done", "done", "active", "pending"]
      : !paid
        ? ["done", "done", "done", "active"]
        : ["done", "done", "done", "done"];
  const details = [
    place,
    needsFat ? "Fat check baqi hai" : fatOk ? `Fat ${row.fat_percentage}` : null,
    rateShown ? `Rs ${row.rate_per_liter}/L` : null,
    filled(row.total_amount) ? `${paid ? "Rs" : "Andaza Rs"} ${amountText}` : null,
  ];
  const times = [karachiClock(row.collected_at), karachiClock(row.fat_at), null, karachiClock(row.verified_at)];
  return MILK_STEPS.map((label, index) => ({
    label,
    detail: details[index],
    state: states[index],
    time: states[index] === "done" || states[index] === "action" ? times[index] : null,
    actionLabel: states[index] === "action" ? actionLabel : null,
  }));
}

export function approvalJourney(row: {
  status?: string | null;
  fat_percentage?: unknown;
  collected_at?: string | null;
  fat_at?: string | null;
  verified_at?: string | null;
} | null, actionLabel = "Manzoor karein"): TimelineStep[] {
  if (!row) {
    return APPROVAL_STEPS.map((label) => ({ label, state: "done" }));
  }
  const checked = filled(row.fat_percentage);
  const verified = String(row.status ?? "") === "verified";
  const priced = String(row.status ?? "") === "priced";
  const states: StepState[] = verified
    ? ["done", "done", "done", "done"]
    : priced
      ? ["done", "done", "action", "pending"]
      : checked
        ? ["done", "done", "active", "pending"]
        : ["done", "active", "pending", "pending"];
  const times = [karachiClock(row.collected_at), karachiClock(row.fat_at), karachiClock(row.verified_at), karachiClock(row.verified_at)];
  return APPROVAL_STEPS.map((label, index) => ({
    label,
    state: states[index],
    time: states[index] === "done" ? times[index] : null,
    actionLabel: states[index] === "action" ? actionLabel : null,
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

/** Active step ko aadha count. Mockup ki bar yahi andaaza hai, koi naya stop nahi. */
export function timelinePercent(steps: TimelineStep[]): number {
  if (!steps.length) return 0;
  const done = steps.filter((step) => step.state === "done").length;
  const moving = steps.some((step) => step.state === "active" || step.state === "action") ? 0.5 : 0;
  return Math.round(((done + moving) / steps.length) * 100);
}

export function timelineFinished(steps: TimelineStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.state === "done");
}
