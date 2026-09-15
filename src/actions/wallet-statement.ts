"use server";
import { createClient } from "@/lib/supabase/server";
import { sendDeptMail, mailWrapper } from "@/lib/mailer";

export interface ActionState {
  error?: string;
  success?: boolean;
  notice?: string;
}

const TYPE_LABELS: Record<string, string> = {
  milk_income: "Milk Income",
  milk_cash_payment: "Milk Cash Payment",
  loan_disbursement: "Loan Diya Gaya",
  loan_repayment: "Loan Installment",
  machinery_payment: "Machinery Payment",
  commission_credit: "Commission/Payout",
};

async function buildStatementData(farmerId: string) {
  const supabase = createClient();
  const [{ data: farmer }, { data: wallet }] = await Promise.all([
    supabase.from("farmers").select("full_name, farmer_code, phone_number").eq("id", farmerId).single(),
    supabase.from("wallets").select("id, balance").eq("owner_type", "farmer").eq("owner_id", farmerId).single(),
  ]);
  if (!farmer || !wallet) return null;

  const { data: rawTxns } = await supabase
    .from("wallet_transactions")
    .select("type, direction, amount, notes, created_at")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: true });

  let runningBalance = 0;
  const rows = (rawTxns ?? []).map((t) => {
    runningBalance += t.direction === "credit" ? Number(t.amount) : -Number(t.amount);
    return {
      typeLabel: TYPE_LABELS[t.type] ?? t.type,
      direction: t.direction,
      amount: Number(t.amount),
      notes: t.notes,
      date: t.created_at,
      balanceAfter: runningBalance,
    };
  });

  return {
    farmerName: farmer.full_name,
    farmerCode: farmer.farmer_code,
    farmerPhone: farmer.phone_number,
    currentBalance: Number(wallet.balance),
    rows,
  };
}

export async function emailWalletStatement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const farmerId = String(formData.get("farmer_id") ?? "");
  const toEmail = String(formData.get("to_email") ?? "").trim();
  if (!farmerId) return { error: "Missing farmer id." };
  if (!toEmail) return { error: "Email likhein." };

  const data = await buildStatementData(farmerId);
  if (!data) return { error: "Farmer ya Wallet nahi mila." };

  const { generateWalletStatementPdf } = await import("@/lib/wallet-statement-pdf");
  const pdfBuffer = await generateWalletStatementPdf(data);

  // Wallet ka hisaab accounts ke khate se (`src/lib/mailer.ts`).
  const sent = await sendDeptMail({
    dept: "accounts",
    to: toEmail,
    subject: `Wallet Statement - ${data.farmerName}`,
    html: mailWrapper(
      `<p>Assalam-o-Alaikum ${data.farmerName},</p><p>Aapki Wallet Statement is email ke sath attach hai.</p><p><strong>Current Balance:</strong> Rs ${data.currentBalance.toLocaleString()}</p>`,
      "accounts"
    ),
    attachments: [{ filename: `wallet-statement-${data.farmerCode}.pdf`, content: pdfBuffer }],
  });
  if (!sent.sent) return { error: sent.error };
  return { success: true, notice: `Statement ${toEmail} par bhej di gayi (${sent.from} se).` };
}

export { buildStatementData };