import { NextRequest, NextResponse } from "next/server";
import { selfCheckIn, selfCheckOut } from "@/actions/hr";
import { createClient } from "@/lib/supabase/server";

/** Offline staff attendance ka authenticated sync raasta. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const kind = body.kind === "check_in" || body.kind === "check_out" ? body.kind : "";
  if (!kind || !body.fields || typeof body.fields !== "object") {
    return NextResponse.json({ error: "Attendance ki maloomat durust nahi." }, { status: 400 });
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(body.fields as Record<string, unknown>)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const result = kind === "check_in" ? await selfCheckIn({}, formData) : await selfCheckOut({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
