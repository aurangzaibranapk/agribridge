import { NextRequest, NextResponse } from "next/server";
import { receivePurchase } from "@/actions/purchases";

/** Offline GRN queue ka sync raasta; asal stock/ledger logic action mein hi rehta hai. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "GRN ki maloomat durust nahi." }, { status: 400 });
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = await receivePurchase({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
