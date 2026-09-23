/**
 * Purchase par adaigi ki shartein -- ek jagah parhi jati hain (255).
 *
 * Do form hain jo purchase banate hain (purchases/new aur bill ka
 * safha), aur dono ko wohi teen sawal karne hain: poora diya, kuch
 * diya, ya udhaar? Kitna diya? Kab tak dena hai? Do jagah alag alag
 * parhne se ek din ek jagah ka qaida doosri se hat jata hai.
 *
 * Yahan koi database nahi -- sirf form ki likhai se faisla.
 */

export type PaymentTerms = "paid" | "partial" | "credit";

export interface ParsedTerms {
  terms: PaymentTerms;
  /** Abhi kitna diya. 'credit' par 0, 'paid' par poora total. */
  paidNow: number;
  creditDays: number | null;
  /** YYYY-MM-DD ya null. */
  dueDate: string | null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Form se shartein nikalna. Ghalti par string wapas aata hai -- jo
 * seedha bande ko dikhaya ja sakta hai.
 */
export function parsePaymentTerms(
  formData: FormData,
  total: number,
  purchaseDate: string
): ParsedTerms | { error: string } {
  const raw = String(formData.get("payment_terms") ?? "credit").trim();
  const terms: PaymentTerms = raw === "paid" || raw === "partial" ? raw : "credit";

  const num = (k: string): number | null => {
    const v = String(formData.get(k) ?? "").trim();
    if (!v) return null;
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  let paidNow = 0;
  if (terms === "paid") {
    paidNow = total;
  } else if (terms === "partial") {
    const p = num("paid_now");
    if (p == null || p <= 0) return { error: '"Kuch diya" ke sath adad likhna zaroori hai, sifar nahi.' };
    if (p >= total) return { error: "Abhi diye hue paise kharid ke kul se zyada ya barabar hain — phir ye \"poora diya\" hai." };
    paidNow = p;
  }

  // Due date: seedha likhi ho to wohi; warna udhaar ke din kharid ki
  // tareekh se. 'paid' par koi due date nahi -- dena hai hi nahi.
  let creditDays: number | null = null;
  let dueDate: string | null = null;
  if (terms !== "paid") {
    const explicit = String(formData.get("due_date") ?? "").trim();
    const days = num("credit_days");
    if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) {
      dueDate = explicit;
      creditDays = days == null ? null : Math.round(days);
    } else if (days != null) {
      creditDays = Math.round(days);
      dueDate = addDays(purchaseDate, creditDays);
    }
  }

  return { terms, paidNow, creditDays, dueDate };
}
