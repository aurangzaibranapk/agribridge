import Link from "next/link";
import { Leaf } from "lucide-react";

const quickLinks = [
  ["Home", "/"],
  ["Agriculture", "/#services"],
  ["Kisan Services", "/#services"],
  ["Marketplace", "/marketplace"],
  ["Grain", "/#services"],
  ["Machinery", "/book-machinery"],
  ["Dairy", "/#services"],
  ["Farm Products", "/#farm-products"],
  ["Kisan AI", "/ai-crop-doctor"],
  ["Partner", "/contact"],
] as const;

const companyLinks = [
  ["About Us", "/about"],
  ["Our Mission", "/about"],
  ["Our Team", "/about"],
  ["Partner With Us", "/contact"],
  ["Contact", "/contact"],
] as const;

export async function SiteFooter() {
  return (
    <footer className="border-t border-emerald-100 bg-[#F3F7EE] text-[#123629]">
      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-5 sm:py-9 lg:px-8 lg:py-10">
        <div className="grid gap-6 sm:gap-7 lg:grid-cols-[1.1fr_1.35fr_.8fr_1fr] lg:gap-8">
          <div className="flex items-center justify-between gap-4 lg:block">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-xs font-black text-white shadow-sm sm:h-14 sm:w-14 sm:text-sm">ART</div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 sm:text-xs sm:tracking-[0.2em]">Al Rana Traders</p>
                <p className="font-display text-xl font-black sm:text-2xl">Agri<span className="text-emerald-700">Bridge</span></p>
              </div>
            </div>
            <p className="hidden max-w-xs text-right text-xs leading-5 text-slate-600 sm:block lg:mt-4 lg:text-left lg:text-sm lg:leading-6">Digital Agriculture for a Better Tomorrow.</p>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#123629] sm:text-sm">Quick Links</h3>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3">
              {quickLinks.map(([label, href]) => (
                <Link key={`${label}-${href}`} href={href} className="flex min-h-9 items-center justify-center rounded-xl bg-emerald-700 px-2.5 py-2 text-center text-[11px] font-bold leading-tight text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-emerald-800 sm:min-h-10 sm:px-3 sm:text-xs">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#123629] sm:text-sm">Our Company</h3>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-3 lg:grid-cols-1">
              {companyLinks.map(([label, href]) => (
                <Link key={`${label}-${href}`} href={href} className="flex min-h-9 items-center justify-center rounded-xl bg-[#BDE8C4] px-2.5 py-2 text-center text-[11px] font-bold leading-tight text-[#17452F] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#A7DCB0] sm:min-h-10 sm:px-3 sm:text-xs">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center rounded-3xl border border-emerald-100 bg-white/75 p-5 text-center shadow-sm sm:p-6">
            <div className="flex items-center gap-4 lg:block">
              <Leaf className="h-11 w-11 shrink-0 text-emerald-700 sm:h-14 sm:w-14 lg:mx-auto" />
              <div className="text-left lg:text-center">
                <p className="text-xl font-black leading-tight text-emerald-800 sm:text-2xl lg:mt-3">Digital Farms<br/>Stronger Pakistan</p>
                <p className="mt-1 text-xs font-semibold text-slate-500 sm:hidden">Digital Agriculture for a Better Tomorrow.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 border-t border-emerald-200 pt-4 text-center text-[10px] leading-5 text-slate-500 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-5 sm:text-left sm:text-xs">
          <p>© {new Date().getFullYear()} Al Rana Traders (AgriBridge). All rights reserved.</p>
          <p>Zarurat se zindagi tak — AgriBridge ke saath.</p>
        </div>
      </div>
    </footer>
  );
}
