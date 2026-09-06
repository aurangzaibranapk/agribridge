import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SettlementsClient } from "./settlements-client";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

const DEKH_SAKTE = ["manager", "finance", "admin_assistant"];
const MANZOORI_WALE = ["finance"];

/**
 * Khaton ka adjustment — ek bande ka "lena" aur "dena" kaatna.
 *
 * Malik (6 September): *"System silently balance overwrite na kare...
 * Phir authorized settlement... Is adjustment ka proper journal + audit
 * trail hoga. Silent set-off bilkul nahi."*
 *
 * Staff ke paas ye safha nahi. Do taraf ki raqam kaatna wo faisla hai
 * jo hisaab jaanne wale ke haath mein rehna chahiye — aur us bande ki
 * raza ke baghair to bilkul nahi.
 */
export default async function SettlementsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  const role = String(me?.role ?? "");
  const sabKuchWala = UNRESTRICTED_ROLES.includes(role);
  if (!sabKuchWala && !DEKH_SAKTE.includes(role)) redirect("/admin/permissions-denied");

  const manzoorKarSakta = sabKuchWala || MANZOORI_WALE.includes(role);
  const maangSakta = sabKuchWala || DEKH_SAKTE.includes(role);

  const service = createServiceClient();
  const loose = service as unknown as { from: (t: string) => any };

  const [{ data: rawRows }, { data: khate }, { data: farmers }, { data: staff }, { data: customers }, { data: suppliers }] =
    await Promise.all([
      loose.from("party_settlements").select("*").order("created_at", { ascending: false }).limit(200),
      service
        .from("gl_accounts")
        .select("code, name, account_type")
        .in("account_type", ["asset", "liability"])
        .eq("is_active", true)
        .order("code"),
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

  const khataNaam = new Map<string, string>();
  (khate ?? []).forEach((k: any) => khataNaam.set(k.code, k.name));

  const rows = ((rawRows ?? []) as any[]).map((r) => ({
    id: r.id as string,
    number: r.settlement_number as string,
    party_type: r.party_type as string,
    party_id: r.party_id as string,
    party_naam: naamMap.get(r.party_id as string) ?? "(naam nahi mila)",
    lena_khata: r.lena_khata as string,
    lena_naam: khataNaam.get(r.lena_khata as string) ?? (r.lena_khata as string),
    dena_khata: r.dena_khata as string,
    dena_naam: khataNaam.get(r.dena_khata as string) ?? (r.dena_khata as string),
    amount: Number(r.amount ?? 0),
    wajah: (r.wajah as string) ?? "",
    status: (r.status as string) ?? "pending",
    rejection_reason: (r.rejection_reason as string | null) ?? null,
    created_at: r.created_at as string,
  }));

  return (
    <div>
      <PageHeader
        title="Khaton ka Adjustment"
        description="Ek hi bande se lena bhi ho aur us ko dena bhi — dono ko manzoori ke sath kaatna"
      />
      <SettlementsClient
        rows={rows}
        khate={{
          lena: (khate ?? []).filter((k: any) => k.account_type === "asset").map((k: any) => ({ code: k.code, name: k.name })),
          dena: (khate ?? []).filter((k: any) => k.account_type === "liability").map((k: any) => ({ code: k.code, name: k.name })),
        }}
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
        maangSakta={maangSakta}
        manzoorKarSakta={manzoorKarSakta}
      />
    </div>
  );
}
