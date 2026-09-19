import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode: string = "PKR"): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: decimals }).format(value);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

/** Sequential human-friendly codes, e.g. prefix "INV" + timestamp-based suffix. */
export function generateCode(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

/**
 * Aaj ki tareekh -- PAKISTAN ki, aur donon taraf EK JAISI.
 *
 * -------------------------------------------------------------------
 * DO ALAG MASLE, EK HI ILAAJ
 *
 * 1) **Hydration toot jati hai.** `new Date().toLocaleDateString()` bina
 *    locale ke likha jaye to wo us MACHINE ka locale istemal karta hai
 *    jahan wo chal raha ho. Server par ek lakeer banti hai, browser par
 *    doosri -- aur React kehta hai:
 *
 *      "Hydration failed because the initial UI does not match what was
 *       rendered on the server."
 *
 *    Poora safha wahin ruk jata hai. Ye 6 September ko Live par hua.
 *
 * 2) **Tareekh WAQAI ghalat ho sakti hai.** Server UTC par ho to raat 7
 *    baje ke baad wo AGLA din dikhata hai -- jab ke dukan par abhi wohi
 *    din chal raha hota hai. Statement par ghalat tareekh chhap jati
 *    hai aur kisi ko pata nahi chalta.
 *
 * Donon ka ilaaj ek hai: locale aur timezone PAKKE kar do. Phir server
 * aur browser dono ek hi jawab dete hain, aur wo jawab wo hai jo dukan
 * par khara banda dekh raha hai.
 */
export function aajPakistan(withDay = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    ...(withDay ? { weekday: "long" as const } : {}),
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

/**
 * Aaj ki tareekh form ke khane ke liye (YYYY-MM-DD) -- PAKISTAN ki.
 *
 * -------------------------------------------------------------------
 * `aajKaKhana()` KYUN GHALAT HAI
 *
 * `toISOString()` hamesha **UTC** deta hai. Pakistan UTC se paanch ghante
 * aage hai, is liye raat 12 baje se subah 5 baje ke darmiyan wo AGLA nahi
 * -- PICHHLA din deta hai:
 *
 *     PKT 2 baje raat (7 September)  ->  UTC 9 baje raat (6 September)
 *
 * Yani us waqt har form ka default "kal ki tareekh" hota hai. Jahan raat
 * ko kaam hota hai -- doodh ki subah wali collection, cash closing --
 * wahan ye khamoshi se GHALAT DIN likh deta hai, aur kisi ko pata nahi
 * chalta.
 *
 * Doosra nuqsan: server UTC par chalta hai aur browser Pakistan par, to
 * dono alag jawab dete hain -- aur React ka hydration toot jata hai.
 *
 * Donon ka ilaaj ek hai: timezone PAKKA kar do.
 */
export function aajKaKhana(): string {
  // en-CA is liye ke wo YYYY-MM-DD deta hai -- wohi shakl jo
  // <input type="date"> maangta hai.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
