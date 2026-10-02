import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import Link from "next/link";
import {
  ShoppingCart, Package, ShoppingBag, BarChart2, Landmark,
  Warehouse, Wheat, Droplets, Users, BookOpen, Settings,
  Monitor, Truck, Store, ClipboardList, CreditCard,
  Building2, LayoutDashboard, Star, ChevronRight,
  BriefcaseMedical, Tractor, Wallet, FileText, MessageSquare,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface PortalModule {
  label: string;
  sublabel: string;
  route: string;
  checkRoutes: string[];
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconColor: string;
  section: "main" | "ops";
}

const PORTAL_MODULES: PortalModule[] = [
  // ── Main modules ──────────────────────────────────────────────────────
  {
    label: "Counter",
    sublabel: "POS / Bikri",
    route: "/admin/pos",
    checkRoutes: ["/admin/pos"],
    icon: ShoppingCart,
    gradient: "from-orange-500 to-orange-600",
    iconBg: "bg-orange-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Products",
    sublabel: "Maal ki fehrist",
    route: "/admin/products",
    checkRoutes: ["/admin/products", "/admin/products/setup"],
    icon: Package,
    gradient: "from-brand-600 to-brand-700",
    iconBg: "bg-brand-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Purchases",
    sublabel: "Maal khareedna",
    route: "/admin/purchases",
    checkRoutes: ["/admin/purchases"],
    icon: ShoppingBag,
    gradient: "from-blue-600 to-blue-700",
    iconBg: "bg-blue-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Finance",
    sublabel: "Hisaab kitaab",
    route: "/admin/shaam-ka-hisaab",
    checkRoutes: ["/admin/shaam-ka-hisaab", "/admin/finance", "/admin/cash-close"],
    icon: Landmark,
    gradient: "from-emerald-600 to-emerald-700",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Reports",
    sublabel: "Bikri / Tajzia",
    route: "/admin/reports/sales",
    checkRoutes: ["/admin/reports/sales", "/admin/reports"],
    icon: BarChart2,
    gradient: "from-teal-600 to-teal-700",
    iconBg: "bg-teal-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Kisan",
    sublabel: "Farmer ledger",
    route: "/admin/farmers",
    checkRoutes: ["/admin/farmers"],
    icon: Wheat,
    gradient: "from-lime-600 to-lime-700",
    iconBg: "bg-lime-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Milk",
    sublabel: "Doodh ka hisaab",
    route: "/admin/milk-collection",
    checkRoutes: ["/admin/milk-collection"],
    icon: Droplets,
    gradient: "from-sky-500 to-sky-600",
    iconBg: "bg-sky-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Warehouse",
    sublabel: "Stock / Godam",
    route: "/admin/stock-transfers",
    checkRoutes: ["/admin/stock-transfers", "/admin/stock-count"],
    icon: Warehouse,
    gradient: "from-amber-600 to-amber-700",
    iconBg: "bg-amber-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Customers",
    sublabel: "CRM / Gahak",
    route: "/admin/crm",
    checkRoutes: ["/admin/crm", "/admin/buyers"],
    icon: Store,
    gradient: "from-pink-500 to-pink-600",
    iconBg: "bg-pink-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Staff / HR",
    sublabel: "Mulazimeen",
    route: "/admin/users",
    checkRoutes: ["/admin/users", "/admin/my-hr", "/admin/my-attendance"],
    icon: Users,
    gradient: "from-yellow-500 to-yellow-600",
    iconBg: "bg-yellow-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Machinery",
    sublabel: "Kiraya / Booking",
    route: "/admin/machinery-rental",
    checkRoutes: ["/admin/machinery-rental"],
    icon: Tractor,
    gradient: "from-purple-600 to-purple-700",
    iconBg: "bg-purple-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Academy",
    sublabel: "Training / Seekhna",
    route: "/admin/academy",
    checkRoutes: ["/admin/academy"],
    icon: BookOpen,
    gradient: "from-indigo-500 to-indigo-600",
    iconBg: "bg-indigo-500/20",
    iconColor: "text-white",
    section: "main",
  },
  {
    label: "Command",
    sublabel: "Center / Admin",
    route: "/admin/command-center",
    checkRoutes: ["/admin/command-center"],
    icon: Monitor,
    gradient: "from-surface-700 to-surface-800",
    iconBg: "bg-surface-500/20",
    iconColor: "text-white",
    section: "main",
  },

  // ── Ops / Quick Links ─────────────────────────────────────────────────
  {
    label: "Mera Kaam",
    sublabel: "Pending tasks",
    route: "/admin/my-work",
    checkRoutes: ["/admin/my-work"],
    icon: Star,
    gradient: "",
    iconBg: "bg-violet-100 dark:bg-violet-900/30",
    iconColor: "text-violet-600 dark:text-violet-400",
    section: "ops",
  },
  {
    label: "Stock Ledger",
    sublabel: "Stock history",
    route: "/admin/stock-ledger",
    checkRoutes: ["/admin/stock-ledger"],
    icon: ClipboardList,
    gradient: "",
    iconBg: "bg-brand-50 dark:bg-brand-950/30",
    iconColor: "text-brand-600 dark:text-brand-400",
    section: "ops",
  },
  {
    label: "Cash Handover",
    sublabel: "Cash transfer",
    route: "/admin/cash-handover",
    checkRoutes: ["/admin/cash-handover"],
    icon: CreditCard,
    gradient: "",
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    section: "ops",
  },
  {
    label: "Suppliers",
    sublabel: "Suppliers list",
    route: "/admin/suppliers",
    checkRoutes: ["/admin/suppliers"],
    icon: Truck,
    gradient: "",
    iconBg: "bg-blue-50 dark:bg-blue-900/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    section: "ops",
  },
  {
    label: "Wallet",
    sublabel: "Staff wallet",
    route: "/admin/wallets",
    checkRoutes: ["/admin/wallets"],
    icon: Wallet,
    gradient: "",
    iconBg: "bg-green-50 dark:bg-green-900/20",
    iconColor: "text-green-600 dark:text-green-400",
    section: "ops",
  },
  {
    label: "Reports Hub",
    sublabel: "Saari reports",
    route: "/admin/reports",
    checkRoutes: ["/admin/reports"],
    icon: FileText,
    gradient: "",
    iconBg: "bg-teal-50 dark:bg-teal-900/20",
    iconColor: "text-teal-600 dark:text-teal-400",
    section: "ops",
  },
  {
    label: "Dealers",
    sublabel: "Dealer network",
    route: "/admin/dealers",
    checkRoutes: ["/admin/dealers"],
    icon: Store,
    gradient: "",
    iconBg: "bg-pink-50 dark:bg-pink-900/20",
    iconColor: "text-pink-600 dark:text-pink-400",
    section: "ops",
  },
  {
    label: "Branches",
    sublabel: "Shakha",
    route: "/admin/branches",
    checkRoutes: ["/admin/branches"],
    icon: Building2,
    gradient: "",
    iconBg: "bg-surface-100 dark:bg-surface-800",
    iconColor: "text-surface-600 dark:text-surface-300",
    section: "ops",
  },
  {
    label: "Messages",
    sublabel: "Contact / CRM",
    route: "/admin/messages",
    checkRoutes: ["/admin/messages", "/admin/contact-messages"],
    icon: MessageSquare,
    gradient: "",
    iconBg: "bg-surface-100 dark:bg-surface-800",
    iconColor: "text-surface-600 dark:text-surface-300",
    section: "ops",
  },
  {
    label: "Master",
    sublabel: "Dashboard",
    route: "/admin/master-dashboard",
    checkRoutes: ["/admin/master-dashboard"],
    icon: LayoutDashboard,
    gradient: "",
    iconBg: "bg-surface-100 dark:bg-surface-800",
    iconColor: "text-surface-600 dark:text-surface-300",
    section: "ops",
  },
  {
    label: "Settings",
    sublabel: "Tanzeem",
    route: "/admin/settings",
    checkRoutes: ["/admin/settings"],
    icon: Settings,
    gradient: "",
    iconBg: "bg-surface-100 dark:bg-surface-800",
    iconColor: "text-surface-600 dark:text-surface-300",
    section: "ops",
  },
];

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
  const allowedSet = nav.unrestricted ? null : new Set(nav.allowedRoutes);

  function isAllowed(checkRoutes: string[]): boolean {
    if (!allowedSet) return true;
    return checkRoutes.some((r) =>
      allowedSet.has(r) || [...allowedSet].some((a) => a === r || a.startsWith(r + "/"))
    );
  }

  const mainModules = PORTAL_MODULES.filter((m) => m.section === "main" && isAllowed(m.checkRoutes));
  const opsModules  = PORTAL_MODULES.filter((m) => m.section === "ops"  && isAllowed(m.checkRoutes));

  const firstName = me.full_name?.split(" ")[0] ?? "Staff";
  const roleLabel = me.role
    ? me.role.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "";

  // Home page link based on role
  const homePage = ["owner", "super_admin", "admin"].includes(me.role)
    ? "/admin/command-center"
    : "/admin/my-work";

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">

      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-surface-200/80 dark:border-surface-800 bg-white/90 dark:bg-surface-900/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
              <Wheat size={16} className="text-white" strokeWidth={2} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-bold tracking-tight text-surface-900 dark:text-surface-50">
                AgriBridge
              </span>
              <span className="rounded bg-brand-50 dark:bg-brand-950/50 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-brand-600 dark:text-brand-400 uppercase">
                OS
              </span>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-3 py-1.5">
              <div className="h-5 w-5 rounded-full bg-brand-600 flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{firstName.charAt(0).toUpperCase()}</span>
              </div>
              <span className="text-[12px] font-medium text-surface-700 dark:text-surface-300">{firstName}</span>
              <span className="text-[11px] text-surface-400">·</span>
              <span className="text-[11px] text-surface-400 dark:text-surface-500">{roleLabel}</span>
            </div>
            <Link
              href={homePage}
              className="flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-[12px] font-medium text-surface-700 dark:text-surface-300 hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              Dashboard
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero / Greeting ────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-700 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-brand-200 text-sm font-medium mb-1">AgriBridge OS</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Salam, {firstName} 👋
          </h1>
          <p className="mt-1.5 text-brand-200 text-sm">
            Apna module chunein — sirf wahi jo aap ke liye khulta hai
          </p>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-10">

        {/* Main Modules */}
        {mainModules.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-5 rounded-full bg-brand-600" />
              <h2 className="text-[13px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
                Modules
              </h2>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {mainModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.route}
                    href={mod.route}
                    className="group relative flex flex-col items-center gap-3 rounded-2xl p-4 bg-white dark:bg-surface-900 border border-surface-100 dark:border-surface-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-150 overflow-hidden"
                  >
                    {/* Subtle gradient overlay on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-5 transition-opacity rounded-2xl`} />

                    {/* Icon */}
                    <div className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${mod.gradient} shadow-md group-hover:scale-110 transition-transform duration-150`}>
                      <Icon size={22} className="text-white" strokeWidth={1.8} />
                    </div>

                    {/* Text */}
                    <div className="text-center">
                      <p className="text-[12px] font-semibold text-surface-800 dark:text-surface-100 leading-tight">
                        {mod.label}
                      </p>
                      <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-0.5 leading-tight">
                        {mod.sublabel}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Ops / Quick Links */}
        {opsModules.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-1 w-5 rounded-full bg-surface-300 dark:bg-surface-600" />
              <h2 className="text-[13px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-widest">
                Quick Links
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {opsModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <Link
                    key={mod.route}
                    href={mod.route}
                    className="group flex items-center gap-3 rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 px-3.5 py-3 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm active:scale-98 transition-all duration-150"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${mod.iconBg} transition-colors`}>
                      <Icon size={16} className={`${mod.iconColor} group-hover:scale-110 transition-transform`} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-surface-800 dark:text-surface-100 truncate">
                        {mod.label}
                      </p>
                      <p className="text-[10px] text-surface-400 dark:text-surface-500 truncate">
                        {mod.sublabel}
                      </p>
                    </div>
                    <ChevronRight size={13} className="ml-auto shrink-0 text-surface-300 dark:text-surface-600 group-hover:text-brand-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between text-[11px] text-surface-400 dark:text-surface-600">
          <span>AgriBridge OS</span>
          <span>v2.0</span>
        </footer>

      </main>
    </div>
  );
}
