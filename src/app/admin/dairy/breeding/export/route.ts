import { NextResponse, type NextRequest } from "next/server";
import { todayPk } from "@/lib/portal/dairy-load";
import { adminBreedCsv, adminBreedFilter } from "@/lib/portal/breeding";
import { isBreedAdmin, loadAdminBreed } from "@/lib/portal/breeding-load";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isBreedAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const asOf = todayPk();
  const { rows, error } = await loadAdminBreed(asOf);
  if (error) return new NextResponse("Error", { status: 500 });
  const csv = adminBreedCsv(adminBreedFilter(rows, sp.get("f") ?? "all", (sp.get("q") ?? "").slice(0, 60)), asOf);
  return new NextResponse(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="nasal-sehat-${asOf}.csv"`, "cache-control": "no-store" },
  });
}
