"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, X } from "lucide-react";

/**
 * Mera Kaam se khula hua safha isi screen ke andar rehta hai (malik, 7
 * September): "kisi bhi card/tag par click karein to us ke liye NAYA
 * safha na khule, wahin par khul jaye -- scroll karke neeche na jana
 * paRe."
 *
 * Tareeqa: Mera Kaam ke andar kisi internal `/admin/...` link par click
 * pakड़ते hain, us route ko poori screen ke overlay mein ek iframe ke
 * zariye kholte hain (`?workspace=1` ke sath, taake wo safha apna
 * topbar/sidebar dobara na banaye -- dekhein ChromeGate). Peeche wala
 * Mera Kaam apni jagah, apne scroll position par, waisa ka waisa rehta
 * hai. Naya tab, Ctrl/Cmd/Shift/Alt-click aur bahar wale links (http…)
 * isi tarah kaam karte hain jaise pehle karte the.
 */
export function InPageWorkspace({ children }: { children: React.ReactNode }) {
  const [href, setHref] = useState<string | null>(null);
  const [title, setTitle] = useState("Kaam");

  useEffect(() => {
    if (!href) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [href]);

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    const a = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
    if (!a) return;

    const raw = a.getAttribute("href") || "";
    // Sirf apne hi admin raaston ke liye -- bahar ka link, mailto, tel
    // waghera bilkul purane tareeqe se hi khulte hain.
    if (!raw.startsWith("/admin/")) return;
    // Mera Kaam khud aur Notifications poora safha hi behtar hai --
    // inhein overlay mein dobara kholna faida nahi deta.
    if (raw.startsWith("/admin/my-work") || raw.startsWith("/admin/notifications")) return;
    if (a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    setTitle((a.textContent || "Kaam").trim().replace(/\s+/g, " ").slice(0, 60) || "Kaam");
    const join = raw.includes("?") ? "&" : "?";
    setHref(`${raw}${join}workspace=1`);
  }

  return (
    <div onClick={onClick} className="min-h-full">
      {children}

      {href && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-surface-50 dark:bg-surface-950">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-surface-200 bg-white px-3 shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <button
              type="button"
              onClick={() => setHref(null)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-surface-200 px-3 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
            >
              <ArrowLeft className="h-4 w-4" /> Wapas
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-surface-900 dark:text-white">{title}</p>
            </div>
            <a
              href={href.replace(/([?&])workspace=1(&|$)/, (_m, p1: string, p2: string) => (p2 ? p1 : ""))}
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-surface-500 hover:bg-surface-50 sm:inline-flex dark:hover:bg-surface-800"
            >
              <ExternalLink className="h-4 w-4" /> Nayi tab mein
            </a>
            <button
              type="button"
              aria-label="Band karein"
              onClick={() => setHref(null)}
              className="grid h-9 w-9 place-items-center rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Sirf isi iframe ke andar scroll hota hai -- peeche wala Mera
              Kaam kabhi nahi hilta. */}
          <iframe key={href} src={href} title={title} className="flex-1 border-0 bg-white dark:bg-surface-950" />
        </div>
      )}
    </div>
  );
}
