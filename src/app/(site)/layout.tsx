import { PublicHeader } from "@/components/site/public-header";
import { PublicFooter } from "@/components/site/public-footer";
import { ChatbotWidget } from "@/components/site/chatbot-widget";
import { createClient } from "@/lib/supabase/server";
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

  // Try/catch jaan boojh kar.
  //
  // 6 September ko POORA admin is se gir gaya tha: layout mein Supabase
  // ka client try block se BAHAR bana tha, aur env ki ek kami ne har
  // safhe par 500 kar diya. Ye layout poori public website ka hai --
  // yahan wo ghalti aur mehngi hai: number na milne ka matlab ye nahi
  // ke website band ho jaye.
  //
  // Number na mile to wo apne fallback par chala jata hai aur baqi safha
  // jaisa hai waisa chalta rehta hai.
  let whatsapp = "923331116727";
  try {
    const supabase = createClient();
    const { data: phoneRow } = await supabase
      .from("website_settings")
      .select("value")
      .eq("key", "contact_phone")
      .maybeSingle();
    const digits = String(phoneRow?.value ?? "").replace(/\D/g, "");
    if (digits) whatsapp = digits;
  } catch (e) {
    console.error("SiteLayout: contact_phone nahi mila —", e instanceof Error ? e.message : e);
  }

  return (
    <LangProvider lang={lang}>
      <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex min-h-screen flex-col bg-white">
        <PublicHeader whatsapp={whatsapp} />
        <main className="flex-1">{children}</main>
        <PublicFooter />
        <ChatbotWidget />
      </div>
    </LangProvider>
  );
}
