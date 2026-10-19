import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_ROLES } from "@/lib/campaigns/season-data";
import { importTemplateRows, toCsv, toXlsx } from "@/lib/campaigns/season-v2";

/** Import template (har qatar = ek kisan, ek farm, ek product). */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  if (!me?.is_active || !ADMIN_ROLES.includes(String(me.role))) return new NextResponse("Unauthorized", { status: 403 });
  const rows = importTemplateRows();
  if (req.nextUrl.searchParams.get("format") === "csv")
    return new NextResponse(toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="season-booking-import-template.csv"' } });
  return new NextResponse(Buffer.from(toXlsx([{ name: "Import", rows }])), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="season-booking-import-template.xlsx"' } });
}
