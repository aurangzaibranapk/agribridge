import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-client";
import { buildTxnAlertParams, type TxnAlertRow } from "@/lib/txn-alerts/format";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;

/**
 * Len-den alerts -- malik ko WhatsApp (paid Utility template `txn_alert`).
 *
 * Qatar `txn_whatsapp_alerts` journal ke trigger (migration 517) se
 * bharti hai: Rs 1,000 se upar har payment aayi/gayi, udhaar, recovery,
 * bank/cash transfer -- POS sale aur shift close ke ilawa.
 *
 * cPanel cron har minute:
 *   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://alranatraders.pk/api/cron/txn-alerts
 * (ya ?token=<CRON_SECRET>)
 *
 * Template abhi set nahi (WHATSAPP_TXN_TEMPLATE khali)? To kuch nahi
 * bhejte, kuch claim nahi karte -- qatarein "pending" rehti hain.
 * Pehle claim (fn_claim_txn_whatsapp_alerts, SKIP LOCKED) phir bhejna,
 * taa ke do cron ek sath chalein to bhi paighaam do dafa na jaye.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient() as any;

  const template = process.env.WHATSAPP_TXN_TEMPLATE;
  if (!template || !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    const { count } = await service
      .from("txn_whatsapp_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return NextResponse.json({
      skipped: true,
      reason: "WHATSAPP_TXN_TEMPLATE / WhatsApp chaabi set nahi -- alerts pending rakhe gaye.",
      pending: count ?? 0,
    });
  }
  const lang = process.env.WHATSAPP_TXN_TEMPLATE_LANG || "en";

  // Malik ka number: admin_whatsapp_numbers (role owner, active)
  const { data: owners, error: ownerError } = await service
    .from("admin_whatsapp_numbers")
    .select("display_phone, phone_key")
    .eq("role", "owner")
    .eq("is_active", true);
  if (ownerError) return NextResponse.json({ error: ownerError.message }, { status: 500 });
  const recipients: string[] = Array.from(
    new Set<string>(
      (owners ?? [])
        .map((o: { display_phone: string | null; phone_key: string | null }) => o.display_phone || o.phone_key || "")
        .filter((p: string) => p.trim().length > 0)
    )
  );
  if (recipients.length === 0) {
    return NextResponse.json({ skipped: true, reason: "admin_whatsapp_numbers mein koi active owner number nahi." });
  }

  const { data: claimed, error: claimError } = await service.rpc("fn_claim_txn_whatsapp_alerts", { p_limit: 20 });
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  const rows = (claimed ?? []) as (TxnAlertRow & { attempts: number })[];
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const params = buildTxnAlertParams(row);
    const errors: string[] = [];
    let anySent = false;
    for (const to of recipients) {
      try {
        await sendWhatsAppTemplate(to, template, lang, params);
        anySent = true;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (anySent) {
      sent++;
      await service
        .from("txn_whatsapp_alerts")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          recipient: recipients.join(", "),
          last_error: errors.length ? errors.join(" | ").slice(0, 500) : null,
        })
        .eq("id", row.id);
    } else {
      failed++;
      await service
        .from("txn_whatsapp_alerts")
        .update({
          status: row.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          recipient: recipients.join(", "),
          last_error: errors.join(" | ").slice(0, 500) || "Na-maloom ghalti",
        })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ processed: rows.length, sent, failed });
}
