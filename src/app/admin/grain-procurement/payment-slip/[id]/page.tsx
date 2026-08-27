import { createClient } from "@/lib/supabase/server";
import { PaymentSlipClient } from "./payment-slip-client";

export const dynamic = "force-dynamic";

export default async function PaymentSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: payment } = await supabase
    .from("grain_procurement_payments")
    .select("*, farmers(full_name, farmer_code, phone_number), grain_parties(party_name, phone)")
    .eq("id", id)
    .maybeSingle();

  if (!payment) {
    return <div className="p-8 text-center text-surface-400">Payment nahi mili.</div>;
  }

  const { data: financeAccounts } = await supabase.from("finance_accounts").select("id, name").eq("is_active", true).order("account_type");

  const farmer = Array.isArray(payment.farmers) ? payment.farmers[0] : payment.farmers;
  const party = Array.isArray(payment.grain_parties) ? payment.grain_parties[0] : payment.grain_parties;

  const slip = {
    id: payment.id,
    amount: Number(payment.amount),
    payment_method: payment.payment_method,
    notes: payment.notes,
    created_at: payment.created_at,
    seller_name: farmer?.full_name ?? party?.party_name ?? "-",
    seller_code: farmer?.farmer_code ?? null,
    seller_phone: farmer?.phone_number ?? party?.phone ?? null,
    seller_type: farmer ? "Farmer" : "Party",
    receipt_photo_url: payment.receipt_photo_url ?? null,
    is_edited: payment.is_edited ?? false,
    original_amount: payment.original_amount ? Number(payment.original_amount) : null,
    edited_at: payment.edited_at ?? null,
  };

  return <PaymentSlipClient slip={slip} financeAccounts={financeAccounts ?? []} />;
}