import { shouldFlush, type NetState } from "./sync";

export type OutboxKind = "attendance" | "meter" | "petrol" | "pickup" | "drop" | "fat" | "feedback";

export interface OutboxItem {
  clientUuid: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: string;
  error?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value.trim());
}

export function enqueue(queue: OutboxItem[], item: OutboxItem): OutboxItem[] {
  if (!isUuid(item.clientUuid)) return queue;
  if (queue.some((row) => row.clientUuid === item.clientUuid)) return queue;
  return [...queue, { ...item, error: null }];
}

/**
 * Jo server ne qabool kar liya wo nikal jati hai.
 * Server ki wajah (ok:false, offline nahi) item par error ke sath rehti hai.
 * Network na ho to queue jyon ki tyon.
 */
export function applyFlushResult(
  queue: OutboxItem[],
  results: { clientUuid: string; ok: boolean; error?: string | null; offline?: boolean }[]
): OutboxItem[] {
  const byId = new Map(results.map((row) => [row.clientUuid, row]));
  return queue.flatMap((item) => {
    const result = byId.get(item.clientUuid);
    if (!result || result.offline) return [item];
    if (result.ok) return [];
    return [{ ...item, error: result.error ?? "Server ne qabool nahi kiya." }];
  });
}

export function flushPlan(queue: OutboxItem[], network: NetState): OutboxItem[] {
  if (!shouldFlush(network)) return [];
  return queue.filter((item) => !item.error);
}

/** Naye phone par server ki pending inbox local queue mein, do dafa nahi. */
export function absorbInbox(queue: OutboxItem[], inbox: OutboxItem[]): OutboxItem[] {
  return inbox.reduce((acc, item) => enqueue(acc, item), queue);
}
