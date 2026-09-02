"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { setUiMode } from "@/actions/training";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

/** Simple / Advanced ka switch (E). Upar ki patti par. */
export function UiModeToggle({ mode }: { mode: "simple" | "advanced" }) {
  const lang = useLang();
  const router = useRouter();
  const [cur, setCur] = useState(mode);
  const [pending, start] = useTransition();
  function flip() {
    const next = cur === "simple" ? "advanced" : "simple";
    setCur(next);
    start(async () => {
      await setUiMode(next);
      router.refresh();
    });
  }
  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      title={t("um_hint", lang)}
      className="hidden h-9 items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 text-xs font-medium text-surface-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-60 md:inline-flex dark:border-surface-700 dark:text-surface-300"
    >
      <SlidersHorizontal className="h-4 w-4" />
      {cur === "simple" ? t("um_simple", lang) : t("um_advanced", lang)}
    </button>
  );
}
