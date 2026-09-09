import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Droplets,
  Leaf,
  MessageCircle,
  ShoppingCart,
  Sprout,
  Tractor,
  UserRound,
  Wheat,
} from "lucide-react";

const services = [
  { title: "Agri Inputs", text: "Fertilizers, Seeds, Pesticides & More", href: "/products", icon: Sprout },
  { title: "Kisan Services", text: "Farm Support & Advisory", href: "/contact", icon: UserRound },
  { title: "Marketplace", text: "Buy & Sell Agriculture Products", href: "/products", icon: ShoppingCart },
  { title: "Grain", text: "Procurement & Trading", href: "/contact", icon: Wheat },
  { title: "Machinery", text: "Booking & Rental Farm Equipment", href: "/contact", icon: Tractor },
  { title: "Dairy", text: "Milk Collection & Dairy Services", href: "/contact", icon: Droplets },
  { title: "Farm Products", text: "Desi Ghee & More From Our Farm", href: "#farm-products", icon: Leaf },
  { title: "Kisan AI", text: "Crop Advisory, Weather & Market", href: "/ai-crop-doctor", icon: Bot },
] as const;

const benefits = [
  ["All-in-One Platform", "From inputs to markets"],
  ["Farmer Focused", "Real solutions for real needs"],
  ["Technology Driven", "AI, data and digital tools"],
  ["A Greener Pakistan", "Sustainable agriculture"],
] as const;

export function EcosystemHome() {
  return (
    <div className="bg-[#F7FAF5] text-slate-950 dark:bg-surface-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-[#ECF8F0] via-[#FDFCF7] to-[#E9F5E8]">
        <div className="absolute -right-24 top-10 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-12 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-16">
          <div className="relative z-10 flex flex-col justify-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.08em] text-emerald-900">Pakistan&apos;s Digital Agriculture Platform</p>
            <h1 className="mt-3 max-w-3xl font-display text-4xl font-black leading-[1.02] tracking-tight text-[#082B1D] sm:text-5xl lg:text-6xl">
              Empowering Farmers Today for a Greener Tomorrow
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">Connecting farmers, inputs, machinery, dairy, markets and technology — from farm to market.</p>
            <p dir="rtl" className="mt-4 max-w-2xl text-xl font-medium leading-10 text-[#173F31]">زراعت کو ڈیجیٹل بنا کر ایک بہتر مستقبل کی طرف</p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="#services" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800">Explore AgriBridge <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/register/farmer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-white/80 px-5 py-3 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50">Join as Farmer</Link>
            </div>

            <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {["Trusted by Farmers", "Complete Agri Solutions", "Better Markets", "Sustainable Growth"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />{item}</div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[380px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#DDEFE0] via-[#F5F0D5] to-[#B9DEA8] shadow-xl ring-1 ring-emerald-900/5">
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-emerald-900/25 to-transparent" />
            <div className="absolute right-7 top-7 rounded-2xl bg-white/90 px-5 py-4 shadow-lg backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Digital Agriculture</p>
              <p className="mt-1 max-w-40 text-2xl font-black leading-tight text-[#113B2B]">Real Impact for Pakistan</p>
            </div>
            <div className="absolute bottom-8 left-8 max-w-sm rounded-3xl bg-[#0D5A3A]/90 p-6 text-white shadow-xl backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-100">Farm → Data → Market</p>
              <h2 className="mt-2 text-3xl font-black">Farmers. Farms. Food.</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-50">A connected digital agriculture ecosystem built around farmers and their daily needs.</p>
            </div>
            <div className="absolute bottom-7 right-7 flex h-24 w-24 items-center justify-center rounded-full bg-white/85 shadow-lg"><Tractor className="h-12 w-12 text-emerald-700" /></div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-[1500px] px-5 py-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-black text-[#123629] sm:text-4xl">Our Agriculture Services</h2>
            <p className="mt-1 text-slate-600">Everything a modern farmer needs — on one platform.</p>
          </div>
          <Link href="/contact" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">View All Services <ArrowRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {services.map(({ title, text, href, icon: Icon }) => (
            <Link key={title} href={href} className="group flex min-h-56 flex-col rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md dark:border-surface-800 dark:bg-surface-900">
              <div className="flex h-20 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50"><Icon className="h-10 w-10 text-emerald-700" /></div>
              <h3 className="mt-4 text-base font-extrabold">{title}</h3>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-500 dark:text-surface-400">{text}</p>
              <span className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition group-hover:bg-emerald-800">Explore <ArrowRight className="h-3.5 w-3.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section id="farm-products" className="border-y border-amber-100 bg-[#FFF9EC]">
        <div className="mx-auto grid max-w-[1500px] gap-7 px-5 py-12 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-emerald-700">From Our Farm to Your Home</p>
            <h2 className="mt-2 font-display text-4xl font-black leading-tight text-[#123629]">Pure. Natural. Desi.</h2>
            <p dir="rtl" className="mt-4 max-w-2xl text-2xl font-semibold leading-10 text-[#183E30]">خالص دیسی گھی — ہمارے فارم سے آپ کے گھر تک</p>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">Pure cow and buffalo desi ghee from our own dairy, prepared with focus on purity, quality and traditional taste.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {["100% Khalis", "No Preservatives", "Farm Fresh", "Trusted Quality"].map((x) => <div key={x} className="rounded-xl border border-amber-100 bg-white px-3 py-3 text-center text-xs font-bold text-emerald-900 shadow-sm">{x}</div>)}
            </div>
            <Link href="/products" className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">View All Farm Products <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <GheeCard title="Pure Cow Desi Ghee" subtitle="From Our Own Dairy" animal="Cow" />
            <GheeCard title="Pure Buffalo Desi Ghee" subtitle="From Our Own Dairy" animal="Buffalo" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-5 py-10 lg:px-8">
        <div className="rounded-3xl border border-emerald-100 bg-[#EFF9F2] p-6 shadow-sm">
          <h2 className="font-display text-2xl font-black text-[#123629]">Why Choose AgriBridge?</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {benefits.map(([title, text]) => (
              <div key={title} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50"><Leaf className="h-5 w-5 text-emerald-700" /></div><div><p className="font-extrabold">{title}</p><p className="text-xs text-slate-500">{text}</p></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-[#075736] via-[#0B6C43] to-[#075736] text-white">
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-4 px-5 py-6 text-center md:grid-cols-4 lg:px-8">
          {["Farmer Focused", "Connected Agriculture Services", "Digital Agriculture", "A Greener Pakistan"].map((x) => (
            <div key={x} className="rounded-2xl bg-white/5 px-3 py-4"><Leaf className="mx-auto h-6 w-6 text-emerald-200" /><p className="mt-2 text-sm font-bold">{x}</p></div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-5 py-12 lg:grid-cols-3 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#D9ECD3] to-[#F4E9C8] p-7">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-700">Farmer Voice</p>
          <h3 className="mt-3 text-3xl font-black leading-tight text-[#143B2B]">Digital agriculture means better access, better records and better decisions.</h3>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-white p-7 shadow-sm dark:border-surface-800 dark:bg-surface-900">
          <h3 className="text-2xl font-black">What Farmers Say</h3>
          <p className="mt-4 leading-7 text-slate-600 dark:text-surface-400">AgriBridge is designed around practical farmer needs — from inputs and machinery to market access, dairy and digital guidance.</p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-[#F0FAF2] to-[#E8F4DE] p-7">
          <h3 className="text-3xl font-black text-[#123629]">Start Your Digital Farming Journey</h3>
          <p className="mt-3 leading-7 text-slate-600">Join a smarter, connected and greener agriculture network.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/register/farmer" className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">Join as Farmer</Link><Link href="/contact" className="rounded-xl border border-emerald-700 bg-white px-5 py-3 text-sm font-bold text-emerald-800">Learn More</Link></div>
        </div>
      </section>
    </div>
  );
}

function GheeCard({ title, subtitle, animal }: { title: string; subtitle: string; animal: string }) {
  return (
    <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-md">
      <div className="flex h-44 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-100 to-emerald-50">
        <div className="text-center"><div className="mx-auto flex h-24 w-20 items-center justify-center rounded-[1.7rem] bg-gradient-to-b from-amber-200 to-amber-400 shadow-lg ring-4 ring-white"><span className="text-center text-xs font-black text-emerald-950">ART<br/>Desi Ghee</span></div><p className="mt-3 text-xs font-bold text-emerald-800">{animal}</p></div>
      </div>
      <h3 className="mt-4 text-center text-lg font-black">{title}</h3>
      <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>
      <div className="mt-4 flex justify-center gap-2">{["500g", "1kg", "2kg"].map((x) => <span key={x} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{x}</span>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-2"><Link href="/products" className="rounded-xl bg-emerald-700 px-3 py-2.5 text-center text-xs font-bold text-white">Order Now</Link><Link href="/contact" className="inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-600 px-3 py-2.5 text-xs font-bold text-emerald-700"><MessageCircle className="h-4 w-4" /> WhatsApp</Link></div>
    </div>
  );
}
