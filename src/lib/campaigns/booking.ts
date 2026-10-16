/**
 * Booking campaign (Gandum Season 2026) ke qaide -- pure functions, test ke liye.
 * Demand-first: booking par koi payment nahi, sirf Demand Center mein demand.
 */

export type LineKind = "seed" | "fertilizer" | "pesticide";
export const LINE_KINDS: LineKind[] = ["seed", "fertilizer", "pesticide"];
export const LINE_KIND_LABELS: Record<LineKind, string> = {
  seed: "Beej (Seed)",
  fertilizer: "Khaad (Fertilizer)",
  pesticide: "Spray (Pesticide)",
};
/** Demand Center category (src/lib/demand/categories) se mapping. */
export const LINE_KIND_CATEGORY: Record<LineKind, string> = { seed: "seed", fertilizer: "fertilizer", pesticide: "pesticide" };

export interface Campaign { id: string; name: string; crop: string; deadline: string; is_active: boolean }
export interface BookingLineInput { kind: string; productId: string; quantity: number | string; unit?: string }
export interface CleanLine { kind: LineKind; productId: string; quantity: number; unit: string }

/** CNIC: sirf 13 hindse. Ghalat ho to null. */
export function normalizeCnic(raw: string | null | undefined): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length === 13 ? d : null;
}
export function formatCnic(d13: string): string {
  return `${d13.slice(0, 5)}-${d13.slice(5, 12)}-${d13.slice(12)}`;
}

/** Deadline PKT din ke aakhir tak khuli rehti hai (20 Oct 23:59 PKT). */
export function isCampaignOpen(c: Pick<Campaign, "deadline" | "is_active">, now: Date = new Date()): boolean {
  if (!c.is_active) return false;
  const pkt = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return pkt <= c.deadline;
}

export function validateBooking(
  input: { acres: number | string; lines: BookingLineInput[]; notes?: string },
  catalogIds: Set<string>
): { ok: true; acres: number; lines: CleanLine[]; notes: string | null } | { ok: false; error: string } {
  const acres = Number(input.acres);
  if (!Number.isFinite(acres) || acres <= 0 || acres > 10000) return { ok: false, error: "Rakba (acres) sahi likhein." };
  const merged = new Map<string, CleanLine>();
  for (const l of input.lines ?? []) {
    if (!l.productId && (l.quantity === "" || l.quantity == null)) continue; // khali qatar
    if (!LINE_KINDS.includes(l.kind as LineKind)) return { ok: false, error: "Line ki qisam ghalat hai." };
    if (!l.productId || !catalogIds.has(l.productId)) return { ok: false, error: "Product catalog se chunein." };
    const q = Number(l.quantity);
    if (!Number.isFinite(q) || q <= 0 || q > 100000) return { ok: false, error: "Miqdar sahi likhein." };
    const unit = (l.unit || "bag").slice(0, 20);
    const key = `${l.productId}|${unit}`;
    const prev = merged.get(key);
    if (prev) prev.quantity += q;
    else merged.set(key, { kind: l.kind as LineKind, productId: l.productId, quantity: q, unit });
  }
  if (merged.size === 0) return { ok: false, error: "Kam az kam ek product (beej, khaad ya spray) chunein." };
  const notes = String(input.notes ?? "").trim().slice(0, 1000) || null;
  return { ok: true, acres, lines: [...merged.values()], notes };
}

export interface CampaignDemandRow { product_id: string | null; product_name: string; unit: string; quantity: number; farmer_id: string; status: string }
export interface CampaignTotal { productId: string | null; productName: string; unit: string; totalQuantity: number; farmerCount: number }

/** Demand Center ke liye product-wise jama (rejected/cancelled bahar). */
export function aggregateCampaignDemand(rows: CampaignDemandRow[]): CampaignTotal[] {
  const m = new Map<string, CampaignTotal & { farmers: Set<string> }>();
  for (const r of rows) {
    if (r.status === "rejected" || r.status === "cancelled") continue;
    const key = `${r.product_id ?? r.product_name.toLowerCase()}|${r.unit}`;
    const cur = m.get(key) ?? { productId: r.product_id, productName: r.product_name, unit: r.unit, totalQuantity: 0, farmerCount: 0, farmers: new Set() };
    cur.totalQuantity += Number(r.quantity) || 0;
    cur.farmers.add(r.farmer_id);
    cur.farmerCount = cur.farmers.size;
    m.set(key, cur);
  }
  return [...m.values()]
    .map(({ farmers: _f, ...t }) => t)
    .sort((a, b) => b.totalQuantity - a.totalQuantity || a.productName.localeCompare(b.productName));
}

/** Doodh supplier flag (view v_farmer_milk_supplier jaisa hi hisaab). */
export function isMilkSupplier(f: { milk_financing_enabled?: boolean | null; milk_collection_type?: string | null; last_milk_entry_date?: string | null }, today: Date = new Date()): boolean {
  if (f.milk_financing_enabled || f.milk_collection_type) return true;
  if (!f.last_milk_entry_date) return false;
  const cutoff = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  return f.last_milk_entry_date >= cutoff;
}

/** Signup ka faisla: CNIC ya phone se purana kisan mila to naya nahi banta. */
export function signupDecision(byCnic: { id: string } | null, byPhone: { id: string } | null):
  | { kind: "new" }
  | { kind: "existing"; farmerId: string }
  | { kind: "conflict" } {
  if (byCnic && byPhone && byCnic.id !== byPhone.id) return { kind: "conflict" };
  const hit = byCnic ?? byPhone;
  return hit ? { kind: "existing", farmerId: hit.id } : { kind: "new" };
}
