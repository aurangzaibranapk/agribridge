import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-client";

export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const service = createServiceClient() as any;
  const body = await req.json();
  const action = String(body.action || "");
  const parties = Array.isArray(body.parties) ? body.parties.slice(0, 100) : [];
  if (!parties.length) return NextResponse.json({ error: "Koi account select nahi hua." }, { status: 400 });

  if (action === "promise") {
    const amount = Number(body.amount);
    if (!(amount > 0) || !body.promiseDate) return NextResponse.json({ error: "Amount aur promise date zaroori hain." }, { status: 400 });
    const rows = parties.map((p: any) => ({ party_type: p.type, party_id: p.id, promised_amount: amount, promise_date: body.promiseDate, notes: body.notes || null, created_by: user.id }));
    const { error } = await service.from("payment_promises").insert(rows);
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ success: true, count: rows.length });
  }

  if (action === "schedule" || action === "send") {
    const channel = String(body.channel || "whatsapp");
    const scheduledAt = action === "send" ? new Date().toISOString() : String(body.scheduledAt || "");
    if (!scheduledAt) return NextResponse.json({ error: "Reminder date/time zaroori hai." }, { status: 400 });
    const rows = parties.map((p: any) => ({
      party_type: p.type, party_id: p.id, outstanding_amount: Number(p.outstanding || 0), overdue_amount: Number(p.outstanding || 0),
      due_date: body.dueDate || null, reminder_stage: body.stage || "friendly", channel,
      scheduled_at: scheduledAt, delivery_status: action === "send" ? "pending" : "scheduled", sent_by: user.id,
    }));
    const { data: inserted, error } = await service.from("payment_reminders").insert(rows).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (action === "send" && channel === "whatsapp") {
      const template = process.env.WHATSAPP_PAYMENT_REMINDER_TEMPLATE;
      if (!template) {
        await service.from("payment_reminders").update({ delivery_status: "failed", failure_reason: "WHATSAPP_PAYMENT_REMINDER_TEMPLATE set nahi hai." }).in("id", inserted.map((r: any) => r.id));
        return NextResponse.json({ error: "WhatsApp reminder template server par set nahi hai." }, { status: 400 });
      }
      let sent = 0;
      for (let i = 0; i < parties.length; i++) {
        const p = parties[i];
        try {
          if (!p.phone) throw new Error("WhatsApp number missing.");
          await sendWhatsAppTemplate(p.phone, template, process.env.WHATSAPP_PAYMENT_REMINDER_LANGUAGE || "en", [p.name, Math.round(Number(p.outstanding)).toLocaleString("en-PK"), body.dueDate || "as soon as possible"]);
          await service.from("payment_reminders").update({ delivery_status: "sent", sent_at: new Date().toISOString() }).eq("id", inserted[i].id);
          sent++;
        } catch (err) {
          await service.from("payment_reminders").update({ delivery_status: "failed", failure_reason: err instanceof Error ? err.message : "Send failed" }).eq("id", inserted[i].id);
        }
      }
      return NextResponse.json({ success: true, count: parties.length, sent });
    }
    return NextResponse.json({ success: true, count: rows.length });
  }
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
