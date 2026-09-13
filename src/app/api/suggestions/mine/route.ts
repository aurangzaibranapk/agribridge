import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Meri bheji hui tajaweez aur un ka darja -- panel ke teesre khane ke liye. */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });

  const service = createServiceClient();
  const { data } = await service
    .from("suggestions")
    .select("id, number, title, status, priority, created_at")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ items: data ?? [] });
}
