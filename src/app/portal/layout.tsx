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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CustomerShell } from "@/components/portal/customer/customer-shell";
import { PortalTabBar } from "@/components/portal/portal-tabbar";
import { PortalBreadcrumb } from "@/components/portal/breadcrumb";
import { OfflineBanner } from "@/components/portal/offline-banner";
import { SkipLink } from "@/components/portal/skip-link";
import { portalShellClass } from "@/components/portal/urdu-font";
import { breedDb, unseenReminders } from "@/lib/portal/breeding-load";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id, full_name, farmer_code, member_photo_url, preferred_language, cow_count, buffalo_count").eq("user_id", user.id).single();
  // Phase 5: jo kisan nahi magar gahak (customers.user_id) hai, us ka apna Customer Portal.
  if (!farmer) return <CustomerShell userId={user.id}>{children}</CustomerShell>;
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
  // Phase 6: Nasal par badge (aaj ke naye reminders) aur phone ki Dairy tab
  // sirf jab janwar hon. Dono sasti ginti; nakami par badge/tab chup.
  const [reminders, animals] = await Promise.all([
    unseenReminders().catch(() => 0),
    Promise.resolve(breedDb().from("dairy_animals").select("id", { count: "exact", head: true })).then((r: { count: number | null }) => r.count ?? 0, () => 0),
  ]);
  const hasDairy = animals > 0 || Number(farmer.cow_count ?? 0) + Number(farmer.buffalo_count ?? 0) > 0;

  // LangProvider portal par bhi -- pehle ye sirf admin ke layout par
  // laga tha. Us ka natija ye tha ke portal ke client components mein
  // useLang() hamesha default "rm" lautata: safha tarjuma shuda lagta,
  // magar Urdu chunne wale kisan ko phir bhi Roman milta. Zaban wohi
  // hai jo neeche prop mein ja rahi hai -- ek hi jagah se, do nahi.
  return (
    <LangProvider lang={lang}>
    <div dir={lang === "ur" ? "rtl" : "ltr"} lang={lang === "ur" ? "ur" : lang === "en" ? "en" : "ur-Latn"} className={`${portalShellClass(lang)} pf-shell flex min-h-screen bg-surface-50 dark:bg-surface-950`}>
      <SkipLink lang={lang} />
      <PortalSidebar lang={lang} badges={{ reminders }} />
      {/* min-w-0 -- wohi wajah jo admin ke layout mein likhi hai: is ke
          baghair ek chaura bachcha (table, lambi lakeer) is khane ko
          screen se bara kar deta hai aur poora safha daayen se kat jata
          hai. Kisan ke portal par ye aur bura hai: wahan safha aksar
          phone par khulta hai, jahan chaurai pehle hi kam hoti hai. */}
      <div className="pf-col min-w-0 flex-1">
        <header className="print:hidden flex items-center justify-between gap-2 border-b border-surface-200 bg-white px-4 py-2 sm:px-6 sm:py-3 dark:bg-surface-900 dark:border-surface-800">
          <div className="flex min-w-0 items-center gap-2">
            <PortalMobileSidebar lang={lang} badges={{ reminders }} />
            <p className="font-display text-sm font-medium text-surface-900 dark:text-white sm:hidden">{t("app_name", lang)}</p>
            <PortalBreadcrumb lang={lang} />
          </div>
          <div className="ms-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="text-end max-[380px]:hidden">
              <p className="text-sm font-medium text-surface-900 dark:text-white">{farmer.full_name}</p>
              <p className="text-xs text-surface-500 dark:text-slate-400"><span dir="ltr" className="ltr-iso">{farmer.farmer_code}</span></p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300" aria-hidden>
              {farmer.member_photo_url ? (
                <img src={farmer.member_photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                farmer.full_name?.charAt(0)?.toUpperCase() ?? "F"
              )}
            </div>
          </div>
        </header>
        <div className="pf-none"><OfflineBanner lang={lang} /></div>
        <main id="portal-main" tabIndex={-1} className="pf-main pb-20 outline-none sm:pb-0">{hasAccess ? children : <SubscriptionLockedScreen minimumAmount={minimumAmount} />}</main>
      </div>
      <PortalTabBar lang={lang} kind="farmer" hasDairy={hasDairy} />
      {activeAnnouncement && <AnnouncementPopup announcement={activeAnnouncement} farmerId={farmer.id} />}
    </div>
    </LangProvider>
  );
}