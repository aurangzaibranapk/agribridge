"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { startFarmerSignup, completeFarmerSignup, type SignupState } from "@/actions/farmer-signup";

const input = "mt-1 w-full rounded-lg border border-surface-200 p-2.5 text-sm";

export function FarmerWhatsappSignupForm() {
  const router = useRouter();
  const [f, setF] = useState({ full_name: "", cnic: "", phone: "", village: "" });
  const [s1, start] = useFormState(startFarmerSignup, {} as SignupState);
  const [s2, complete] = useFormState(completeFarmerSignup, {} as SignupState);
  const otpStep = (s1.otpSent && !s2.existing) || s2.otpSent;
  const state = otpStep ? s2 : s1;

  useEffect(() => {
    if (s2.success) { router.push("/portal/campaigns"); router.refresh(); }
  }, [s2.success, router]);

  const hidden = Object.entries(f).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-card">
        <h1 className="mb-1 text-lg font-semibold">Kisan Signup / کسان رجسٹریشن</h1>
        <p className="mb-4 text-xs text-surface-500">Mobile WhatsApp code se verify hoga. Naya khata admin ki manzoori ke baad mukammal hota hai.</p>
        {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
        {state.existing && (
          <p className="mb-3 text-sm">
            <Link href="/login" className="font-medium text-brand-700 underline">Login</Link>{" · "}
            <Link href="/forgot-password/farmer" className="font-medium text-brand-700 underline">Password bhool gaye</Link>
          </p>
        )}
        {!otpStep ? (
          <form action={start} className="space-y-3">
            {(["full_name", "cnic", "phone", "village"] as const).map((k) => (
              <div key={k}>
                <label className="text-sm font-medium text-surface-700">
                  {{ full_name: "Poora naam", cnic: "CNIC (35202-1234567-1)", phone: "Mobile (WhatsApp)", village: "Gaon" }[k]}
                </label>
                <input name={k} required value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode={k === "cnic" || k === "phone" ? "numeric" : undefined} className={input} />
              </div>
            ))}
            <button className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white">WhatsApp par code bhejein</button>
          </form>
        ) : (
          <form action={complete} className="space-y-3">
            {hidden}
            <p className="text-sm text-surface-600">Code {s1.sentVia === "sms" ? "SMS" : "WhatsApp"} par bheja gaya ({f.phone}). 5 minute tak chalega.</p>
            <input name="code" required maxLength={6} inputMode="numeric" placeholder="6 hindse" className={input} />
            <button className="w-full rounded-lg bg-brand-700 py-2.5 text-sm font-semibold text-white">Verify & Signup</button>
          </form>
        )}
      </div>
    </div>
  );
}
