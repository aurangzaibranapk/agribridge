import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { ChatbotWidget } from "@/components/site/chatbot-widget";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";

/**
 * LangProvider yahan lagta hai -- root layout par nahi.
 *
 * WOHI KHAMOSHI WALI KHARABI JO LOGIN AUR PORTAL PAR PAKRI GAYI THI:
 * is ke baghair andar ka har client component useLang() se hamesha
 * DEFAULT zaban lauta leta. Safha tarjuma shuda lagta -- aur Urdu chunne
 * wale bande ko phir bhi Roman milta. Aur ye nazar bhi nahi aata,
 * kyunke Roman waise bhi theek parha jata hai.
 *
 * Root layout par jaan boojh kar nahi: wo poori website ka hai, aur
 * wahan cookies() parhne se har safha dynamic ho jata. Ye layout sirf
 * public website ka hai, aur us ke qareeban saare safhe pehle se
 * dynamic hain (build ke mutabiq), is liye yahan koi qeemat ada nahi
 * hoti.
 *
 * dir bhi yahin se: Urdu daayen se bayen chalti hai, aur ye baat poore
 * safhe par ek sath lagni chahiye -- har component mein alag alag nahi.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = getLanguageFromCookies("rm");
  return (
    <LangProvider lang={lang}>
      <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <ChatbotWidget />
      </div>
    </LangProvider>
  );
}
