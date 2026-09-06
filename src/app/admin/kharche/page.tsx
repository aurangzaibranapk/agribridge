import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { StatCard } from "@/components/dashboard/stat-card";
import { KharcheClient } from "./kharche-client";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { billQismKaLabel } from "@/lib/kharche";
import { ArrowDownCircle, ArrowUpCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const MANZOORI_WALE = ["manager", "admin_assistant", "finance"];

/**
 * Kharche aur adaigi — din bhar ka har len-den ek jagah.
 *
 * Malik (6 September): *"Expense ka alag se tag hona chahiye slide bar
 * mein, jis mein daily koi bhi bill hai wo add kar sakein, jis ki
 * manzoori manager dega."*
 */
export default async function KharchePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id, shop_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = String(me?.role ?? "");
  const sabKuchWala = UNRESTRICTED_ROLES.includes(role);
  const manzoorKarSakta =
    sabKuchWala || MANZOORI_WALE.includes(role) || (await canDo("kharche", "approve"));
  const darjKarSakta = sabKuchWala || (await canDo("kharche", "create"));

  const service = createServiceClient();

  /**
   * Dukan par baithe bande ko us ki apni shaakh ka hisaab.
   *
   * Poore karobar ke kharche us ke saamne rakhna do wajhon se ghalat
   * hai: wo un ka zimmedar nahi, aur us ki apni fehrist un mein gum ho
   * jati hai.
   */
  let q = service
    .from("company_expense_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!sabKuchWala && me?.branch_id) q = q.eq("branch_id", me.branch_id);

  const [{ data: rawRows }, { data: khaate }, { data: suppliers }, { data: staff }, { data: farmers }, { data: customers }] =
    await Promise.all([
      q,
      service
        .from("finance_accounts")
        .select("id, name, gl_code, is_active")
        .eq("is_active", true)
        .order("name"),
      service.from("suppliers").select("id, name").order("name").limit(500),
      service.from("profiles").select("id, full_name").eq("is_active", true).order("full_name").limit(500),
      service.from("farmers").select("id, full_name, mobile").eq("is_deleted", false).order("full_name").limit(1000),
      service.from("customers").select("id, name, phone").order("name").limit(1000),
    ]);

  const rows = ((rawRows ?? []) as any[]).map((r) => ({
    id: r.id as string,
    expense_number: r.expense_number as string,
    kind: (r.kind as string | null) ?? "kharcha",
    category: r.category as string | null,
    categoryLabel: billQismKaLabel(r.category),
    amount: Number(r.amount ?? 0),
    description: (r.description as string | null) ?? "",
    status: (r.status as string) ?? "pending",
    rejection_reason: (r.rejection_reason as string | null) ?? null,
    party_type: (r.party_type as string | null) ?? null,
    party_id: (r.party_id as string | null) ?? null,
    party_name: (r.party_name as string | null) ?? null,
    document_url: (r.document_url as string | null) ?? null,
    expense_date: (r.expense_date as string | null) ?? (r.created_at as string).slice(0, 10),
    paid_from_account_id: (r.paid_from_account_id as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  // Bande ka naam har fehrist se -- taake qatar par id nahi, naam nazar
  // aaye. Id kisi ke kaam ki nahi.
  const naamMap = new Map<string, string>();
  (suppliers ?? []).forEach((s: any) => naamMap.set(s.id, s.name));
  (staff ?? []).forEach((s: any) => naamMap.set(s.id, s.full_name));
  (farmers ?? []).forEach((f: any) => naamMap.set(f.id, f.full_name));
  (customers ?? []).forEach((c: any) => naamMap.set(c.id, c.name));

  const khataNaam = new Map<string, string>();
  (khaate ?? []).forEach((k: any) => khataNaam.set(k.id, k.name));

  const intezar = rows.filter((r) => r.status === "pending");
  const manzoor = rows.filter((r) => r.status === "approved");

  // Aaj ka hisaab -- rukh ke hisaab se, "kharcha" aur "paisa gaya" ek
  // cheez nahi. (Qism ka rukh `lib/kharche.ts` mein likha hai.)
  const aaj = new Date().toISOString().slice(0, 10);
  const aajKe = manzoor.filter((r) => r.expense_date === aaj);
  const GAYE = ["kharcha", "supplier_ko_diya", "staff_ko_advance", "kisan_ko_advance"];
  const aajGaya = aajKe.filter((r) => GAYE.includes(r.kind)).reduce((s, r) => s + r.amount, 0);
  const aajAaya = aajKe.filter((r) => !GAYE.includes(r.kind)).reduce((s, r) => s + r.amount, 0);
  const intezarKiRaqam = intezar.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Kharche aur Adaigi"
        description="Din bhar ka har bill aur len-den — aur ye ke wo kis ke khaate mein gaya"
      />

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Aaj paisa gaya" value={`Rs. ${aajGaya.toLocaleString()}`} icon={ArrowDownCircle} tone="red" />
        <StatCard label="Aaj paisa aaya" value={`Rs. ${aajAaya.toLocaleString()}`} icon={ArrowUpCircle} tone="green" />
        <StatCard
          label={`Manzoori ka intezar (${intezar.length})`}
          value={`Rs. ${intezarKiRaqam.toLocaleString()}`}
          icon={Clock}
          tone="warn"
        />
      </div>

      <KharcheClient
        rows={rows}
        khaate={(khaate ?? []).map((k: any) => ({ id: k.id, name: k.name, gl_code: k.gl_code }))}
        bande={{
          supplier: (suppliers ?? []).map((s: any) => ({ id: s.id, naam: s.name })),
          staff: (staff ?? []).map((s: any) => ({ id: s.id, naam: s.full_name })),
          farmer: (farmers ?? []).map((f: any) => ({
            id: f.id,
            naam: f.mobile ? `${f.full_name} — ${f.mobile}` : f.full_name,
          })),
          customer: (customers ?? []).map((c: any) => ({
            id: c.id,
            naam: c.phone ? `${c.name} — ${c.phone}` : c.name,
          })),
        }}
        naamMap={Object.fromEntries(naamMap)}
        khataNaam={Object.fromEntries(khataNaam)}
        darjKarSakta={darjKarSakta}
        manzoorKarSakta={manzoorKarSakta}
      />
    </div>
  );
}
