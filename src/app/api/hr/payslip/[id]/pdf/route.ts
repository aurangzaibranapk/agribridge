import { NextResponse } from "next/server";
import { payrollViewer } from "@/lib/payroll/access";
import { loadSlip } from "@/lib/payroll/slip-data";
import { salarySlipPdf } from "@/lib/payroll/slip-pdf";
import { siteOrigin } from "@/lib/payroll/site-origin";
import { verifyUrl } from "@/lib/payroll/salary-offer";

export const dynamic = "force-dynamic";

/** 691: Salary slip PDF. Payroll writer sab ki; staff sirf apni (manzoori ke baad). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const v = await payrollViewer();
  if (!v) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  const slip = await loadSlip(v.sb, params.id);
  if (!slip || (!v.writer && slip.profileId !== v.id)) return NextResponse.json({ error: "Slip nahi mili." }, { status: 404 });
  const origin = siteOrigin();
  const bytes = await salarySlipPdf(slip, slip.verifyCode ? verifyUrl(origin, slip.verifyCode) : null, `${origin.replace(/^https?:\/\//, "")}/verify`);
  const name = `salary-slip-${slip.payYear}-${String(slip.payMonth).padStart(2, "0")}-${(slip.slipNo ?? slip.lineId.slice(0, 8)).replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
