import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";

/**
 * LangProvider -- warna andar ka har client component useLang() se
 * hamesha DEFAULT zaban lauta leta.
 *
 * YE WOHI KHAMOSHI WALI KHARABI HAI jo login, kisan ke portal aur public
 * website par pakri ja chuki hai: safha tarjuma shuda LAGTA hai, aur Urdu
 * chunne wale bande ko phir bhi Roman milta hai. Nazar bhi nahi aati,
 * kyunke Roman waise bhi theek parha jata hai.
 *
 * Is hisse ka koi apna layout tha hi nahi, is liye ye nayi file hai --
 * sirf zaban ke liye. Shakl yahan se nahi badalti.
 *
 * dir bhi yahin se: Urdu daayen se bayen chalti hai, aur ye baat poore
 * safhe par ek sath lagni chahiye.
 */
export default function PortalLangLayout({ children }: { children: React.ReactNode }) {
  const lang = getLanguageFromCookies("rm");
  return (
    <LangProvider lang={lang}>
      <div dir={lang === "ur" ? "rtl" : "ltr"}>{children}</div>
    </LangProvider>
  );
}
