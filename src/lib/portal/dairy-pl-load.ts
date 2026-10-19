import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addMonths, parsePnl, PHOTO_TYPES, photoOk, photoPath, type PnlRow } from "./dairy-pl";

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
// 574-578 abhi generated types mein nahi.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const looseDb = () => createClient() as any;
const rpc = (): Rpc => { const sb = createClient(); return sb.rpc.bind(sb) as unknown as Rpc; };

export async function loadPnl(from: string, to: string, group: "month" | "week" = "month"): Promise<{ rows: PnlRow[]; error: string | null }> {
  const r = await rpc()("fn_my_dairy_pnl", { p_from: from, p_to: to, p_group: group });
  return { rows: parsePnl(r.data), error: r.error?.message ?? null };
}
/** Chart ke liye pichhle 6 maheene (aaj tak). */
export async function loadSixMonths(asOf: string): Promise<PnlRow[]> {
  const from = addMonths(`${asOf.slice(0, 7)}-01`, -5);
  return (await loadPnl(from, asOf, "month")).rows;
}
export interface Entry { id: string; date: string; type: "expense" | "income"; cat: string; sub_type: string | null; qty: number | null; unit: string | null; rate: number | null; amount: number; detail: string; source: string; animal_id: string | null }
export async function loadEntries(from: string, to: string, limit = 40): Promise<Entry[]> {
  const db = looseDb();
  const [e, i] = await Promise.all([
    db.from("dairy_expenses").select("id, expense_date, category, sub_type, qty, unit, rate, amount, paid_to, note, source, animal_id").eq("voided", false).gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }).limit(limit),
    db.from("dairy_income").select("id, income_date, kind, qty, rate, amount, buyer, note, animal_id").eq("voided", false).gte("income_date", from).lte("income_date", to).order("income_date", { ascending: false }).limit(limit),
  ]);
  const out: Entry[] = [
    ...((e.data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), date: String(r.expense_date), type: "expense" as const, cat: String(r.category), sub_type: (r.sub_type as string) ?? null, qty: r.qty === null ? null : Number(r.qty), unit: (r.unit as string) ?? null, rate: r.rate === null ? null : Number(r.rate), amount: Number(r.amount), detail: [r.note, r.paid_to].filter(Boolean).join(" · "), source: String(r.source), animal_id: (r.animal_id as string) ?? null })),
    ...((i.data ?? []) as Record<string, unknown>[]).map((r) => ({ id: String(r.id), date: String(r.income_date), type: "income" as const, cat: String(r.kind), sub_type: null, qty: r.qty === null ? null : Number(r.qty), unit: null, rate: r.rate === null ? null : Number(r.rate), amount: Number(r.amount), detail: [r.note, r.buyer].filter(Boolean).join(" · "), source: "manual", animal_id: (r.animal_id as string) ?? null })),
  ];
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}
export interface Suggestion { item_id: string; sale_date: string; ref: string; product: string; qty: number; rate: number; amount: number; category: string; added: boolean }
export async function loadSuggestions(): Promise<Suggestion[]> {
  const r = await rpc()("fn_my_shop_dairy_suggestions", { p_from: null, p_to: null });
  return Array.isArray(r.data) ? (r.data as Record<string, unknown>[]).map((x) => ({ item_id: String(x.item_id), sale_date: String(x.sale_date), ref: String(x.ref), product: String(x.product ?? ""), qty: Number(x.qty), rate: Number(x.rate), amount: Number(x.amount), category: String(x.category), added: !!x.added })) : [];
}
/** Private tasveeron ke 1 ghante wale links (apne session se -- RLS). */
export async function signedUrls(paths: (string | null)[]): Promise<Record<string, string>> {
  const list = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (!list.length) return {};
  const sb = createClient();
  const { data } = await sb.storage.from("dairy-photos").createSignedUrls(list, 3600);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
/** FormData se tasveer (client ne pehle hi chhoti ki) -> storage -> janwar. */
export async function savePhoto(farmerId: string, animalId: string, fd: FormData): Promise<"none" | "ok" | "bad" | "fail"> {
  const photo = fd.get("photo"), thumb = fd.get("photo_thumb");
  if (!(photo instanceof File) || photo.size === 0) return "none";
  if (!photoOk(photo) || !(thumb instanceof File) || !photoOk(thumb)) return "bad";
  const sb = createClient();
  const id = crypto.randomUUID();
  const p = photoPath(farmerId, animalId, id), t = photoPath(farmerId, animalId, id, true);
  const type = PHOTO_TYPES.includes(photo.type) ? photo.type : "image/webp";
  const up1 = await sb.storage.from("dairy-photos").upload(p, photo, { contentType: type, upsert: false });
  if (up1.error) return "fail";
  const up2 = await sb.storage.from("dairy-photos").upload(t, thumb, { contentType: thumb.type || type, upsert: false });
  if (up2.error) return "fail";
  const { error } = await looseDb().from("dairy_animals").update({ photo_path: p, photo_thumb_path: t }).eq("id", animalId);
  return error ? "fail" : "ok";
}
