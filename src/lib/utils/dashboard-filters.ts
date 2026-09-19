export type DateRangeKey = "today" | "yesterday" | "week" | "month" | "last_month" | "year" | "custom";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

export function isDateRangeKey(value: string | undefined): value is DateRangeKey {
  return !!value && DATE_RANGE_OPTIONS.some((o) => o.key === value);
}

/**
 * `customFrom`/`customTo` YYYY-MM-DD (jaise `<input type="date">` deta
 * hai) -- sirf `key === "custom"` par istemal hote hain. Malik (19
 * September): "custom date bhi add kar sakein" -- na milen to aaj ke
 * din tak simat jata hai, jhooti "poora mahina" nahi dikhata.
 */
export function getDateRange(key: DateRangeKey, customFrom?: string, customTo?: string): { start: Date; end: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (key) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "custom": {
      const from = customFrom ? new Date(`${customFrom}T00:00:00`) : now;
      const to = customTo ? new Date(`${customTo}T00:00:00`) : now;
      const start = isNaN(from.getTime()) ? startOfDay(now) : startOfDay(from);
      const end = isNaN(to.getTime()) ? endOfDay(now) : endOfDay(to);
      // Ulti tareekhen (from ba'ad mein to se) diye jayein to bhi kabhi
      // khali/uljhi range nahi banti -- chhoti-bari khud theek ho jati hai.
      return start <= end ? { start, end } : { start: end, end: start };
    }
  }
}
