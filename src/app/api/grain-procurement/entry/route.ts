import { NextRequest, NextResponse } from "next/server";
import { createGrainEntry } from "@/actions/grain-procurement";
import { createClient } from "@/lib/supabase/server";

/** Offline wheat/grain entry queue ka authenticated sync raasta. */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });
  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const incoming = await req.formData();
  const rawFields = String(incoming.get("fields") ?? "");
  let fields: Record<string, unknown>;
  try {
    fields = JSON.parse(rawFields) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Grain entry ki fields durust nahi." }, { status: 400 });
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") formData.set(key, value);
  }
  const photo = incoming.get("receipt_photo");
  if (photo instanceof File && photo.size > 0) formData.set("receipt_photo", photo);

  const result = await createGrainEntry({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
