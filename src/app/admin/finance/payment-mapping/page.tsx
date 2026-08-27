import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { PaymentMappingClient } from "./payment-mapping-client";

export const dynamic = "force-dynamic";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  qr: "QR",
};

export default async function PaymentMappingPage() {
  const supabase = createClient();

  const { data: mappings } = await supabase.from("payment_method_account_map").select("payment_method, finance_account_id").order("payment_method");
  const { data: accounts } = await supabase.from("finance_accounts").select("id, name, account_type").eq("is_active", true).order("account_type");

  const rows = (mappings ?? []).map((m) => ({
    paymentMethod: m.payment_method,
    label: PAYMENT_METHOD_LABELS[m.payment_method] ?? m.payment_method,
    financeAccountId: m.finance_account_id,
  }));

  return (
    <div>
      <PageHeader
        title="Payment Method Mapping"
        description="POS mein jab koi payment method use ho (Cash, JazzCash, Easypaisa, wagera), wo paisa kis Finance Account mein jaye - ye yahan set karein"
      />
      <PaymentMappingClient rows={rows} accounts={accounts ?? []} />
    </div>
  );
}