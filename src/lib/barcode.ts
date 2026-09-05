/**
 * Barcode ka adad khud jaancha ja sakta hai.
 *
 * EAN-13, EAN-8 aur UPC-A -- teenon ka aakhri adad "check digit" hota
 * hai, jo baqi adadon se banta hai. Yani ek ghalat parha hua barcode
 * aksar KHUD BATA DETA hai ke wo ghalat hai.
 *
 * Ye jaanch is liye ahem hai ke barcode ki ghalti khud nazar nahi aati:
 * dono adad bilkul ek jaise dikhte hain, aur farq us din khulta hai jab
 * dukan par scan karne se doosra product nikalta hai.
 */
export function isValidBarcode(raw: string): boolean {
  const code = raw.replace(/\D/g, "");
  if (![8, 12, 13].includes(code.length)) return false;

  const digits = code.split("").map(Number);
  const check = digits.pop() as number;

  // Daayen se: baari baari 3 aur 1 ka pahaRa (EAN/UPC ka usool).
  let sum = 0;
  for (let i = digits.length - 1, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += digits[i] * weight;
  }

  return (10 - (sum % 10)) % 10 === check;
}

/** Sirf adad rakhta hai. Tasveer se aaya matn aksar space le aata hai. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}
