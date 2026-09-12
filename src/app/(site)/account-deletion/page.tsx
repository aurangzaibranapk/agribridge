import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock3, LockKeyhole, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "Account Deletion | Al Rana Traders AgriBridge",
  description: "Request deletion of your AgriBridge mobile account and associated personal data.",
};

const steps = [
  "AgriBridge mobile app kholein aur apne account mein sign in karein.",
  "Profile > Privacy & Security > Account deletion request kholein.",
  "Reason optional hai; Request button daba kar tasdeeq karein.",
  "Request review hone par account aur deletable personal data remove ya anonymize kar diya jayega.",
];

export default function AccountDeletionPage() {
  return (
    <section className="bg-gradient-to-b from-emerald-50 to-white px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Smartphone className="h-7 w-7" />
          </div>
          <p className="mt-6 text-sm font-bold uppercase tracking-wider text-emerald-700">AgriBridge Mobile</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 sm:text-4xl">Account aur data deletion</h1>
          <p className="mt-4 max-w-2xl leading-7 text-slate-600">
            Al Rana Traders — AgriBridge user apna account delete karne ki request seedha mobile app se de sakta hai.
          </p>

          <div className="mt-8 space-y-4">
            {steps.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-2xl border border-slate-200 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-black text-white">{index + 1}</span>
                <p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-amber-50 p-5">
              <Clock3 className="h-6 w-6 text-amber-700" />
              <h2 className="mt-3 font-bold text-slate-900">Processing</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Request verification aur legal/accounting retention check ke baad process hoti hai.</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-5">
              <LockKeyhole className="h-6 w-6 text-sky-700" />
              <h2 className="mt-3 font-bold text-slate-900">Required records</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Invoice, tax, audit ya financial records qanooni muddat tak restricted form mein retain ho sakte hain.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl bg-emerald-800 p-5 text-white sm:flex-row sm:items-center">
            <CheckCircle2 className="h-7 w-7 shrink-0" />
            <p className="flex-1 text-sm leading-6">App access na ho to registered mobile number ke sath support ko email karein.</p>
            <a className="rounded-xl bg-white px-4 py-2 text-center text-sm font-bold text-emerald-800" href="mailto:info@alranatraders.pk?subject=AgriBridge%20Account%20Deletion">Email Support</a>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Data handling detail ke liye <Link href="/privacy-policy" className="font-bold text-emerald-700 underline">Privacy Policy</Link> dekhein.
          </p>
        </div>
      </div>
    </section>
  );
}
