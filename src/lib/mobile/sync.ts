export const PAGE_SIZE = 20;

export interface Stamped {
  id: string;
  at: string;
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): { items: T[]; page: number; hasMore: boolean } {
  const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (p - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: p, hasMore: start + pageSize < items.length };
}

/** Sirf cursor ke baad ki qatarein. Khali cursor = poori fehrist (pehli dafa). */
export function newerThan<T extends { at: string }>(rows: T[], since: string | null | undefined): T[] {
  if (!since) return rows;
  return rows.filter((row) => row.at > since);
}

export function mergeById<T extends Stamped>(local: T[], incoming: T[]): T[] {
  const map = new Map(local.map((row) => [row.id, row]));
  for (const row of incoming) {
    const prev = map.get(row.id);
    if (!prev || row.at >= prev.at) map.set(row.id, row);
  }
  return [...map.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function nextCursor(rows: { at: string }[], previous: string | null): string | null {
  if (rows.length === 0) return previous;
  return rows.reduce((max, row) => (row.at > max ? row.at : max), previous ?? "");
}

export type NetState = "online" | "offline" | "unknown";

export function shouldFlush(network: NetState): boolean {
  return network === "online";
}
