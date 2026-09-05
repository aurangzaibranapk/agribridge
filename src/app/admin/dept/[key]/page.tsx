import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { ADMIN_NAV_GROUPS } from "@/components/layout/nav-items";
import { departmentByKey, departmentForRole, UNRESTRICTED_ROLES } from "@/lib/departments";
import { effectiveAccess, canOpen } from "@/lib/effective-permissions";
import { tilesFor } from "@/lib/department-dashboard";
import { NeedsAttention } from "@/components/guided/needs-attention";
import { WorkCoachBox } from "@/components/guided/work-coach-box";
import { loadNav } from "@/lib/access/nav";
import { ArrowRight } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

function toneClass(tone?: string) {
  if (tone === "alert") return "text-red-600";
  if (tone === "warn") return "text-amber-600";
  return "text-surface-900 dark:text-white";
}

export default async function DepartmentDashboard({ params }: { params: Promise<{ key: string }> }) {
  const lang = getLanguageFromCookies("rm");
  const { key } = await params;
  const dept = departmentByKey(key);
  if (!dept) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, branch_id, full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active) {
    return <div className="p-8 text-center text-surface-400">{t("at_account_inactive", lang)}</div>;
  }

  // Apna department, ya admin darje ka shakhs jo sab dekh sakta hai.
  const isOwnDepartment = departmentForRole(me.role)?.key === key;
  if (!isOwnDepartment && !UNRESTRICTED_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye dashboard {dept.label} department ka hai.</div>;
  }

  const access = await effectiveAccess(me.role, null);

  // Sirf wohi shortcut jo is shakhs ko waqai khulte hain. Band darwaze
  // dikhana bandey ka waqt bhi zaya karta hai aur bharosa bhi.
  const shortcuts = ADMIN_NAV_GROUPS.flatMap((g) => g.items)
    .filter((item) => dept.suggestedPages.includes(item.href))
    .filter((item, index, all) => all.findIndex((x) => x.href === item.href) === index)
    .filter((item) => canOpen(access, item.href));

  const tiles = await tilesFor(key, me.branch_id);
  const nav = await loadNav(user?.id ?? "", me.role, lang);
  const AREAS: Record<string, ("purchase" | "inventory" | "products" | "sales" | "finance" | "ai")[]> = {
    purchase: ["purchase", "finance"],
    inventory: ["inventory", "products", "purchase"],
    sales: ["sales", "products"],
    finance: ["finance", "purchase"],
  };

  return (
    <div className="space-y-4">
      <PageHeader title={`${dept.label} Dashboard`} description={dept.summary} />

      {tiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((tile) => {
            const inner = (
              <>
                <p className="text-xs text-surface-500">{tile.label}</p>
                <p className={`mt-1 text-2xl font-semibold ${toneClass(tile.tone)}`}>{tile.value}</p>
                {tile.hint && <p className="text-xs text-surface-400">{tile.hint}</p>}
              </>
            );
            return tile.href ? (
              <Link key={tile.label} href={tile.href}>
                <Card className="h-full p-4 transition hover:border-brand-400">{inner}</Card>
              </Link>
            ) : (
              <Card key={tile.label} className="p-4">
                {inner}
              </Card>
            );
          })}
        </div>
      )}

      <WorkCoachBox />
      <NeedsAttention lang={lang} allowedRoutes={nav.unrestricted ? null : nav.allowedRoutes} areas={AREAS[key]} />

      <Card className="overflow-hidden">
        <div className="border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{t("at_my_work", lang)}</h3>
        </div>
        {shortcuts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-surface-400">
            Abhi koi safha khula hua nahi. Admin se kehein ke {dept.label} department ki ijazat set kar de.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-px bg-surface-100 sm:grid-cols-2 lg:grid-cols-3 dark:bg-surface-800">
            {shortcuts.map((item) => (
              <li key={item.href} className="bg-white dark:bg-surface-900">
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-50 dark:hover:bg-surface-800/50"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="min-w-0 flex-1 truncate text-sm text-surface-800 dark:text-surface-200">
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-surface-300" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
