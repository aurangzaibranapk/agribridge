/** Server-only: ek kisan ki season booking save karna (farmer form aur sheet import dono). Demand-first: koi payment/stock/ledger nahi. */
import type { CleanFarm, CleanLineV2 } from "./season-v2";
import { LINE_KIND_CATEGORY } from "./booking";

export interface SaveCtx {
  farmer: { id: string; organization_id: string | null; branch_id: string | null };
  campaign: { id: string; name: string; deadline: string };
  farms: CleanFarm[]; acres: number; lines: CleanLineV2[]; notes: string | null;
  source: "form" | "munshi"; actorId: string; productNames: Map<string, string>;
}

export async function saveSeasonBooking(service: any, c: SaveCtx): Promise<{ ok: true; bookingId: string; lineCount: number } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const { data: booking, error: bErr } = await service.from("campaign_bookings")
    .upsert({ campaign_id: c.campaign.id, farmer_id: c.farmer.id, organization_id: c.farmer.organization_id, acres: c.acres, notes: c.notes, status: "submitted", updated_at: now }, { onConflict: "campaign_id,farmer_id" })
    .select("id").single();
  if (bErr || !booking) return { ok: false, error: "Booking save nahi hui. Dobara koshish karein." };

  // Farms: kisan ke apne farm (naam se) update, warna naya. Pin sirf tab likhte hain jab diya ho.
  const { data: own } = await service.from("farms").select("id, name").eq("farmer_id", c.farmer.id);
  const byId = new Map<string, string>(((own ?? []) as any[]).map((f) => [f.id, f.id]));
  const byName = new Map<string, string>(((own ?? []) as any[]).map((f) => [String(f.name ?? "").trim().toLowerCase(), f.id]));
  const links: { booking_id: string; farm_id: string; crop: string; acres: number }[] = [];
  for (const f of c.farms) {
    const pin = f.lat != null && f.lng != null
      ? { latitude: f.lat, longitude: f.lng, location_source: f.src ?? "manual_pin", location_accuracy_m: f.src === "gps" ? f.accuracy ?? null : null, location_captured_at: now, location_captured_by: c.actorId }
      : {};
    const existing = (f.farmId && byId.get(f.farmId)) || byName.get(f.name.toLowerCase());
    let farmId = existing ?? null;
    if (farmId) {
      const { error } = await service.from("farms").update({ name: f.name, area_acres: f.acres, ...(f.village ? { village: f.village } : {}), ...pin }).eq("id", farmId).eq("farmer_id", c.farmer.id);
      if (error) return { ok: false, error: `${f.name}: farm save nahi hua.` };
    } else {
      const { data: nf, error } = await service.from("farms").insert({ farmer_id: c.farmer.id, name: f.name, area_acres: f.acres, village: f.village, ...pin }).select("id").single();
      if (error || !nf) return { ok: false, error: `${f.name}: farm save nahi hua.` };
      farmId = nf.id; byName.set(f.name.toLowerCase(), nf.id);
    }
    links.push({ booking_id: booking.id, farm_id: farmId!, crop: "wheat", acres: f.acres });
  }
  await service.from("campaign_booking_farms").delete().eq("booking_id", booking.id);
  const { error: lErr } = await service.from("campaign_booking_farms").insert(links);
  if (lErr) return { ok: false, error: "Farms booking se jor nahi sake." };

  // Purani pending lines aur pending custom products hatao, phir nayi.
  await service.from("farmer_product_demands").update({ status: "cancelled", updated_at: now }).eq("campaign_booking_id", booking.id).eq("status", "pending");
  await service.from("custom_product_requests").update({ status: "rejected", reviewed_at: now }).eq("campaign_booking_id", booking.id).eq("status", "pending");

  const purpose = `${c.campaign.name} — ${c.acres} acre gandum`;
  const rows: any[] = [];
  for (const l of c.lines) {
    let customId: string | null = null;
    if (!l.productId) {
      const { data: cr, error } = await service.from("custom_product_requests").insert({
        organization_id: c.farmer.organization_id, farmer_id: c.farmer.id, campaign_id: c.campaign.id, campaign_booking_id: booking.id,
        line_kind: l.kind, name: l.customName, quantity: l.quantity, unit: l.unit, created_by: c.actorId,
      }).select("id").single();
      if (error || !cr) return { ok: false, error: "Apni product save nahi hui." };
      customId = cr.id;
    }
    rows.push({
      organization_id: c.farmer.organization_id, branch_id: c.farmer.branch_id, farmer_id: c.farmer.id,
      product_id: l.productId, product_name: l.productId ? c.productNames.get(l.productId) ?? "Product" : l.customName,
      quantity: l.quantity, unit: l.unit, needed_by: c.campaign.deadline, purpose, notes: c.notes, status: "pending",
      payment_required_at_registration: false, category: LINE_KIND_CATEGORY[l.kind], source: c.source,
      campaign_id: c.campaign.id, campaign_booking_id: booking.id, custom_request_id: customId,
    });
  }
  const { error: dErr } = await service.from("farmer_product_demands").insert(rows);
  if (dErr) return { ok: false, error: "Demand save nahi hui. Dobara koshish karein." };
  return { ok: true, bookingId: booking.id, lineCount: rows.length };
}
