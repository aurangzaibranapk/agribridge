import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function FarmerRegistrationThankYouPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-surface-900">Registration Received</h1>
      <p className="mt-3 text-surface-500">
        Thank you for registering with Al Rana Traders. Our team will review and verify your account shortly.
        Once approved, you&apos;ll have full access to your Farmer Portal, Khata account, and AI Crop Doctor.
      </p>
      <Link href="/" className="mt-6 inline-block text-brand-700 hover:underline">Back to Home</Link>
    </div>
  );
}
