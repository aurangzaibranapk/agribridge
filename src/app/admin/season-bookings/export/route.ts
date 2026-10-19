import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { loadSeasonBookings, STAFF_ROLES } from "@/lib/campaigns/season-data";
import { buildExportSheets, toCsv, toXlsx } from "@/lib/campaigns/season-v2";

/** Tamam kisanon ki season booking ek file mein: XLSX (2 sheets) ya CSV (sheet=summary|lines). Google Sheets mein seedha khulti hai. */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  if (!me?.is_active || !STAFF_ROLES.includes(String(me.role))) return new NextResponse("Unauthorized", { status: 403 });
  const service = createServiceClient() as any;
  const sp = req.nextUrl.searchParams;
  const { data: campaign } = sp.get("campaign")
    ? await service.from("booking_campaigns").select("id, name").eq("id", sp.get("campaign")).maybeSingle()
    : await service.from("booking_campaigns").select("id, name").eq("crop", "wheat").order("deadline", { ascending: false }).limit(1).maybeSingle();
  if (!campaign) return new NextResponse("Campaign nahi mili", { status: 404 });
  const { summary, lines } = buildExportSheets(await loadSeasonBookings(service, campaign.id));
  const stamp = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  const base = `season-booking-gandum-${stamp}`;
  if (sp.get("format") === "csv") {
    const which = sp.get("sheet") === "lines" ? "demand-lines" : "summary";
    return new NextResponse(toCsv(which === "summary" ? summary : lines), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}-${which}.csv"`, "Cache-Control": "no-store" } });
  }
  const xlsx = toXlsx([{ name: "Summary per farmer", rows: summary }, { name: "Demand lines", rows: lines }]);
  return new NextResponse(Buffer.from(xlsx), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"`, "Cache-Control": "no-store" } });
}
