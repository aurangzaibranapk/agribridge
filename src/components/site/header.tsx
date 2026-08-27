import Link from "next/link";
import { Button } from "@/components/ui/form";
import { SearchBar } from "@/components/site/search-bar";

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
          <svg width="38" height="42" viewBox="0 0 220 260" className="shrink-0">
            <defs>
              <linearGradient id="navGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#F3D98B" />
                <stop offset="50%" stopColor="#C9A227" />
                <stop offset="100%" stopColor="#E8C767" />
              </linearGradient>
            </defs>
            <polygon points="110,10 190,55 190,145 110,190 30,145 30,55" fill="none" stroke="url(#navGoldGrad)" strokeWidth="4" />
            <polygon points="110,22 178,60 178,140 110,178 42,140 42,60" fill="#0D2818" stroke="url(#navGoldGrad)" strokeWidth="1.5" />
            <g transform="translate(110,60)">
              <path d="M0 90 L0 20" stroke="url(#navGoldGrad)" strokeWidth="4" strokeLinecap="round" />
              <g fill="url(#navGoldGrad)">
                <ellipse cx="-9" cy="65" rx="9" ry="15" transform="rotate(-32 -9 65)" />
                <ellipse cx="9" cy="65" rx="9" ry="15" transform="rotate(32 9 65)" />
                <ellipse cx="-10" cy="46" rx="8.4" ry="14.1" transform="rotate(-30 -10 46)" />
                <ellipse cx="10" cy="46" rx="8.4" ry="14.1" transform="rotate(30 10 46)" />
                <ellipse cx="-9" cy="28" rx="7.5" ry="12.9" transform="rotate(-28 -9 28)" />
                <ellipse cx="9" cy="28" rx="7.5" ry="12.9" transform="rotate(28 9 28)" />
              </g>
              <ellipse cx="0" cy="10" rx="6.9" ry="12.9" fill="url(#navGoldGrad)" />
              <path d="M0 90 Q-24 84 -28 66 Q-10 66 0 78 Z" fill="#4A7856" />
              <path d="M0 90 Q24 84 28 66 Q10 66 0 78 Z" fill="#4A7856" />
            </g>
          </svg>
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