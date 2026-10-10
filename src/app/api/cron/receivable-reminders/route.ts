import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp-client";
import { getRecoverySettings } from "@/lib/recovery/credit-block";
import { buildReminderMessage, formatDatePk, formatRs, reminderStageFor } from "@/lib/recovery/aging";

export const dynamic = "force-dynamic";

/**
 * Wasooli yaad-dihani (migration 523) -- roz ek dafa.
 *
 *   15ve din: narm yaad-dihani;  30ve din: aakhri notice.
 *
 * BAND by default: receivable_recovery_settings.reminders_enabled = false
 * ho to kuch nahi bhejta, kuch darj nahi karta. Malik go-live ke baad
 * /admin/receivable-reminders se chalu karein.
 *
 * Har stage ek hi dafa: receivable_reminders (customer, stage, cycle_date)
 * UNIQUE. Pehle row insert (claim), phir bhejna -- do cron sath chalein
 * to bhi paighaam do dafa nahi jata.
 *
 * Bhejna: WHATSAPP_RECOVERY_TEMPLATE set ho to Meta template (params:
 * naam, raqam, tareekh, dukan, stage); warna session text (sirf 24 ghante
 * ki window mein pahunchta hai -- template behtar hai).
 *
 * cPanel cron roz subah:
 *   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://alranatraders.pk/api/cron/receivable-reminders
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getRecoverySettings();
  if (!settings.reminders_enabled) {
    return NextResponse.json({ skipped: true, reason: "Yaad-dihani band hai (reminders_enabled = false)." });
  }
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    return NextResponse.json({ skipped: true, reason: "WhatsApp chaabi set nahi." });
  }

  const service = createServiceClient() as any;
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10); // PKT

  const { data: aging, error } = await service.rpc("fn_customer_receivable_aging", { p_as_of: today, p_customer: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (aging ?? []) as any[];
  const ids = rows.map((r) => r.customer_id);
  const branchIds = Array.from(new Set(rows.map((r) => r.last_branch_id).filter(Boolean)));
  const [{ data: custs }, { data: prefs }, { data: branches }] = await Promise.all([
    ids.length ? service.from("customers").select("id, name, business_name, phone_number").in("id", ids) : { data: [] },
    ids.length ? service.from("receivable_reminder_prefs").select("*").in("customer_id", ids) : { data: [] },
    branchIds.length ? service.from("branches").select("id, name").in("id", branchIds) : { data: [] },
  ]);
  const custMap = new Map<string, any>((custs ?? []).map((c: any) => [c.id, c]));
  const prefMap = new Map<string, any>((prefs ?? []).map((p: any) => [p.customer_id, p]));
  const branchMap = new Map<string, string>((branches ?? []).map((b: any) => [b.id, b.name]));
  const template = process.env.WHATSAPP_RECOVERY_TEMPLATE;
  const lang = process.env.WHATSAPP_RECOVERY_TEMPLATE_LANG || "en";

  let sent = 0, failed = 0, skipped = 0;
  for (const r of rows) {
    const stage = reminderStageFor(
      { balance: Number(r.balance), oldestDays: r.oldest_days == null ? null : Number(r.oldest_days) },
      settings
    );
    if (!stage) continue;
    const pref = prefMap.get(r.customer_id);
    if (pref?.paused || (pref?.skip_until && pref.skip_until >= today)) { skipped++; continue; }
    const cust = custMap.get(r.customer_id);
    const phone = cust?.phone_number as string | null;
    const name = (cust?.business_name || cust?.name || "Gahak") as string;
    const shopName = branchMap.get(r.last_branch_id) || "Al Rana Traders";
    const dueDate = String(r.due_date);
    const amount = Number(r.balance);
    const message = buildReminderMessage({ stage, customerName: name, amount, dueDate, shopName });

    // Claim: unique (customer, stage, cycle) -- pehle se ho to chhor do.
    const { data: claimed, error: insErr } = await service
      .from("receivable_reminders")
      .insert({
        customer_id: r.customer_id, stage, cycle_date: r.oldest_unpaid_date, amount_due: amount,
        due_date: dueDate, shop_name: shopName, phone, message,
        status: phone ? "pending" : "skipped", last_error: phone ? null : "Gahak ka phone number nahi.",
      })
      .select("id")
      .maybeSingle();
    if (insErr || !claimed) continue; // pehle bhej chuke (unique) ya ghalti
    if (!phone) { skipped++; continue; }

    try {
      if (template) {
        await sendWhatsAppTemplate(phone, template, lang, [
          name, formatRs(amount), formatDatePk(dueDate), shopName, stage === "day30" ? "Aakhri notice" : "Yaad-dihani",
        ]);
      } else {
        await sendWhatsAppMessage(phone, message);
      }
      sent++;
      await service.from("receivable_reminders").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", claimed.id);
    } catch (err) {
      failed++;
      await service.from("receivable_reminders")
        .update({ status: "failed", last_error: (err instanceof Error ? err.message : String(err)).slice(0, 500) })
        .eq("id", claimed.id);
    }
  }
  return NextResponse.json({ candidates: rows.length, sent, failed, skipped });
}
