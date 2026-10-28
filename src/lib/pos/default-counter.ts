/**
 * POS khulte waqt kaunsi dukaan pehle khule.
 *
 * Pehle code `openShifts[0]` leta tha, aur wo query bina order ke thi.
 * Live par Anwar (shop = Kisaan Karyana Mahabali) ka purana shift
 * SHIFT-26-00026 Dukan POS-01 par khula pada hai, is liye /admin/pos
 * hamesha Kisaan Dukan Mahabali kholta tha.
 *
 * Ab tarteeb:
 *   1. `?counter=` — banda khud switcher se aaya, wahi counter.
 *   2. Staff jiski profile.shop_id us ke counters mein hai — wahi dukaan.
 *      Doosri dukaan par khula shift is ko nahi cheenta.
 *   3. Owner / Admin / Super Admin — Kisaan Karyana Mahabali
 *      (Live id, warna naam). 157 NB ("Kryana") default nahi.
 *   4. Warna khula shift, phir akeli counter, warna khali chunao.
 *
 * Preferred dukaan par khula shift ho to wahi POS. Na ho to usi counter
 * ka Shift Open form — Doosri shop ka khula shift yahan nahi khulta.
 */

/** Live: Kisaan Karyana Mahabali, code 03. Testing par naam se pehchan. */
export const KISAAN_KARYANA_MAHABALI_SHOP_ID = "263f1d55-91f4-4866-8c34-b1df7e5d1651";

export interface PosCounterChoice {
  id: string;
  name: string;
  shopId: string;
  shopName: string;
  shopCode?: string | null;
}

export type PosCounterPickReason =
  | "requested"
  | "assigned-shop"
  | "karyana-default"
  | "open-shift"
  | "only-counter"
  | "none";

export interface PosCounterPick {
  counterId: string | null;
  /** List ke upar ye dukaan. Khali jab koi pasand na ho. */
  preferredShopId: string | null;
  reason: PosCounterPickReason;
}

function shopNameKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Kisaan Karyana Mahabali — 157 NB alag dukaan hai (code KC002, naam
 * "Kryana"), usay yahan se nahi pakarte.
 */
export function isKisaanKaryanaMahabali(shop: {
  id?: string | null;
  name?: string | null;
  code?: string | null;
}): boolean {
  if (shop.id && shop.id === KISAAN_KARYANA_MAHABALI_SHOP_ID) return true;
  const name = shopNameKey(shop.name);
  if (name === "kisaan karyana mahabali" || name === "kisan karyana mahabali") return true;
  const code = (shop.code ?? "").trim().toLowerCase();
  return code === "03" && name.includes("karyana") && name.includes("mahabali") && !name.includes("157");
}

function byCounterName(a: PosCounterChoice, b: PosCounterChoice): number {
  return a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);
}

/** Preferred dukaan par naya khula shift, warna naam se pehla counter. */
function chooseOnShop(onShop: PosCounterChoice[], openShiftCounterIds: string[]): PosCounterChoice | null {
  if (onShop.length === 0) return null;
  for (const id of openShiftCounterIds) {
    const hit = onShop.find((c) => c.id === id);
    if (hit) return hit;
  }
  return [...onShop].sort(byCounterName)[0] ?? null;
}

export function pickPosCounter(opts: {
  counters: PosCounterChoice[];
  /** Naye se purane. Ek counter par ek hi khula shift. */
  openShiftCounterIds: string[];
  requestedCounterId?: string | null;
  /** profile.shop_id. Owner/Admin par nazarandaz — un ka default Karyana hai. */
  assignedShopId?: string | null;
  unrestricted: boolean;
}): PosCounterPick {
  const counters = opts.counters;
  const requested =
    opts.requestedCounterId && counters.some((c) => c.id === opts.requestedCounterId)
      ? opts.requestedCounterId
      : null;
  if (requested) {
    const row = counters.find((c) => c.id === requested)!;
    return { counterId: requested, preferredShopId: row.shopId, reason: "requested" };
  }

  if (!opts.unrestricted && opts.assignedShopId) {
    const onShop = counters.filter((c) => c.shopId === opts.assignedShopId);
    const chosen = chooseOnShop(onShop, opts.openShiftCounterIds);
    if (chosen) {
      return { counterId: chosen.id, preferredShopId: opts.assignedShopId, reason: "assigned-shop" };
    }
  }

  if (opts.unrestricted) {
    const karyana = counters.find((c) =>
      isKisaanKaryanaMahabali({ id: c.shopId, name: c.shopName, code: c.shopCode }),
    );
    if (karyana) {
      const onShop = counters.filter((c) => c.shopId === karyana.shopId);
      const chosen = chooseOnShop(onShop, opts.openShiftCounterIds);
      if (chosen) {
        return { counterId: chosen.id, preferredShopId: karyana.shopId, reason: "karyana-default" };
      }
    }
  }

  for (const id of opts.openShiftCounterIds) {
    const row = counters.find((c) => c.id === id);
    if (row) return { counterId: row.id, preferredShopId: null, reason: "open-shift" };
  }

  if (counters.length === 1) {
    return { counterId: counters[0].id, preferredShopId: null, reason: "only-counter" };
  }

  return { counterId: null, preferredShopId: null, reason: "none" };
}

export function sortPosCounters<T extends { shopId: string; shopName: string; name: string }>(
  counters: T[],
  preferredShopId: string | null,
): T[] {
  return [...counters].sort((a, b) => {
    const ap = preferredShopId && a.shopId === preferredShopId ? 0 : 1;
    const bp = preferredShopId && b.shopId === preferredShopId ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const shop = a.shopName.localeCompare(b.shopName, "en");
    if (shop !== 0) return shop;
    return a.name.localeCompare(b.name, "en");
  });
}
