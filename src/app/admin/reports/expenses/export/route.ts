import { NextRequest, NextResponse } from "next/server";
import { aajKaKhana } from "@/lib/utils/format";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { logAudit } from "@/lib/audit";
import { loadFilteredExpenses } from "@/lib/reports/expense-report-query";
import { expenseCsv, parseExpenseFilters, resolveReportScope } from "@/lib/reports/expense-report";

const REPORT_ROLES = new Set(["owner", "super_admin", "admin", "finance", "manager"]);

export async function GET(req: NextRequest) {
  const gate = await requireAction("kharche.report", "export");
  if ("error" in gate) return new NextResponse("Unauthorized", { status: 403 });
  const caller = gate.caller;
  if (caller.legacy && !REPORT_ROLES.has(caller.role)) return new NextResponse("Unauthorized", { status: 403 });

  const today = aajKaKhana();
  const raw: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = parseExpenseFilters(raw, today);
  const scoped = resolveReportScope(parsed, {
    unrestricted: caller.unrestricted,
    scope: caller.scope,
    branchId: caller.branchId,
    shopId: caller.shopId,
  });
  if (!scoped.ok) return new NextResponse("Branch or shop is not set on this login.", { status: 403 });

  const loaded = await loadFilteredExpenses(createServiceClient(), scoped.filters);
  if (loaded.error) return new NextResponse(loaded.error, { status: 500 });

  await logAudit({
    actionType: "view",
    module: "kharche.report",
    recordLabel: `CSV ${scoped.filters.from} to ${scoped.filters.to}`,
    description: loaded.truncated
      ? `Kharcha report CSV adhoori. Parhi hui qatarein ${loaded.lines.length}. Kind ${scoped.filters.kind}.`
      : `Kharcha report CSV. Qatarein ${loaded.lines.length}. Kind ${scoped.filters.kind}. Status ${scoped.filters.status || "sab"}.`,
  });

  const body = expenseCsv(loaded.lines);
  const file = `kharche-${scoped.filters.from}-to-${scoped.filters.to}.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "no-store",
    },
  });
}
