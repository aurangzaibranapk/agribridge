import { Search, Bell } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitch } from "@/components/ui/language-switch";
import type { Lang } from "@/lib/i18n/translations";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import type { SidebarGroup } from "@/components/layout/sidebar";
import { BusinessSelector } from "@/components/layout/business-selector";
import { getBusinessContext } from "@/lib/utils/get-business-context";
import { NotificationBell } from "@/components/layout/notification-bell";
import { HelpButton } from "@/components/help/help-button";
import { UiModeToggle } from "@/components/guided/ui-mode-toggle";
import { getUiMode } from "@/lib/access/ui-mode";

export async function Topbar({
  subtitle, searchAction = "/admin/search", searchPlaceholder = "Search...", notificationsHref = "/admin/notifications", navGroups = [], lang = "rm",
}: {
  subtitle: string;
  navGroups?: SidebarGroup[];
  searchAction?: string;
  searchPlaceholder?: string;
  notificationsHref?: string;
  lang?: Lang;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let fullName = user?.email ?? "";
  let unreadCount = 0;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).single();
    if (profile?.full_name) fullName = profile.full_name;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false);
    unreadCount = count ?? 0;
  }
  const businessContext = await getBusinessContext();
  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-200 bg-white px-4 sm:px-6 dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-1 items-center gap-3">
        <MobileSidebar subtitle={subtitle} groups={navGroups} />
        <BusinessSelector current={businessContext} />
        <form action={searchAction} className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 lg:flex dark:border-surface-700 dark:bg-surface-800">
          <Search className="h-4 w-4 text-surface-400" />
          <input
            name="q"
            placeholder={searchPlaceholder}
            className="w-full bg-transparent py-2 text-sm text-surface-800 placeholder:text-surface-400 focus:outline-none dark:text-surface-100"
          />
        </form>
      </div>
      <div className="flex items-center gap-1 sm:gap-3">
        {/* Simple / Advanced (E) aur "? Samjhein" (266). */}
        <UiModeToggle mode={await getUiMode()} />
        <HelpButton />
        <LanguageSwitch current={lang} className="hidden sm:inline-flex" />
        <ThemeToggle />
        <NotificationBell initialCount={unreadCount} href={notificationsHref} />
        <div className="hidden items-center gap-3 border-l border-surface-200 pl-4 sm:flex dark:border-surface-700">
          <div className="text-right">
            <p className="text-sm font-medium text-surface-800 dark:text-surface-100">{fullName}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}