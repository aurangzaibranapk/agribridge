import Link from "next/link";
import { Lock, Clock } from "lucide-react";
import { verificationGateMessage } from "@/lib/utils/verification-gate";

export function VerificationGateMessage({ reason }: { reason: "incomplete_profile" | "pending_review" }) {
  const msg = verificationGateMessage(reason);
  const Icon = reason === "incomplete_profile" ? Lock : Clock;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="font-display text-xl font-semibold text-surface-900">{msg.title}</h1>
      <p className="mt-3 text-sm text-surface-600">{msg.body}</p>
      <Link
        href={msg.ctaHref}
        className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        {msg.ctaLabel}
      </Link>
    </div>
  );
}