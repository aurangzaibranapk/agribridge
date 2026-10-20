import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRecoverySettings } from "@/lib/recovery/credit-block";
import { buildReminderMessage, formatDatePk, formatRs, reminderStageFor, recoveryPolicyActive, reminderDue } from "@/lib/recovery/aging";
import { deliverRecoveryNotice, recoveryChannelReady } from "@/lib/sms/deliver";
import { veevoEnv } from "@/lib/sms/veevo";

export const dynamic = "force-dynamic";

/** Daily authenticated recovery job. Approved template only; never sends before policy date.
 * Successful reminders repeat weekly; failed sends retry on a later daily run.
 * ?dry_run=1 checks readiness/candidates without messages or queue writes.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let settings;
  try { settings = await getRecoverySettings(); } catch {
    return NextResponse.json({ error: "Recovery settings unavailable" }, { status: 503 });
  }
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  if (!recoveryPolicyActive(settings, today)) {
    return NextResponse.json({ skipped: true, reason: "Policy scheduled", effective_from: settings.effective_from });
  }
  if (!settings.reminders_enabled) {
    return NextResponse.json({ skipped: true, reason: "Yaad-dihani band hai (reminders_enabled = false)." });
  }
  const channel = recoveryChannelReady({
    ...veevoEnv(),
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_RECOVERY_TEMPLATE: process.env.WHATSAPP_RECOVERY_TEMPLATE,
  });
  if (channel === "none") {
    return NextResponse.json({ error: "Veevo SMS (SMS_PROVIDER=veevo, VEEVO_API_KEY) ya WhatsApp keys aur approved recovery template zaroori hain; koi message nahi bheja." }, { status: 503 });
  }

  const service = createServiceClient() as any;

  const { data: aging, error } = await service.rpc("fn_customer_receivable_aging", { p_as_of: today, p_customer: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (aging ?? []) as any[];
  const ids = rows.map((r) => r.customer_id);
  const branchIds = Array.from(new Set(rows.map((r) => r.last_branch_id).filter(Boolean)));
  const [customerResult, prefResult, branchResult, historyResult] = await Promise.all([
    ids.length ? service.from("customers").select("id, name, business_name, phone_number").in("id", ids) : { data: [] },
    ids.length ? service.from("receivable_reminder_prefs").select("*").in("customer_id", ids) : { data: [] },
    branchIds.length ? service.from("branches").select("id, name").in("id", branchIds) : { data: [] },
    ids.length ? service.from("receivable_reminders").select("customer_id,stage,sent_at").eq("status", "sent").in("customer_id", ids).gte("sent_at", new Date(Date.now() - (settings.reminder_interval_days + 1) * 86400000).toISOString()) : { data: [] },
  ]);
  const lookupError = [customerResult, prefResult, branchResult, historyResult].find(result => result.error)?.error;
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 503 });
  const custs = customerResult.data, prefs = prefResult.data, branches = branchResult.data;
  const lastSent = new Map<string, { stage: string; sent_at: string }>();
  for (const row of historyResult.data ?? []) {
    if (row.sent_at && (!lastSent.has(row.customer_id) || row.sent_at > lastSent.get(row.customer_id)!.sent_at)) lastSent.set(row.customer_id, row);
  }
  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  const custMap = new Map<string, any>((custs ?? []).map((c: any) => [c.id, c]));
  const prefMap = new Map<string, any>((prefs ?? []).map((p: any) => [p.customer_id, p]));
  const branchMap = new Map<string, string>((branches ?? []).map((b: any) => [b.id, b.name]));
  const template = process.env.WHATSAPP_RECOVERY_TEMPLATE!;
  const lang = process.env.WHATSAPP_RECOVERY_TEMPLATE_LANG || "en";

  let sent = 0, failed = 0, skipped = 0, eligible = 0;
  for (const r of rows) {
    const stage = reminderStageFor(
      { balance: Number(r.balance), oldestDays: r.oldest_days == null ? null : Number(r.oldest_days) },
      settings, today
    );
    if (!stage) continue;
    if (!reminderDue(stage, lastSent.get(r.customer_id) ?? null, today, settings.reminder_interval_days)) { skipped++; continue; }
    const pref = prefMap.get(r.customer_id);
    if (pref?.paused || (pref?.skip_until && pref.skip_until >= today)) { skipped++; continue; }
    const cust = custMap.get(r.customer_id);
    const phone = cust?.phone_number as string | null;
    const name = (cust?.business_name || cust?.name || "Gahak") as string;
    const shopName = branchMap.get(r.last_branch_id) || "Al Rana Traders";
    const dueDate = String(r.due_date);
    const amount = Number(r.balance);
    const message = buildReminderMessage({ stage, customerName: name, amount, dueDate, shopName });

    eligible++;
    if (dryRun) continue;
    // Unique customer/stage/day claims prevent concurrent duplicate sends.
    const { data: claimed, error: insErr } = await service
      .from("receivable_reminders")
      .insert({
        customer_id: r.customer_id, stage, reminder_date: today, cycle_date: r.oldest_unpaid_date, amount_due: amount,
        due_date: dueDate, shop_name: shopName, phone, message,
        status: phone ? "pending" : "skipped", last_error: phone ? null : "Gahak ka phone number nahi.",
      })
      .select("id")
      .maybeSingle();
    if (insErr || !claimed) {
      if (insErr && insErr.code !== "23505") failed++; else skipped++;
      continue;
    }
    if (!phone) { skipped++; continue; }

    try {
      const notice = await deliverRecoveryNotice({
        phone,
        message,
        template,
        lang,
        params: [name, formatRs(amount), formatDatePk(dueDate), shopName, stage === "day30" ? "Aakhri notice" : "Yaad-dihani"],
      });
      if (!notice.ok) throw new Error(notice.error || "Send failed");
      sent++;
      await service.from("receivable_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", claimed.id);
    } catch (err) {
      failed++;
      await service.from("receivable_reminders")
        .update({ status: "failed", last_error: (err instanceof Error ? err.message : String(err)).slice(0, 500) })
        .eq("id", claimed.id);
    }
  }
  return NextResponse.json({ dry_run: dryRun, candidates: rows.length, eligible, sent, failed, skipped }, { status: failed ? 502 : 200 });
}
