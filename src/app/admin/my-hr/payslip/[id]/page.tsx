import { PayslipView } from "@/components/payroll/payslip-view";

export const dynamic = "force-dynamic";

/** 691: My HR -- staff ki apni salary slip (sirf apni). */
export default async function MyPayslipPage({ params }: { params: { id: string } }) {
  return <PayslipView id={params.id} self />;
}
