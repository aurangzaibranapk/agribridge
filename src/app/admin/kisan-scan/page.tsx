import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/api-auth";
import { kisanQrSecret, verifyKisanQr } from "@/lib/portal/kisan-qr";
import { kisanScanDecision } from "@/lib/portal/kisan-scan";

export const dynamic = "force-dynamic";

/**
 * Kisan card QR scan -- sirf login kiya hua staff. Token sahi ho to
 * us kisan ka khata (read-only statement) khulta hai. Koi likhai nahi.
 */
export default async function KisanScanPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = Array.isArray(searchParams?.t) ? searchParams.t[0] : searchParams?.t;
  const auth = await requireStaff();
  const d = kisanScanDecision({ auth, token: t ?? null, secret: kisanQrSecret(), verify: verifyKisanQr });
  if (d.kind === "login") redirect(`/login?redirectTo=${encodeURIComponent(`/admin/kisan-scan?t=${t ?? ""}`)}`);
  if (d.kind === "open") redirect(d.href);
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <p className="text-lg font-bold text-surface-900 dark:text-white">Kisan card scan</p>
      <p className="mt-2 text-sm text-surface-600 dark:text-slate-300">{d.message}</p>
    </div>
  );
}
