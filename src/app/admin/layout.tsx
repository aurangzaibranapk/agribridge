import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MessagesWidget } from "@/components/layout/messages-widget";
import { createClient } from "@/lib/supabase/server";
import { effectiveAccess } from "@/lib/effective-permissions";
import { homePageForRole } from "@/lib/departments";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role = "";
  let allowedPages: string[] | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role, allowed_pages").eq("id", user.id).single();
    role = profile?.role ?? "";
    // Menu wahi hisaab istemal karta hai jo rok istemal karti hai --
    // shakhs ka apna set, warna us ke department ka. Do jagah alag
    // hisaab hota to banda menu mein cheez dekhta magar khol na pata.
    const access = await effectiveAccess(role, (profile?.allowed_pages as string[] | null) ?? null);
    allowedPages = access.unrestricted ? null : access.pages;
  }
  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      <Sidebar subtitle="Website Admin" homeHref={homePageForRole(role)} role={role} allowedPages={allowedPages} />
      <div className="flex flex-1 flex-col">
        <Topbar
          subtitle="Website Admin"
          searchAction="/admin/dashboard"
          searchPlaceholder="Search..."
          notificationsHref="/admin/contact-messages"
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      {user && <MessagesWidget />}
    </div>
  );
}