import { NextRequest, NextResponse } from "next/server";
import { giveCustomerLoan, takeCustomerRepayment } from "@/actions/customer-udhaar";
import { createClient } from "@/lib/supabase/server";

/** Offline Udhaar/Payment Receive queue ka authenticated sync raasta. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "loan" ? "loan" : body.kind === "repayment" ? "repayment" : "";
  if (!kind || !body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Udhaar entry ki maloomat durust nahi." }, { status: 400 });
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = kind === "loan" ? await giveCustomerLoan({}, formData) : await takeCustomerRepayment({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
