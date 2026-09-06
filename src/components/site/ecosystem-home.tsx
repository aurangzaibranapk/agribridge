import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness, CircleDollarSign, Droplets, ShoppingBag, Sprout, Tractor, Wheat } from "lucide-react";

const actions = [
  ["Fasal & Agriculture", "Beej, khaad, spray aur crop support", "/products", Sprout],
  ["Products Kharidein", "Verified agriculture products dekhein", "/products", ShoppingBag],
  ["Machine Book Karein", "Harvesting aur farm machinery services", "/login", Tractor],
  ["Crop / Credit Plan", "Fasal ke inputs aur credit planning", "/login", CircleDollarSign],
  ["Fasal Bechein", "Grain aur produce ko market se connect karein", "/contact", Wheat],
  ["Dairy Services", "Milk, livestock aur dairy support", "/contact", Droplets],
  ["Kisan AI se Poochein", "Crop Doctor aur smart agriculture guidance", "/ai-crop-doctor", Bot],
  ["Business ke liye ERP", "POS se finance tak complete AgriBridge ERP", "/contact", BriefcaseBusiness],
] as const;

const farmerFlow = ["Farmer", "Inputs", "Crop Plan", "Machinery", "Produce / Milk", "Marketplace", "Payment / Khata"];
const businessFlow = ["POS", "Purchase", "Inventory", "Finance", "HR", "Logistics", "Reports", "AI"];

export function EcosystemHome() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#0D2818] px-4 py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(201,162,39,.18),transparent_35%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#E8C767]">Al Rana Traders · ART AgriBridge</p>
          <h1 className="mt-5 max-w-4xl font-display text-4xl font-semibold tracking-tight sm:text-6xl">Agriculture. Technology. One Bridge.</h1>
          <p className="mt-5 max-w-2xl text-lg text-[#C7D7CA] sm:text-xl">Beej se Bazaar tak — Business se AI tak. Farmer services, marketplace, machinery, dairy aur intelligent ERP ek connected ecosystem mein.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="#ecosystem" className="rounded-xl bg-[#E8C767] px-5 py-3 text-sm font-semibold text-[#0D2818] hover:bg-[#F3D98B]">Explore AgriBridge</Link>
            <Link href="/contact" className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/15">Book ERP Demo</Link>
            <Link href="/ai-crop-doctor" className="rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold hover:bg-white/10">Ask Kisan AI</Link>
          </div>
        </div>
      </section>

      <section id="ecosystem" className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <Heading eyebrow="AgriBridge Ecosystem" title="Aap ko aaj kya karna hai?" text="Farmer ho ya business owner — apna kaam select karein. AgriBridge aap ko sahi service tak le jata hai." />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(([title, text, href, Icon]) => (
            <Link key={title} href={href} className="group rounded-2xl border border-[#DFE8DF] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 min-h-10 text-sm leading-5 text-surface-500 dark:text-surface-400">{text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 dark:text-brand-300">Kholein <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[#DFE8DF] bg-white px-4 py-16 dark:border-surface-800 dark:bg-surface-900 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <Heading eyebrow="One Connected Journey" title="Beej se Bazaar tak" text="Farmer ki ek identity aur ek relationship ke saath har service aage barhti hai." />
          <Flow items={farmerFlow} />
          <p className="mt-5 text-center text-sm text-surface-500">One Farmer ID → Services → Transactions → Unified Khata → Better decisions</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">For Agriculture Businesses</p>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Pakistan&apos;s Intelligent Agriculture Business Platform</h2>
            <p className="mt-4 text-surface-500 dark:text-surface-400">Agri input shop, retail store, milk collection, grain business, machinery rental ya multi-branch operation — AgriBridge daily work ko ek system mein connect karta hai.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/contact" className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-800">Book ERP Demo</Link>
              <Link href="/contact" className="rounded-xl border border-surface-300 bg-white px-5 py-3 text-sm font-semibold dark:border-surface-700 dark:bg-surface-900">Request Business Setup</Link>
            </div>
          </div>
          <div className="rounded-3xl bg-[#0D2818] p-7 text-white shadow-xl sm:p-9">
            <h3 className="font-display text-xl font-semibold text-[#E8C767]">Complete Business Flow</h3>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{businessFlow.map((x, i) => <div key={x} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center"><span className="block text-xs text-[#9FB8A4]">0{i + 1}</span><span className="mt-1 block text-sm font-semibold">{x}</span></div>)}</div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:pb-20">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#0D2818] px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#E8C767]">ART AgriBridge</p><h2 className="mt-3 font-display text-3xl font-semibold">Beej se Bazaar tak — aur Business ke liye ERP tak.</h2><p className="mt-3 text-[#B9CDBD]">Agriculture product, machinery booking, farmer service, AI guidance ya complete ERP — sab ek bridge par.</p></div>
          <div className="mt-7 flex gap-3 lg:mt-0 lg:pl-8"><Link href="/contact" className="rounded-xl bg-[#E8C767] px-5 py-3 text-sm font-semibold text-[#0D2818]">Contact Us</Link><Link href="/login" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold">Login</Link></div>
        </div>
      </section>
    </>
  );
}

function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p><h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{title}</h2><p className="mt-3 text-surface-500 dark:text-surface-400">{text}</p></div>;
}

function Flow({ items }: { items: readonly string[] }) {
  return <div className="mt-10 rounded-2xl border border-[#DFE8DF] bg-[#F7FAF5] p-6 dark:border-surface-800 dark:bg-surface-950"><div className="flex flex-wrap items-center justify-center gap-2">{items.map((item, i) => <div key={item} className="flex items-center gap-2"><span className={`rounded-full px-4 py-2 text-sm font-semibold ${i === 0 ? "bg-brand-700 text-white" : "border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900"}`}>{item}</span>{i < items.length - 1 && <ArrowRight className="h-4 w-4 text-surface-300" />}</div>)}</div></div>;
}
