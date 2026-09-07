import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ChromeGate } from "@/components/layout/chrome-gate";
import { Suspense } from "react";
import { GuideOverlay } from "@/components/guided/guide-overlay";
import { CompactNav } from "@/components/layout/compact-nav";
import { WorkSidebar, type SideItem } from "@/components/layout/work-sidebar";
import { QUICK_BY_ROLE } from "@/lib/access/my-work";
import { AssistantPanel } from "@/components/layout/assistant-panel";
import { NavProgress } from "@/components/layout/nav-progress";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { sidebarModeFor, type SidebarKind } from "@/lib/access/sidebar-free";
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
  // Owner/Admin -- in ke liye department wale card aur chhoti quick
  // fehrist barqarar rehti hai.
  let unrestricted = false;
  let showSidebar = true;
  /** "work" = staff wali chhoti sidebar, "none" = sirf cards. */
  let sidebarKind: SidebarKind = "full";
  let showPos = false;
  let navGroups: { key: string; label: string; icon?: string | null; items: { href: string; label: string; icon: string | null }[] }[] = [];
  // POORA khana try ke andar.
  //
  // Layout ke OOPER koi error boundary nahi hoti -- `admin/error.tsx`
  // sirf us ke ANDAR ke safhon ko pakarta hai. Is liye yahan se phenki
  // gayi koi bhi ghalti seedha ek SAADA "Internal Server Error" banti
  // hai: poora admin band, aur screen par ek harf bhi aisa nahi jis se
  // pata chale ke masla kya hai.
  //
  // 6 September ko bilkul yehi hua tha. `loadNav()` mein service client
  // try se BAHAR banta tha, aur wo `SUPABASE_SERVICE_ROLE_KEY` na hone
  // par phenkta hai.
  //
  // Wo ek jagah theek ho chuki, magar sirf usi jagah ko theek kar dena
  // kaafi nahi: kal koi doosri lakeer wahi kaam kar sakti hai. Is liye
  // ab poora khana yahan pakra jata hai. Nakami par banda ANDAR aata
  // hai -- fallback menu ke sath -- aur wajah server ke log mein jati
  // hai.
  //
  // Ye ghalti chhupana NAHI hai: fallback menu khud bata deta hai ke
  // kuch kam hai, aur log mein poori wajah likhi hoti hai. Chhupana wo
  // hota agar hum khali sidebar dikha kar chup ho jate.
  try {
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? "";
    // Menu ab database se banta hai. Rok bhi wahi fehrist parhti hai --
    // do jagah alag hisaab hota to banda menu mein cheez dekhta aur khol
    // na pata.
    const nav = await loadNav(user.id, role, lang);
    navGroups = nav.groups;
    unrestricted = nav.unrestricted;
    allowedPages = nav.unrestricted ? null : nav.allowedRoutes;

    // Sidebar ka faisla ijazat ki GINTI par hai (malik ka usool, 5
    // September). Ginti wahi hai jo neeche cards banati hai -- ek hi
    // fehrist se, taake sidebar aur cards kabhi alag alag hisaab na
    // lagayen.
    const kitne = new Set(nav.groups.flatMap((g) => g.items.map((i) => i.href))).size;
    const mode = await sidebarModeFor(role, kitne);
    showSidebar = mode.showSidebar;
    sidebarKind = mode.kind;
    // Patti par POS ka raasta bhi usi ijazat par lagta hai jis par
    // menu lagta hai -- do jagah alag hisaab hota to banda patti par
    // POS dekhta aur khol na pata.
    showPos = nav.unrestricted || routeAllowed(nav.allowedRoutes, "/admin/pos");
  }
  } catch (e) {
    console.error(
      "admin layout: menu bana nahi -- fallback par chal raha hai:",
      e instanceof Error ? e.message : e
    );
    // navGroups khali reh jayen to sidebar khali dikhti. Aisi soorat mein
    // banda "Mera Kaam" se apna raasta dhoondh leta hai, aur poora daftar
    // ruka nahi rehta.
    showSidebar = false;
    sidebarKind = "none";
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

  /**
   * Staff ka SAARA kaam sidebar mein -- chhe tak mehdood nahi.
   *
   * Malik (6 September), teen alag paighaam, ek hi baat:
   *
   *   *"Farmers jab sidebar mein aa raha hai to Milk tag kyun hai —
   *   staff ke paas nahi hona chahiye."*
   *   *"Grain ka tag hi nahi banta... to sidebar mein hi aa jaye."*
   *   *"Sales & Retail mein jo jo staff ko dena hai already sidebar mein
   *   hai, to ye sara yahan kyun aa raha hai?"*
   *
   * Wajah ye thi: sidebar sirf CHHE kaam dikhata tha (`QUICK_BY_ROLE`
   * ki tayyar fehrist se). Baqi kaam ke liye "department" ke card bante
   * the -- aur wo card us dashboard ke naam se aate the jis se wo kaam
   * juRa hua hota hai. Is liye ek "Farmers" ki wajah se poora **Milk**
   * ka department nazar aa jata tha, aur ek "Produce Orders" ki wajah se
   * **Grain** ka -- jab ke dukan ka salesman na doodh ka hai na anaj ka.
   *
   * Ab jis bande ki ijazat mehdood hai, us ka HAR kaam sidebar mein aa
   * jata hai, aur department wale card us ke liye bante hi nahi. Owner,
   * Admin aur Manager ke liye wo card waise hi rehte hain -- wo waqai
   * department se department chalte hain.
   */
  const quickSide: SideItem[] = unrestricted
    ? (QUICK_BY_ROLE[role] ?? [])
        .map((k) => byHref.get(`/admin/${k.replace(/\./g, "/")}`))
        .filter((i): i is SideItem => !!i)
        .slice(0, 6)
    : (() => {
        // Pehle wo kaam jo is ohde ke liye chune hue hain (tarteeb wahi
        // rehti hai), phir baqi sab -- taake roz wala kaam upar rahe.
        const chune = (QUICK_BY_ROLE[role] ?? [])
          .map((k) => byHref.get(`/admin/${k.replace(/\./g, "/")}`))
          .filter((i): i is SideItem => !!i);
        const chuneHue = new Set(chune.map((i) => i.href));
        const baqi = uniqueItems.filter(
          (i) => !chuneHue.has(i.href) && i.href !== "/admin/my-work" && i.href !== "/admin/my-hr"
        );
        return [...chune, ...baqi];
      })();

  const deptSide: SideItem[] = unrestricted
    ? navGroups
        .filter((g) => g.key !== "master" && g.items.length > 0)
        .map((g) => ({ href: `/admin/my-work#${g.key}`, label: g.label, icon: g.icon ?? "LayoutGrid" }))
    : [];

  const reportsSide = uniqueItems.filter((i) => i.href.startsWith("/admin/reports")).slice(0, 4);
  /**
   * Staff ka apna hissa -- EK darwaza, teen nahi.
   *
   * Malik (6 September): *"My HR mein staff ko apna sab kuch aana
   * chahiye. Alag se 'My Attendance', 'My Wallet' waghera kuch bhi nahi
   * aana chahiye — staff ko sab kuch us ke HR mein aana chahiye."*
   *
   * Wo theek keh rahe the. "Meri Hazri", "Mera Batwa" aur "Meri Ijazat"
   * teen alag naam the jo teenon ek hi cheez ke hissay hain: bande ka
   * apna record. Menu mein teen naam rakhne se banda har dafa sochta
   * hai ke kaun sa kholoon.
   *
   * Ab menu mein sirf **Mera HR** hai. Wo safha khud in teenon ka
   * darwaza hai (us par "Jaldi wale kaam" mein Meri hazri, Mera batwa,
   * Chhutti ki darkhwast, Kharcha claim -- sab maujood hain). Safhe
   * mitaye nahi gaye; sirf menu se un ke alag naam hataye gaye hain.
   */
  //
  // Fehrist se chhaan kar nahi, SEEDHA banaya ja raha hai: "Mera HR"
  // `ALWAYS` mein hai (har staff ko khulta hai) magar zaroori nahi ke wo
  // us bande ki feature wali fehrist mein bhi ho. Chhaan kar lene se wo
  // khana khali reh jata aur menu se ye hissa hi ghayab ho jata.
  const settingsSide: SideItem[] = [
    byHref.get("/admin/my-hr") ?? { href: "/admin/my-hr", label: "Mera HR", icon: "UserCircle" },
  ];

  return (
    <LangProvider lang={lang}>
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* Chhoti sidebar sirf us bande ko jise das se ZYADA safhe khulte
          hain. Us se kam par safha sirf cards ka rehta hai -- malik ka
          usool. */}
      {/* ChromeGate: Mera Kaam se ek safha "workspace" overlay ke andar
          khula ho (?workspace=1) to yahan sidebar dobara nahi banti --
          overlay ka apna Wapas/title header hi kaafi hai. */}
      <Suspense fallback={null}>
        <ChromeGate>
          {sidebarKind === "work" && user && (
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
        </ChromeGate>
      </Suspense>
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
        <Suspense fallback={null}>
          <ChromeGate>
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
          </ChromeGate>
        </Suspense>
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