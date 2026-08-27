"use client";
import { useEffect, useState } from "react";

// Simple client-side reader for the "language" cookie set by
// src/actions/language.ts (cookie-based i18n system used across the
// app). Returns "en" or "ur" - defaults to "en" until the cookie is
// read on mount (avoids SSR/CSR mismatch).
export function useLanguage() {
  const [language, setLanguage] = useState<"en" | "ur">("en");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)language=([^;]+)/);
    if (match && (match[1] === "en" || match[1] === "ur")) {
      setLanguage(match[1]);
    }
  }, []);

  return { language };
}