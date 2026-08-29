import { portalDict } from "./dict/portal";
import { posDict } from "./dict/pos";
import { machineryDict } from "./dict/machinery";
import { myWorkDict } from "./dict/my-work";
import { machineryQueueDict } from "./dict/machinery-queue";
import { leaveDict } from "./dict/leave";
import { milkDispatchDict } from "./dict/milk-dispatch";
import { milkDict, milkPageDict } from "./dict/milk";

/**
 * Teen zabanein, ek hi safha.
 *
 *   en  English            -- daftar, reports, bahar bhejne wali cheezein
 *   rm  Roman Urdu         -- "Nayi Machinery Booking" (abhi jo likha hai)
 *   ur  Urdu script        -- اردو، khet aur counter ke staff ke liye
 *
 * `rm` jaan boojh kar optional hai. Portal ke 262 alfaz pehle se en/ur
 * mein hain; un sab ka Roman ek sath likhna is kaam ko rok deta. Jab tak
 * kisi lafz ka Roman na ho, us ki jagah URDU aata hai -- English nahi.
 *
 * Wajah: Roman Urdu aur Urdu script EK HI ZABAN hain, sirf harf alag
 * hain. Jis bande ne Roman chuna, us ke liye Urdu script parhna English
 * parhne se kahin qareeb hai.
 *
 * ---------------------------------------------------------------------
 * Fehrist module ke module baanti gayi hai (dict/ ke andar)
 * ---------------------------------------------------------------------
 * Poore admin panel mein taqreeban 3,300 alfaz hain. Wo sab ek file mein
 * daal dene ka anjaam ye hota ke koi bhi lafz dhoondna namumkin ho jata
 * aur ek hi cheez ke do naam alag alag jagah likhe jate.
 *
 * Ab har module ki apni file hai, aur lookup ek hi rehta hai -- t().
 * Do jagah dekhne ki zaroorat nahi.
 *
 * Naya module likhte waqt PEHLE glossary.ts dekhein: us mein likha hai
 * ke kis cheez ka kya naam pehle se tay ho chuka hai.
 */
export type Lang = "en" | "rm" | "ur";

const dict = {
  ...portalDict,
  ...posDict,
  ...machineryDict,
  ...myWorkDict,
  ...machineryQueueDict,
  ...leaveDict,
  ...milkDispatchDict,
  ...milkDict,
  ...milkPageDict,
};

export type TranslationKey = keyof typeof dict;

export function t(key: TranslationKey, lang: Lang): string {
  const entry = dict[key] as { en: string; rm?: string; ur: string } | undefined;
  if (!entry) return String(key);
  if (lang === "rm") return entry.rm ?? entry.ur;
  return entry[lang] ?? entry.en;
}

/** Har zaban ka apna naam -- apni hi zaban mein. */
export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  rm: "Roman Urdu",
  ur: "اردو",
};
