import type { Metadata } from "next";
import Link from "next/link";
import { RequestOrganizationForm } from "./request-organization-form";

export const metadata: Metadata = {
  title: "AgriBridge OS for Your Business",
  description: "Request a separate AgriBridge OS ERP workspace for your business.",
};

export default function RequestDemoPage() {
  return (
    <main className="min-h-screen bg-[#f4f8f4] px-4 py-10 text-surface-900 sm:px-6 lg:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
        <section className="rounded-3xl bg-[#102e4d] p-7 text-white shadow-xl sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">AgriBridge OS</p>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl">Apne business ke liye apna ERP portal hasil karein</h1>
          <p className="mt-4 text-sm leading-6 text-surface-200">POS, inventory, finance, staff, milk, grain, machinery aur reports — aap ke business ke separate secure workspace ke sath.</p>
          <div className="mt-7 space-y-3 text-sm text-surface-100">
            <p>✓ Aap ka apna company workspace</p>
            <p>✓ Staff permissions aur separate data</p>
            <p>✓ Starter, Business aur Enterprise plans</p>
            <p>✓ Apna custom domain connect karne ki facility</p>
          </div>
          <Link href="/login" className="mt-8 inline-flex rounded-xl border border-white/20 px-4 py-2.5 text-sm font-bold hover:bg-white/10">Already have an account? Login</Link>
        </section>
        <section className="rounded-3xl border border-surface-200 bg-white p-6 shadow-lg sm:p-8">
          <h2 className="font-display text-2xl font-bold">Request your workspace</h2>
          <p className="mt-1 text-sm text-surface-500">Request submit hone ke baad hamari team approval aur setup ke liye rabta karegi.</p>
          <RequestOrganizationForm />
        </section>
      </div>
    </main>
  );
}

