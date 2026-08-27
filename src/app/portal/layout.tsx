import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PortalSidebar } from "@/components/portal/sidebar";
import { PortalMobileSidebar } from "@/components/portal/mobile-sidebar";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
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
  const { data: farmer } = await supabase.from("farmers").select("id, full_name, farmer_code, member_photo_url").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const lang = getLanguageFromCookies();

  const { hasAccess, minimumAmount } = await checkFarmerSubscriptionAccess(farmer.id);
  const activeAnnouncement = await getActiveAnnouncementForFarmer(farmer.id);

  return (
    <div dir={lang === "ur" ? "rtl" : "ltr"} className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      <PortalSidebar lang={lang} />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-surface-200 bg-white px-4 py-3 sm:px-6 dark:bg-surface-900 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <PortalMobileSidebar lang={lang} />
            <p className="font-display text-sm font-medium text-surface-900 sm:hidden">AgriBridge</p>
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
  );
}