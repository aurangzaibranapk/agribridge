import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { OrgTreeClient } from "./tree-client";

export const dynamic = "force-dynamic";

// Poori company ka darakht sirf ye log dekhte hain. Manager ko bhi
// fn_hr_staff_directory sirf us ki apni shakh deti hai -- ye rok
// database mein hai, yahan sirf us ka natija dikhta hai.
const POORI_COMPANY = ["hr", "admin", "owner", "super_admin"];

/**
 * Team ka darakht — kaun kis ke ooper hai.
 *
 * Malik ne 5 September ko kaha: *"kon kis k oper hy kis trha sy tree
 * bni hy pori team ki."*
 *
 * `/admin/hr/team` par fehrist pehle se thi -- naam, shoba, afsar ka
 * naam, sab qatar dar qatar. Us se ek banda dhoondhna asaan hai, magar
 * ye sawal us se nahi milta: **poori company ka dhaancha kaisa hai?**
 * Us ke liye shakhein nazar aani chahiyein, qatarein nahi.
 *
 * -------------------------------------------------------------------
 * DO BAATEIN JAAN BOOJH KAR:
 *
 * 1. **Jis ka afsar darj nahi, wo chhupta nahi -- upar aata hai.** Aisa
 *    banda darakht ki jaR par alag nishan ke sath aata hai. Use kisi ke
 *    neeche daal dena ya list se nikal dena, dono jhoot hain: pehla
 *    ghalat dhaancha dikhata hai, doosra bande ko gayab kar deta hai.
 *
 * 2. **Jo log staff_details mein nahi, un ki ginti saaf likhi hai.**
 *    Darakht sirf un logon ka banta hai jin ka HR record mukammal hai.
 *    Baqi ko khamoshi se chhorna "company mein bas itne log hain" jaisa
 *    ghalat jawab deta -- is liye ginti aur naam dono saamne hain.
 */
export default async function OrgTreePage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active) redirect("/login");

  const { data: dir, error: dirErr } = await supabase.rpc("fn_hr_staff_directory");

  if (dirErr) {
    return (
      <div>
        <PageHeader title="Team ka darakht" />
        <Card>
          <p className="text-sm text-red-700 dark:text-red-300">{dirErr.message}</p>
        </Card>
      </div>
    );
  }

  const rows = (dir ?? []).map((d) => ({
    id: d.profile_id as string,
    naam: (d.full_name as string | null) ?? "—",
    role: (d.role as string | null) ?? "—",
    ohda: (d.designation as string | null) ?? null,
    shoba: (d.department_label as string | null) ?? null,
    shakha: (d.branch_name as string | null) ?? null,
    afsar: (d.reports_to as string | null) ?? null,
    afsarNaam: (d.reports_to_name as string | null) ?? null,
    neechay: (d.direct_reports as number | null) ?? 0,
  }));

  // Sirf poori company dekhne walon ke liye: kaun sa active banda
  // darakht se bahar reh gaya (HR record na hone ki wajah se).
  let bahar: string[] = [];
  if (POORI_COMPANY.includes(me.role)) {
    const { data: sab } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true);
    const andar = new Set(rows.map((r) => r.id));
    bahar = (sab ?? [])
      .filter((p) => !andar.has(p.id as string))
      .map((p) => (p.full_name as string | null) ?? "—")
      .sort();
  }

  return (
    <div>
      <PageHeader
        title="Team ka darakht"
        description="Kaun kis ke ooper hai — poora dhaancha ek nazar mein"
        actions={
          <Link
            href="/admin/hr/team"
            className="inline-flex items-center rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-800 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            Fehrist aur tabdeeli
          </Link>
        }
      />
      <OrgTreeClient rows={rows} bahar={bahar} khudId={user.id} />
    </div>
  );
}
