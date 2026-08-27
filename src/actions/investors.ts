"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function convertInquiryToInvestor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const serviceClient = createServiceClient();

  const inquiryId = String(formData.get("inquiry_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const dealType = String(formData.get("deal_type") ?? "product_investment");
  const amount = Number(formData.get("amount_invested") ?? 0);
  const profitShare = Number(formData.get("profit_share_percentage") ?? 0);

  if (!fullName) return { error: "Full name is required." };
  if (!email || !email.includes("@")) return { error: "A valid email is required to invite the investor." };
  if (!amount || amount <= 0) return { error: "Investment amount must be greater than zero." };
  if (!profitShare || profitShare <= 0) return { error: "Profit share percentage is required." };

  const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: { role: "investor" },
  });

  if (inviteError || !invited?.user) {
    return { error: `Failed to invite investor: ${inviteError?.message ?? "unknown error"}` };
  }

  await serviceClient.from("profiles").update({ role: "customer" }).eq("id", invited.user.id);

  const investorCode = `INV-${Date.now().toString().slice(-6)}`;
  const { data: investor, error: investorError } = await supabase
    .from("investors")
    .insert({
      user_id: invited.user.id,
      investor_code: investorCode,
      full_name: fullName,
      phone_number: phone || null,
    })
    .select("id")
    .single();

  if (investorError || !investor) {
    return { error: `Investor record failed: ${investorError?.message}` };
  }

  // Create the first deal + its opening ledger entry - fn_apply_investment_ledger_entry
  // (Migration 002b) auto-computes balance_after and bumps investors.total_invested.
  const { data: deal, error: dealError } = await supabase
    .from("investment_deals")
    .insert({
      investor_id: investor.id,
      deal_type: dealType,
      amount_invested: amount,
      profit_share_percentage: profitShare,
      status: "active",
    })
    .select("id")
    .single();

  if (dealError || !deal) {
    return { error: `Investment deal failed: ${dealError?.message}` };
  }

  const { error: ledgerError } = await supabase.from("investment_ledger").insert({
    deal_id: deal.id,
    entry_type: "investment_in",
    amount,
    balance_after: 0, // overwritten by fn_apply_investment_ledger_entry trigger
    notes: "Initial investment",
  });

  if (ledgerError) {
    return { error: `Ledger entry failed: ${ledgerError.message}` };
  }

  if (inquiryId) {
    await supabase.from("investor_inquiries").update({ status: "responded" }).eq("id", inquiryId);
  }

  revalidatePath("/admin/investor-inquiries");
  revalidatePath("/admin/investors");
  return { success: true };
}