import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/layout/logout-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { NotificationBell } from "@/components/layout/notification-bell";
import { HelpButton } from "@/components/help/help-button";
import { UiModeToggle } from "@/components/guided/ui-mode-toggle";
import { getUiMode } from "@/lib/access/ui-mode";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * Sidebar ke baghair upar wali patti.
 *
 * Malik ka faisla: staff ko permanent sidebar nahi milti. Us ke bajaye
 * yahan sirf wo raaste hain jo har waqt kaam ke hain --
 *
 *   ← Mera Kaam  |  POS  |  Notifications  |  Profile
 *
 * "Mera Kaam" pehle hai aur hamesha rehta hai. Wajah: sidebar hatne ke
 * baad wapas jane ka koi aur raasta nahi bachta, aur ek safhe par phans
 * jane wala banda browser ka back button dabata hai -- jo aadhe bhare
 * hue form ke sath achha nahi hota.
 *
 * POS is liye alag rakha gaya hai ke counter par baitha banda din bhar
 * usi par jata hai; usay do click ka faasla dena kaam dhima kar deta
 * hai. Magar wo tabhi dikhta hai jab us ki ijazat ho -- "ijazat nahi to
 * card nahi" wala qanoon patti par bhi lagta hai.
 */
export async function CompactNav({
  lang,
  showPos,
  homeHref,
}: {
  lang: Lang;
  showPos: boolean;
  homeHref: string;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = user?.email ?? "";
  let branchName: string | null = null;
  let unreadCount = 0;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name, branch_id").eq("id", user.id).maybeSingle();
    if (profile?.full_name) fullName = profile.full_name;
    if (profile?.branch_id) {
      const { data: branch } = await supabase.from("branches").select("name").eq("id", profile.branch_id).maybeSingle();
      branchName = branch?.name ?? null;
    }
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false);
    unreadCount = count ?? 0;
  }

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b border-surface-200 bg-white px-3 sm:px-5 dark:border-surface-800 dark:bg-surface-900">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
        <Link
          href={homeHref}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("mw_title", lang)}</span>
        </Link>

        {showPos && (
          <Link
            href="/admin/pos"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">POS</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <UiModeToggle mode={await getUiMode()} />
        <HelpButton compact />
        <LanguageSwitch current={lang} className="hidden sm:inline-flex" />
        <ThemeToggle />
        <NotificationBell initialCount={unreadCount} href="/admin/notifications" />
        <div className="hidden items-center gap-2.5 border-l border-surface-200 pl-3 sm:flex dark:border-surface-700">
          {/* Naam ke sath shaakh -- ek hi banda kai shaakh dekh sakta hai,
              aur "main abhi kis shaakh mein hoon" har waqt saamne hona
              chahiye. */}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
            {fullName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[10rem] truncate text-sm font-medium text-surface-800 dark:text-surface-100">{fullName}</span>
            {branchName && <span className="block max-w-[10rem] truncate text-[11px] text-surface-400">{branchName}</span>}
          </span>
          <LogoutButton />
        </div>
        <div className="sm:hidden">
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
