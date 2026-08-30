"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { postMachineryVendorPayout, failed } from "@/lib/ledger/rules";

export interface ActionState {
  error?: string;
  success?: boolean;
}

// Purana booking form aur us ka action hata diya gaya.
//
// Booking ab machinery-lifecycle.ts se banti hai, jahan booking ka
// andaza, kisan se tay hua final rate, aur kattai ke baad ka asal kaam
// teen alag cheezein hain. Purana action rate aur total seedha booking
// par likh deta tha -- yani wahi ghalti jo is poore module ki wajah
// bani: bill andaze par ban jata tha.
//
// Ise sirf istemal se hataana kaafi nahi tha: pari rehti to kisi din
// koi ise dobara jorh deta aur zanjeer chup chaap bypass ho jati.

export async function createMachineryVendor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vendorName = String(formData.get("vendor_name") ?? "").trim();
  const contactPerson = (formData.get("contact_person") as string) || null;
  const phone = (formData.get("phone") as string) || null;
  const cnic = (formData.get("cnic") as string) || null;
  const address = (formData.get("address") as string) || null;
  if (!vendorName) return { error: "Vendor ka naam likhein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("machinery_vendors").insert({
    vendor_name: vendorName,
    contact_person: contactPerson,
    phone,
    cnic,
    address,
    created_by: user?.id ?? null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/machinery-rental");
  return { success: true };
}

export async function createVendorMachine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const vendorId = String(formData.get("vendor_id") ?? "");
  const machineType = String(formData.get("machine_type") ?? "").trim();
  const model = (formData.get("model") as string) || null;
  const rateType = String(formData.get("rate_type") ?? "");
  const rateAmount = Number(formData.get("rate_amount") ?? 0);
  const notes = (formData.get("notes") as string) || null;

  // Driver machine ke sath likha jata hai, har booking par nahi. Wohi
  // machine, wohi driver -- har dafa naya likhwana ek hi naam ke teen
  // hijje aur ek galat phone number paida karta hai.
  const driverName = (formData.get("driver_name") as string)?.trim() || null;
  const driverPhone = (formData.get("driver_phone") as string)?.trim() || null;

  if (!vendorId) return { error: "Vendor select karein." };
  if (!machineType) return { error: "Machine type likhein." };
  if (!["per_acre", "per_hour", "per_day"].includes(rateType)) return { error: "Rate type sahi select karein." };
  if (!rateAmount || rateAmount <= 0) return { error: "Rate sahi likhein." };

  const { error } = await supabase.from("machinery_vendor_machines").insert({
    vendor_id: vendorId,
    machine_type: machineType,
    model,
    rate_type: rateType,
    rate_amount: rateAmount,
    driver_name: driverName,
    driver_phone: driverPhone,
    notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/machinery-rental");
  return { success: true };
}


// updateBookingStatus aur completeMachineryBooking hata diye gaye.
//
// Dono ek hi darwaza the: booking ko seedha "completed" kar dena --
// bina asal raqbe ke, bina bill ke. Jo booking is raaste se guzarti thi
// wo har qatar se nikal jati thi, aur kisan se lena kabhi darj hi na
// hota. Diesel us modal mein darj ho jata tha, yani kharcha likha hua
// aur aamdani ghayab.
//
// Ab dono cheezein apni jagah par hain: diesel machine ki rawangi par
// (142), aur booking ki halat sirf zanjeer ke qadmon se badalti hai --
// kaam darj hone par, bill banne par, paisa aane par.
//
// Inhein sirf istemal se hataana kaafi nahi tha: pari rehti to kisi din
// koi dobara jorh deta aur zanjeer chup chaap bypass ho jati.

export async function recordVendorPayout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  if (!bookingId) return { error: "Missing booking id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Account select karein." };

  const { data: booking } = await supabase.from("machinery_bookings").select("vendor_payable, amount_paid_to_vendor, booking_number, vendor_id").eq("id", bookingId).single();
  if (!booking) return { error: "Booking nahi mili." };
  const remaining = Number(booking.vendor_payable ?? 0) - Number(booking.amount_paid_to_vendor);
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} Vendor ko dena baaqi hai.` };

  // ART ne is booking par vendor ke liye jo diesel diya, wo isi
  // adaigi mein wapas aata hai (170).
  //
  // Vendor ke naam par jo raqam khari hai wo poori kam hoti hai,
  // magar cash sirf farq nikalta hai -- baqi wo pehle hi diesel ki
  // shakal mein ja chuka hai. Alag se "recovery" darj karwana wo
  // qadam hai jo koi kabhi nahi karta, aur phir 1120 mein ek jor
  // hamesha ke liye para reh jata hai.
  const { data: dieselRows } = await supabase
    .from("machinery_fuel_logs")
    .select("amount")
    .eq("booking_id", bookingId)
    .eq("vendor_recoverable", true)
    .eq("verification_status", "verified");

  const dieselTotal = (dieselRows ?? []).reduce((sum, r) => sum + Number(r.amount ?? 0), 0);
  const alreadyPaid = Number(booking.amount_paid_to_vendor);
  // Diesel sirf utna hi wapas aata hai jitna abhi tak wapas nahi aaya.
  const dieselLeft = Math.max(0, Math.round((dieselTotal - alreadyPaid) * 100) / 100);
  const dieselRecovered = Math.min(dieselLeft, amount);
  const cashOut = Math.round((amount - dieselRecovered) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Kharche ki qatar sirf us paise ki banti hai jo waqai bahar gaya.
  // Diesel ka kharcha us din darj ho chuka tha.
  let txn: { id: string } | null = null;
  if (cashOut > 0) {
    const { data: row, error: txnError } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: accountId,
        transaction_type: "expense",
        category: "Machinery Rental - Vendor Payout",
        amount: cashOut,
        transaction_date: new Date().toISOString().slice(0, 10),
        notes:
          dieselRecovered > 0
            ? `Booking ${booking.booking_number} - Vendor payout (Rs ${dieselRecovered.toLocaleString()} diesel wapas kata)`
            : `Booking ${booking.booking_number} - Vendor payout`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (txnError || !row) return { error: txnError?.message ?? "Payout darj nahi hua." };
    txn = row;
  }

  // Account ka balance yahan haath se KAM NAHI kiya jata.
  //
  // finance_transactions par trigger (trg_finance_transaction_apply) khud
  // ye kaam karta hai. Pehle yahan dobara bhi kata jata tha, yani Rs 1,000
  // ke payout par balance Rs 2,000 kam hota tha. Jaanch kar ke dekha:
  // 0 -> trigger ke baad -1000 -> code ke apne update ke baad -2000.

  const posted = await postMachineryVendorPayout({
    bookingId,
    vendorId: booking.vendor_id,
    amount,
    dieselRecovered,
    accountId,
    description:
      dieselRecovered > 0
        ? `Machinery ${booking.booking_number} — vendor ko us ka hissa (ART ka diesel Rs ${dieselRecovered.toLocaleString()} wapas)`
        : `Machinery ${booking.booking_number} — vendor ko us ka hissa`,
    ctx: {
      createdBy: user?.id ?? null,
      claims: txn ? [{ table: "finance_transactions", rowId: txn.id }] : [],
    },
  });
  if (failed(posted)) {
    if (txn) await createServiceClient().from("finance_transactions").delete().eq("id", txn.id);
    return { error: `Ledger mein nahi gaya, is liye payout darj nahi kiya: ${posted.error}` };
  }

  await supabase
    .from("machinery_bookings")
    .update({ amount_paid_to_vendor: Number(booking.amount_paid_to_vendor) + amount })
    .eq("id", bookingId);

  revalidatePath("/admin/machinery-rental");
  revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function emailMachineryBookingSlip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const toEmail = String(formData.get("to_email") ?? "").trim();
  if (!bookingId) return { error: "Missing booking id." };
  if (!toEmail) return { error: "Email likhein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select(
      "booking_number, booking_date, acres, hours, days, rate_amount, total_amount, amount_received_from_farmer, location_address, farmers(full_name, phone_number), machinery_vendors(vendor_name), machinery_vendor_machines(machine_type, model)"
    )
    .eq("id", bookingId)
    .single();
  if (!booking) return { error: "Booking nahi mili." };

  const farmer = Array.isArray((booking as any).farmers) ? (booking as any).farmers[0] : (booking as any).farmers;
  const vendor = Array.isArray((booking as any).machinery_vendors) ? (booking as any).machinery_vendors[0] : (booking as any).machinery_vendors;
  const machine = Array.isArray((booking as any).machinery_vendor_machines) ? (booking as any).machinery_vendor_machines[0] : (booking as any).machinery_vendor_machines;

  const quantityLabel = booking.acres ? `${booking.acres} Acres` : booking.hours ? `${booking.hours} Hours` : `${booking.days} Days`;

  const { generateMachineryBookingSlipPdf } = await import("@/lib/machinery-booking-slip-pdf");
  const pdfBuffer = await generateMachineryBookingSlipPdf({
    slipNumber: booking.booking_number,
    farmerName: farmer?.full_name ?? "-",
    farmerPhone: farmer?.phone_number ?? null,
    vendorName: vendor?.vendor_name ?? "-",
    machineLabel: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
    bookingDate: booking.booking_date,
    quantityLabel,
    rateAmount: Number(booking.rate_amount),
    totalAmount: Number(booking.total_amount),
    amountReceived: Number(booking.amount_received_from_farmer),
    locationAddress: booking.location_address,
  });

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST ?? "mail.alranatraders.pk",
      port: 587,
      secure: false,
      auth: { user: process.env.JOB_SMTP_USER ?? "job@alranatraders.pk", pass: process.env.JOB_SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Al Rana Traders" <${process.env.JOB_SMTP_USER ?? "job@alranatraders.pk"}>`,
      to: toEmail,
      subject: `Machinery Booking Slip - ${farmer?.full_name ?? ""}`,
      html: `<p>Assalam-o-Alaikum ${farmer?.full_name ?? ""},</p><p>Aapki Machinery Booking ki slip is email ke sath attach hai.</p><p>Total: Rs ${Number(booking.total_amount).toLocaleString()}</p><p>Al Rana Traders - AgriBridge</p>`,
      attachments: [{ filename: `machinery-slip-${booking.booking_number}.pdf`, content: pdfBuffer }],
    });
  } catch {
    return { error: "Email bhejne mein masla hua." };
  }
  return { success: true };
}

export async function emailMachineryBookingsList(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const toEmail = String(formData.get("to_email") ?? "").trim();
  if (!toEmail) return { error: "Email likhein." };

  const { data: bookings } = await supabase
    .from("machinery_bookings")
    .select(
      "booking_number, booking_date, total_amount, amount_received_from_farmer, status, farmers(full_name, phone_number), machinery_vendor_machines(machine_type, model)"
    )
    .order("booking_date", { ascending: false });

  const rows = (bookings ?? []).map((b: any) => {
    const farmer = Array.isArray(b.farmers) ? b.farmers[0] : b.farmers;
    const machine = Array.isArray(b.machinery_vendor_machines) ? b.machinery_vendor_machines[0] : b.machinery_vendor_machines;
    return {
      bookingNumber: b.booking_number,
      bookingDate: b.booking_date,
      farmerName: farmer?.full_name ?? "-",
      farmerPhone: farmer?.phone_number ?? null,
      machineLabel: `${machine?.machine_type ?? ""}${machine?.model ? ` (${machine.model})` : ""}`,
      totalAmount: Number(b.total_amount),
      amountReceived: Number(b.amount_received_from_farmer),
      status: b.status,
    };
  });

  const { generateMachineryBookingsListPdf } = await import("@/lib/machinery-bookings-list-pdf");
  const pdfBuffer = await generateMachineryBookingsListPdf(rows);

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST ?? "mail.alranatraders.pk",
      port: 587,
      secure: false,
      auth: { user: process.env.JOB_SMTP_USER ?? "job@alranatraders.pk", pass: process.env.JOB_SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Al Rana Traders" <${process.env.JOB_SMTP_USER ?? "job@alranatraders.pk"}>`,
      to: toEmail,
      subject: `Machinery Bookings List - ${new Date().toLocaleDateString()}`,
      html: `<p>Machinery Bookings ki poori list is email ke sath attach hai.</p><p>Total Bookings: ${rows.length}</p><p>Al Rana Traders - AgriBridge</p>`,
      attachments: [{ filename: `machinery-bookings-list.pdf`, content: pdfBuffer }],
    });
  } catch {
    return { error: "Email bhejne mein masla hua." };
  }
  return { success: true };
}