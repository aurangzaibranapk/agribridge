import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
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
 *
 * ---------------------------------------------------------------------
 * 6 SEPTEMBER: HEADER AUR FOOTER BADLE, BAQI SAB WAHIN
 *
 * Malik ka final design aaya to sirf `SiteHeader`/`SiteFooter` ki jagah
 * `PublicHeader`/`PublicFooter` aaye. `LangProvider`, `dir` aur
 * `ChatbotWidget` haath nahi lagaye gaye -- malik ki hidayat thi ke
 * layout mein jo pehle se chal raha hai wo mita na diya jaye.
 *
 * WhatsApp ka number yahan se guzarta hai (CMS `contact_phone` se),
 * kyunki header client component hai aur wahan database nahi parha ja
 * sakta. Number ek hi jagah se aata hai -- do jagah likhne ka matlab
 * hota ke ek badle aur doosra purana reh jaye.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = getLanguageFromCookies("rm");

  // WhatsApp ka number yahan se nikal gaya (6 September).
  //
  // Malik ne header se WhatsApp ka button hata diya, aur us ke sath ye
  // talaash bhi bekaar ho gayi: footer apna number khud laata hai. Har
  // safhe par ek aisi query chalate rehna jis ka jawab koi parhta hi
  // nahi -- wo sirf safha dheema karti hai.
  return (
    <LangProvider lang={lang}>
      <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-white">
        <PublicHeader />
        <main className="flex-1">{children}</main>
        <PublicFooter />
        <ChatbotWidget />
      </div>
    </LangProvider>
  );
}
