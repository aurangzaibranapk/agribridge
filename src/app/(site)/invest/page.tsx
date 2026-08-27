import Link from "next/link";
import { Package, Building2, Sprout, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/form";
import { InvestorInquiryForm } from "@/app/(site)/invest/investor-inquiry-form";
import { InvestorChatWidget } from "@/app/(site)/invest/investor-chat-widget";

const MODELS = [
  {
    icon: Package,
    title: "Product Investment",
    subtitle: "Fertilizer · Pesticide · Livestock Feed",
    description: "Place your stock with Al Rana Traders. We sell it through our dealer network — recovery is our responsibility, profit is shared.",
    points: ["No cash required", "Recovery tracked to the batch", "Written agreement provided"],
  },
  {
    icon: Building2,
    title: "Corporation Deal",
    subtitle: "Pull / Adda business model",
    description: "Your company supplies product, Al Rana sells it through its farmer and dealer network. Payment returns, commission is ours.",
    points: ["Farmer network across Punjab", "Fast, nationwide distribution", "Transparent settlement"],
  },
  {
    icon: Sprout,
    title: "Dairy & Livestock",
    subtitle: "Farm investment model",
    description: "Invest in verified dairy farms. Al Rana identifies the farm, drafts the agreement, and shares milk & meat profit.",
    points: ["Verified dairy farmers only", "Milk & meat profit share", "Written agreement"],
  },
  {
    icon: TrendingUp,
    title: "Franchise Model",
    subtitle: "15km radius opportunity",
    description: "Open an Al Rana Traders franchise in your area — full setup, training, and product supply on a shared-profit model.",
    points: ["15km exclusive radius", "Full setup & training", "Shared profit model"],
  },
];

const GROWTH = [
  { year: "FY 2020", label: "Foundation Year" },
  { year: "FY 2021", label: "Expansion Phase" },
  { year: "FY 2022", label: "Market Leader" },
  { year: "FY 2023", label: "Peak Performance" },
];

export default function InvestPage() {
  return (
    <div>
      <section className="border-b border-surface-200 bg-gradient-to-b from-wheat-400/10 to-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-wheat-600">Business &amp; Investment Platform</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-surface-900 sm:text-4xl">
            Your trusted agriculture business partner
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-surface-500">
            Pakistan&apos;s most transparent agriculture business platform — no cash, only products and livestock, run through halal, written agreements.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <InvestorChatWidget />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center font-display text-2xl font-semibold text-surface-900">Choose Your Business Model</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-surface-500">Four proven partnership models — transparent, halal, and profitable. No cash required.</p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {MODELS.map((m) => (
            <div key={m.title} className="rounded-card border border-surface-200 bg-white p-6 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-wheat-400/20 text-wheat-600">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-surface-900">{m.title}</h3>
              <p className="text-xs font-medium text-surface-400">{m.subtitle}</p>
              <p className="mt-2 text-sm text-surface-500">{m.description}</p>
              <ul className="mt-3 space-y-1">
                {m.points.map((p) => (
                  <li key={p} className="text-xs text-surface-500">✓ {p}</li>
                ))}
              </ul>
              <Link
                href={`/contact?model=${encodeURIComponent(m.title)}`}
                className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                Discuss this model →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-surface-200 bg-surface-50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-display text-2xl font-semibold text-surface-900">From Startup to Market Leader</h2>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {GROWTH.map((g) => (
              <div key={g.year} className="text-center">
                <p className="font-display text-lg font-semibold text-brand-700">{g.year}</p>
                <p className="mt-1 text-xs text-surface-500">{g.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-surface-400">
            Exact revenue and growth figures are shared directly with serious partnership inquiries.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-4 py-16">
        <h2 className="text-center font-display text-2xl font-semibold text-surface-900 dark:text-white">Submit an Investment Inquiry</h2>
        <p className="mx-auto mt-2 max-w-md text-center text-surface-500 dark:text-surface-400">Tell us a bit about your interest — our team will reach out to discuss details.</p>
        <div className="mt-8">
          <InvestorInquiryForm />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-16">
        <div className="flex gap-3 rounded-card border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/40 dark:bg-amber-900/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>Fraud alert:</strong> Al Rana Traders never accepts cash for a partnership or investment — every deal happens through products or livestock, with a written agreement. If someone asks for cash using our name, it&apos;s fraud. Report it to{" "}
            <a href="mailto:info@alranatraders.pk" className="underline">info@alranatraders.pk</a>.
          </p>
        </div>
      </section>
    </div>
  );
}