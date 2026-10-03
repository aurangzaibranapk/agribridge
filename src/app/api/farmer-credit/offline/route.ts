import { NextRequest, NextResponse } from "next/server";
import { issueFarmerCredit, recordFarmerCreditRepayment } from "@/actions/farmer-credit";
import { createClient } from "@/lib/supabase/server";

/** Atomic offline farmer-credit sync: khata + cash book + journal together. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "issue" || body.kind === "repayment" ? body.kind : "";
  if (!kind || !body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Farmer credit entry ki maloomat durust nahi." }, { status: 400 });
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = kind === "issue" ? await issueFarmerCredit({}, formData) : await recordFarmerCreditRepayment({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
