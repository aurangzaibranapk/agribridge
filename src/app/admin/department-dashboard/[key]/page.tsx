import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadNav } from "@/lib/access/nav";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { tilesFor } from "@/lib/department-dashboard";
import { CanonicalDepartmentDashboard } from "@/components/dashboard/canonical-department-dashboard";

export const dynamic = "force-dynamic";

const TILE_ALIASES: Record<string, string> = { milk: "dairy", inventory: "warehouse", purchase: "procurement", admin: "admin_office" };

export default async function CanonicalDashboardPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (key === "master") redirect("/admin/command-center");
  if (key === "reports") redirect("/admin/reports");
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role, branch_id, is_active").eq("id", user.id).maybeSingle();
  if (!profile?.is_active) return <div className="p-8 text-center text-surface-400">Account inactive hai.</div>;
  const nav = await loadNav(user.id, profile.role, lang);
  const group = nav.groups.find((g) => g.key === key);
  if (!group) notFound();
  const tiles = await tilesFor(TILE_ALIASES[key] ?? key, profile.branch_id);
  return <CanonicalDepartmentDashboard dashboardKey={key} label={group.label} description={group.description || `${group.label} operations, performance aur controls`} icon={group.icon ?? null} items={group.items} tiles={tiles} />;
}
