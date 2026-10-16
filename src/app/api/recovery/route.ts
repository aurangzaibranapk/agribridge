import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postJournal } from "@/lib/ledger/post";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { promiseRuleError } from "@/lib/recovery/credit-position";
import { TERMS_VERSION } from "@/lib/recovery/credit-report";

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
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const service = createServiceClient() as any;
  const body = await req.json();
  const action = String(body.action || "");
  const parties = Array.isArray(body.parties) ? body.parties.slice(0, 100) : [];
  if (!parties.length) return NextResponse.json({ error: "Koi account select nahi hua." }, { status: 400 });

  if (action === "promise") {
    // 538: raqam ikhtiyari; din/tareekh lazmi. Staff: 1 khula waada, max 30 din, toote ke baad sirf Admin.
    const rawAmount = body.amount == null || body.amount === "" ? null : Number(body.amount);
    if (rawAmount != null && !(rawAmount > 0)) return NextResponse.json({ error: "Raqam sahi likhein ya khali chhorein." }, { status: 400 });
    const promiseDate = String(body.promiseDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(promiseDate)) return NextResponse.json({ error: "Waade ki tareekh zaroori hai." }, { status: 400 });
    const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
    const days = Math.round((Date.parse(promiseDate) - Date.parse(today)) / 86400000);
    // 541: zubani sharaait -- staff checkbox se tasdeeq (staff id + waqt + version).
    if (body.termsAccepted !== true) return NextResponse.json({ error: "Sharaait ki tasdeeq zaroori hai: customer ne zubani maan li -- checkbox lagayein." }, { status: 400 });
    const { data: prof } = await service.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    const isAdmin = Boolean(prof?.is_active && UNRESTRICTED_ROLES.includes(prof.role));
    for (const p of parties) {
      if (p.type !== "customer") continue;
      const { data: last } = await service.from("payment_promises").select("status,promise_date,promised_amount,fulfilled_amount")
        .eq("party_type", "customer").eq("party_id", p.id).in("status", ["open", "broken"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const lastBroken = Boolean(last && (last.status === "broken" || last.promise_date < today) && !(last.promised_amount != null && Number(last.fulfilled_amount) >= Number(last.promised_amount)));
      const hasOpen = Boolean(last && last.status === "open" && last.promise_date >= today);
      const ruleError = promiseRuleError({ isAdmin, days, hasOpenPromise: hasOpen, lastBroken });
      if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 });
    }
    // Purana khula/toota waada band -- naya hi chalu rahe.
    const customerIds = parties.filter((p: any) => p.type === "customer").map((p: any) => p.id);
    if (customerIds.length) {
      await service.from("payment_promises").update({ status: "replaced", updated_at: new Date().toISOString() })
        .eq("party_type", "customer").in("party_id", customerIds).in("status", ["open", "broken"]);
    }
    const rows = parties.map((p: any) => ({
      party_type: p.type,
      party_id: p.id,
      promised_amount: rawAmount,
      promise_date: promiseDate,
      promised_days: days,
      approved_by: isAdmin ? user.id : null,
      notes: body.notes || null,
      created_by: user.id,
      terms_version: TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
      terms_accepted_by: user.id,
      terms_channel: "verbal",
    }));
    const { data: inserted, error } = await service.from("payment_promises").insert(rows).select("id,promise_date,promised_amount");
    return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ success: true, count: rows.length, promises: inserted ?? [] });
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
      // Malik (16 September): WhatsApp ka paid (template) raasta filhal
      // band -- sirf free-form paighaam chalta rehta hai. Recovery
      // reminder template se jata hai (24-ghante ki window se bahar bhi
      // pahunchna hota hai), is liye ye abhi nahi bheja jata.
      await service
        .from("payment_reminders")
        .update({ delivery_status: "failed", failure_reason: "WhatsApp (paid) reminders filhal band hain — kharcha bachane ke liye." })
        .in(
          "id",
          inserted.map((r: any) => r.id)
        );
      return NextResponse.json({ success: true, count: parties.length, sent: 0 });
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
