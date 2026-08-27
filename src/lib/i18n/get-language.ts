import { cookies } from "next/headers";
import type { Lang } from "./translations";

export function getLanguageFromCookies(): Lang {
  const lang = cookies().get("agribridge_lang")?.value;
  return lang === "en" ? "en" : "ur";
}