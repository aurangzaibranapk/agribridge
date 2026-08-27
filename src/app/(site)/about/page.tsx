import { Target, Eye, Gem } from "lucide-react";

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-surface-200 bg-gradient-to-b from-brand-50 to-white px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-3xl font-semibold text-surface-900 sm:text-4xl">About Al Rana Traders</h1>
          <p className="mx-auto mt-3 max-w-xl text-surface-500">
            A Pakistan agriculture platform dedicated to quality products, expert guidance, and connecting every farmer, dealer, company, and investor on one transparent, reliable bridge.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <ValueCard icon={Target} title="Our Mission" description="Empower farmers, dealers, and investors with quality agricultural inputs, transparent routing, and reliable service — with AgriBridge standing between every transaction." />
          <ValueCard icon={Eye} title="Our Vision" description="Become Pakistan's most trusted agriculture platform — recognized for quality, innovation, and the trust built by never letting any two parties transact unverified." />
          <ValueCard icon={Gem} title="Our Values" description="Integrity, quality, farmers-first, innovation, teamwork, and sustainability — the same principles behind every order AgriBridge routes." />
        </div>
      </section>

      <section className="border-t border-surface-200 bg-surface-50 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-display text-lg text-surface-800">
            &ldquo;Hamaara maqsad sirf business nahi — Pakistan ki kheti aur kisaano ki tarakki hai.&rdquo;
          </p>
          <p className="mt-3 text-sm font-semibold text-surface-900">Ch. Mahabal Ali</p>
          <p className="mt-3 text-sm font-semibold text-surface-900">Founder &amp; CEO — Founded 2010</p>
        </div>
      </section>
    </div>
  );
}

function ValueCard({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return (
    <div className="rounded-card border border-surface-200 bg-white p-6 shadow-card">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold text-surface-900">{title}</h2>
      <p className="mt-1.5 text-sm text-surface-500">{description}</p>
    </div>
  );
}
