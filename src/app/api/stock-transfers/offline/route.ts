import { NextRequest, NextResponse } from "next/server";
import { requestInternalTransfer } from "@/actions/stock-transfer-workflow";
import { createClient } from "@/lib/supabase/server";

/** Offline multi-product transfer-request sync. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Transfer request ki maloomat durust nahi." }, { status: 400 });
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = await requestInternalTransfer({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}

