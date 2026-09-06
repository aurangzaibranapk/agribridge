import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { createClient } from "@/lib/supabase/server";
import { OrgTreeClient } from "./tree-client";

export const dynamic = "force-dynamic";

// Kaun poori company badal sakta hai. Manager ko fn_hr_staff_directory
// sirf us ki apni shakh deti hai -- ye rok database mein hai, yahan
// sirf us ka natija dikhta hai.
const HR_ROLES = ["hr", "admin", "owner", "super_admin"];

/**
 * Team ka darakht — kaun kis ke ooper hai.
 *
 * Malik ne 5 September ko kaha: *"kon kis k oper hy kis trha sy tree
 * bni hy pori team ki."* Aur 6 September ko safha KHALI dekh kar:
 * *"ye tree banayein — Board of Director, phir CEO, phir Admin, phir
 * Assistant Admin... aur sath har file edit kar sakein, aur sare staff
 * apni image laga sakein, aur tree mein image bhi aani chahiye."*
 *
 * -------------------------------------------------------------------
 * SAFHA KHALI KYUN THA
 *
 * `staff_details` mein EK BHI qatar nahi thi (19 active profiles, 0 HR
 * records), aur `fn_hr_staff_directory` us table par INNER JOIN karta
 * tha. Yani jis ka HR record na ho, wo fehrist mein aata hi nahi tha --
 * aur kisi ka tha hi nahi.
 *
 * Safha apni khaali ki wajah theek bata raha tha ("abhi kisi ka HR
 * record mukammal nahi"), magar wo jawab kisi kaam ka nahi tha: banda
 * yahan dhaancha dekhne aata hai, aur usay 19 log nazar aane chahiyen --
 * chahe un mein se 19 ka hi record adhoora ho.
 *
 * 334 ne wo INNER JOIN LEFT kar diya. Ab darakht **poori company** ka
 * banta hai, aur adhoore record par saaf nishan lagta hai.
 *
 * -------------------------------------------------------------------
 * TEEN BAATEIN JAAN BOOJH KAR
 *
 * 1. **Jis ka afsar darj nahi, wo chhupta nahi -- jaR par aata hai.**
 *    Use kisi ke neeche daal dena ya fehrist se nikal dena, dono jhoot
 *    hain: pehla ghalat dhaancha dikhata hai, doosra bande ko gayab kar
 *    deta hai.
 *
 * 2. **Ohda aur system role do alag cheezein hain.** Ohda company mein
 *    darja hai (Board of Director → CEO → Admin → Assistant Admin);
 *    role ye tay karta hai ke system mein kya khul sakta hai. Inhen ek
 *    kar dena ye maan lena hota ke ohda barhne par ijazat khud barh
 *    jaye.
 *
 * 3. **Tasveer yahan se nahi lagti.** Har banda apni tasveer apne
 *    "My HR" safhe se khud lagata hai. HR ke haath mein doosron ki
 *    shakal dena na zaroori hai na theek.
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

  const canEdit = HR_ROLES.includes(me.role);

  const [{ data: dir, error: dirErr }, { data: positions }, { data: departments }, { data: branches }] =
    await Promise.all([
      supabase.rpc("fn_hr_staff_directory"),
      supabase.from("org_positions").select("key, label, rank").eq("is_active", true).order("rank"),
      supabase.from("departments").select("key, label").eq("is_active", true).order("sort_order"),
      supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    ]);

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
    darja: (d.position_key as string | null) ?? null,
    darjaNaam: (d.position_label as string | null) ?? null,
    shobaKey: (d.department_key as string | null) ?? null,
    shoba: (d.department_label as string | null) ?? null,
    shakhaId: (d.branch_id as string | null) ?? null,
    shakha: (d.branch_name as string | null) ?? null,
    afsar: (d.reports_to as string | null) ?? null,
    afsarNaam: (d.reports_to_name as string | null) ?? null,
    kaamKiQism: (d.employment_type as string | null) ?? "permanent",
    tasveer: (d.photo_url as string | null) ?? null,
    recordHai: Boolean(d.hr_record),
  }));

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
      <OrgTreeClient
        rows={rows}
        khudId={user.id}
        canEdit={canEdit}
        positions={(positions ?? []).map((p) => ({ key: p.key as string, label: p.label as string }))}
        departments={(departments ?? []).map((d) => ({ key: d.key as string, label: d.label as string }))}
        branches={(branches ?? []).map((b) => ({ id: b.id as string, name: b.name as string }))}
      />
    </div>
  );
}
