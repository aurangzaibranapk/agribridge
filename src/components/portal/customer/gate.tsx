import Link from "next/link";
import { t, type Lang } from "@/lib/i18n/translations";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";
import { btnPrimary } from "./cust-parts";

export function CustGate({ lang, farmerReason }: { lang: Lang; farmerReason?: "incomplete_profile" | "pending_review" }) {
  if (farmerReason) return <VerificationGateMessage reason={farmerReason} />;
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="text-5xl">🔒</div>
      <p className="mt-3 text-sm font-semibold text-surface-800 dark:text-slate-100">{t("pc_gate", lang)}</p>
      <Link href="/portal/c/profile" className={`mt-5 inline-block px-5 py-2.5 text-sm ${btnPrimary}`}>{t("pc_nav_profile", lang)}</Link>
    </div>
  );
}
export function NoCustomer({ lang }: { lang: Lang }) {
  return <div className="mx-auto max-w-xl px-4 py-16 text-center"><div className="text-5xl">🧾</div><p className="mt-3 font-semibold text-surface-800 dark:text-slate-100">{t("pc_no_customer", lang)}</p></div>;
}
