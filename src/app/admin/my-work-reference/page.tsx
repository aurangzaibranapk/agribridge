import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadNav, routeAllowed } from "@/lib/access/nav";
import { loadNeedsAttention, filterAttention, type AttentionItem } from "@/lib/access/needs-attention";
import { buildMyWork, loadFourthKpi, loadRecentActivity } from "@/lib/access/my-work";
import { departmentForRole } from "@/lib/departments";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { HelpButton } from "@/components/help/help-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitch } from "@/components/ui/language-switch";
import { LogoutButton } from "@/components/layout/logout-button";
import * as I from "lucide-react";

export const dynamic = "force-dynamic";

type IconType = React.ComponentType<{ className?: string }>;
type SideLink = { label: string; href: string; icon: IconType };
type Notice = { id: string; title: string; message: string; link_url: string | null; is_read: boolean; created_at: string };

const deptIcons: Record<string, IconType> = {
  milk: I.Droplets,
  dairy: I.Droplets,
  grain: I.Wheat,
  machinery: I.Wrench,
  sales: I.ShoppingCart,
  finance: I.Landmark,
  hr: I.Users,
  inventory: I.Boxes,
  purchase: I.PackageSearch,
};

function safeSum(items: AttentionItem[]): number | null {
  if (items.some((x) => x.count == null)) return null;
  return items.reduce((sum, x) => sum + (x.count ?? 0), 0);
}

function relativeTime(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} hours ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function noticeIcon(title: string): IconType {
  const s = title.toLowerCase();
  if (s.includes("milk")) return I.Droplets;
  if (s.includes("order")) return I.ShoppingCart;
  if (s.includes("payment")) return I.Banknote;
  if (s.includes("stock")) return I.PackageSearch;
  if (s.includes("expense")) return I.ReceiptText;
  if (s.includes("farmer")) return I.UserRound;
  return I.Bell;
}

export default async function MyWorkReferencePage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name,role,branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const nav = await loadNav(user.id, me.role, lang);
  const allowed = nav.unrestricted ? null : nav.allowedRoutes;
  const groups = nav.groups.filter((g) => g.items.length > 0);
  const model = await buildMyWork(groups, allowed, me.role, lang);
  const attention = filterAttention(await loadNeedsAttention(), allowed);

  const [branchResult, fourth, recent, noticeResult, unreadResult] = await Promise.all([
    me.branch_id
      ? supabase.from("branches").select("name").eq("id", me.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    loadFourthKpi(me.branch_id, allowed, lang),
    loadRecentActivity(me.branch_id, allowed),
    supabase
      .from("notifications")
      .select("id,title,message,link_url,is_read,created_at")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(9),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false),
  ]);

  const branch = branchResult.data;
  const notices = (noticeResult.data ?? []) as Notice[];
  const unreadCount = unreadResult.count ?? 0;
  const can = (path: string) => allowed === null || routeAllowed(allowed, path);
  const role = (me.role || "")
    .split("_")
    .map((x: string) => x ? x[0].toUpperCase() + x.slice(1) : x)
    .join(" ");
  const dept = departmentForRole(me.role);
  const allItems = groups.flatMap((g) => g.items);
  const firstPrefix = (prefix: string) => allItems.find((x) => x.href.startsWith(prefix))?.href ?? null;

  const sideLinks: SideLink[] = [
    can("/admin/pos") && { label: "POS", href: "/admin/pos", icon: I.ShoppingCart },
    can("/admin/kharche") && { label: "Paisa & Khata", href: "/admin/kharche", icon: I.WalletCards },
    can("/admin/farmers") && { label: "Farmers", href: "/admin/farmers", icon: I.UsersRound },
    can("/admin/products") && { label: "Products", href: "/admin/products", icon: I.Package },
    can("/admin/agri-orders") && { label: "Orders", href: "/admin/agri-orders", icon: I.ClipboardList },
    firstPrefix("/admin/milk-collection") && { label: "Milk", href: firstPrefix("/admin/milk-collection")!, icon: I.Droplets },
    firstPrefix("/admin/grain") && { label: "Grain", href: firstPrefix("/admin/grain")!, icon: I.Wheat },
    firstPrefix("/admin/machinery-rental") && { label: "Machinery", href: firstPrefix("/admin/machinery-rental")!, icon: I.Wrench },
    (can("/admin/pos") || can("/admin/agri-orders")) && { label: "Sales & Retail", href: can("/admin/pos") ? "/admin/pos" : "/admin/agri-orders", icon: I.ShoppingCart },
    (can("/admin/finance") || can("/admin/kharche")) && { label: "Finance", href: can("/admin/finance") ? "/admin/finance" : "/admin/kharche", icon: I.Landmark },
    can("/admin/reports") && { label: "Reports", href: "/admin/reports", icon: I.BarChart3 },
  ].filter(Boolean) as SideLink[];

  const pendingApprovals = safeSum(attention.filter((x) => x.tone === "amber"));
  const myOpenTasks = safeSum(attention);
  const urgentToday = safeSum(attention.filter((x) => x.tone === "red"));
  const kpis = [
    { label: "Pending Approvals", value: pendingApprovals, icon: I.UserCheck, box: "bg-emerald-50 text-emerald-700" },
    { label: "My Open Tasks", value: myOpenTasks, icon: I.ClipboardCheck, box: "bg-emerald-50 text-emerald-700" },
    { label: "Urgent Today", value: urgentToday, icon: I.Clock3, box: "bg-red-50 text-red-600" },
    { label: fourth?.label ?? "Role Summary", value: fourth?.value ?? null, icon: I.Users, box: "bg-blue-50 text-blue-600" },
  ];

  const quick = [
    can("/admin/kharche") && ["/admin/kharche", "Add Expense / Payment", I.WalletCards],
    can("/admin/farmers") && ["/admin/farmers", "Add Farmer", I.UserPlus],
    can("/admin/agri-orders") && ["/admin/agri-orders", "Create Order", I.ShoppingCart],
    can("/admin/load-bill") && ["/admin/load-bill", "Receive Payment", I.Banknote],
  ].filter(Boolean) as [string, string, IconType][];

  const now = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  return (
    <div className="fixed inset-0 z-30 overflow-auto bg-[#f7faf8] text-surface-900 dark:bg-surface-950 dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[214px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen border-r border-surface-200 bg-white lg:flex lg:flex-col dark:border-surface-800 dark:bg-surface-900">
          <div className="flex h-[66px] items-center gap-2 border-b border-surface-100 px-5 dark:border-surface-800">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-white"><I.Leaf className="h-5 w-5" /></span>
            <div>
              <p className="text-[20px] font-bold leading-5 text-emerald-700">AgriBridge</p>
              <p className="mt-1 text-[8px] text-surface-400">Connecting Farmers, Business & Technology</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4">
            <Link href="/admin/my-work-reference" className="mb-1 flex h-11 items-center gap-3 rounded-xl bg-emerald-50 px-3 text-[13px] font-semibold text-emerald-800">
              <I.Home className="h-[18px] w-[18px]" /> My Work
            </Link>
            {sideLinks.map(({ label, href, icon: Icon }) => (
              <Link key={`${label}-${href}`} href={href} className="mb-0.5 flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] text-surface-700 hover:bg-surface-50 dark:text-surface-300 dark:hover:bg-surface-800">
                <Icon className="h-[17px] w-[17px] text-emerald-700" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-surface-100 px-3 py-3 dark:border-surface-800">
            <Link href="/admin/my-hr" className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] text-surface-700 hover:bg-surface-50 dark:text-surface-300"><I.UserRound className="h-[17px] w-[17px]" />My Profile</Link>
            {can("/admin/settings") && <Link href="/admin/settings" className="flex h-10 items-center gap-3 rounded-lg px-3 text-[13px] text-surface-700 hover:bg-surface-50 dark:text-surface-300"><I.Settings className="h-[17px] w-[17px]" />Settings</Link>}
            <div className="flex min-h-10 items-center gap-2 px-2"><HelpButton /><span className="text-[13px] text-surface-700 dark:text-surface-300">Help & Support</span></div>
            <div className="flex h-10 items-center gap-2 px-2"><LogoutButton /><span className="text-[13px] text-surface-700 dark:text-surface-300">Logout</span></div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-[66px] items-center border-b border-surface-200 bg-white px-4 dark:border-surface-800 dark:bg-surface-900">
            <button type="button" className="mr-4 rounded-lg p-2 text-surface-600"><I.Menu className="h-5 w-5" /></button>
            <div className="hidden h-10 w-full max-w-[600px] items-center gap-2 rounded-xl bg-surface-50 px-4 text-surface-400 md:flex dark:bg-surface-800">
              <I.Search className="h-4 w-4" />
              <span className="text-[12px]">Search farmers, products, orders, etc...</span>
              <span className="ml-auto rounded-md bg-white px-2 py-1 text-[10px] text-surface-500 shadow-sm dark:bg-surface-900">Ctrl + K</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <HelpButton compact />
              <NotificationBell initialCount={unreadCount} href="/admin/notifications" />
              <ThemeToggle />
              <div className="hidden sm:block"><LanguageSwitch current={lang} /></div>
              <div className="ml-2 flex items-center gap-2 border-l border-surface-200 pl-3 dark:border-surface-700">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">{(me.full_name || "U").trim().charAt(0).toUpperCase()}</span>
                <div className="hidden xl:block">
                  <p className="max-w-[160px] truncate text-[12px] font-semibold">{me.full_name}</p>
                  <p className="max-w-[180px] truncate text-[9px] text-surface-500">{[role, branch?.name].filter(Boolean).join(" · ")}</p>
                </div>
                <I.ChevronDown className="hidden h-4 w-4 text-surface-400 xl:block" />
              </div>
            </div>
          </header>

          <div className="p-4 xl:p-5">
            <div className="mx-auto max-w-[1320px]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[25px] font-bold tracking-tight">Good evening, {me.full_name} 👋</h1>
                  <p className="mt-1 text-[12px] text-surface-500">{[role, dept?.label, branch?.name].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex items-center gap-2 text-[12px] font-medium text-surface-600 dark:text-surface-300"><I.CalendarDays className="h-4 w-4" />{now}</div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                <main className="min-w-0 space-y-3">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {kpis.map(({ label, value, icon: Icon, box }) => (
                      <div key={label} className="flex min-h-[82px] items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 dark:border-surface-800 dark:bg-surface-900">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${box}`}><Icon className="h-5 w-5" /></span>
                        <div className="min-w-0"><p className="text-[24px] font-bold leading-none">{value ?? "—"}</p><p className="mt-2 truncate text-[11px] text-surface-500">{label}</p></div>
                      </div>
                    ))}
                  </div>

                  <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-white"><I.Check className="h-5 w-5" /></span><div><p className="text-[13px] font-semibold">{urgentToday && urgentToday > 0 ? "Important work needs your attention." : "No urgent work pending today."}</p><p className="text-[10px] text-surface-500">{myOpenTasks == null ? "Task count is currently unavailable." : myOpenTasks > 0 ? `${myOpenTasks} item(s) need review.` : "You're up to date! Keep up the good work."}</p></div></div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-surface-500"><span>Quick Access:</span>{quick.slice(0,4).map(([href, label]) => <Link key={href} href={href} className="rounded-lg bg-white px-2.5 py-1.5 font-medium text-surface-700 shadow-sm dark:bg-surface-900 dark:text-surface-200">{label}</Link>)}</div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                      <div className="mb-3 flex items-start justify-between"><div><h2 className="flex items-center gap-2 text-[14px] font-bold"><I.Map className="h-4 w-4" />Your Departments</h2><p className="mt-1 text-[10px] text-surface-500">Quick access to your daily work</p></div></div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {model.departments.slice(0, 6).map((d: any) => { const Icon = deptIcons[d.key] || I.LayoutGrid; const href = d.tools?.[0]?.href; const card = <><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon className="h-4 w-4" /></span><span className="truncate text-[11px] font-medium">{d.label}</span><I.ChevronRight className="ml-auto h-4 w-4 text-surface-300" /></>; return href ? <Link key={d.key} href={href} className="flex min-h-[68px] items-center gap-2 rounded-xl border border-surface-200 px-3 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800">{card}</Link> : <div key={d.key} className="flex min-h-[68px] items-center gap-2 rounded-xl border border-surface-200 px-3 dark:border-surface-800">{card}</div>; })}
                      </div>
                    </section>

                    <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-bold"><I.ClipboardList className="h-4 w-4" />Today's Tasks</h2><Link href="/admin/my-work" className="text-[10px] font-semibold text-emerald-700">View All</Link></div>
                      <div className="divide-y divide-surface-100 dark:divide-surface-800">
                        {attention.slice(0, 4).map((a) => <Link href={a.href} key={a.key} className="flex min-h-[48px] items-center gap-3 py-2"><span className={`h-2.5 w-2.5 rounded-full ${a.tone === "red" ? "bg-red-500" : a.tone === "amber" ? "bg-amber-400" : "bg-blue-400"}`} /><div className="min-w-0"><p className="truncate text-[11px] font-semibold">{t(a.label, lang)}</p><p className="text-[10px] text-surface-400">{a.count == null ? "Count unavailable" : `${a.count} pending`}</p></div><I.ChevronRight className="ml-auto h-4 w-4 text-surface-300" /></Link>)}
                        {attention.length === 0 && <p className="py-10 text-center text-[11px] text-surface-400">No pending tasks.</p>}
                      </div>
                    </section>

                    <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                      <div className="mb-2 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-bold"><I.History className="h-4 w-4" />Recent Activity</h2></div>
                      <div className="divide-y divide-surface-100 dark:divide-surface-800">
                        {recent.slice(0, 4).map((a: any) => <div key={a.key} className="flex min-h-[48px] items-center gap-3 py-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><I.ReceiptText className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate text-[11px] font-semibold">{t(a.labelKey, lang)}</p><p className="truncate text-[10px] text-surface-400">{a.subtitle || ""}</p></div>{a.amount != null && <span className="ml-auto text-[11px] font-bold">Rs {Number(a.amount).toLocaleString()}</span>}</div>)}
                        {recent.length === 0 && <p className="py-10 text-center text-[11px] text-surface-400">No recent activity.</p>}
                      </div>
                    </section>

                    <section className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
                      <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold"><I.Zap className="h-4 w-4" />Quick Actions</h2>
                      <div className="grid grid-cols-2 gap-2">{quick.map(([href, label, Icon], index) => <Link key={href} href={href} className={`flex min-h-[54px] items-center gap-3 rounded-xl px-4 text-[11px] font-semibold ${index === 0 ? "bg-emerald-50 text-emerald-800" : "bg-surface-50 text-surface-700 dark:bg-surface-800 dark:text-surface-200"}`}><Icon className="h-5 w-5" />{label}</Link>)}</div>
                    </section>
                  </div>
                </main>

                <aside className="h-fit overflow-hidden rounded-xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
                  <div className="flex items-center justify-between border-b border-surface-100 px-4 py-4 dark:border-surface-800"><h2 className="flex items-center gap-2 text-[14px] font-bold"><I.Bell className="h-4 w-4 text-emerald-700" />Live Notifications {unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</h2><Link href="/admin/notifications" className="text-[10px] font-semibold text-emerald-700">View All</Link></div>
                  <div className="divide-y divide-surface-100 dark:divide-surface-800">
                    {notices.map((n) => { const Icon = noticeIcon(n.title); const body = <div className="flex gap-3 px-3 py-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${n.is_read ? "bg-surface-100 text-surface-500" : "bg-emerald-50 text-emerald-700"}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex gap-2"><p className={`min-w-0 flex-1 truncate text-[10px] ${n.is_read ? "font-medium" : "font-semibold"}`}>{n.title}</p><span className="shrink-0 text-[8px] text-surface-400">{relativeTime(n.created_at)}</span></div><p className="mt-1 line-clamp-2 text-[9px] leading-4 text-surface-500">{n.message}</p></div></div>; return n.link_url ? <Link key={n.id} href={n.link_url}>{body}</Link> : <div key={n.id}>{body}</div>; })}
                    {notices.length === 0 && <p className="px-4 py-12 text-center text-[11px] text-surface-400">No notifications.</p>}
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
