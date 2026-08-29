"use client";
import { useEffect, useState } from "react";

// Client-side reader for the language cookie that src/actions/language.ts
// sets. Returns "en" or "ur".
//
// Cookie ka naam "agribridge_lang" hai. Pehle yahan "language" likha tha
// -- yani ye hook wo cookie parhta tha jo kabhi likhi hi nahi jati thi.
// Nateeja: farmer portal ke saare CLIENT wale hissay hamesha English hi
// dikhate rehte the, chahe kisan Urdu chun leta. Server wale hissay Urdu
// mein aate the, is liye ek hi safhe par dono zabanein nazar aati thin.
//
// Default bhi "ur" kar diya gaya hai, get-language.ts ki tarah -- warna
// safha pehle English mein banta aur cookie parhte hi Urdu mein badal
// jata.
export function useLanguage() {
  const [language, setLanguage] = useState<"en" | "ur">("ur");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)agribridge_lang=([^;]+)/);
    if (match && (match[1] === "en" || match[1] === "ur")) {
      setLanguage(match[1]);
    }
  }, []);

  return { language };
}