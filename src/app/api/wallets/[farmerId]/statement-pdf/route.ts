import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWalletStatementPdf } from "@/lib/wallet-statement-pdf";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  milk_income: "Milk Income",
  milk_cash_payment: "Milk Cash Payment",
  loan_disbursement: "Loan Diya Gaya",
  loan_repayment: "Loan Installment",
  machinery_payment: "Machinery Payment",
  commission_credit: "Commission/Payout",
};

export async function GET(request: Request, { params }: { params: Promise<{ farmerId: string }> }) {
  const { farmerId } = await params;
  const supabase = createClient();

  const [{ data: farmer }, { data: wallet }] = await Promise.all([
    supabase.from("farmers").select("full_name, farmer_code, phone_number").eq("id", farmerId).single(),
    supabase.from("wallets").select("id, balance").eq("owner_type", "farmer").eq("owner_id", farmerId).single(),
  ]);
  if (!farmer || !wallet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  const pdfBuffer = await generateWalletStatementPdf({
    farmerName: farmer.full_name,
    farmerCode: farmer.farmer_code,
    farmerPhone: farmer.phone_number,
    currentBalance: Number(wallet.balance),
    rows,
  });

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="wallet-statement-${farmer.farmer_code}.pdf"`,
    },
  });
}