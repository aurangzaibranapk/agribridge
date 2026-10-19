/** Server-only: Season Booking admin/export ke liye data (service role, auth ke baad hi bulayein). */
import type { ExportBooking, CampaignProductRow } from "./season-v2";
import type { LineKind } from "./booking";

export const STAFF_ROLES = ["owner", "super_admin", "admin", "manager", "sales_staff"];
export const ADMIN_ROLES = ["owner", "super_admin", "admin"];

export interface AdminBooking extends ExportBooking { id: string; farmerId: string; district: string | null }

export async function loadCampaignProducts(sb: any): Promise<CampaignProductRow[]> {
  const { data } = await sb.from("v_campaign_products").select("id, name, pack_size, unit, category_name, line_kind").order("name");
  return (data ?? []) as CampaignProductRow[];
}

export async function loadSeasonBookings(service: any, campaignId: string): Promise<AdminBooking[]> {
  const { data: bookings } = await service
    .from("campaign_bookings")
    .select("id, farmer_id, acres, status, created_at, updated_at, farmers(farmer_code, full_name, phone_number, village, district)")
    .eq("campaign_id", campaignId).neq("status", "cancelled").order("updated_at", { ascending: false }).limit(5000);
  const list = (bookings ?? []) as any[];
  if (!list.length) return [];
  const ids = list.map((b) => b.id);
  const [{ data: bf }, { data: dem }] = await Promise.all([
    service.from("campaign_booking_farms").select("booking_id, acres, farms(name, village, latitude, longitude)").in("booking_id", ids),
    service.from("farmer_product_demands").select("campaign_booking_id, product_name, quantity, unit, category, status, custom_request_id").in("campaign_booking_id", ids).neq("status", "cancelled"),
  ]);
  return list.map((b) => {
    const f = b.farmers ?? {};
    return {
      id: b.id, farmerId: b.farmer_id, farmerCode: f.farmer_code ?? null, farmerName: f.full_name ?? "—", phone: f.phone_number ?? null,
      village: f.village ?? null, district: f.district ?? null, bookingAcres: Number(b.acres), status: b.status, submittedAt: b.updated_at ?? b.created_at,
      farms: ((bf ?? []) as any[]).filter((x) => x.booking_id === b.id).map((x) => ({
        name: x.farms?.name ?? "Farm", village: x.farms?.village ?? null, acres: Number(x.acres),
        lat: x.farms?.latitude != null ? Number(x.farms.latitude) : null, lng: x.farms?.longitude != null ? Number(x.farms.longitude) : null,
      })),
      lines: ((dem ?? []) as any[]).filter((d) => d.campaign_booking_id === b.id).map((d) => ({
        kind: (["seed", "fertilizer", "pesticide"].includes(d.category) ? d.category : "fertilizer") as LineKind,
        product: d.product_name, custom: !!d.custom_request_id, quantity: Number(d.quantity), unit: d.unit, status: d.status,
      })),
    };
  });
}
