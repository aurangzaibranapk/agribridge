import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { isApproverRole } from "@/lib/demand/demand-rules";
import { SignupReviewButtons } from "./review-buttons";

export const dynamic = "force-dynamic";

/** Owner/Admin: kisanon ke khud-bane signup ki manzoori (migration 535). */
export default async function FarmerSignupsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  if (!me?.is_active || !isApproverRole(me.role)) {
    return <Card><p className="text-sm text-red-700">Ye safha sirf Owner/Admin ke liye hai.</p></Card>;
  }
  const service = createServiceClient() as any;
  const { data: rows, error } = await service
    .from("farmers")
    .select("id, farmer_code, full_name, cnic, phone_number, village, phone_verified_at, created_at")
    .eq("signup_approval_status", "pending")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(200);
  const ids = (rows ?? []).map((r: any) => r.id);
  const { data: milk } = ids.length ? await service.from("v_farmer_milk_supplier").select("farmer_id, is_milk_supplier").in("farmer_id", ids) : { data: [] };
  const milkSet = new Set((milk ?? []).filter((m: any) => m.is_milk_supplier).map((m: any) => m.farmer_id));
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <PageHeader title="Kisan Signups / نئے کسان" description="Portal par khud signup karne wale kisan. Mobile WhatsApp OTP se verified hai." />
      {error && <Card><p className="text-sm text-red-700">Parha nahi ja saka (migration 535 lagi hai?): {error.message}</p></Card>}
      <Card>
        {(rows ?? []).length === 0 ? <p className="text-sm text-surface-600">Koi pending signup nahi.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-surface-500"><th>Naam</th><th>CNIC</th><th>Mobile</th><th>Gaon</th><th>Doodh supplier</th><th></th></tr></thead>
            <tbody>
              {(rows ?? []).map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.full_name} <span className="text-xs text-surface-500">{r.farmer_code}</span></td>
                  <td>{r.cnic ?? "—"}</td><td>{r.phone_number}</td><td>{r.village ?? "—"}</td>
                  <td>{milkSet.has(r.id) ? "Haan" : "Nahi"}</td>
                  <td><SignupReviewButtons farmerId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
