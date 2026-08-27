"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithToken, type ActionState } from "@/actions/password-reset";

const initialState: ActionState = {};

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [state, formAction] = useFormState(resetPasswordWithToken, initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (state.success) {
    setTimeout(() => router.push("/login"), 2000);
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm rounded-card bg-white p-6 text-center shadow-card">
        <p className="text-sm text-red-700">Ye link ghalat hai. Barah-e-meherbani dobara "Forgot Password" se try karein.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Forgot Password Page</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
      {state.success ? (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-center text-sm text-brand-700">
          Password badal diya gaya - login page par le ja rahe hain...
        </p>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
          <div>
            <label className="text-sm font-medium text-surface-700">Naya Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kam az kam 6 characters"
              className="mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Dobara likhein"
              className="mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm"
            />
            {mismatch && <p className="mt-1 text-xs text-red-600">Passwords match nahi karte.</p>}
          </div>
          <SubmitButton disabled={mismatch} />
        </form>
      )}
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? "Save ho raha hai..." : "Password Save Karein"}
    </button>
  );
}