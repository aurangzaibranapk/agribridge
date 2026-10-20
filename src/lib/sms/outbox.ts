/**
 * cc_sms_outbox ka nikaas. Provider khali ho to take() bhi nahi hota —
 * qatarein queued rehti hain. Nakami par attempts + next_attempt_at.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { nextSmsAttempt, sendVeevoSms, veevoEnv, veevoReady, type VeevoEnv, type VeevoSendResult } from "@/lib/sms/veevo";

export interface OutboxRow {
  id: string;
  to_phone: string;
  body: string;
  attempts: number;
}

export interface OutboxPatch {
  status: "queued" | "sent" | "failed";
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  provider: "veevo";
  sent_at: string | null;
}

export interface OutboxDb {
  take(limit: number): Promise<OutboxRow[]>;
  save(id: string, patch: OutboxPatch): Promise<void>;
}

export function applyOutboxResult(attempts: number, result: VeevoSendResult, now = new Date()): OutboxPatch | null {
  if (result.queued) return null;
  if (result.sent) {
    return {
      status: "sent",
      attempts: attempts + 1,
      next_attempt_at: null,
      last_error: null,
      provider: "veevo",
      sent_at: now.toISOString(),
    };
  }
  if (!result.retryable) {
    return {
      status: "failed",
      attempts: attempts + 1,
      next_attempt_at: null,
      last_error: result.reason,
      provider: "veevo",
      sent_at: null,
    };
  }
  const next = nextSmsAttempt(attempts, now);
  return {
    status: next.status,
    attempts: next.attempts,
    next_attempt_at: next.nextAttemptAt,
    last_error: result.reason,
    provider: "veevo",
    sent_at: null,
  };
}

export async function drainSmsOutbox(opts: {
  db?: OutboxDb;
  env?: VeevoEnv;
  fetchImpl?: typeof fetch;
  now?: Date;
  limit?: number;
} = {}): Promise<{ skipped: boolean; reason: string | null; sent: number; failed: number; retry: number }> {
  const env = opts.env ?? veevoEnv();
  if (!veevoReady(env)) {
    return { skipped: true, reason: "SMS provider not configured yet.", sent: 0, failed: 0, retry: 0 };
  }
  const db = opts.db ?? supabaseSmsOutbox();
  const now = opts.now ?? new Date();
  const rows = await db.take(opts.limit ?? 20);
  let sent = 0;
  let failed = 0;
  let retry = 0;
  for (const row of rows) {
    const result = await sendVeevoSms({ to: row.to_phone, text: row.body, env, fetchImpl: opts.fetchImpl });
    const patch = applyOutboxResult(row.attempts ?? 0, result, now);
    if (!patch) continue;
    await db.save(row.id, patch);
    if (patch.status === "sent") sent += 1;
    else if (patch.status === "failed") failed += 1;
    else retry += 1;
  }
  return { skipped: false, reason: null, sent, failed, retry };
}

function missingColumn(message: string): boolean {
  return /fn_cc_take_sms|schema cache|does not exist|Could not find|attempts|next_attempt_at/i.test(message);
}

/** Service role. 628 se pehle purani queued qatarein bina lease ke uth-ti hain. */
export function supabaseSmsOutbox(): OutboxDb {
  const db = createServiceClient() as unknown as {
    rpc: (fn: string, args: { p_limit: number }) => Promise<{ data: OutboxRow[] | null; error: { message: string } | null }>;
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, value: string) => {
          eq: (col: string, value: string) => {
            order: (col: string) => { limit: (n: number) => Promise<{ data: OutboxRow[] | null; error: { message: string } | null }> };
          };
        };
      };
      update: (patch: Record<string, unknown>) => { eq: (col: string, value: string) => Promise<{ error: { message: string } | null }> };
    };
  };
  return {
    async take(limit) {
      const taken = await db.rpc("fn_cc_take_sms", { p_limit: limit });
      if (!taken.error) return taken.data ?? [];
      if (!missingColumn(taken.error.message)) throw new Error("SMS queue nahi uthi.");
      const fallback = await db.from("cc_sms_outbox").select("id,to_phone,body").eq("status", "queued").eq("channel", "sms").order("created_at").limit(limit);
      if (fallback.error) throw new Error("SMS queue nahi uthi.");
      return (fallback.data ?? []).map((row) => ({ ...row, attempts: 0 }));
    },
    async save(id, patch) {
      const full = {
        status: patch.status,
        provider: patch.provider,
        last_error: patch.last_error,
        sent_at: patch.sent_at,
        attempts: patch.attempts,
        next_attempt_at: patch.next_attempt_at,
      };
      const first = await db.from("cc_sms_outbox").update(full).eq("id", id);
      if (!first.error) return;
      if (!missingColumn(first.error.message)) throw new Error("SMS queue update nahi hui.");
      const second = await db.from("cc_sms_outbox").update({
        status: patch.status, provider: patch.provider, last_error: patch.last_error, sent_at: patch.sent_at,
      }).eq("id", id);
      if (second.error) throw new Error("SMS queue update nahi hui.");
    },
  };
}
