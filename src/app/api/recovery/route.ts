import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { requireAction } from "@/lib/access/guard";
import { sendWhatsAppMessage, sendWhatsAppTemplate } from "@/lib/whatsapp-client";

/**
 * Recovery dashboard se teen kaam: promise darj karna, reminder schedule
 * karna, ya abhi WhatsApp bhej dena.
 *
 * `/api/**` par admin middleware nahi chalta -- is liye tasdeeq yahin,
 * khud is route mein.
 */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const service = createServiceClient() as any;
  const body = await req.json();
  const action = String(body.action || "");
  const requiredAction = action === "receive_payment" ? "receive" : action === "send" || action === "schedule" ? "send" : "edit";
  const guard = await requireAction("finance.recovery", requiredAction);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: 403 });
  const parties = Array.isArray(body.parties) ? body.parties.slice(0, 100) : [];
  if (!parties.length) return NextResponse.json({ error: "Koi account select nahi hua." }, { status: 400 });

  if (action === "promise") {
    const amount = Number(body.amount);
    if (!(amount > 0) || !body.promiseDate) {
      return NextResponse.json({ error: "Amount aur promise date zaroori hain." }, { status: 400 });
    }
    const rows = parties.map((p: any) => ({
      party_type: p.type,
      party_id: p.id,
      promised_amount: amount,
      promise_date: body.promiseDate,
      notes: body.notes || null,
      created_by: user.id,
    }));
    const { error } = await service.from("payment_promises").insert(rows);
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ success: true, count: rows.length });
  }

  if (action === "schedule" || action === "send") {
    const channel = String(body.channel || "whatsapp");
    const scheduledAt = action === "send" ? new Date().toISOString() : String(body.scheduledAt || "");
    if (!scheduledAt) return NextResponse.json({ error: "Reminder date/time zaroori hai." }, { status: 400 });

    const rows = parties.map((p: any) => ({
      party_type: p.type,
      party_id: p.id,
      outstanding_amount: Number(p.outstanding || 0),
      overdue_amount: Number(p.outstanding || 0),
      due_date: body.dueDate || null,
      reminder_stage: body.stage || "friendly",
      channel,
      scheduled_at: scheduledAt,
      delivery_status: action === "send" ? "pending" : "scheduled",
      sent_by: user.id,
    }));
    const { data: inserted, error } = await service.from("payment_reminders").insert(rows).select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (action === "send" && channel === "whatsapp") {
      const template = process.env.WHATSAPP_RECOVERY_TEMPLATE;
      const lang = process.env.WHATSAPP_RECOVERY_TEMPLATE_LANG || "en";
      let sent = 0;
      let statementsSent = 0;
      for (let index = 0; index < parties.length; index++) {
        const p = parties[index] as any;
        const reminderId = inserted[index]?.id;
        const phone = String(p.phone || "");
        const amount = Number(p.outstanding || 0);
        const dueDate = String(p.dueDate || body.dueDate || "as soon as possible");
        const message = `Assalam-o-Alaikum ${p.name} Sahib,\nKisan Wasela ke record ke mutabiq aap ka Rs. ${Math.round(amount).toLocaleString("en-PK")} balance pending hai.\nDue Date: ${dueDate}\nMeherbani farma kar payment jama karwa dein. Agar payment ho chuki hai to receipt share kar dein.\nShukriya — Kisan Wasela`;
        try {
          if (!phone) throw new Error("WhatsApp number missing.");
          if (template) await sendWhatsAppTemplate(phone, template, lang, [String(p.name), Math.round(amount).toLocaleString("en-PK"), dueDate, "Kisan Wasela"]);
          else await sendWhatsAppMessage(phone, message);
          sent++;
          if (reminderId) await service.from("payment_reminders").update({ delivery_status: "sent", sent_at: new Date().toISOString(), failure_reason: null }).eq("id", reminderId);
          if (body.attachStatement && (p.type === "customer" || p.type === "farmer")) {
            const statementRes = await fetch(`${req.nextUrl.origin}/api/customer-statements/${p.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") || "" },
              body: JSON.stringify({ channel: "whatsapp", partyType: p.type }),
            });
            if (statementRes.ok) statementsSent++;
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          if (reminderId) await service.from("payment_reminders").update({ delivery_status: "failed", failure_reason: reason.slice(0, 500) }).eq("id", reminderId);
        }
      }
      return NextResponse.json({ success: true, count: parties.length, sent, statementsSent });
    }
    return NextResponse.json({ success: true, count: rows.length });
  }
  if (action === "receive_payment") {
    const party = parties[0];
    if (!party) return NextResponse.json({ error: "Party select nahi hui." }, { status: 400 });

    const amount = Number(body.amount);
    if (!(amount > 0)) return NextResponse.json({ error: "Raqam sahi likhein." }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);
    const paymentDate = typeof body.paymentDate === "string" && body.paymentDate ? body.paymentDate : today;
    const isBack = paymentDate < today;
    const backdateReason = typeof body.backdateReason === "string" ? body.backdateReason.trim() : "";
    if (isBack && !backdateReason) {
      return NextResponse.json({ error: "Purani date ke liye wajah likhna zaroori hai." }, { status: 400 });
    }

    const PM_GL: Record<string, string> = {
      cash: "1000", jazzcash: "1000", easypaisa: "1000", qr: "1000",
      bank_transfer: "1010", cheque: "1010",
    };
    const PM_LABEL: Record<string, string> = {
      cash: "Cash", jazzcash: "JazzCash", easypaisa: "Easypaisa", qr: "QR",
      bank_transfer: "Bank Transfer", cheque: "Cheque",
    };
    const method = typeof body.paymentMethod === "string" ? body.paymentMethod : "cash";
    const glAccount = PM_GL[method] ?? "1000";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const description = `Recovery — ${PM_LABEL[method] ?? method} — ${party.name}${notes ? ` (${notes})` : ""}`;

    // Har party type ka apna receivable khata
    const AR_CODE: Record<string, string> = {
      farmer: "1150", customer: "1100", dealer: "1160", supplier: "2000",
    };
    const arCode = AR_CODE[String(party.type)] ?? "1100";

    const result = await postJournal({
      description,
      sourceModule: "recovery",
      sourceId: String(party.id),
      branchId: null,
      entryDate: paymentDate,
      backdateReason: isBack ? backdateReason : null,
      createdBy: user.id,
      lines: [
        { account: glAccount, debit: Math.round(amount), memo: description },
        { account: arCode, credit: Math.round(amount), partyType: String(party.type), partyId: String(party.id), memo: description },
      ],
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, entryNumber: result.entryNumber, total: result.total });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
