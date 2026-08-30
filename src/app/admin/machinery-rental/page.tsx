import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { MachineryClient } from "./machinery-client";

export const dynamic = "force-dynamic";

export default async function MachineryRentalPage({
  searchParams,
}: {
  searchParams: Promise<{ convert_farmer?: string; convert_request?: string; convert_acres?: string; convert_location?: string }>;
}) {
  const lang = getLanguageFromCookies("rm");
  const params = await searchParams;
  const supabase = createClient();

  const [
    { data: vendors },
    { data: rawMachines },
    { data: farmers },
    { data: rawBookings },
  ] = await Promise.all([
    // Band vendor bhi fehrist mein aata hai (181) -- warna usay dobara
    // chalu karne ka koi raasta hi nahi bachta. Us ki qatar halki
    // dikhti hai aur nayi booking us par nahi jati.
    supabase.from("machinery_vendors").select("id, vendor_name, contact_person, phone, user_id, is_active").order("is_active", { ascending: false }).order("vendor_name"),
    supabase.from("machinery_vendor_machines").select("*, machinery_vendors(vendor_name)").eq("is_available", true).order("machine_type"),
    supabase.from("farmers").select("id, full_name, farmer_code, booking_link_token").eq("is_deleted", false).order("full_name"),
    supabase
      .from("machinery_bookings")
      .select("*, farmers(full_name), machinery_vendors(vendor_name), machinery_vendor_machines(machine_type, model)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  // Commission ka rate ek hi jagah se aata hai -- machine par nahi
  // (migration 120). Yahan se le kar screen par dikhaya jata hai, taake
  // admin wahi number dekhe jo bill par lagta hai.
  const { data: rateRow } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "machinery_commission_rate")
    .maybeSingle();
  const commissionRate = rateRow?.value === undefined || rateRow?.value === null ? 12 : Number(rateRow.value);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const canEditCommission = ["owner", "super_admin", "admin"].includes(me?.role ?? "");

  // Har booking ka asal baqi -- bill aur machinery_payments se, booking
  // par pare hue purane khanon se nahi.
  //
  // Ye zaroori tha: nayi zanjeer amount_received_from_farmer ko haath
  // nahi lagati (wo paisa machinery_payments mein jata hai). Us purane
  // khane par bharosa karte to poori payment ke baad bhi ye fehrist
  // "Farmer Se Lena Rs 95,000" dikhati rehti.
  const [{ data: allBills }, { data: allPayments }] = await Promise.all([
    supabase.from("machinery_bills").select("booking_id, balance_payable, vendor_payable"),
    supabase.from("machinery_payments").select("booking_id, amount, kind"),
  ]);

  const finalPaidBy = new Map<string, number>();
  (allPayments ?? [])
    .filter((p) => p.kind === "final")
    .forEach((p) => finalPaidBy.set(p.booking_id, (finalPaidBy.get(p.booking_id) ?? 0) + Number(p.amount)));

  const billBy = new Map<string, { balance: number; vendor: number }>();
  (allBills ?? []).forEach((b) =>
    billBy.set(b.booking_id, { balance: Number(b.balance_payable), vendor: Number(b.vendor_payable) })
  );

  // Vendor ke sath kya juda hua hai -- mitane ka button isi par hai.
  const [{ data: vendorMachines }, { data: vendorBookings }] = await Promise.all([
    supabase.from("machinery_vendor_machines").select("vendor_id"),
    supabase.from("machinery_bookings").select("vendor_id"),
  ]);
  const machineCount = new Map<string, number>();
  (vendorMachines ?? []).forEach((m) => {
    if (m.vendor_id) machineCount.set(m.vendor_id, (machineCount.get(m.vendor_id) ?? 0) + 1);
  });
  const bookingCount = new Map<string, number>();
  (vendorBookings ?? []).forEach((b) => {
    if (b.vendor_id) bookingCount.set(b.vendor_id, (bookingCount.get(b.vendor_id) ?? 0) + 1);
  });

  // Login ka pata -- yehi wo cheez hai jis se do ek jaise vendor alag
  // pehchane jate hain.
  //
  // Gaon mein do bandon ka naam aur number tak ek jaisa ho sakta hai,
  // aur safhe par dono qatarein bilkul ek jaisi lagti thin. Malik ko
  // har ek ke andar ja kar dekhna parta tha ke asli kaun sa hai.
  // Login ka pata kabhi do ka ek nahi hota ("farmanali@" aur
  // "farmanali2@"), aur wohi vendor apne phone par likhta hai -- so
  // pehchan ke liye sab se saaf nishani wohi hai.
  const withLogin = (vendors ?? []).filter((v) => v.user_id);
  const emailBy = new Map<string, string>();
  if (withLogin.length > 0) {
    const service = createServiceClient();
    const found = await Promise.all(
      withLogin.map(async (v) => {
        const { data } = await service.auth.admin.getUserById(v.user_id as string);
        return [v.id, data?.user?.email ?? null] as const;
      })
    );
    found.forEach(([id, email]) => {
      if (email) emailBy.set(id, email);
    });
  }

  const vendorRows = (vendors ?? []).map((v) => ({
    id: v.id,
    vendor_name: v.vendor_name,
    contact_person: v.contact_person,
    phone: v.phone,
    user_id: v.user_id,
    is_active: v.is_active,
    machine_count: machineCount.get(v.id) ?? 0,
    booking_count: bookingCount.get(v.id) ?? 0,
    login_email: emailBy.get(v.id) ?? null,
  }));

  const machines = (rawMachines ?? []).map((m: any) => {
    const vendor = Array.isArray(m.machinery_vendors) ? m.machinery_vendors[0] : m.machinery_vendors;
    return {
      id: m.id,
      vendor_id: m.vendor_id,
      // ART ki apni machine par vendor hota hi nahi -- wahan "-" likhna
      // ye samjhata hai ke vendor darj karna reh gaya.
      vendor_name: m.owner === "art" ? "ART (apni machine)" : (vendor?.vendor_name ?? "-"),
      machine_type: m.machine_type,
      model: m.model,
      rate_type: m.rate_type,
      rate_amount: Number(m.rate_amount),
      driver_name: m.driver_name ?? null,
      driver_phone: m.driver_phone ?? null,
    };
  });

  const bookings = (rawBookings ?? []).map((b: any) => {
    const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
    const vendor = Array.isArray(b.machinery_vendors) ? b.machinery_vendors[0] : b.machinery_vendors;
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    return {
      id: b.id,
      booking_number: b.booking_number,
      booking_date: b.booking_date,
      farmer_name: farmer?.full_name ?? "-",
      vendor_name: vendor?.vendor_name ?? "-",
      machine_label: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
      acres: b.acres ? Number(b.acres) : null,
      hours: b.hours ? Number(b.hours) : null,
      days: b.days ? Number(b.days) : null,
      total_amount: Number(b.total_amount),
      commission_amount: Number(b.commission_amount),
      vendor_payable: Number(b.vendor_payable),
      amount_received_from_farmer: Number(b.amount_received_from_farmer),
      amount_paid_to_vendor: Number(b.amount_paid_to_vendor),
      status: b.status,
      // Bill ban chuka ho to asal baqi wahin se; warna abhi kuch maangna
      // hi nahi banta -- rate tak tay nahi hua hota.
      farmer_remaining: billBy.has(b.id)
        ? Math.max(0, Math.round((billBy.get(b.id)!.balance - (finalPaidBy.get(b.id) ?? 0)) * 100) / 100)
        : 0,
      vendor_remaining: billBy.has(b.id)
        ? Math.max(0, Math.round((billBy.get(b.id)!.vendor - Number(b.amount_paid_to_vendor)) * 100) / 100)
        : 0,
      has_bill: billBy.has(b.id),
    };
  });

  const totalBookingsValue = bookings.reduce((s, b) => s + b.total_amount, 0);
  const totalCommissionEarned = bookings.reduce((s, b) => s + b.commission_amount, 0);
  const totalReceivedFromFarmers = bookings.reduce((s, b) => s + b.amount_received_from_farmer, 0);
  const totalPaidToVendors = bookings.reduce((s, b) => s + b.amount_paid_to_vendor, 0);

  return (
    <div>
      <PageHeader title={t("mc_title", lang)} description={t("mc_subtitle", lang)} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("mc_total_bookings_value", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalBookingsValue.toLocaleString()}</p>
        </Card>
        <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-green-600">{t("mc_commission_earned", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-green-700">Rs {totalCommissionEarned.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("mc_from_farmers", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">Rs {totalReceivedFromFarmers.toLocaleString()}</p>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-600">{t("mc_to_vendors", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700">Rs {totalPaidToVendors.toLocaleString()}</p>
        </Card>
      </div>

      <MachineryClient
        vendors={vendorRows}
        machines={machines}
        farmers={farmers ?? []}
        bookings={bookings}
        commissionRate={commissionRate}
        canEditCommission={canEditCommission}
        defaultFarmerId={params.convert_farmer}
        defaultRequestId={params.convert_request}
        defaultAcres={params.convert_acres}
        defaultLocation={params.convert_location ? decodeURIComponent(params.convert_location) : undefined}
      />
    </div>
  );
}