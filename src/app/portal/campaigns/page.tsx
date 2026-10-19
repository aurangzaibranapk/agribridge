import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCampaignOpen, type LineKind } from "@/lib/campaigns/booking";
import { loadCampaignProducts } from "@/lib/campaigns/season-data";
import { CampaignBookingForm, type FarmDraft, type LineDraft } from "./booking-form";

export const dynamic = "force-dynamic";

/** Kisan: Season Booking (Gandum 2026). Farms + pin, beej/khaad/spray, apni product. Demand-first, koi payment nahi. */
export default async function CampaignsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const sb = supabase as any;
  const { data: farmer } = await sb.from("farmers").select("id, full_name, farmer_code, signup_approval_status").eq("user_id", user.id).maybeSingle();
  if (!farmer) redirect("/login");

  const [{ data: campaigns }, products, { data: bookings }, { data: lines }, { data: myFarms }] = await Promise.all([
    sb.from("booking_campaigns").select("id, name, crop, deadline, is_active, description").eq("is_active", true).eq("crop", "wheat").order("deadline"),
    loadCampaignProducts(sb),
    sb.from("campaign_bookings").select("id, campaign_id, acres, notes").eq("farmer_id", farmer.id),
    sb.from("farmer_product_demands").select("campaign_id, product_id, product_name, quantity, unit, category, status, custom_request_id").eq("farmer_id", farmer.id).not("campaign_id", "is", null).neq("status", "cancelled"),
    sb.from("farms").select("id, name, area_acres, village, latitude, longitude").eq("farmer_id", farmer.id).order("created_at"),
  ]);
  const bookingIds = (bookings ?? []).map((b: any) => b.id);
  const { data: links } = bookingIds.length ? await sb.from("campaign_booking_farms").select("booking_id, farm_id, acres").in("booking_id", bookingIds) : { data: [] };

  const toFarm = (f: any, acres?: number): FarmDraft => ({ key: f.id, farmId: f.id, name: f.name ?? "", acres: String(acres ?? f.area_acres ?? ""), village: f.village ?? "", lat: f.latitude != null ? Number(f.latitude) : null, lng: f.longitude != null ? Number(f.longitude) : null });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">Season Booking / سیزن بکنگ</h1>
        <p className="text-sm text-surface-500">Apne farms, rakba aur zaroorat ka saman likhein. Daftar demand dekh kar raabta karega.</p>
      </div>
      {farmer.signup_approval_status === "pending" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Aap ka signup admin ki manzoori ka intezar kar raha hai. Booking abhi bhi bhej sakte hain; daftar check karega.</p>
      )}
      {(campaigns ?? []).length === 0 && <p className="text-sm text-surface-600">Abhi koi booking campaign khuli nahi.</p>}
      {(campaigns ?? []).map((c: any) => {
        const b = (bookings ?? []).find((x: any) => x.campaign_id === c.id) ?? null;
        const linked = b ? (links ?? []).filter((l: any) => l.booking_id === b.id) : [];
        const farms: FarmDraft[] = linked.length
          ? linked.map((l: any) => { const f = (myFarms ?? []).find((x: any) => x.id === l.farm_id); return f ? toFarm(f, Number(l.acres)) : null; }).filter(Boolean) as FarmDraft[]
          : (myFarms ?? []).map((f: any) => toFarm(f));
        const myLines: LineDraft[] = (lines ?? []).filter((l: any) => l.campaign_id === c.id).map((l: any, i: number) => ({
          key: `l${i}`, kind: (["seed", "fertilizer", "pesticide"].includes(l.category) ? l.category : "fertilizer") as LineKind,
          productId: l.custom_request_id ? null : l.product_id, customName: l.custom_request_id ? l.product_name : null, quantity: String(Number(l.quantity)), unit: l.unit,
        }));
        return (
          <CampaignBookingForm key={c.id} campaign={c} open={isCampaignOpen(c)} products={products} farmerCode={farmer.farmer_code ?? null}
            initialFarms={farms} initialLines={myLines} initialNotes={b?.notes ?? ""} existing={!!b} />
        );
      })}
    </div>
  );
}
