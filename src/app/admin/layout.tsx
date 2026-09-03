import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Suspense } from "react";
import { GuideOverlay } from "@/components/guided/guide-overlay";
import { CompactNav } from "@/components/layout/compact-nav";
import { WorkSidebar, type SideItem } from "@/components/layout/work-sidebar";
import { QUICK_BY_ROLE } from "@/lib/access/my-work";
import { AssistantPanel } from "@/components/layout/assistant-panel";
import { NavProgress } from "@/components/layout/nav-progress";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { sidebarModeFor } from "@/lib/access/sidebar-free";
import { homePageForRole } from "@/lib/departments";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { t } from "@/lib/i18n/translations";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  // Admin panel Roman se shuru hota hai -- abhi wahan yahi likha hua hai,
  // is liye purane staff ko koi jhatka nahi lagta. Farmer portal Urdu se.
  const lang = getLanguageFromCookies("rm");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role = "";
  let allowedPages: string[] | null = null;
  // Sidebar dikhegi ya nahi -- ye faisla database mein rakha hai
  // (250). Setting na mile to sidebar rehti hai: navigation ka ghayab
  // ho jana poore daftar ko rok deta hai.
  let showSidebar = true;
  let showPos = false;
  let navGroups: { key: string; label: string; icon?: string | null; items: { href: string; label: string; icon: string | null }[] }[] = [];
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? "";
    // Menu ab database se banta hai. Rok bhi wahi fehrist parhti hai --
    // do jagah alag hisaab hota to banda menu mein cheez dekhta aur khol
    // na pata.
    const nav = await loadNav(user.id, role, lang);
    navGroups = nav.groups;
    allowedPages = nav.unrestricted ? null : nav.allowedRoutes;

    const mode = await sidebarModeFor(role);
    showSidebar = mode.showSidebar;
    // Patti par POS ka raasta bhi usi ijazat par lagta hai jis par
    // menu lagta hai -- do jagah alag hisaab hota to banda patti par
    // POS dekhta aur khol na pata.
    showPos = nav.unrestricted || routeAllowed(nav.allowedRoutes, "/admin/pos");
  }
  // Zaban poore admin panel ke liye ek hi jagah se. Andar ke saare
  // client components isi se parhte hain -- kisi ko prop bhejne ki
  // zaroorat nahi, aur cookie browser mein parhne wala jhatka bhi nahi
  // aata (dekhein lang-context.tsx).
  // Staff ki sidebar ka maal (malik ke reference ke mutabiq). Ye poora
  // ERP nahi dikhati -- sirf is bande ke rozana ke safhe, us ke apne
  // department, us ki reports aur us ka khata. Sab kuch usi navGroups se
  // aata hai jo pehle se ijazat ke hisaab se bani hai; yahan koi nayi
  // ijazat nahi banti.
  const allItems: SideItem[] = navGroups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, icon: i.icon })));
  const seenHref = new Set<string>();
  const uniqueItems = allItems.filter((i) => (seenHref.has(i.href) ? false : (seenHref.add(i.href), true)));
  const byHref = new Map(uniqueItems.map((i) => [i.href, i]));

  const quickSide: SideItem[] = (QUICK_BY_ROLE[role] ?? [])
    .map((k) => byHref.get(`/admin/${k.replace(/\./g, "/")}`))
    .filter((i): i is SideItem => !!i)
    .slice(0, 6);

  const deptSide: SideItem[] = navGroups
    .filter((g) => g.key !== "master" && g.items.length > 0)
    .map((g) => ({ href: `/admin/my-work#${g.key}`, label: g.label, icon: g.icon ?? "LayoutGrid" }));

  const reportsSide = uniqueItems.filter((i) => i.href.startsWith("/admin/reports")).slice(0, 4);
  const settingsSide = uniqueItems.filter((i) => i.href === "/admin/my-attendance" || i.href === "/admin/my-access" || i.href === "/admin/my-wallet");

  return (
    <LangProvider lang={lang}>
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      {!showSidebar && user && (
        <WorkSidebar
          lang={lang}
          homeHref={homePageForRole(role)}
          quick={quickSide}
          departments={deptSide}
          reports={reportsSide}
          settings={settingsSide}
        />
      )}
      {showSidebar && (
        <Sidebar subtitle={t("at_website_admin", lang)} homeHref={homePageForRole(role)} role={role} allowedPages={allowedPages} groups={navGroups} />
      )}
      {/* min-w-0 -- is ke baghair poora safha daayen se kat jata hai.
          Flex ki qatar mein har bachche ki kam se kam chaurai us ke andar
          ke maal jitni hoti hai (min-width: auto). Yani ek chauri table
          is khane ko screen se bara kar deti hai, aur wo Sidebar ke sath
          mil kar poore safhe ko phaila deta hai -- daayen taraf likhi
          hui raqamein bahar nikal jati hain, aur safha khud daayen-bayen
          khisakne lagta hai.
          min-w-0 lagane se ye khana sukar sakta hai. Chaura maal phir
          <main> ke andar khisakta hai -- jo pehle se overflow-y-auto hai,
          aur CSS ke qaide se us ka overflow-x bhi khud auto ho jata hai.
          Yani table apne dabbe mein khisakti hai, poora safha nahi. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {showSidebar ? (
          <Topbar
            subtitle={t("at_website_admin", lang)}
            searchAction="/admin/dashboard"
            searchPlaceholder="Search..."
            notificationsHref="/admin/contact-messages"
            navGroups={navGroups}
            lang={lang}
          />
        ) : (
          <CompactNav lang={lang} showPos={showPos} homeHref={homePageForRole(role)} />
        )}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
          <p className="mt-8 text-center text-[11px] text-surface-400">{t("at_footer", lang)}</p>
        </main>
      </div>
      <Suspense fallback={null}><NavProgress /></Suspense>
      {user && <AssistantPanel />}
      {user && (
        <Suspense fallback={null}>
          <GuideOverlay />
        </Suspense>
      )}
    </div>
    </LangProvider>
  );
}