/**
 * Paisa aaya magar har aamad aamdani (revenue) nahi hoti.
 *
 * Health sweep 10 Oct 2026: manual "income" form ki categories jaise
 * "Udhaar liya (qarz)", "customer_udhaar_wapsi" aur "Shuruati balance"
 * `incomeAccountFor()` mein kisi khaas khate se nahi milti thin, is liye
 * 4090 (Other Income) mein chali jati thin -- qarz aur wusooli munafa ban
 * jate the. Ye function aisi categories pehchanta hai aur ghair-aamdani
 * khata deta hai. Party maloom na ho to Suspense (9999), taake nazar aaye
 * aur ghalat party par na lage.
 */
export const RECEIPT_ACC = { suspense: "9999", openingEquity: "3200" } as const;

export function nonRevenueReceiptAccount(category: string | null | undefined): string | null {
  const c = (category ?? "").toLowerCase();
  if (!c.trim()) return null;
  // Qarz / loan liya -- liability hai, aamdani nahi.
  if (/\b(qarz|qarza|loan)\b/.test(c) || c.includes("udhaar liya")) return RECEIPT_ACC.suspense;
  // Kisi ka udhaar wapas aaya (wusooli) -- receivable kam hota hai, aamdani nahi.
  if (/(udhaar[_ ]?wapsi|wusool|recovery|receivable|collection|wapas)/.test(c)) return RECEIPT_ACC.suspense;
  // Shuruati / opening balance -- equity.
  if (/(shuruati|opening)/.test(c)) return RECEIPT_ACC.openingEquity;
  return null;
}
