import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractInstructionsFromImage } from "@/lib/ai/instruction-image-client";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const HQ_ROLES = ["super_admin", "admin", "owner"];
  if (!HQ_ROLES.includes(profile?.role ?? ""))
    return NextResponse.json({ error: "Ijazat nahi." }, { status: 403 });

  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "Image nahi mili." }, { status: 400 });

    const MAX_BYTES = 4 * 1024 * 1024;
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: "Image 4MB se kam honi chahiye." }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const items = await extractInstructionsFromImage(base64, file.type || "image/jpeg");
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
