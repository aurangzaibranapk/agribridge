/**
 * POS Checkout ka double-submit bachao (fix/pos-card-cash-dupes).
 *
 * `submitting` React state agle render tak update nahi hota -- do tez
 * clicks (ya touch screen par double tap) dono guzar jate the. Ye gate
 * foran (synchronously) band hota hai, is liye doosra click wahin ruk
 * jata hai. Pure -- browser/React ke baghair test ho sakta hai.
 */
import { DUPLICATE_SALE_MARKER } from "@/lib/pos/checkout-guards";

export interface SubmitGate {
  /** true = aap chala sakte hain (gate ab band); false = pehle se chal raha hai. */
  tryEnter(): boolean;
  leave(): void;
  readonly busy: boolean;
}

export function createSubmitGate(): SubmitGate {
  let busy = false;
  return {
    tryEnter() {
      if (busy) return false;
      busy = true;
      return true;
    },
    leave() {
      busy = false;
    },
    get busy() {
      return busy;
    },
  };
}

/** Gate ke andar kaam chalao; dusri call (jab tak pehli chal rahi) kuch nahi karti. */
export async function runOnce<T>(gate: SubmitGate, fn: () => Promise<T>): Promise<T | undefined> {
  if (!gate.tryEnter()) return undefined;
  try {
    return await fn();
  } finally {
    gate.leave();
  }
}

/**
 * Ek cart ke liye ek hi idempotency key. Retry (network/override/confirm)
 * par wohi key jati hai, taake server/DB wohi bill wapas de, naya na
 * banaye. Bill kamyab hone par (resetSale) key saaf.
 */
export function createCheckoutKey(gen: () => string) {
  let key: string | null = null;
  return {
    current(): string {
      if (!key) key = gen();
      return key;
    },
    reset() {
      key = null;
    },
  };
}

export function isDuplicateSaleError(error: string | undefined | null): boolean {
  return !!error && error.startsWith(DUPLICATE_SALE_MARKER);
}

export function duplicateSaleMessage(error: string): string {
  return error.slice(DUPLICATE_SALE_MARKER.length).trim();
}
