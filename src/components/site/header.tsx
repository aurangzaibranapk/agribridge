import Link from "next/link";
import { Search } from "lucide-react";
import { MobileSiteNav } from "@/components/site/mobile-site-nav";
import { HeaderBrand } from "@/components/site/header-brand";
import { BrandMark } from "@/components/brand/brand-mark";
import { brandName, brandTagline } from "@/lib/brand";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/#services", label: "Agriculture" },
  { href: "/#services", label: "Kisan Services" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/#services", label: "Grain" },
  { href: "/book-machinery", label: "Machinery" },
  { href: "/#services", label: "Dairy" },
  { href: "/#farm-products", label: "Farm Products" },
  { href: "/ai-crop-doctor", label: "Kisan AI" },
  { href: "/faslon-ke-tips", label: "Faslon ke tips" },
  { href: "/contact", label: "Partner" },
];

export function SiteHeader() {
  const lang = getLanguageFromCookies("en");
  const name = brandName(lang);
  const tagline = brandTagline(lang);
  return (
    <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/95 backdrop-blur dark:border-surface-800 dark:bg-surface-950/95">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[1500px] items-center gap-3 px-3 py-1.5 sm:px-4 lg:px-7">
        <Link href="/" aria-label={`${name}, ${tagline}`} className="flex min-w-0 shrink-0 items-center gap-2.5">
          <BrandMark className="h-10 w-10 sm:h-11 sm:w-11" />
          <HeaderBrand name={name} tagline={tagline} urdu={lang === "ur"} />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-3 xl:flex 2xl:gap-5">
          {NAV.map((item) => (
            <Link key={`${item.href}-${item.label}`} href={item.href} className="group relative whitespace-nowrap py-2 text-xs font-semibold text-surface-700 transition hover:text-emerald-700 2xl:text-sm dark:text-surface-300">
              {item.label}
              <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-0.5 w-0 rounded-full bg-emerald-600 transition-all group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link href="/products" aria-label="Search products" className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface-100 text-surface-700 transition hover:bg-emerald-50 hover:text-emerald-700 md:flex dark:bg-surface-900 dark:text-surface-200">
            <Search className="h-4 w-4" />
          </Link>
          <Link href="/contact" className="hidden rounded-xl border border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 md:inline-flex dark:bg-surface-950 dark:text-emerald-300">Contact Us</Link>
          <Link href="/login" className="hidden rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 sm:inline-flex xl:inline-flex">Login</Link>
          <MobileSiteNav lang={lang} tagline={tagline} />
        </div>
      </div>
    </header>
  );
}
