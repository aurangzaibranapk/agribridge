import { redirect } from "next/navigation";
import { dairyContext } from "@/lib/portal/dairy-load";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";

export const dynamic = "force-dynamic";

/** Khata ki tarah: dairy bhi sirf mukammal (verified) profile par khulti hai. */
export default async function DairyLayout({ children }: { children: React.ReactNode }) {
  const ctx = await dairyContext();
  if (!ctx?.farmer) redirect("/login");
  if (!ctx.gate.allowed) return <VerificationGateMessage reason={ctx.gate.reason!} />;
  return <>{children}</>;
}
