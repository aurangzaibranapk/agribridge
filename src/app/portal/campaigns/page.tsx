import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isCampaignOpen } from "@/lib/campaigns/booking";
import { CampaignBookingForm, type CampaignProduct } from "./booking-form";

export const dynamic = "force-dynamic";

/** Kisan: booking campaigns (Gandum Season 2026). Demand-first, koi payment nahi. */
export default async function CampaignsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await (supabase as any).from("farmers").select("id, full_name, signup_approval_status").eq("user_id", user.id).maybeSingle();
  if (!farmer) redirect("/login");

  const sb = supabase as any;
  const [{ data: campaigns }, { data: products }, { data: bookings }, { data: lines }] = await Promise.all([
    sb.from("booking_campaigns").select("id, name, crop, deadline, is_active, description").eq("is_active", true).order("deadline"),
    sb.from("products").select("id, name, pack_size, unit").eq("is_deleted", false).order("name"),
    sb.from("campaign_bookings").select("id, campaign_id, acres, notes").eq("farmer_id", farmer.id),
    sb.from("farmer_product_demands").select("campaign_id, product_id, product_name, quantity, unit, category, status").eq("farmer_id", farmer.id).not("campaign_id", "is", null).neq("status", "cancelled"),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">Booking / بکنگ</h1>
      {farmer.signup_approval_status === "pending" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Aap ka signup admin ki manzoori ka intezar kar raha hai. Booking abhi bhi bhej sakte hain; daftar check karega.</p>
      )}
      {(campaigns ?? []).length === 0 && <p className="text-sm text-surface-600">Abhi koi booking campaign khuli nahi.</p>}
      {(campaigns ?? []).map((c: any) => {
        const b = (bookings ?? []).find((x: any) => x.campaign_id === c.id) ?? null;
        return (
          <CampaignBookingForm
            key={c.id}
            campaign={c}
            open={isCampaignOpen(c)}
            products={(products ?? []) as CampaignProduct[]}
            existing={b ? { acres: Number(b.acres), notes: b.notes ?? "", lines: (lines ?? []).filter((l: any) => l.campaign_id === c.id) } : null}
          />
        );
      })}
    </div>
  );
}
