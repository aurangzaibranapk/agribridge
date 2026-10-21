import { PayslipView } from "@/components/payroll/payslip-view";

export const dynamic = "force-dynamic";

/** 553 payslip, 691 se A4 salary slip (print, PDF, QR tasdeeq). Staff sirf apni, manzoori ke baad. */
export default async function PayslipPage({ params }: { params: { id: string } }) {
  return <PayslipView id={params.id} self={false} />;
}
