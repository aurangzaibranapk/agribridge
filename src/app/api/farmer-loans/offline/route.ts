import { NextRequest, NextResponse } from "next/server";
import { createFarmerLoan } from "@/actions/farmer-loans";
import { createClient } from "@/lib/supabase/server";

/** Atomic offline farmer-loan issue sync. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.fields || typeof body.fields !== "object") return NextResponse.json({ error: "Loan ki maloomat durust nahi." }, { status: 400 });
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = await createFarmerLoan({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}

