import { Suspense } from "react";
import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-lg font-bold text-brand-700">AR</Link>
          <h1 className="font-display text-xl font-semibold text-white">Naya Password Set Karein</h1>
        </div>
        <Suspense fallback={<div className="rounded-card bg-white p-6 text-center text-sm text-surface-500">Load ho raha hai...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}