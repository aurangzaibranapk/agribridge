"use client";
import { Languages } from "lucide-react";
import { setLanguage } from "@/actions/language";
import type { Lang } from "@/lib/i18n/translations";

export function LanguageToggle({ current }: { current: Lang }) {
  function toggle() {
    setLanguage(current === "en" ? "ur" : "en");
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
    >
      <Languages className="h-3.5 w-3.5" />
      {current === "en" ? "اردو" : "English"}
    </button>
  );
}