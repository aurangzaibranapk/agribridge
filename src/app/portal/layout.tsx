import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalSidebar } from "@/components/portal/sidebar";
import { PortalMobileSidebar } from "@/components/portal/mobile-sidebar";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { LangProvider } from "@/lib/i18n/lang-context";
import { checkFarmerSubscriptionAccess } from "@/actions/subscriptions";
import { getActiveAnnouncementForFarmer } from "@/actions/announcements";
import { SubscriptionLockedScreen } from "@/components/portal/subscription-locked-screen";
import { AnnouncementPopup } from "@/components/portal/announcement-popup";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id, full_name, farmer_code, member_photo_url, preferred_language").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  // Kisan ne apni profile mein jo zaban chuni hai wohi shuru mein lagti
  // hai. Cookie us se upar rehti hai: jis ne abhi switch dabaya hai us ki
  // marzi is waqt ki hai, aur profile ka jawab purana.
  //
  // Ye khana sirf yahan nahi parha jata -- WhatsApp aur SMS wahan se
  // bhejte hain jahan cookie hoti hi nahi, aur kisan zyada tar wahin
  // parhta hai.
  const preferred = farmer?.preferred_language;
  const lang = getLanguageFromCookies(
    preferred === "en" || preferred === "rm" || preferred === "ur" ? preferred : "ur"
  );

  const { hasAccess, minimumAmount } = await checkFarmerSubscriptionAccess(farmer.id);
  const activeAnnouncement = await getActiveAnnouncementForFarmer(farmer.id);

  // LangProvider portal par bhi -- pehle ye sirf admin ke layout par
  // laga tha. Us ka natija ye tha ke portal ke client components mein
  // useLang() hamesha default "rm" lautata: safha tarjuma shuda lagta,
  // magar Urdu chunne wale kisan ko phir bhi Roman milta. Zaban wohi
  // hai jo neeche prop mein ja rahi hai -- ek hi jagah se, do nahi.
  return (
    <LangProvider lang={lang}>
    <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      <PortalSidebar lang={lang} />
      {/* min-w-0 -- wohi wajah jo admin ke layout mein likhi hai: is ke
          baghair ek chaura bachcha (table, lambi lakeer) is khane ko
          screen se bara kar deta hai aur poora safha daayen se kat jata
          hai. Kisan ke portal par ye aur bura hai: wahan safha aksar
          phone par khulta hai, jahan chaurai pehle hi kam hoti hai. */}
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-surface-200 bg-white px-4 py-3 sm:px-6 dark:bg-surface-900 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <PortalMobileSidebar lang={lang} />
            <p className="font-display text-sm font-medium text-surface-900 sm:hidden">{t("app_name", lang)}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-surface-900 dark:text-white">{farmer.full_name}</p>
              <p className="text-xs text-surface-400">{farmer.farmer_code}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {farmer.member_photo_url ? (
                <img src={farmer.member_photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                farmer.full_name?.charAt(0)?.toUpperCase() ?? "F"
              )}
            </div>
          </div>
        </header>
        <main>{hasAccess ? children : <SubscriptionLockedScreen minimumAmount={minimumAmount} />}</main>
      </div>
      {activeAnnouncement && <AnnouncementPopup announcement={activeAnnouncement} farmerId={farmer.id} />}
    </div>
    </LangProvider>
  );
}