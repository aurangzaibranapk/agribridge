import { NextResponse, type NextRequest } from "next/server";
import { todayPk } from "@/lib/portal/dairy-load";
import { adminCsv, adminFilter, resolvePeriod } from "@/lib/portal/dairy-pl";
import { isDairyAdmin, loadAdminTotals } from "@/lib/portal/dairy-admin-load";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isDairyAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const per = resolvePeriod(sp, todayPk());
  const { rows, error } = await loadAdminTotals(per.from, per.to);
  if (error) return new NextResponse("Error", { status: 500 });
  const csv = adminCsv(adminFilter(rows, sp.f ?? "all", sp.q ?? ""), per.from, per.to);
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="dairy-hisaab-${per.from}-to-${per.to}.csv"`, "cache-control": "no-store" },
  });
}
