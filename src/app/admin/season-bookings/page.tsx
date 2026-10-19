import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { loadSeasonBookings, loadCampaignProducts, STAFF_ROLES, ADMIN_ROLES } from "@/lib/campaigns/season-data";
import { BookingsDashboard } from "./dashboard";
import { ImportPanel, CustomProductQueue } from "./import-panel";

export const dynamic = "force-dynamic";

/** Admin: Season Booking (Gandum) -- tamam kisanon ki booking, farms map, export/import. */
export default async function SeasonBookingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  if (!user || !me?.is_active || !STAFF_ROLES.includes(String(me.role))) {
    return <div className="mx-auto max-w-3xl"><PageHeader title="Season Bookings" /><Card><p className="text-sm text-red-700">Ye safha sirf staff ke liye hai.</p></Card></div>;
  }
  const isAdmin = ADMIN_ROLES.includes(String(me.role));
  const service = createServiceClient() as any;
  const { data: campaign } = await service.from("booking_campaigns").select("id, name, crop, deadline").eq("crop", "wheat").order("deadline", { ascending: false }).limit(1).maybeSingle();
  if (!campaign) return <div className="mx-auto max-w-3xl"><PageHeader title="Season Bookings" /><Card><p className="text-sm">Gandum ki koi campaign nahi mili.</p></Card></div>;

  const [bookings, products, { data: customs }, { data: batch }] = await Promise.all([
    loadSeasonBookings(service, campaign.id),
    loadCampaignProducts(service),
    service.from("custom_product_requests").select("id, name, line_kind, quantity, unit, created_by, created_at, farmers(full_name, phone_number)").eq("campaign_id", campaign.id).eq("status", "pending").order("created_at", { ascending: false }).limit(100),
    isAdmin ? service.from("season_import_batches").select("id, file_name, total_rows, ok_rows, warning_rows, error_rows, created_by, created_at").eq("campaign_id", campaign.id).eq("status", "preview").order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null },
  ]);
  const { data: batchRows } = batch ? await service.from("season_import_rows").select("row_no, raw, result, messages").eq("batch_id", batch.id).order("row_no").limit(500) : { data: [] };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <BookingsDashboard campaign={campaign} bookings={bookings} isAdmin={isAdmin} />
      {isAdmin && <ImportPanel campaignId={campaign.id} batch={batch ? { ...batch, mine: batch.created_by === user.id } : null} rows={(batchRows ?? []) as any[]} />}
      {isAdmin && <CustomProductQueue items={((customs ?? []) as any[]).map((c) => ({ ...c, mine: c.created_by === user.id }))} products={products} />}
    </div>
  );
}
