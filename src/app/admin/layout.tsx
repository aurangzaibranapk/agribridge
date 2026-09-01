import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MessagesWidget } from "@/components/layout/messages-widget";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { homePageForRole } from "@/lib/departments";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
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
  let navGroups: { key: string; label: string; items: { href: string; label: string; icon: string | null }[] }[] = [];
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? "";
    // Menu ab database se banta hai. Rok bhi wahi fehrist parhti hai --
    // do jagah alag hisaab hota to banda menu mein cheez dekhta aur khol
    // na pata.
    const nav = await loadNav(user.id, role, lang);
    navGroups = nav.groups;
    allowedPages = nav.unrestricted ? null : nav.allowedRoutes;
  }
  // Zaban poore admin panel ke liye ek hi jagah se. Andar ke saare
  // client components isi se parhte hain -- kisi ko prop bhejne ki
  // zaroorat nahi, aur cookie browser mein parhne wala jhatka bhi nahi
  // aata (dekhein lang-context.tsx).
  return (
    <LangProvider lang={lang}>
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar subtitle="Website Admin" homeHref={homePageForRole(role)} role={role} allowedPages={allowedPages} groups={navGroups} />
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
        <Topbar
          subtitle="Website Admin"
          searchAction="/admin/dashboard"
          searchPlaceholder="Search..."
          notificationsHref="/admin/contact-messages"
          navGroups={navGroups}
          lang={lang}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      {user && <MessagesWidget />}
    </div>
    </LangProvider>
  );
}