import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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
  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
