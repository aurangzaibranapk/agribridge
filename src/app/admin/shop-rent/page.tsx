import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ShopRentClient } from "./shop-rent-client";

export const dynamic = "force-dynamic";

export default async function ShopRentPage() {
  const supabase = createClient();

  const { data: branches } = await supabase.from("branches").select("id, name").eq("is_active", true).order("name");

  const { data: rawAgreements } = await supabase
    .from("shop_rent_agreements")
    .select("*, branches(name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const { data: rawPayments } = await supabase.from("shop_rent_payments").select("*");

  const { data: rawBills } = await supabase
    .from("shop_bills")
    .select("*, branches(name)")
    .order("bill_year", { ascending: false })
    .order("bill_month", { ascending: false })
    .limit(100);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const agreements = (rawAgreements ?? []).map((a: any) => {
    const branchName = Array.isArray(a.branches) ? a.branches[0]?.name : a.branches?.name;
    const payments = (rawPayments ?? []).filter((p) => p.agreement_id === a.id);

    // Advance balance: total paid across all recorded months minus
    // total due for all months up to and including the current one -
    // positive means they're paid ahead.
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
    const monthsElapsed = Math.max(
      1,
      (currentYear - new Date(a.agreement_start_date).getFullYear()) * 12 + (currentMonth - (new Date(a.agreement_start_date).getMonth() + 1)) + 1
    );
    const totalDueSoFar = monthsElapsed * Number(a.monthly_rent);
    const advanceBalance = totalPaid - totalDueSoFar;

    const currentMonthPayment = payments.find((p) => p.payment_month === currentMonth && p.payment_year === currentYear);

    return {
      id: a.id,
      branch_id: a.branch_id,
      branch_name: branchName,
      landlord_name: a.landlord_name,
      landlord_contact: a.landlord_contact,
      landlord_cnic: a.landlord_cnic,
      monthly_rent: Number(a.monthly_rent),
      due_day: a.due_day,
      agreement_start_date: a.agreement_start_date,
      agreement_end_date: a.agreement_end_date,
      agreement_document_url: a.agreement_document_url,
      advance_balance: advanceBalance,
      current_month_paid: currentMonthPayment ? Number(currentMonthPayment.amount_paid) : 0,
      payments: payments.map((p) => ({
        id: p.id,
        payment_month: p.payment_month,
        payment_year: p.payment_year,
        amount_due: Number(p.amount_due),
        amount_paid: Number(p.amount_paid),
        paid_date: p.paid_date,
      })),
    };
  });

  const bills = (rawBills ?? []).map((b: any) => ({
    id: b.id,
    branch_name: Array.isArray(b.branches) ? b.branches[0]?.name : b.branches?.name,
    bill_type: b.bill_type,
    bill_month: b.bill_month,
    bill_year: b.bill_year,
    amount: Number(b.amount),
    due_date: b.due_date,
    status: b.status,
    bill_image_url: b.bill_image_url,
  }));

  return (
    <div>
      <PageHeader title="Shop Rent & Bills" description="Har shop ka rent agreement, monthly payment, aur bills (electricity/maintenance)" />
      <ShopRentClient branches={branches ?? []} agreements={agreements} bills={bills} currentMonth={currentMonth} currentYear={currentYear} />
    </div>
  );
}