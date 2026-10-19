/**
 * Broadcast worker: manzoor-shuda, waqt aa chuka elaan ke queued numbers bhejta hai.
 * - BROADCAST_ENABLED != "true" -> kuch nahi (DB ko bhi nahi chhoota).
 * - WhatsApp sirf Meta-APPROVED template se (free text ka raasta hai hi nahi).
 * - Rate limit, quiet hours, rozana hadd: planBatch.
 * Sab dependencies injectable hain taake test bina network ke chale.
 */
import type { BroadcastConfig } from "./config";
import { planBatch } from "./schedule";
import { renderText } from "./text";

export interface QueuedRow { id: string; broadcast_id: string; phone: string; lang: string; vars: Record<string, string>; channel: "whatsapp" | "sms" }
export interface BroadcastRow { id: string; channel: "whatsapp" | "sms" | "both"; status: string; template_vars: string[]; sms_body: Record<string, string>; approved_by: string | null; created_by: string;
  template: { name: string; lang: string; meta_status: string } | null }

export interface WorkerDeps {
  config: BroadcastConfig;
  now: () => Date;
  sentToday: () => Promise<number>;
  claim: (limit: number) => Promise<QueuedRow[]>;
  loadBroadcast: (id: string) => Promise<BroadcastRow | null>;
  mark: (id: string, status: "sent" | "failed", provider: string, msgId: string | null, error?: string | null) => Promise<void>;
  sendTemplate: (to: string, name: string, lang: string, params: string[]) => Promise<string | null>;
  sendSms: (to: string, text: string) => Promise<{ id: string; status: "sent" | "failed"; error?: string; provider: string }>;
  sleep: (ms: number) => Promise<void>;
}

export interface WorkerResult { sent: number; failed: number; skipped: number; reason: string | null }

export function smsTextFor(b: BroadcastRow, lang: string): string {
  return b.sms_body[lang] || b.sms_body.rm || b.sms_body.en || b.sms_body.ur || "";
}

export async function runBroadcastWorker(d: WorkerDeps): Promise<WorkerResult> {
  const res: WorkerResult = { sent: 0, failed: 0, skipped: 0, reason: null };
  if (!d.config.enabled) return { ...res, reason: "BROADCAST_ENABLED is not true (kill switch)" };
  const plan = planBatch(d.now(), d.config, await d.sentToday());
  if (plan.limit === 0) return { ...res, reason: plan.reason };
  const rows = await d.claim(plan.limit);
  const cache = new Map<string, BroadcastRow | null>();
  for (const r of rows) {
    if (!cache.has(r.broadcast_id)) cache.set(r.broadcast_id, await d.loadBroadcast(r.broadcast_id));
    const b = cache.get(r.broadcast_id);
    // Doosri hifazat (DB pehle hi rokta hai): manzoori aur maker-checker.
    if (!b || !["approved", "sending"].includes(b.status) || !b.approved_by || b.approved_by === b.created_by) { res.skipped++; continue; }
    try {
      if (r.channel === "whatsapp") {
        if (!b.template || b.template.meta_status !== "APPROVED") throw new Error("template not APPROVED by Meta");
        const params = (b.template_vars ?? []).map((k) => renderText(`{${k}}`, r.vars ?? {}));
        const id = await d.sendTemplate(r.phone, b.template.name, b.template.lang, params);
        await d.mark(r.id, "sent", "whatsapp", id, null);
        res.sent++;
      } else {
        const text = renderText(smsTextFor(b, r.lang), r.vars ?? {});
        const s = await d.sendSms(r.phone, text);
        await d.mark(r.id, s.status, s.provider, s.id, s.error ?? null);
        if (s.status === "sent") res.sent++; else res.failed++;
      }
    } catch (e) {
      await d.mark(r.id, "failed", r.channel, null, String((e as Error)?.message ?? e).slice(0, 300));
      res.failed++;
    }
    if (plan.delayMs) await d.sleep(plan.delayMs);
  }
  return res;
}
