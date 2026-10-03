import { NextRequest, NextResponse } from "next/server";
import { adjustStock, transferStock } from "@/actions/inventory";
import { createClient } from "@/lib/supabase/server";

/** Offline inventory sync. Existing inventory actions remain the source of truth. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "adjust" || body.kind === "transfer" ? body.kind : "";
  if (!kind || !body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Inventory entry ki maloomat durust nahi." }, { status: 400 });
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = kind === "adjust" ? await adjustStock({}, formData) : await transferStock({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
