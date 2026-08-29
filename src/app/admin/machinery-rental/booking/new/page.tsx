import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { NewBookingForm } from "./new-booking-form";

export const dynamic = "force-dynamic";

export default async function NewMachineryBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ convert_farmer?: string; convert_request?: string; convert_acres?: string; convert_location?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const [{ data: farmers }, { data: rawMachines }, { data: accounts }, { data: bills }, { data: payments }] =
    await Promise.all([
      supabase
        .from("farmers")
        .select("id, full_name, farmer_code, phone_number, village")
        .eq("is_deleted", false)
        .order("full_name"),
      supabase
        .from("machinery_vendor_machines")
        .select("id, machine_type, model, rate_type, rate_amount, machinery_vendors(vendor_name)")
        .eq("is_available", true)
        .order("machine_type"),
      supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type"),
      supabase.from("machinery_bills").select("booking_id, balance_payable"),
      supabase.from("machinery_payments").select("booking_id, amount, kind"),
    ]);

  // Kisan ka pichla machinery hisaab. Ye jaan boojh kar "machinery ka
  // baqi" hai, kisan ka poora khata nahi -- yahan staff ko wohi cheez
  // chahiye jo isi kaam se juRi hai, aur mila-jula number dikhana in
  // dono ko aik samajh lene ki wajah ban jata hai.
  const { data: bookingRows } = await supabase.from("machinery_bookings").select("id, farmer_id, status");

  const finalPaidByBooking = new Map<string, number>();
  (payments ?? [])
    .filter((p) => p.kind === "final")
    .forEach((p) => finalPaidByBooking.set(p.booking_id, (finalPaidByBooking.get(p.booking_id) ?? 0) + Number(p.amount)));

  const balanceByBooking = new Map<string, number>();
  (bills ?? []).forEach((b) =>
    balanceByBooking.set(b.booking_id, Number(b.balance_payable) - (finalPaidByBooking.get(b.booking_id) ?? 0))
  );

  const history = new Map<string, { bookings: number; outstanding: number }>();
  (bookingRows ?? []).forEach((b) => {
    const entry = history.get(b.farmer_id) ?? { bookings: 0, outstanding: 0 };
    entry.bookings += 1;
    entry.outstanding += Math.max(0, balanceByBooking.get(b.id) ?? 0);
    history.set(b.farmer_id, entry);
  });

  // Paisa lene wale ka naam form par pehle se dikhta hai. Baad mein
  // record se pata chal jana kaafi nahi -- jo banda cash pakaR raha hai
  // usay usi waqt nazar aana chahiye ke ye us ke naam par likha ja raha
  // hai.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    : { data: null };

  const machines = (rawMachines ?? []).map((m: any) => {
    const vendor = Array.isArray(m.machinery_vendors) ? m.machinery_vendors[0] : m.machinery_vendors;
    return {
      id: m.id,
      machine_type: m.machine_type,
      model: m.model,
      rate_type: m.rate_type,
      rate_amount: Number(m.rate_amount),
      vendor_name: vendor?.vendor_name ?? "-",
    };
  });

  return (
    <div>
      <PageHeader
        title="Nayi Machinery Booking"
        description="Booking se le kar final payment tak sab kuch isi Booking ID ke neeche chalega."
      />
      <NewBookingForm
        farmers={(farmers ?? []).map((f) => ({
          id: f.id,
          full_name: f.full_name ?? "",
          farmer_code: f.farmer_code ?? "",
          phone_number: f.phone_number ?? "",
          village: f.village ?? "",
          previous_bookings: history.get(f.id)?.bookings ?? 0,
          outstanding: history.get(f.id)?.outstanding ?? 0,
        }))}
        machines={machines}
        accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name, account_type: a.account_type }))}
        staffName={me?.full_name ?? null}
        defaultFarmerId={params.convert_farmer}
        defaultRequestId={params.convert_request}
        defaultAcres={params.convert_acres}
        defaultLocation={params.convert_location ? decodeURIComponent(params.convert_location) : undefined}
      />
    </div>
  );
}
