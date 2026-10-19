import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { broadcastConfig } from "@/lib/broadcast/config";
import { runBroadcastWorker, type QueuedRow, type BroadcastRow } from "@/lib/broadcast/worker";
import { getSmsProvider } from "@/lib/broadcast/sms";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-client";

export const dynamic = "force-dynamic";

/**
 * Cron (har minute): POST /api/broadcast/run, header x-broadcast-secret = BROADCAST_CRON_SECRET.
 * BROADCAST_ENABLED "true" na ho to foran wapas -- database bhi nahi chhoota.
 */
export async function POST(req: NextRequest) {
  const cfg = broadcastConfig();
  if (!cfg.enabled) return NextResponse.json({ ok: true, sent: 0, reason: "BROADCAST_ENABLED is not true (kill switch)" });
  const secret = process.env.BROADCAST_CRON_SECRET ?? "";
  const got = req.headers.get("x-broadcast-secret") ?? "";
  if (!secret || got.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = createServiceClient() as unknown as SupabaseClient;
  const sms = getSmsProvider(cfg.smsProvider);
  const start = new Date(); start.setUTCHours(-5, 0, 0, 0); // PKT din ka aaghaz (taqreeban)
  const res = await runBroadcastWorker({
    config: cfg,
    now: () => new Date(),
    sentToday: async () => (await db.from("broadcast_recipients").select("id", { count: "exact", head: true }).gte("sent_at", start.toISOString())).count ?? 0,
    claim: async (limit) => ((await db.rpc("broadcast_claim_batch", { p_limit: limit })).data ?? []) as QueuedRow[],
    loadBroadcast: async (id) => {
      const { data } = await db.from("broadcasts").select("id, channel, status, template_vars, sms_body, approved_by, created_by, template:message_templates(name, lang, meta_status)").eq("id", id).maybeSingle();
      return (data as unknown as BroadcastRow) ?? null;
    },
    mark: async (id, status, provider, msgId, error) => { await db.rpc("broadcast_mark", { p_recipient: id, p_status: status, p_provider: provider, p_msg_id: msgId, p_error: error ?? null }); },
    sendTemplate: (to, name, lang, params) => sendWhatsAppTemplate(to, name, lang, params),
    sendSms: async (to, text) => ({ ...(await sms.send(to, text)), provider: sms.name }),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
  return NextResponse.json({ ok: true, ...res });
}
