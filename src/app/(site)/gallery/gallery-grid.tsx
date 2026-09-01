"use client";

import { useMemo, useState } from "react";
import { X, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface GalleryItem { id: string; type: "photo" | "video"; url: string; thumbnail_url: string | null; caption: string | null; category: string | null }

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const lang = useLang();
  const [activeCategory, setActiveCategory] = useState("All");
  const [lightboxItem, setLightboxItem] = useState<GalleryItem | null>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map((i) => i.category).filter(Boolean) as string[]))], [items]);
  const filtered = activeCategory === "All" ? items : items.filter((i) => i.category === activeCategory);

  if (items.length === 0) {
    return <p className="text-center text-sm text-surface-400 dark:text-surface-500">{t("sp_no_gallery", lang)}</p>;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              activeCategory === cat ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((item) => (
          <button
            key={item.id}
            onClick={() => setLightboxItem(item)}
            className="group relative aspect-square overflow-hidden rounded-card border border-surface-200 dark:border-surface-800"
          >
            <img
              src={item.thumbnail_url || item.url}
              alt={item.caption ?? ""}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            {item.type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                <PlayCircle className="h-8 w-8 text-white" />
              </span>
            )}
          </button>
        ))}
      </div>

      {lightboxItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxItem(null)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setLightboxItem(null)} aria-label={t("sp_close", lang)}>
            <X className="h-6 w-6" />
          </button>
          <div className="max-h-[85vh] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {lightboxItem.type === "video" ? (
              <video src={lightboxItem.url} controls autoPlay className="max-h-[85vh] w-full rounded-lg" />
            ) : (
              <img src={lightboxItem.url} alt={lightboxItem.caption ?? ""} className="max-h-[85vh] w-full rounded-lg object-contain" />
            )}
            {lightboxItem.caption && <p className="mt-2 text-center text-sm text-white">{lightboxItem.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
