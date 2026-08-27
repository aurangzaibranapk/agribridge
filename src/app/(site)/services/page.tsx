import Link from "next/link";
import { SERVICES } from "@/lib/data/services";

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">Services</h1>
      <p className="mt-2 text-surface-500 dark:text-surface-400">What Al Rana Traders offers beyond the product catalog.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <Link key={s.slug} href={`/services/${s.slug}`} className="rounded-card border border-surface-200 bg-white p-6 shadow-card transition-shadow hover:shadow-lg dark:border-surface-800 dark:bg-surface-900">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
              <s.icon className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{s.title}</h2>
            <p className="mt-1.5 text-sm text-surface-500 dark:text-surface-400">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
