import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MessagesWidget } from "@/components/layout/messages-widget";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { homePageForRole } from "@/lib/departments";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
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
    const nav = await loadNav(user.id, role);
    navGroups = nav.groups;
    allowedPages = nav.unrestricted ? null : nav.allowedRoutes;
  }
  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar subtitle="Website Admin" homeHref={homePageForRole(role)} role={role} allowedPages={allowedPages} groups={navGroups} />
      <div className="flex flex-1 flex-col">
        <Topbar
          subtitle="Website Admin"
          searchAction="/admin/dashboard"
          searchPlaceholder="Search..."
          notificationsHref="/admin/contact-messages"
          navGroups={navGroups}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      {user && <MessagesWidget />}
    </div>
  );
}