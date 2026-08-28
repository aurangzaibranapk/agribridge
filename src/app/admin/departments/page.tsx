import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DEPARTMENTS } from "@/lib/departments";
import { DepartmentsClient, type DeptRow } from "./departments-client";

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

  const [{ data: perms }, { data: staff }] = await Promise.all([
    supabase.from("role_page_permissions").select("role, allowed_pages"),
    supabase.from("profiles").select("role, allowed_pages").eq("is_active", true),
  ]);

  const rows: DeptRow[] = DEPARTMENTS.map((d) => {
    const mine = (staff ?? []).filter((s) => s.role === d.role);
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
    </div>
  );
}
