"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

export function SearchBar() {
  const lang = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("sp_search_site", lang)}
        className="h-9 w-full rounded-lg border border-surface-200 bg-surface-50 pl-8 pr-2 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
      />
    </form>
  );
}
