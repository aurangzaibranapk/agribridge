import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { saveCounts } from "@/actions/stock-count";

/**
 * Offline stock-count drafts ka sync raasta.
 *
 * Ye sirf counted quantity save karta hai. Stock/ledger movement existing
 * `postCount` ke zariye hi hoti hai, is route se nahi.
 */
export async function POST(req: NextRequest) {
  const auth = createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const { data: isStaff } = await (auth as any).rpc("fn_is_any_staff");
  if (!isStaff) return NextResponse.json({ error: "Staff permission required." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const countId = String(body.count_id || "");
  const lineId = String(body.line_id || "");
  const counted = Number(body.counted);
  if (!countId || !lineId || !Number.isFinite(counted) || counted < 0) {
    return NextResponse.json({ error: "Count row ki maloomat durust nahi." }, { status: 400 });
  }

  // Queue payload ko isi count ki isi line tak mahdood rakhein.
  const service = createServiceClient();
  const { data: line } = await service
    .from("stock_count_lines")
    .select("id")
    .eq("id", lineId)
    .eq("count_id", countId)
    .maybeSingle();
  if (!line) return NextResponse.json({ error: "Ye count row nahi mili." }, { status: 404 });

  const formData = new FormData();
  formData.set("count_id", countId);
  formData.set(`qty_${lineId}`, String(counted));
  const result = await saveCounts({}, formData);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
