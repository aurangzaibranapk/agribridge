import { cookies } from "next/headers";
import type { Lang } from "./translations";

/**
 * Server par zaban parhna.
 *
 * `fallback` is liye hai ke har hissay ki apni pasandeeda default ho:
 * farmer portal Urdu se shuru hota hai (kisan ke liye), aur admin panel
 * Roman se (abhi wahan yahi likha hua hai, is liye purane staff ko koi
 * jhatka nahi lagta).
 */
export function getLanguageFromCookies(fallback: Lang = "ur"): Lang {
  const lang = cookies().get("agribridge_lang")?.value;
  if (lang === "en" || lang === "rm" || lang === "ur") return lang;
  return fallback;
}
