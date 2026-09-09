import Link from "next/link";
import { Leaf } from "lucide-react";

const quickLinks = [
  ["Home", "/"],
  ["Agriculture", "/#services"],
  ["Kisan Services", "/#services"],
  ["Marketplace", "/#services"],
  ["Grain", "/#services"],
  ["Machinery", "/#services"],
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
      <div className="mx-auto max-w-[1500px] px-5 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1.35fr_.8fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white shadow-sm">ART</div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">Al Rana Traders</p>
                <p className="font-display text-2xl font-black">Agri<span className="text-emerald-700">Bridge</span></p>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">Digital Agriculture for a Better Tomorrow.</p>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[#123629]">Quick Links</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {quickLinks.map(([label, href]) => (
                <Link key={`${label}-${href}`} href={href} className="rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-bold text-white transition hover:bg-emerald-800">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[#123629]">Our Company</h3>
            <div className="mt-3 grid gap-2">
              {companyLinks.map(([label, href]) => (
                <Link key={`${label}-${href}`} href={href} className="rounded-lg bg-[#BDE8C4] px-3 py-2 text-center text-xs font-bold text-[#17452F] transition hover:bg-[#A7DCB0]">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center rounded-3xl border border-emerald-100 bg-white/70 p-6 text-center shadow-sm">
            <div>
              <Leaf className="mx-auto h-14 w-14 text-emerald-700" />
              <p className="mt-3 text-2xl font-black leading-tight text-emerald-800">Digital Farms<br/>Stronger Pakistan</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-emerald-200 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Al Rana Traders (AgriBridge). All rights reserved.</p>
          <p>Zarurat se zindagi tak — AgriBridge ke saath.</p>
        </div>
      </div>
    </footer>
  );
}
