import Link from "next/link";
import { Button } from "@/components/ui/form";
import { SearchBar } from "@/components/site/search-bar";
import { ArtLogo } from "@/components/brand/art-logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Products" },
  { href: "/services", label: "Services" },
  { href: "/ai-crop-doctor", label: "Kisan AI Crop Doctor" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/invest", label: "Invest" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#C9A227]/20 bg-white/95 shadow-[0_1px_0_0_rgba(201,162,39,0.08)] backdrop-blur dark:border-surface-800 dark:bg-surface-950/90">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 xl:gap-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <ArtLogo width={38} />
          <div className="hidden sm:block">
            <span className="block font-display text-base font-semibold leading-tight text-surface-900 dark:text-white">Al Rana Traders</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#A9791A]">ART AgriBridge</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-4 lg:flex xl:gap-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative whitespace-nowrap py-1 text-sm font-medium text-surface-600 hover:text-[#1E4A2E] dark:text-surface-300 dark:hover:text-brand-400"
            >
              {item.label}
              <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 bg-[#C9A227] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>
        <div className="hidden w-44 xl:block">
          <SearchBar />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/login">
            <Button variant="secondary" size="sm">Sign In</Button>
          </Link>
          <Link href="/register/farmer">
            <Button size="sm" className="bg-[#1E4A2E] hover:bg-[#163A23]">Register</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}