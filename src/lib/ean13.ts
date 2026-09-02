/**
 * EAN-13 ka naqsha banana (I, naqshe ka #13).
 *
 * Apna barcode "200" se shuru hota hai -- ye range duniya bhar mein
 * "andar ke istemal" ke liye rakhi gayi hai (GS1: 200-299), is liye ye
 * kisi asal company ke barcode se kabhi nahi takrayega, aur har aam
 * scanner ise parh leta hai.
 *
 * Yahan sirf lakeeron ka naqsha banta hai: 95 khane, har khana kala (1)
 * ya safed (0). Chhaapne wala hissa is se SVG banata hai.
 */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
// Pehla adad batata hai baen taraf ke chhe adad L/G mein kaise likhen.
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13CheckDigit(first12: string): number {
  const d = first12.replace(/\D/g, "").slice(0, 12).split("").map(Number);
  if (d.length !== 12) throw new Error("EAN-13 ke liye 12 adad chahiye");
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += d[i] * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** 13 adad -> 95 khane ka naqsha ("1"/"0"). */
export function ean13Modules(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length !== 13) throw new Error("EAN-13 mein 13 adad hote hain");
  if (ean13CheckDigit(digits.slice(0, 12)) !== Number(digits[12])) throw new Error("Check digit ghalat hai");
  const parity = PARITY[Number(digits[0])];
  let out = "101";
  for (let i = 1; i <= 6; i++) {
    const n = Number(digits[i]);
    out += parity[i - 1] === "L" ? L[n] : G[n];
  }
  out += "01010";
  for (let i = 7; i <= 12; i++) out += R[Number(digits[i])];
  out += "101";
  return out;
}

export function isEan13(code: string): boolean {
  const d = code.replace(/\D/g, "");
  if (d.length !== 13) return false;
  try {
    return ean13CheckDigit(d.slice(0, 12)) === Number(d[12]);
  } catch {
    return false;
  }
}
