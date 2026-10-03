import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bell, Boxes, CheckCircle2, Grid2X2, Home, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { LangProvider } from "@/lib/i18n/lang-context";
import { iconByName } from "@/lib/access/icons";

export const dynamic = "force-dynamic";

const GROUP_TONES = [
  "from-emerald-500 to-green-700",
  "from-blue-500 to-indigo-700",
  "from-amber-500 to-orange-700",
  "from-cyan-500 to-teal-700",
  "from-violet-500 to-purple-700",
  "from-rose-500 to-red-700",
];

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
                <p className="truncate font-display text-lg font-bold tracking-tight">AgriBridge <span className="text-emerald-300">OS</span></p>
                <p className="truncate text-[11px] text-surface-300">Owner / Admin My Home · {me.full_name || roleLabel}</p>
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

          <div className="space-y-8">
            {groups.map((group, groupIndex) => {
              const tone = GROUP_TONES[groupIndex % GROUP_TONES.length];
              return (
                <section key={group.key}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-sm`}><LayoutGrid className="h-4 w-4" /></span>
                    <div><h2 className="font-display text-lg font-bold">{group.label}</h2><p className="text-xs text-surface-500">{group.items.length} active options</p></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {group.items.map((item) => {
                      const Icon = iconByName(item.icon);
                      return (
                        <Link key={`${group.key}-${item.href}`} href={item.href} className="group rounded-2xl border border-surface-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg dark:border-surface-800 dark:bg-surface-900 dark:hover:border-emerald-700">
                          <div className="flex items-start justify-between gap-3">
                            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-sm`}><Icon className="h-5 w-5" /></span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</span>
                          </div>
                          <h3 className="mt-4 line-clamp-2 min-h-[2.75rem] text-base font-bold text-surface-900 dark:text-white">{item.label}</h3>
                          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-surface-500 dark:text-surface-400">{item.description || "Is module ka kaam khol kar dekhein."}</p>
                          <div className="mt-4 flex items-center justify-between border-t border-surface-100 pt-3 text-xs font-bold text-emerald-700 dark:border-surface-800 dark:text-emerald-300"><span>Open Module</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {groups.length === 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm text-amber-800">Koi active module nahi mila. Admin se access check karwayein.</div>}
          <div className="mt-10 flex justify-center"><Link href="/admin/command-center" className="inline-flex items-center gap-2 rounded-xl bg-[#102e4d] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#173f66]"><Boxes className="h-4 w-4" /> Dashboard / Sidebar Admin Panel</Link></div>
        </main>
      </div>
    </LangProvider>
  );
}
