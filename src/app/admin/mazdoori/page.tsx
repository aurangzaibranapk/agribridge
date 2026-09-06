import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { MazdooriClient } from "./mazdoori-client";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

const MANZOORI_WALE = ["manager", "admin_assistant", "finance"];

/**
 * Mazdoori / Daily Work.
 *
 * Malik (6 September): *"Farmer #125 — Muhammad Aslam... Work: Shop
 * unloading, Qty: 100 bags, Rate: Rs 20/bag, Mazdoori: Rs 2,000. System
 * turant us bande ke unified ledger ko dekhe... Staff ko calculation
 * manually nahi karni."*
 */
export default async function MazdooriPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = String(me?.role ?? "");
  const sabKuchWala = UNRESTRICTED_ROLES.includes(role);
  const manzoorKarSakta = sabKuchWala || MANZOORI_WALE.includes(role) || (await canDo("mazdoori", "approve"));
  const darjKarSakta = sabKuchWala || (await canDo("mazdoori", "create"));

  const service = createServiceClient();
  const looseService = service as unknown as { from: (t: string) => any };

  let q = looseService
    .from("labour_work_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (!sabKuchWala && me?.branch_id) q = q.eq("branch_id", me.branch_id);

  const [{ data: rawRows }, { data: farmers }, { data: staff }, { data: customers }, { data: suppliers }] =
    await Promise.all([
      q,
      service.from("farmers").select("id, full_name, phone_number").eq("is_deleted", false).order("full_name").limit(1000),
      service.from("profiles").select("id, full_name").eq("is_active", true).order("full_name").limit(500),
      service.from("customers").select("id, name, phone_number").order("name").limit(1000),
      service.from("suppliers").select("id, name").order("name").limit(500),
    ]);

  const naamMap = new Map<string, string>();
  (farmers ?? []).forEach((f: any) => naamMap.set(f.id, f.full_name));
  (staff ?? []).forEach((s: any) => naamMap.set(s.id, s.full_name));
  (customers ?? []).forEach((c: any) => naamMap.set(c.id, c.name));
  (suppliers ?? []).forEach((s: any) => naamMap.set(s.id, s.name));

  const rows = ((rawRows ?? []) as any[]).map((r) => ({
    id: r.id as string,
    entry_number: r.entry_number as string,
    party_type: r.party_type as string,
    party_id: r.party_id as string,
    party_naam: naamMap.get(r.party_id as string) ?? "(naam nahi mila)",
    work_date: r.work_date as string,
    work_detail: r.work_detail as string,
    quantity: r.quantity != null ? Number(r.quantity) : null,
    unit: (r.unit as string | null) ?? null,
    rate: r.rate != null ? Number(r.rate) : null,
    amount: Number(r.amount ?? 0),
    advance_adjusted: Number(r.advance_adjusted ?? 0),
    payable_added: Number(r.payable_added ?? 0),
    received_by_name: (r.received_by_name as string | null) ?? null,
    status: (r.status as string) ?? "pending",
    rejection_reason: (r.rejection_reason as string | null) ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="Mazdoori / Daily Work"
        description="Kis ne kaam kiya, kitna bana — purana advance khud us mein se kat jata hai"
      />
      <MazdooriClient
        rows={rows}
        bande={{
          farmer: (farmers ?? []).map((f: any) => ({
            id: f.id,
            naam: f.phone_number ? `${f.full_name} — ${f.phone_number}` : f.full_name,
          })),
          staff: (staff ?? []).map((s: any) => ({ id: s.id, naam: s.full_name })),
          customer: (customers ?? []).map((c: any) => ({
            id: c.id,
            naam: c.phone_number ? `${c.name} — ${c.phone_number}` : c.name,
          })),
          supplier: (suppliers ?? []).map((s: any) => ({ id: s.id, naam: s.name })),
        }}
        darjKarSakta={darjKarSakta}
        manzoorKarSakta={manzoorKarSakta}
      />
    </div>
  );
}
