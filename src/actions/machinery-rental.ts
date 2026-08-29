"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { postCashIn, postCashOut, postWalletMovement, ACC, failed } from "@/lib/ledger/rules";
import { notifyRoles } from "@/lib/notifications";

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
  const commissionPercentage = Number(formData.get("commission_percentage") ?? 0);
  const notes = (formData.get("notes") as string) || null;

  if (!vendorId) return { error: "Vendor select karein." };
  if (!machineType) return { error: "Machine type likhein." };
  if (!["per_acre", "per_hour", "per_day"].includes(rateType)) return { error: "Rate type sahi select karein." };
  if (!rateAmount || rateAmount <= 0) return { error: "Rate sahi likhein." };
  if (commissionPercentage < 0 || commissionPercentage > 100) return { error: "Commission % 0-100 ke darmiyan hona chahiye." };

  const { error } = await supabase.from("machinery_vendor_machines").insert({
    vendor_id: vendorId,
    machine_type: machineType,
    model,
    rate_type: rateType,
    rate_amount: rateAmount,
    commission_percentage: commissionPercentage,
    notes,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/machinery-rental");
  return { success: true };
}


export async function updateBookingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!bookingId) return { error: "Missing booking id." };
  if (!["pending", "confirmed", "in_progress", "completed", "cancelled"].includes(status)) return { error: "Status sahi select karein." };

  const { error } = await supabase.from("machinery_bookings").update({ status }).eq("id", bookingId);
  if (error) return { error: error.message };
  revalidatePath("/admin/machinery-rental");
  return { success: true };
}

export async function completeMachineryBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const willSellToUs = formData.get("will_sell_to_us") === "yes";
  const wantsReminder = formData.get("wants_next_season_reminder") === "yes";
  const dieselAmount = Number(formData.get("diesel_amount") ?? 0);
  const dieselRate = Number(formData.get("diesel_rate") ?? 0);
  const dieselAccountId = (formData.get("diesel_account_id") as string) || null;

  if (!bookingId) return { error: "Missing booking id." };
  if (dieselAmount > 0 && !dieselAccountId) return { error: "Diesel ka konsa account, wo select karein." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("machinery_bookings")
    .update({
      status: "completed",
      will_sell_to_us: willSellToUs,
      wants_next_season_reminder: wantsReminder,
      diesel_amount: dieselAmount,
      diesel_rate: dieselRate,
      completed_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (dieselAmount > 0 && dieselAccountId) {
    const { data: booking } = await supabase.from("machinery_bookings").select("booking_number").eq("id", bookingId).single();
    const { data: dieselRow } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: dieselAccountId,
        transaction_type: "expense",
        category: "Machinery - Diesel",
        amount: dieselAmount,
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: `Diesel for booking ${booking?.booking_number ?? bookingId} - Rs ${dieselRate}/litre`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (dieselRow?.id) {
      await postCashOut({
        accountId: dieselAccountId,
        amount: dieselAmount,
        description: `Diesel — booking ${booking?.booking_number ?? bookingId}`,
        againstAccount: ACC.fuel,
        ctx: {
          createdBy: user?.id ?? null,
          claims: [{ table: "finance_transactions", rowId: dieselRow.id }],
        },
      });
    }
    const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", dieselAccountId).single();
    if (account) {
      await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - dieselAmount }).eq("id", dieselAccountId);
    }
  }

  revalidatePath("/admin/machinery-rental");
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function recordFarmerPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  const payFromWallet = formData.get("pay_from_wallet") === "yes";
  if (!bookingId) return { error: "Missing booking id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!payFromWallet && !accountId) return { error: "Account select karein." };

  const { data: booking } = await supabase.from("machinery_bookings").select("farmer_id, total_amount, amount_received_from_farmer, booking_number").eq("id", bookingId).single();
  if (!booking) return { error: "Booking nahi mili." };
  const remaining = Number(booking.total_amount) - Number(booking.amount_received_from_farmer);
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} baaqi hai.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (payFromWallet) {
    const { data: wallet } = await supabase.from("wallets").select("id, balance").eq("owner_type", "farmer").eq("owner_id", booking.farmer_id).single();
    if (!wallet) return { error: "Is Farmer ka Wallet nahi mila." };
    if (Number(wallet.balance) < amount) return { error: `Wallet mein sirf Rs ${Number(wallet.balance).toLocaleString()} hai.` };

    const { data: walletPayRow } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        type: "manual_adjustment",
        direction: "debit",
        amount,
        balance_after: 0,
        reference_type: "machinery_booking",
        reference_id: bookingId,
        notes: `Booking ${booking.booking_number} - Machinery payment from wallet`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    // Wallet se adaigi bhi utni hi asli aamdani hai jitni cash se. Sirf
    // cash wali adaigi ginein to machinery ki kamai asal se kam nazar
    // aati hai, aur kiraye ka faisla ghalat adad par hota hai.
    if (walletPayRow?.id) {
      const posted = await postWalletMovement({
        ownerType: "farmer",
        ownerId: booking.farmer_id,
        amount,
        direction: "debit",
        against: ACC.machineryIncome,
        description: `Booking ${booking.booking_number} — wallet se adaigi`,
        ctx: {
          createdBy: user?.id ?? null,
          claims: [{ table: "wallet_transactions", rowId: walletPayRow.id }],
        },
      });
      if (failed(posted)) return { error: `Adaigi hui magar ledger mein nahi gayi: ${posted.error}` };
    }
  } else {
    const { data: rentCashRow } = await supabase
      .from("finance_transactions")
      .insert({
        account_id: accountId,
        transaction_type: "income",
        category: "Machinery Rental - Farmer Payment",
        amount,
        transaction_date: new Date().toISOString().slice(0, 10),
        notes: `Booking ${booking.booking_number} - Farmer payment`,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (rentCashRow?.id && accountId) {
      const posted = await postCashIn({
        accountId,
        amount,
        description: `Booking ${booking.booking_number} — kisan se adaigi`,
        againstAccount: ACC.machineryIncome,
        ctx: {
          createdBy: user?.id ?? null,
          claims: [{ table: "finance_transactions", rowId: rentCashRow.id }],
        },
      });
      if (failed(posted)) return { error: `Adaigi darj hui magar ledger mein nahi gayi: ${posted.error}` };
    }
    const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId!).single();
    if (account) {
      await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) + amount }).eq("id", accountId!);
    }
  }

  await supabase.from("machinery_bookings").update({ amount_received_from_farmer: Number(booking.amount_received_from_farmer) + amount }).eq("id", bookingId);

  revalidatePath("/admin/machinery-rental");
  revalidatePath("/admin/finance");
  return { success: true };
}

export async function recordVendorPayout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const bookingId = String(formData.get("booking_id") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const accountId = (formData.get("account_id") as string) || null;
  if (!bookingId) return { error: "Missing booking id." };
  if (!amount || amount <= 0) return { error: "Amount sahi likhein." };
  if (!accountId) return { error: "Account select karein." };

  const { data: booking } = await supabase.from("machinery_bookings").select("vendor_payable, amount_paid_to_vendor, booking_number").eq("id", bookingId).single();
  if (!booking) return { error: "Booking nahi mili." };
  const remaining = Number(booking.vendor_payable) - Number(booking.amount_paid_to_vendor);
  if (amount > remaining) return { error: `Sirf Rs ${remaining.toLocaleString()} Vendor ko dena baaqi hai.` };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("machinery_bookings").update({ amount_paid_to_vendor: Number(booking.amount_paid_to_vendor) + amount }).eq("id", bookingId);

  await supabase.from("finance_transactions").insert({
    account_id: accountId,
    transaction_type: "expense",
    category: "Machinery Rental - Vendor Payout",
    amount,
    transaction_date: new Date().toISOString().slice(0, 10),
    notes: `Booking ${booking.booking_number} - Vendor payout`,
    created_by: user?.id ?? null,
  });
  const { data: account } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single();
  if (account) {
    await supabase.from("finance_accounts").update({ current_balance: Number(account.current_balance) - amount }).eq("id", accountId);
  }

  revalidatePath("/admin/machinery-rental");
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