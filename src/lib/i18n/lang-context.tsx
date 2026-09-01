"use client";
import { createContext, useContext } from "react";
import type { Lang } from "./translations";

/**
 * Zaban ek jagah se, poore admin panel ke liye.
 *
 * Do aur raaste the aur dono mein kharabi thi:
 *
 *   useLanguage()  cookie BROWSER mein parhta hai. Yani safha pehle ek
 *                  zaban mein banta hai aur phir doosri mein badal jata
 *                  hai. Counter par ye jhatka saaf nazar aata hai.
 *
 *   prop           safha safha bhejna. Machinery ke ek hi file mein
 *                  aathara chhote components hain; har ek tak zaban
 *                  pahunchane ke liye har ek ka signature badalna paRta,
 *                  aur ek bhi bhool jane par wahin English reh jati.
 *
 * Is liye context: zaban server se aati hai (jahan cookie pehle se
 * maloom hai), admin ke layout par ek dafa lagti hai, aur andar jitne
 * marzi components hon, sab wahin se parh lete hain.
 *
 * Server components is ka istemal NAHI kar sakte -- wo getLanguageFromCookies()
 * se seedha parhte hain. Dono ek hi cookie parhte hain, is liye jawab ek
 * hi hota hai.
 */
const LangContext = createContext<Lang>("rm");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}
