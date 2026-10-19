import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/translations";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";

export function CustGate({ lang, farmerReason }: { lang: Lang; farmerReason?: "incomplete_profile" | "pending_review" }) {
  if (farmerReason) return <VerificationGateMessage reason={farmerReason} />;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="text-5xl">🔒</div>
      <p className="mt-3 text-sm font-semibold text-surface-800 dark:text-slate-100">{t("pc_gate", lang)}</p>
      <Link href="/portal/c/profile" className="mt-5 inline-block rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white">{t("pc_nav_profile", lang)}</Link>
    </div>
  );
}
export function NoCustomer({ lang }: { lang: Lang }) {
  return <div className="mx-auto max-w-xl px-4 py-16 text-center"><div className="text-5xl">🧾</div><p className="mt-3 font-semibold text-surface-800 dark:text-slate-100">{t("pc_no_customer", lang)}</p></div>;
}
