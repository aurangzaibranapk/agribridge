import { NextRequest, NextResponse } from "next/server";
import { createGrainSale } from "@/actions/grain-sales";
import { createClient } from "@/lib/supabase/server";

/** Offline grain sale queue ka authenticated sync raasta. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!body.fields || typeof body.fields !== "object") return NextResponse.json({ error: "Grain sale ki maloomat durust nahi." }, { status: 400 });
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = await createGrainSale({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
