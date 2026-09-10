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
  { title: "Marketplace", text: "Buy & Sell Agriculture Products", href: "/marketplace", icon: ShoppingCart },
  { title: "Grain", text: "Procurement & Trading", href: "/contact", icon: Wheat },
  { title: "Machinery", text: "Booking & Rental Farm Equipment", href: "/book-machinery", icon: Tractor },
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
        <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-8 sm:px-5 sm:py-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-8 lg:px-8 lg:py-16">
          <div className="relative z-10 flex flex-col justify-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-emerald-900 sm:text-sm">Pakistan&apos;s Digital Agriculture Platform</p>
            <h1 className="mt-3 max-w-3xl font-display text-[2.2rem] font-black leading-[1.03] tracking-tight text-[#082B1D] sm:text-5xl lg:text-6xl">Empowering Farmers Today for a Greener Tomorrow</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 sm:mt-5 sm:text-lg sm:leading-8">Connecting farmers, inputs, machinery, dairy, markets and technology — from farm to market.</p>
            <p dir="rtl" className="mt-3 max-w-2xl text-lg font-medium leading-8 text-[#173F31] sm:mt-4 sm:text-xl sm:leading-10">زراعت کو ڈیجیٹل بنا کر ایک بہتر مستقبل کی طرف</p>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:flex sm:flex-wrap sm:gap-3">
              <Link href="#services" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 sm:px-5 sm:text-sm">Explore AgriBridge <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/register/farmer" className="inline-flex items-center justify-center rounded-xl border border-emerald-700 bg-white/80 px-4 py-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50 sm:px-5 sm:text-sm">Join as Farmer</Link>
            </div>
            <div className="mt-5 grid max-w-2xl grid-cols-2 gap-2.5 sm:mt-8 sm:grid-cols-4 sm:gap-3">
              {["Built for Farmers", "Complete Agri Solutions", "Better Markets", "Sustainable Growth"].map((item) => <div key={item} className="flex items-start gap-2 rounded-xl bg-white/55 px-2.5 py-2 text-[11px] font-semibold leading-4 text-slate-700 sm:bg-transparent sm:p-0 sm:text-xs"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 sm:h-4 sm:w-4" />{item}</div>)}
            </div>
          </div>
          <div className="relative min-h-[270px] overflow-hidden rounded-[1.6rem] bg-gradient-to-br from-[#DDEFE0] via-[#F5F0D5] to-[#B9DEA8] shadow-lg ring-1 ring-emerald-900/5 sm:min-h-[340px] sm:rounded-[2rem] lg:min-h-[380px] lg:shadow-xl">
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-emerald-900/25 to-transparent sm:h-44" />
            <div className="absolute right-4 top-4 rounded-2xl bg-white/90 px-4 py-3 shadow-md backdrop-blur sm:right-7 sm:top-7 sm:px-5 sm:py-4 sm:shadow-lg"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 sm:text-xs">Digital Agriculture</p><p className="mt-1 max-w-32 text-lg font-black leading-tight text-[#113B2B] sm:max-w-40 sm:text-2xl">Real Impact for Pakistan</p></div>
            <div className="absolute bottom-4 left-4 max-w-[75%] rounded-2xl bg-[#0D5A3A]/90 p-4 text-white shadow-lg backdrop-blur sm:bottom-8 sm:left-8 sm:max-w-sm sm:rounded-3xl sm:p-6 sm:shadow-xl"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100 sm:text-sm">Farm → Data → Market</p><h2 className="mt-1.5 text-xl font-black sm:mt-2 sm:text-3xl">Farmers. Farms. Food.</h2><p className="mt-1.5 text-xs leading-5 text-emerald-50 sm:mt-2 sm:text-sm sm:leading-6">A connected digital agriculture ecosystem built around farmers and their daily needs.</p></div>
            <div className="absolute bottom-4 right-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/85 shadow-md sm:bottom-7 sm:right-7 sm:h-24 sm:w-24 sm:shadow-lg"><Tractor className="h-8 w-8 text-emerald-700 sm:h-12 sm:w-12" /></div>
          </div>
        </div>
      </section>
      <section id="services" className="mx-auto max-w-[1500px] px-4 py-9 sm:px-5 sm:py-12 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4"><div><h2 className="font-display text-2xl font-black text-[#123629] sm:text-4xl">Our Agriculture Services</h2><p className="mt-1 text-sm text-slate-600 sm:text-base">Everything a modern farmer needs — on one platform.</p></div><Link href="/contact" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 sm:text-sm">View All Services <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3 md:grid-cols-4 xl:grid-cols-8">
          {services.map(({ title, text, href, icon: Icon }) => <Link key={title} href={href} className="group flex min-h-[185px] flex-col rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-md sm:min-h-56 sm:p-4 dark:border-surface-800 dark:bg-surface-900"><div className="flex h-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50 sm:h-20"><Icon className="h-7 w-7 text-emerald-700 sm:h-10 sm:w-10" /></div><h3 className="mt-3 text-sm font-extrabold sm:mt-4 sm:text-base">{title}</h3><p className="mt-1 flex-1 text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5 dark:text-surface-400">{text}</p><span className="mt-2.5 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-2 text-[11px] font-bold text-white transition group-hover:bg-emerald-800 sm:mt-3 sm:px-3 sm:text-xs">Explore <ArrowRight className="h-3.5 w-3.5" /></span></Link>)}
        </div>
      </section>
      <section id="farm-products" className="border-y border-amber-100 bg-[#FFF9EC]">
        <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-9 sm:px-5 sm:py-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-7 lg:px-8">
          <div className="flex flex-col justify-center"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-700 sm:text-sm">From Our Farm to Your Home</p><h2 className="mt-2 font-display text-3xl font-black leading-tight text-[#123629] sm:text-4xl">Pure. Natural. Desi.</h2><p dir="rtl" className="mt-3 max-w-2xl text-xl font-semibold leading-9 text-[#183E30] sm:mt-4 sm:text-2xl sm:leading-10">خالص دیسی گھی — ہمارے فارم سے آپ کے گھر تک</p><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">Pure cow and buffalo desi ghee from our own dairy, prepared with focus on purity, quality and traditional taste.</p><div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">{["100% Khalis", "No Preservatives", "Farm Fresh", "Quality Focused"].map((x) => <div key={x} className="rounded-xl border border-amber-100 bg-white px-2.5 py-2.5 text-center text-[11px] font-bold text-emerald-900 shadow-sm sm:px-3 sm:py-3 sm:text-xs">{x}</div>)}</div><Link href="/products" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white sm:mt-6 sm:w-fit">View All Farm Products <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4"><GheeCard title="Pure Cow Desi Ghee" subtitle="From Our Own Dairy" animal="Cow" /><GheeCard title="Pure Buffalo Desi Ghee" subtitle="From Our Own Dairy" animal="Buffalo" /></div>
        </div>
      </section>
      <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-5 sm:py-10 lg:px-8"><div className="rounded-3xl border border-emerald-100 bg-[#EFF9F2] p-4 shadow-sm sm:p-6"><h2 className="font-display text-xl font-black text-[#123629] sm:text-2xl">Why Choose AgriBridge?</h2><div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-5 sm:gap-3 md:grid-cols-4">{benefits.map(([title, text]) => <div key={title} className="rounded-2xl bg-white p-3 shadow-sm sm:p-4"><div className="flex items-start gap-2.5 sm:items-center sm:gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 sm:h-10 sm:w-10"><Leaf className="h-4 w-4 text-emerald-700 sm:h-5 sm:w-5" /></div><div><p className="text-sm font-extrabold sm:text-base">{title}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500 sm:text-xs">{text}</p></div></div></div>)}</div></div></section>
      <section className="bg-gradient-to-r from-[#075736] via-[#0B6C43] to-[#075736] text-white"><div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-2.5 px-4 py-5 text-center sm:gap-4 sm:px-5 sm:py-6 md:grid-cols-4 lg:px-8">{["Farmer Focused", "Connected Agriculture Services", "Digital Agriculture", "A Greener Pakistan"].map((x) => <div key={x} className="rounded-2xl bg-white/5 px-2.5 py-3 sm:px-3 sm:py-4"><Leaf className="mx-auto h-5 w-5 text-emerald-200 sm:h-6 sm:w-6" /><p className="mt-1.5 text-xs font-bold sm:mt-2 sm:text-sm">{x}</p></div>)}</div></section>
      <section className="mx-auto grid max-w-[1500px] gap-3 px-4 py-9 sm:gap-5 sm:px-5 sm:py-12 lg:grid-cols-3 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#D9ECD3] to-[#F4E9C8] p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 sm:text-sm">Farmer First</p><h3 className="mt-2 text-2xl font-black leading-tight text-[#143B2B] sm:mt-3 sm:text-3xl">Digital agriculture means better access, better records and better decisions.</h3></div>
        <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-7 dark:border-surface-800 dark:bg-surface-900"><h3 className="text-xl font-black sm:text-2xl">Built Around Farmers</h3><p className="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7 dark:text-surface-400">AgriBridge is designed around practical farmer needs — from inputs and machinery to market access, dairy and digital guidance.</p></div>
        <div className="rounded-3xl bg-gradient-to-br from-[#F0FAF2] to-[#E8F4DE] p-5 sm:p-7"><h3 className="text-2xl font-black text-[#123629] sm:text-3xl">Start Your Digital Farming Journey</h3><p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">Connect with AgriBridge for agriculture services, market access and digital support.</p><Link href="/contact" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0B6C43] px-5 py-3 text-sm font-bold text-white">Contact Us <ArrowRight className="h-4 w-4" /></Link></div>
      </section>
    </div>
  );
}

function GheeCard({ title, subtitle, animal }: { title: string; subtitle: string; animal: string }) {
  return <div className="rounded-2xl border border-amber-200 bg-white p-3 shadow-md sm:rounded-3xl sm:p-4 sm:shadow-lg"><div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 via-yellow-50 to-emerald-50 sm:rounded-2xl"><div className="text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow sm:h-20 sm:w-20"><Droplets className="h-7 w-7 text-amber-600 sm:h-10 sm:w-10" /></div><p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 sm:mt-3 sm:text-xs">{animal} Dairy</p></div></div><h3 className="mt-3 text-sm font-black leading-tight sm:mt-4 sm:text-lg">{title}</h3><p className="mt-1 text-[10px] text-slate-500 sm:text-xs">{subtitle}</p><div className="mt-2.5 flex flex-wrap gap-1 sm:mt-3 sm:gap-1.5">{["500g", "1kg", "2kg"].map((x) => <span key={x} className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-900 sm:px-2.5 sm:text-[10px]">{x}</span>)}</div><Link href="/contact" className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-2 py-2 text-[10px] font-bold text-white sm:mt-4 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs"><MessageCircle className="h-3.5 w-3.5" /> Order Now</Link></div>;
}
