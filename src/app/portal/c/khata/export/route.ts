import { NextResponse, type NextRequest } from "next/server";
import { parseRange } from "@/lib/portal/khata";
import { csvCell } from "@/lib/portal/dairy-pl";
import { custGate, customerContext, loadKhata } from "@/lib/portal/customer-load";

export const dynamic = "force-dynamic";

/** Apna khata CSV (Google Sheets / Excel). Sirf apna (565 functions, apna session). */
export async function GET(req: NextRequest) {
  const ctx = await customerContext();
  if (!ctx || (!ctx.profile && !ctx.isFarmer) || !(await custGate(ctx)).allowed) return new NextResponse("Forbidden", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const r = parseRange(sp);
  const { rows } = await loadKhata(r.from, r.to);
  const lines = [["Date", "Ref", "Category", "Detail", "Debit (Rs)", "Credit (Rs)", "Balance (Rs)"].map(csvCell).join(",")];
  for (const x of rows) lines.push([x.entry_date, x.ref, x.is_opening ? "opening" : x.category, x.is_opening ? "Opening balance" : x.tafseel, x.udhaar, x.adaigi, x.baqaya].map(csvCell).join(","));
  return new NextResponse("\uFEFF" + lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="khata-${r.from ?? "all"}-${r.to ?? "today"}.csv"`, "cache-control": "no-store" },
  });
}
