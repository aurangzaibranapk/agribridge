import type { WaIdentity } from "./identity";
import type { ReadIntent } from "./intents";
import { allowedReads } from "./policy";

/**
 * Read-only jawab. Har function SIRF pehchane hue user (identity.userId)
 * ke liye chalta hai -- paigham ka koi lafz (naam, number, id) kabhi
 * query ka parameter nahi banta. Is liye "Ahmad ka khata" likhne se bhi
 * apna hi khata aata hai (data leak nahi).
 */
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export interface AnswerDeps {
  rpc: Rpc;
  /** App ki menu / route ijazat (loadNav). null = sab (owner/admin). */
  allowedRoutes: (userId: string, role: string) => Promise<string[] | null>;
  routeAllowed: (allowed: string[], route: string) => boolean;
}

export const rs = (n: unknown) => `Rs ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const dt = (s: unknown) => {
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? String(s ?? "") : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Karachi" });
};

const LABEL: Record<ReadIntent, string> = {
  today_sales: "aaj ki sale",
  cash_position: "cash position",
  pending_approvals: "baqi approvals",
  my_work: "mera kaam",
  my_khata: "mera khata",
  my_bills: "akhri bill",
  my_orders: "mere orders",
  help: "menu",
};

export function helpText(id: WaIdentity): string {
  const opts = allowedReads(id.kind, id.role).filter((i) => i !== "help").map((i) => `• ${LABEL[i]}`);
  const name = id.fullName ? ` ${id.fullName}` : "";
  return `Assalam-o-Alaikum${name}. Aap likh kar ya bol kar (voice note) pooch sakte hain:\n${opts.join("\n")}\n\nNayi entry / approval WhatsApp par agle marhale mein aa rahi hai — abhi app istemal karein.`;
}

export function formatSales(d: Record<string, unknown>): string {
  return `*Aaj ki sale${d.branch_scope ? " (aap ki branch)" : ""}*\nKul: *${rs(d.total)}* · Bills: ${d.bills}\nCash: ${rs(d.cash)} · Khata: ${rs(d.khata)} · Baqi tareeqe: ${rs(d.other)}\nWapsi wale bills: ${d.returned_bills}`;
}
export function formatCash(d: Record<string, unknown>): string {
  return `*Cash position*\nCash: *${rs(d.cash)}*\nBank: ${rs(d.bank)} · Wallet: ${rs(d.wallet)} · Doosre: ${rs(d.other)}\n(${d.accounts} accounts)`;
}
export type PendingRow = { category: string; route: string; pending: number; mine_to_act: number; readable: boolean; is_info: boolean };
export function formatPending(rows: PendingRow[], title: string): string {
  const live = rows.filter((r) => r.readable && !r.is_info && Number(r.pending) > 0);
  if (!live.length) return `*${title}*\nKoi kaam baqi nahi. ✔`;
  const total = live.reduce((s, r) => s + Number(r.pending), 0);
  const mine = live.reduce((s, r) => s + Number(r.mine_to_act ?? 0), 0);
  const top = [...live].sort((a, b) => Number(b.pending) - Number(a.pending)).slice(0, 5).map((r) => `• ${r.category.replace(/_/g, " ")}: ${r.pending}`);
  return `*${title}*\nKul baqi: *${total}* · Aap ke faisle ke: ${mine}\n${top.join("\n")}\n\nApprove abhi app mein: /admin/my-work/pending`;
}
export function formatKhata(d: Record<string, unknown> | null): string {
  if (!d) return "Aap ke account se koi khata nahi juda. Branch se rabta karein.";
  const lp = d.last_payment as { date?: string; amount?: number } | null;
  const owed = Number(d.owed) || 0;
  return `*Mera khata*\n${owed > 0 ? `Baqaya: *${rs(owed)}*` : owed < 0 ? `Aap ka jama: *${rs(-owed)}*` : "Koi baqaya nahi ✔"}${lp?.date ? `\nAkhri adaigi: ${dt(lp.date)} · ${rs(lp.amount)}` : ""}`;
}
export function formatLines(rows: { entry_date: string; ref: string | null; tafseel: string | null; udhaar: number; adaigi: number }[]): string {
  if (!rows.length) return "*Akhri entries*\nPichhle 90 din mein koi entry nahi.";
  return `*Akhri entries*\n${rows.map((r) => `${dt(r.entry_date)}  ${r.ref ?? r.tafseel ?? ""}  ${Number(r.udhaar) > 0 ? "+" + rs(r.udhaar) : "−" + rs(r.adaigi)}`).join("\n")}`;
}
export function formatOrders(rows: { order_number: string; status: string; grand_total: number; created_at: string }[]): string {
  if (!rows.length) return "*Mere orders*\nKoi order nahi mila.";
  return `*Mere orders*\n${rows.map((o) => `${o.order_number} · ${o.status} · ${rs(o.grand_total)} · ${dt(o.created_at)}`).join("\n")}`;
}

const NOT_READY = "Ye jawab abhi tayyar nahi ho saka. Thori dair baad ya app mein dekhein.";

export async function answerRead(deps: AnswerDeps, id: WaIdentity, intent: ReadIntent): Promise<string> {
  if (intent === "help") return helpText(id);
  const uid = id.userId!;
  const call = async (fn: string, args: Record<string, unknown> = {}) => {
    const { data, error } = await deps.rpc(fn, { p_user: uid, ...args });
    if (error) throw new Error(error.message);
    return data;
  };
  try {
    switch (intent) {
      case "today_sales":
        return formatSales((await call("fn_wa_today_sales")) as Record<string, unknown>);
      case "cash_position":
        return formatCash((await call("fn_wa_cash_position")) as Record<string, unknown>);
      case "pending_approvals":
      case "my_work": {
        const rows = ((await call("fn_wa_pending_counts")) as PendingRow[] | null) ?? [];
        // App ki menu ijazat: jo safha app mein nahi khulta, us ki ginti bhi nahi.
        const allowed = await deps.allowedRoutes(uid, id.role ?? "");
        const visible = allowed === null ? rows : rows.filter((r) => deps.routeAllowed(allowed, r.route));
        return formatPending(visible, intent === "my_work" ? "Mera baqi kaam" : "Baqi approvals");
      }
      case "my_khata":
        return formatKhata((await call("fn_wa_my_khata")) as Record<string, unknown> | null);
      case "my_bills":
        return formatLines(((await call("fn_wa_my_recent_lines", { p_limit: 5 })) as Parameters<typeof formatLines>[0]) ?? []);
      case "my_orders":
        return formatOrders(((await call("fn_wa_my_orders", { p_limit: 5 })) as Parameters<typeof formatOrders>[0]) ?? []);
    }
  } catch {
    return NOT_READY;
  }
  return NOT_READY;
}
