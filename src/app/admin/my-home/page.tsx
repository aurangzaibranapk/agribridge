import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Boxes, CheckCircle2, Grid2X2, Home } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { AGRIBRIDGE_OS_RELEASE, AGRIBRIDGE_OS_VERSION } from "@/lib/app-version";
import { ModuleSearch } from "./module-search";

export const dynamic = "force-dynamic";

export default async function MyHomePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  const nav = await loadNav(user.id, me.role, lang);
  const groups = nav.groups.filter((group) => group.items.length > 0);
  const totalCards = groups.reduce((total, group) => total + group.items.length, 0);
  const roleLabel = String(me.role ?? "").split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  return (
    <LangProvider lang={lang}>
      <div className="min-h-screen bg-[#f5f8f6] text-surface-900 dark:bg-surface-950 dark:text-white">
        <header className="sticky top-0 z-20 border-b border-surface-200/80 bg-[#102e4d] text-white shadow-lg dark:border-surface-800">
          <div className="mx-auto flex min-h-[68px] w-full max-w-[1800px] items-center gap-3 px-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 shadow-inner shadow-emerald-900/30">
                <Home className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold tracking-tight">AgriBridge <span className="text-emerald-300">OS</span> <span className="ml-1 text-xs font-semibold text-emerald-200">{AGRIBRIDGE_OS_VERSION}</span></p>
                <p className="truncate text-[11px] text-surface-300">{AGRIBRIDGE_OS_RELEASE} · Owner / Admin My Home · {me.full_name || roleLabel}</p>
              </div>
            </div>

            <nav className="ml-2 flex items-center gap-2" aria-label="AgriBridge OS navigation">
              <Link href="/admin/my-home" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm ring-1 ring-emerald-300/50">
                <Home className="h-4 w-4" />
                <span className="hidden sm:inline">My Home</span>
              </Link>
              <Link href="/admin/command-center" className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/15">
                <Grid2X2 className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-3 text-xs text-surface-300">
              <Bell className="h-5 w-5" />
              <span className="hidden rounded-full border border-white/15 px-3 py-1.5 sm:inline">{roleLabel || "User"}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-7 sm:py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">AgriBridge OS Home</p>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Active Modules</h1>
              <p className="mt-1 max-w-2xl text-sm text-surface-500 dark:text-surface-400">Aap ke active permissions ke tamam ERP options ek jagah cards ki shakal mein.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm dark:border-emerald-900/40 dark:bg-surface-900">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"><CheckCircle2 className="h-5 w-5" /></span>
              <div><p className="text-sm font-bold">All systems operational</p><p className="text-xs text-surface-500">{groups.length} sections · {totalCards} active cards</p></div>
            </div>
          </div>

          <ModuleSearch groups={groups} />

          {groups.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800">Koi active module nahi mila. Admin se access check karwayein.</div>}
          <div className="mt-10 flex justify-center"><Link href="/admin/command-center" className="inline-flex items-center gap-2 rounded-xl bg-[#102e4d] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#173f66]"><Boxes className="h-4 w-4" /> Dashboard / Sidebar Admin Panel</Link></div>
        </main>
      </div>
    </LangProvider>
  );
}
