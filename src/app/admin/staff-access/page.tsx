import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { StaffAccessClient } from "./staff-access-client";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { STAFF_ROLES } from "@/lib/utils/roles";
import { DEPARTMENTS } from "@/lib/departments";
import { TemplateManager } from "./template-manager";

export const dynamic = "force-dynamic";

/**
 * Staff ki ijazat -- kis ko kya khulta hai.
 *
 * Malik (6 September): *"lekin hamein aasani honi chahiye: ye kis stage
 * par banda aaya hai, usi stage se usay kya kya dena hai wo easy ho."*
 *
 * Migration 343 ne ohde ko TEMPLATE bana diya. Us ke baad ijazat ka
 * waahid darwaza `user_feature_permissions` reh gaya -- aur us mein
 * kuch daalne ka koi safha maujood hi nahi tha. Ye safha wo darwaza
 * hai: banda chunein, us ke stage ka template ek dabao mein lagayein,
 * phir us mein se kam ya zyada karein.
 */
export default async function StaffAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ banda?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  // Ijazat baantna sirf malik ke haath mein rehta hai.
  if (!UNRESTRICTED_ROLES.includes(String(me?.role ?? ""))) redirect("/admin/permissions-denied");

  const service = createServiceClient();

  const [{ data: staff }, { data: features }, { data: templates }, { data: branches }, { data: shops }] = await Promise.all([
    // Malik (7 September): "yahan sirf staff aana chahiye aur kuch
    // nahi." Pehle ye query koi role filter nahi karti thi -- har
    // profile aa jata tha, farmer aur vendor tak jo kabhi test signup
    // se ban gaye the. Ijazat sirf staff ko di ja sakti hai, is liye
    // fehrist bhi sirf unhi ki honi chahiye.
    service
      .from("profiles")
      .select("id, full_name, role, is_active, branch_id, shop_id")
      .in("role", STAFF_ROLES)
      .order("is_active", { ascending: false })
      .order("full_name"),
    service.from("features").select("key, label, route, is_sensitive").eq("is_active", true).order("label"),
    service.from("role_feature_permissions").select("role, feature_key, actions, data_scope"),
    service.from("branches").select("id, name").eq("is_active", true).order("name"),
    service.from("shops").select("id, name, branch_id").eq("is_active", true).order("name"),
  ]);

  // Kaam ka banda wohi jise ijazat lagti hai. Owner/Admin is fehrist
  // mein nahi -- un par ye safha asar hi nahi karta, aur unhen yahan
  // dikhana ye jhoot bolta ke un ki ijazat yahan se badalti hai.
  const log = (staff ?? []).filter((p) => !UNRESTRICTED_ROLES.includes(String(p.role)));

  // Har template mein kitni cheezein hain -- taake malik ko lagane se
  // pehle pata ho ke wo kya de raha hai.
  const templateFeatures = new Map<string, { feature_key: string; actions: any[]; data_scope: any }[]>();
  (templates ?? []).forEach((r: any) => {
    const list = templateFeatures.get(r.role) ?? [];
    list.push({ feature_key: String(r.feature_key), actions: (r.actions ?? ["view"]) as any[], data_scope: r.data_scope ?? "own_branch" });
    templateFeatures.set(r.role, list);
  });
  const templateFehrist = DEPARTMENTS.map((department) => {
    const permissions = templateFeatures.get(department.role) ?? [];
    return { role: department.role, label: department.label, summary: department.summary, ginti: permissions.length, featureKeys: permissions.map((p) => p.feature_key), permissions };
  }).sort((a, b) => a.label.localeCompare(b.label));

  const chunaHua = params.banda && log.some((p) => p.id === params.banda) ? params.banda : null;

  const { data: uskiIjazat } = chunaHua
    ? await service
        .from("user_feature_permissions")
        .select("feature_key, actions, data_scope, expires_at, reason")
        .eq("profile_id", chunaHua)
        .order("feature_key")
    : { data: [] };

  const { data: productPermission } = chunaHua
    ? await service
        .from("staff_product_permissions")
        .select("can_add, can_edit, can_view, can_delete, can_approve_products")
        .eq("profile_id", chunaHua)
        .maybeSingle()
    : { data: null };

  return (
    <div>
      <PageHeader
        title="Staff & Access Control"
        description="Banda, department, branch, shop aur access — sab ek hi jagah se"
      />
      <div className="mt-4">
        <TemplateManager
          templates={templateFehrist.map((t) => ({ role: t.role, label: t.label, summary: t.summary, permissions: t.permissions }))}
          features={(features ?? []).map((f: any) => ({ key: f.key, label: f.label, route: f.route, is_sensitive: f.is_sensitive === true }))}
        />
      </div>
      {log.length === 0 ? (
        <EmptyState title="Koi staff nahi mila." />
      ) : (
        <StaffAccessClient
          staff={log.map((p) => ({
            id: p.id,
            full_name: p.full_name ?? "(naam nahi)",
            role: String(p.role),
            is_active: p.is_active !== false,
            branch_id: (p.branch_id as string | null) ?? null,
            shop_id: (p.shop_id as string | null) ?? null,
          }))}
          features={(features ?? []).map((f: any) => ({
            key: f.key,
            label: f.label,
            route: f.route,
            is_sensitive: f.is_sensitive === true,
          }))}
          templates={templateFehrist}
          chunaHua={chunaHua}
          uskiIjazat={(uskiIjazat ?? []).map((r: any) => ({
            feature_key: r.feature_key,
            actions: (r.actions as string[]) ?? [],
            data_scope: String(r.data_scope),
            expires_at: (r.expires_at as string | null) ?? null,
            reason: (r.reason as string | null) ?? null,
          }))}
          branches={(branches ?? []).map((b: any) => ({ id: b.id, name: b.name }))}
          shops={(shops ?? []).map((s: any) => ({ id: s.id, name: s.name, branch_id: s.branch_id }))}
          productPermission={{
            can_add: productPermission?.can_add === true,
            can_edit: productPermission?.can_edit === true,
            can_view: productPermission?.can_view === true,
            can_delete: productPermission?.can_delete === true,
            can_approve_products: productPermission?.can_approve_products === true,
          }}
        />
      )}
    </div>
  );
}
