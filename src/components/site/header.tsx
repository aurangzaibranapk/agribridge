import Link from "next/link";
import { Button } from "@/components/ui/form";
import { SearchBar } from "@/components/site/search-bar";
import { MobileNav } from "@/components/site/mobile-nav";
import { ArtLogo } from "@/components/brand/art-logo";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

/**
 * Website ki navigation.
 *
 * Malik ki spec (6 September) ke mutabiq das unwan. Do baatein jaan
 * boojh kar:
 *
 * 1. **Marketplace `/marketplace` par jata hai, koi naya safha nahi.**
 *    Wo safha pehle se maujood hai. Spec khud kehti hai "REUSE IT --
 *    avoid /marketplace2": ek hi karobar ka nizam hona chahiye, us ki
 *    naqal nahi.
 *
 * 2. **Kisan AI `/kisan-ai` par hai magar Crop Doctor `/ai-crop-doctor`
 *    par hi rehta hai.** Naya safha us ka darwaza hai, us ki jagah
 *    nahi -- chalta hua Crop Doctor kisi soorat nahi chhera ja raha.
 *
 * `MOBILE_NAV` mein kuch cheezein zyada hain (Products, Blog, About,
 * Contact). Wajah: phone par upar koi jagah nahi bachti, magar menu ke
 * andar poori fehrist rakhi ja sakti hai -- aur wahan un tak pahunchne
 * ka koi aur raasta hai bhi nahi.
 */
const NAV = [
  { href: "/", label: "Home" },
  { href: "/agriculture", label: "Agriculture" },
  { href: "/kisan-services", label: "Kisan Services" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/grain", label: "Grain" },
  { href: "/machinery", label: "Machinery" },
  { href: "/dairy", label: "Dairy" },
  { href: "/kisan-ai", label: "Kisan AI" },
  { href: "/erp", label: "AgriBridge ERP" },
  { href: "/partner", label: "Partner" },
];

const MOBILE_NAV = [
  ...NAV,
  { href: "/products", label: "Products" },
  { href: "/services", label: "Services" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const lang = getLanguageFromCookies("rm");
  return (
    <header className="sticky top-0 z-40 border-b border-[#C9A227]/20 bg-white/95 shadow-[0_1px_0_0_rgba(201,162,39,0.08)] backdrop-blur dark:border-surface-800 dark:bg-surface-950/90">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-3 px-4 xl:gap-5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <ArtLogo width={38} />
          <div className="hidden sm:block">
            <span className="block font-display text-base font-semibold leading-tight text-surface-900 dark:text-white">{t("sh_company", lang)}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[#A9791A]">{t("sh_brand", lang)}</span>
          </div>
        </Link>
        <nav className="hidden items-center gap-3 lg:flex xl:gap-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative whitespace-nowrap py-1 text-[13px] font-medium text-surface-600 hover:text-[#1E4A2E] xl:text-sm dark:text-surface-300 dark:hover:text-brand-400"
            >
              {item.label}
              <span className="absolute -bottom-0.5 left-0 h-[2px] w-0 bg-[#C9A227] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>
        <div className="hidden w-40 2xl:block">
          <SearchBar />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/login" className="hidden sm:block">
            <Button variant="secondary" size="sm">{t("sh_sign_in", lang)}</Button>
          </Link>
          <Link href="/register/farmer" className="hidden sm:block">
            <Button size="sm" className="bg-[#1E4A2E] hover:bg-[#163A23]">{t("sh_register", lang)}</Button>
          </Link>
          <MobileNav items={MOBILE_NAV} />
        </div>
      </div>
    </header>
  );
}