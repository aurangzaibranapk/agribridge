import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DEPARTMENTS } from "@/lib/departments";
import { DepartmentsClient, type DeptRow } from "./departments-client";
import { HeadForm, type StaffOption, type HeadInfo } from "./head-form";
import { TemporaryList } from "./temporary-list";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !["owner", "super_admin", "admin"].includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">Ye safha sirf Owner aur Admin ke liye hai.</div>;
  }

  const [{ data: perms }, { data: staff }, { data: heads }, { data: allStaff }] = await Promise.all([
    supabase.from("role_page_permissions").select("role, allowed_pages"),
    supabase.from("profiles").select("role, allowed_pages, extra_roles").eq("is_active", true),
    supabase
      .from("department_head_grants")
      .select("department_key, profile_id, max_actions, max_data_scope, expires_at"),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .neq("role", "farmer")
      .order("full_name"),
  ]);

  const staffOptions: StaffOption[] = (allStaff ?? []).map((s) => ({
    id: s.id,
    name: s.full_name ?? "—",
    role: s.role,
  }));

  const headByDept = new Map<string, HeadInfo>();
  for (const h of heads ?? []) {
    headByDept.set(h.department_key, {
      profileId: h.profile_id,
      name: staffOptions.find((s) => s.id === h.profile_id)?.name ?? "—",
      maxActions: (h.max_actions as string[]) ?? [],
      maxScope: h.max_data_scope,
      expiresAt: h.expires_at,
    });
  }

  const rows: DeptRow[] = DEPARTMENTS.map((d) => {
    // Department ke banday: jin ka asli department yehi hai, AUR jinhen
    // ye department us ke ilawa diya gaya hai (193). Doosron ko na
    // ginna wohi purani khamoshi wapas laata -- safha "0 banday" kehta
    // aur admin samajhta ke abhi kisi ko lagaya hi nahi.
    const mine = (staff ?? []).filter(
      (s) => s.role === d.role || ((s.extra_roles as string[] | null) ?? []).includes(d.role)
    );
    return {
      role: d.role,
      pages: ((perms ?? []).find((p) => p.role === d.role)?.allowed_pages as string[] | null) ?? [],
      staffCount: mine.length,
      // Jin ka apna set bhara hua hai un par department ka set nahi
      // lagta -- admin ko ye saamne dikhna chahiye, warna wo department
      // badal kar samajhta hai ke sab par lag gaya.
      overrideCount: mine.filter((s) => ((s.allowed_pages as string[] | null) ?? []).length > 0).length,
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Department aur Ijazat"
        description="Ek dafa department ki ijazat tay karein — us ke har banday par lag jati hai."
      />
      <DepartmentsClient rows={rows} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Waqti Ijazat</h2>
        <p className="mb-3 text-xs text-surface-500">
          Chhutti par gaye kisi ki jagah di hui ijazat. Waqt guzarte hi khud khatam ho jati hai — kisi
          ko yaad rakhne ki zarurat nahi.
        </p>
        <TemporaryList />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">Department Head</h2>
        <p className="mb-3 text-xs text-surface-500">
          Head apni team ko khud ijazat de sakta hai — magar sirf wahi jo aap ne use di ho, aur sirf us
          feature par jo us ke apne paas ho.
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {DEPARTMENTS.map((d) => (
            <HeadForm
              key={d.key}
              departmentKey={d.key}
              departmentLabel={d.label}
              staff={staffOptions}
              head={headByDept.get(d.key) ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
