import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import Link from "next/link";
import {
  ShoppingCart, Package, ShoppingBag, BarChart2, Landmark,
  Warehouse, Wheat, Droplets, Users, BookOpen, Settings,
  Monitor, Truck, Store, ClipboardList, CreditCard,
  Building2, BriefcaseMedical, LayoutDashboard, Star,
} from "lucide-react";

export const dynamic = "force-dynamic";

// ── Module card definition ──────────────────────────────────────────────
interface PortalModule {
  label: string;
  route: string;
  // Sirf ye route(s) mein se koi bhi allowed ho to card dikhe
  checkRoutes: string[];
  icon: React.ElementType;
  color: string; // Tailwind bg class (card background)
  textColor: string;
  section: "main" | "ops";
}

const PORTAL_MODULES: PortalModule[] = [
  // ── Main Section ───────────────────────────────────────────────────────
  {
    label: "Counter / POS",
    route: "/admin/pos",
    checkRoutes: ["/admin/pos"],
    icon: ShoppingCart,
    color: "bg-orange-500",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Products",
    route: "/admin/products",
    checkRoutes: ["/admin/products", "/admin/products/setup"],
    icon: Package,
    color: "bg-emerald-600",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Purchases",
    route: "/admin/purchases",
    checkRoutes: ["/admin/purchases"],
    icon: ShoppingBag,
    color: "bg-blue-600",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Finance",
    route: "/admin/shaam-ka-hisaab",
    checkRoutes: ["/admin/shaam-ka-hisaab", "/admin/finance", "/admin/cash-close"],
    icon: Landmark,
    color: "bg-green-700",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Bikri / Reports",
    route: "/admin/reports/sales",
    checkRoutes: ["/admin/reports/sales", "/admin/reports"],
    icon: BarChart2,
    color: "bg-teal-600",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Kisan",
    route: "/admin/farmers",
    checkRoutes: ["/admin/farmers"],
    icon: Wheat,
    color: "bg-lime-600",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Milk Collection",
    route: "/admin/milk-collection",
    checkRoutes: ["/admin/milk-collection"],
    icon: Droplets,
    color: "bg-sky-500",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Warehouse",
    route: "/admin/stock-transfers",
    checkRoutes: ["/admin/stock-transfers", "/admin/stock-count"],
    icon: Warehouse,
    color: "bg-amber-700",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Staff / HR",
    route: "/admin/users",
    checkRoutes: ["/admin/users", "/admin/my-hr", "/admin/my-attendance"],
    icon: Users,
    color: "bg-yellow-500",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Customers",
    route: "/admin/crm",
    checkRoutes: ["/admin/crm", "/admin/buyers"],
    icon: Store,
    color: "bg-pink-500",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Machinery",
    route: "/admin/machinery-rental",
    checkRoutes: ["/admin/machinery-rental"],
    icon: BriefcaseMedical,
    color: "bg-purple-600",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Academy",
    route: "/admin/academy",
    checkRoutes: ["/admin/academy"],
    icon: BookOpen,
    color: "bg-indigo-500",
    textColor: "text-white",
    section: "main",
  },
  {
    label: "Command Center",
    route: "/admin/command-center",
    checkRoutes: ["/admin/command-center"],
    icon: Monitor,
    color: "bg-gray-800",
    textColor: "text-white",
    section: "main",
  },
  // ── Ops Section ───────────────────────────────────────────────────────
  {
    label: "Stock Ledger",
    route: "/admin/stock-ledger",
    checkRoutes: ["/admin/stock-ledger"],
    icon: ClipboardList,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Cash Handover",
    route: "/admin/cash-handover",
    checkRoutes: ["/admin/cash-handover"],
    icon: CreditCard,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Branches",
    route: "/admin/branches",
    checkRoutes: ["/admin/branches"],
    icon: Building2,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Suppliers",
    route: "/admin/suppliers",
    checkRoutes: ["/admin/suppliers"],
    icon: Truck,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Dealers",
    route: "/admin/dealers",
    checkRoutes: ["/admin/dealers"],
    icon: Store,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Settings",
    route: "/admin/settings",
    checkRoutes: ["/admin/settings"],
    icon: Settings,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Master Dashboard",
    route: "/admin/master-dashboard",
    checkRoutes: ["/admin/master-dashboard"],
    icon: LayoutDashboard,
    color: "bg-surface-100 dark:bg-surface-800",
    textColor: "text-surface-800 dark:text-surface-100",
    section: "ops",
  },
  {
    label: "Mera Kaam",
    route: "/admin/my-work",
    checkRoutes: ["/admin/my-work"],
    icon: Star,
    color: "bg-violet-500",
    textColor: "text-white",
    section: "ops",
  },
];

// ── Page ────────────────────────────────────────────────────────────────
export default async function PortalPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me) redirect("/login");

  const nav = await loadNav(user.id, me.role, lang);
  const allowedSet = nav.unrestricted
    ? null
    : new Set(nav.allowedRoutes);

  function isAllowed(checkRoutes: string[]): boolean {
    if (!allowedSet) return true; // unrestricted (owner/admin)
    return checkRoutes.some((r) => allowedSet.has(r) || [...allowedSet].some((a) => a === r || a.startsWith(r + "/")));
  }

  const mainModules = PORTAL_MODULES.filter((m) => m.section === "main" && isAllowed(m.checkRoutes));
  const opsModules  = PORTAL_MODULES.filter((m) => m.section === "ops"  && isAllowed(m.checkRoutes));

  const displayName = me.full_name?.split(" ")[0] ?? "Staff";
  const roleLabel = me.role
    ? me.role.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "";

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          {/* Logo placeholder — same as main nav */}
          <span className="text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
            AgriBridge
          </span>
          <span className="rounded bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
            OS
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400">
          <span>{displayName} · <span className="text-surface-400 dark:text-surface-500">{roleLabel}</span></span>
          <Link
            href="/admin/my-work"
            className="rounded-md border border-surface-200 dark:border-surface-700 px-3 py-1.5 text-xs font-medium hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
          >
            Mera Kaam
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* ── Title ── */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50">AgriBridge OS</h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Apna module chunein
          </p>
        </div>

        {/* ── Main Modules Grid ── */}
        {mainModules.length > 0 && (
          <section className="mb-8">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {mainModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.route}
                    href={mod.route}
                    className="group flex flex-col items-center gap-2.5 rounded-xl p-4 transition-all hover:scale-105 hover:shadow-md active:scale-95"
                  >
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl ${mod.color} shadow-sm transition-shadow group-hover:shadow-md`}
                    >
                      <Icon size={26} className={mod.textColor} strokeWidth={1.8} />
                    </div>
                    <span className="text-center text-xs font-medium leading-tight text-surface-700 dark:text-surface-300">
                      {mod.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Ops / Quick Links ── */}
        {opsModules.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wide">
              Quick Links
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {opsModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.route}
                    href={mod.route}
                    className="group flex flex-col items-center gap-2 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-3 transition-all hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm active:scale-95"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800 transition-colors group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30">
                      <Icon size={20} className="text-surface-600 dark:text-surface-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" strokeWidth={1.8} />
                    </div>
                    <span className="text-center text-[11px] font-medium leading-tight text-surface-600 dark:text-surface-400">
                      {mod.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
