import { createServiceClient } from "@/lib/supabase/service";
import { qismDhoondein } from "@/lib/kharche";

/**
 * Ek shop ki sale, payment-method ke hisaab se — aur usi shop ke
 * manzoor-shuda expense minus, wohi method jis se wo expense diya gaya.
 *
 * Malik (8 September): "Is waqt khaton mein" (Paisa & Khata par) poori
 * company ka combined balance dikhata hai — shop par baithe staff ke
 * liye wo ghalat cheez hai, us ki apni shop ka nahi. Us ki jagah staff
 * ko sirf APNI shop ka, chuni hui date range ka, payment-method-wise
 * hisaab chahiye: kis method se kitni sale hui, us method se kitna
 * kharcha/adaigi hui, aur is se kitna bacha.
 *
 * Branch ka nahi, shop ka -- kyunke ek branch mein ek se zyada shop ho
 * sakti hain (malik ne khud confirm kiya), aur do shops ka paisa ek
 * dusre mein mil jana wahi purani ghalti hai jo is project mein bar bar
 * pakRi gayi hai.
 */

export interface ShopPaymentMethodRow {
  method: string;
  label: string;
  /** Isi method se, is date range mein, is shop ki POS sale. */
  sales: number;
  /** Isi method se diya gaya kharcha/adaigi manfi, wapas aayi raqam jama. */
  expenseNet: number;
  /** sales + expenseNet. */
  net: number;
}

/**
 * POS counter ki asal payment-method fehrist.
 *
 * Zero-Leakage screen par sirf woh methods dikhana jin par sale hui ho
 * ghalat impression deta hai ke baqi methods POS mein maujood hi nahi.
 * Is liye ye tamam POS methods har dafa pre-seed hote hain; sale na ho to
 * un ki value Rs 0 rehti hai.
 *
 * Ye keys src/components/pos/pos-client.tsx ke PAYMENT_METHODS ke barabar
 * rakhi gayi hain. "card" ka matlab yahan Kisan Card hai, aam bank card
 * nahi.
 */
const POS_METHODS: { method: string; label: string }[] = [
  { method: "cash", label: "Cash" },
  { method: "bank_transfer", label: "Bank" },
  { method: "card", label: "Kisan Card" },
  { method: "jazzcash", label: "JazzCash" },
  { method: "easypaisa", label: "Easypaisa" },
  { method: "qr", label: "QR" },
  { method: "khata", label: "Khata" },
  { method: "waseela_card", label: "Waseela Card" },
];

const METHOD_LABEL: Record<string, string> = Object.fromEntries(
  POS_METHODS.map((m) => [m.method, m.label])
);

export async function shopPaymentMethodBreakdown(
  shopId: string,
  fromDate: string,
  toDate: string,
  options: { strict?: boolean } = {}
): Promise<ShopPaymentMethodRow[]> {
  const service = createServiceClient();
  // Pakistan time (UTC+5) ki midnight -- baghair offset ke UTC midnight
  // lete hai (= 5 AM PKT), jo subah ki sale miss karta hai.
  const fromTs = `${fromDate}T00:00:00+05:00`;
  const toTs = `${toDate}T23:59:59.999+05:00`;

  const { data: sales, error: salesError } = await service
    .from("pos_sales")
    .select("id")
    .eq("shop_id", shopId)
    .gte("created_at", fromTs)
    .lte("created_at", toTs);
  if (options.strict && salesError) throw new Error("Shop sales could not be loaded.");
  const saleIds = (sales ?? []).map((s) => s.id as string);

  const [paymentResult, expenseResult, mapResult, returnResult] = await Promise.all([
    saleIds.length > 0
      ? service.from("pos_sale_payment_details").select("sale_id, payment_method, amount").in("sale_id", saleIds)
      : Promise.resolve({ data: [] as { sale_id: string; payment_method: string; amount: number }[], error: null }),
    service
      .from("company_expense_requests")
      .select("kind, amount, paid_from_account_id")
      .eq("shop_id", shopId)
      .eq("status", "approved")
      .gte("expense_date", fromDate)
      .lte("expense_date", toDate),
    service.from("payment_method_account_map").select("payment_method, finance_account_id"),
    // Wapas hui bikriyaan -- golak mein ye paisa wapas gaya, is liye
    // net ko reduce karta hai. sale_id se original payment method pata
    // chalta hai (refund_method="original" ke liye).
    saleIds.length > 0
      ? service.from("pos_returns").select("sale_id, total_amount, refund_method").in("sale_id", saleIds)
      : Promise.resolve({ data: [] as { sale_id: string; total_amount: number; refund_method: string }[], error: null }),
  ]);
  if (options.strict && (paymentResult.error || expenseResult.error || mapResult.error)) {
    throw new Error("Shop payment breakdown is incomplete.");
  }
  const { data: payments } = paymentResult;
  const { data: expenses } = expenseResult;
  const { data: mapRows } = mapResult;
  const { data: returns } = returnResult;

  const accountToMethod = new Map<string, string>();
  for (const m of (mapRows ?? []) as { payment_method: string; finance_account_id: string | null }[]) {
    if (m.finance_account_id) accountToMethod.set(m.finance_account_id, m.payment_method);
  }

  // Har POS method pehle se maujood ho — beshak is period mein us par
  // aik bhi sale na hui ho. Unknown/new DB methods agar milen to woh bhi
  // neeche khud add ho jayen, taake naya method chup na jaye.
  const buckets = new Map<string, { sales: number; expenseNet: number }>(
    POS_METHODS.map((m) => [m.method, { sales: 0, expenseNet: 0 }])
  );
  const bucket = (method: string) => {
    const cur = buckets.get(method) ?? { sales: 0, expenseNet: 0 };
    buckets.set(method, cur);
    return cur;
  };

  for (const p of (payments ?? []) as { sale_id: string; payment_method: string; amount: number }[]) {
    bucket(p.payment_method).sales += Number(p.amount ?? 0);
  }

  // Sale ID -> [{method, amount}] naqsha -- wapas hui bikriyaan ke liye
  // original payment method proportionally subtract karne ke liye.
  const salePayMap = new Map<string, { method: string; amount: number }[]>();
  for (const p of (payments ?? []) as { sale_id: string; payment_method: string; amount: number }[]) {
    const cur = salePayMap.get(p.sale_id) ?? [];
    cur.push({ method: p.payment_method, amount: Number(p.amount ?? 0) });
    salePayMap.set(p.sale_id, cur);
  }

  // Wapas hui bikriyaan: har method se uski proportional hissa wapas ho.
  // refund_method="cash" → cash bucket se; "original" → original sale ki
  // payment split ke mutabiq proportionally; koi mapped method nahi to
  // khamoshi se chhoRa jata hai (hisaab galat karne se behtar).
  for (const r of (returns ?? []) as { sale_id: string; total_amount: number; refund_method: string }[]) {
    const amt = Number(r.total_amount ?? 0);
    if (amt <= 0) continue;
    if (r.refund_method === "cash") {
      bucket("cash").sales -= amt;
    } else {
      // "original" ya koi aur: original sale ki payment split se
      const origPays = salePayMap.get(r.sale_id) ?? [];
      const origTotal = origPays.reduce((s, p) => s + p.amount, 0);
      if (origTotal > 0) {
        for (const p of origPays) {
          bucket(p.method).sales -= amt * (p.amount / origTotal);
        }
      }
    }
  }

  // Jis account ka koi payment-method mapping nahi mila, wo is hisaab
  // mein shamil nahi ho sakta -- khamoshi se sifar mein daalne se
  // "hisaab mila" jhoot ban jata, is liye chhoR diya jata hai.
  for (const e of (expenses ?? []) as { kind: string; amount: number; paid_from_account_id: string | null }[]) {
    if (!e.paid_from_account_id) continue;
    const method = accountToMethod.get(e.paid_from_account_id);
    if (!method) continue;
    const qism = qismDhoondein(e.kind);
    const sign = qism?.rukh === "aaya" ? 1 : -1;
    bucket(method).expenseNet += sign * Number(e.amount ?? 0);
  }

  const order = new Map(POS_METHODS.map((m, i) => [m.method, i]));

  return [...buckets.entries()]
    .map(([method, v]) => ({
      method,
      label: METHOD_LABEL[method] ?? method,
      sales: Math.round(v.sales * 100) / 100,
      expenseNet: Math.round(v.expenseNet * 100) / 100,
      net: Math.round((v.sales + v.expenseNet) * 100) / 100,
    }))
    .sort((a, b) => (order.get(a.method) ?? 999) - (order.get(b.method) ?? 999));
}
