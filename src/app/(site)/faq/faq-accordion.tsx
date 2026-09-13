"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Faq { id: string; question: string; answer: string; category: string | null }

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  }, [faqs, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Faq[]>();
    for (const f of filtered) {
      const cat = f.category ?? "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <div className="relative mb-8">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("sp_search_faq", lang)} className="pl-9" />
      </div>

      {grouped.length === 0 && <p className="text-center text-sm text-surface-400 dark:text-surface-500">{t("sp_no_faq", lang)}</p>}

      {grouped.map(([category, items]) => (
        <div key={category} className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-surface-900 dark:text-white">{category}</h2>
          <div className="space-y-2">
            {items.map((f) => (
              <div key={f.id} className="rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
                <button
                  onClick={() => setOpenId(openId === f.id ? null : f.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-surface-900 dark:text-white">{f.question}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-surface-400 transition-transform", openId === f.id && "rotate-180")} />
                </button>
                {openId === f.id && (
                  <div className="border-t border-surface-100 px-4 py-3 text-sm text-surface-600 dark:border-surface-800 dark:text-surface-300">
                    {f.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
