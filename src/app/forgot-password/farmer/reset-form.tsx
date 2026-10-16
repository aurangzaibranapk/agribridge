"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { requestFarmerPasswordResetOtp, resetFarmerPasswordWithOtp, type ResetState } from "@/actions/farmer-signup";

const input = "mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm";

export function FarmerResetForm() {
  const [phone, setPhone] = useState("");
  const [s1, ask] = useFormState(requestFarmerPasswordResetOtp, {} as ResetState);
  const [s2, reset] = useFormState(resetFarmerPasswordWithOtp, {} as ResetState);
  const step2 = s1.otpSent || s2.otpSent;
  const state = step2 ? s2 : s1;
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
        <h1 className="mb-4 text-lg font-semibold">Password bhool gaye (Kisan)</h1>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {s2.success ? (
          <p className="text-sm">Naya password ban gaya. <Link href="/login" className="font-medium text-brand-700 underline">Login karein</Link></p>
        ) : !step2 ? (
          <form action={ask} className="space-y-3">
            <label className="text-sm font-medium text-surface-700">Registered mobile</label>
            <input name="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" className={input} />
            <button className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white">WhatsApp par code bhejein</button>
          </form>
        ) : (
          <form action={reset} className="space-y-3">
            <input type="hidden" name="phone" value={phone} />
            <p className="text-sm text-surface-600">Agar ye number registered hai to code bhej diya gaya hai (5 minute).</p>
            <input name="code" required maxLength={6} inputMode="numeric" placeholder="6 hindse code" className={input} />
            <input name="password" type="password" required minLength={6} placeholder="Naya password" className={input} />
            <input name="password_confirm" type="password" required minLength={6} placeholder="Password dobara" className={input} />
            <button className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white">Password badlein</button>
          </form>
        )}
      </div>
    </div>
  );
}
