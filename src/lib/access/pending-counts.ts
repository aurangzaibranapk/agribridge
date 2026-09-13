import { createServiceClient } from "@/lib/supabase/service";

/**
 * Har department par kitna kaam baqi hai.
 *
 * Card par ye adad sab se zyada nazar aata hai, is liye us ka SACH hona
 * sab se zyada zaroori hai. Ek ghalat ginti se behtar hai ke koi ginti na
 * ho: khali card banda kholta hai aur khud dekh leta hai, magar "12
 * Pending" likha ho aur andar kuch na ho -- to wo us din ke baad kisi
 * bhi adad par bharosa nahi karta.
 *
 * Is liye yahan sirf wo department hain jin ke paas WAQAI koi aisi
 * fehrist hai jo khatam ho sakti hai. Baqi ke card bina adad ke aate
 * hain -- aur ye kami nahi, jaan boojh kar hai.
 *
 * `alert` alag cheez hai: ginti "kaam baqi hai" kehti hai, alert "kuch
 * ghalat hai" kehta hai. Do alag baatein ek hi adad mein mila dena dono
 * ko bemani kar deta hai.
 */
export interface DeptSignal {
  pending: number | null;
  alert: number | null;
}

async function count(table: string, apply: (q: any) => any): Promise<number> {
  const service = createServiceClient();
  const q = apply(service.from(table as never).select("id", { count: "exact", head: true }));
  const { count: n } = await q;
  return n ?? 0;
}

export async function pendingByDepartment(): Promise<Record<string, DeptSignal>> {
  const out: Record<string, DeptSignal> = {};

  const jobs: Array<[string, () => Promise<DeptSignal>]> = [
    [
      "machinery",
      async () => ({
        // Jo booking band nahi hui -- yani us par abhi kuch karna baqi hai.
        pending: await count("machinery_bookings", (q) => q.not("status", "in", '("closed","cancelled")')),
        alert: await count("v_machinery_watch", (q) => q),
      }),
    ],
    [
      "sales",
      async () => ({
        pending: await count("agri_orders", (q) => q.eq("status", "pending")),
        alert: null,
      }),
    ],
    [
      "purchase",
      async () => ({
        pending: await count("supplier_payment_requests", (q) => q.eq("status", "pending")),
        alert: null,
      }),
    ],
    [
      "inventory",
      async () => ({
        pending: await count("stock_transfers", (q) => q.eq("status", "pending")),
        // Godam ki ginti apni harkaton se hat gayi ho (129).
        alert: await count("v_inventory_balance_check", (q) => q),
      }),
    ],
    [
      "finance",
      async () => ({
        pending: await count("v_cash_close_missing", (q) => q),
        alert: await count("v_finance_balance_check", (q) => q),
      }),
    ],
    [
      "grain",
      async () => ({
        // Jin kisanon ka anaj ka paisa abhi baqi hai.
        pending: await count("grain_farmer_balances", (q) => q.gt("balance_due", 0)),
        alert: null,
      }),
    ],
  ];

  // Ek department ki ginti na ban sake to baqi sab ruk na jayen. Us ek ka
  // adad khali reh jata hai -- jo sahi bhi hai: hum jaante hi nahi.
  await Promise.all(
    jobs.map(async ([key, fn]) => {
      try {
        out[key] = await fn();
      } catch {
        out[key] = { pending: null, alert: null };
      }
    })
  );

  return out;
}
