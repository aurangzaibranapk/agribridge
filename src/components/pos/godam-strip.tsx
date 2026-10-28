"use client";

import { useState } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import {
  formatGodamQty,
  godamHint,
  shopQtyToneClass,
  type GodamLine,
} from "@/lib/pos/godam-on-card";

/**
 * Card ki tasveer ke neeche ki lakeer: Dukan X | Godam Y.
 * Hover ya tap par har godam ka naam. Daban se cart nahi banta.
 */
export function GodamStrip({
  shopQty,
  godamQty,
  lines,
  lang,
  defaultOpen = false,
}: {
  shopQty: number;
  godamQty: number | null | undefined;
  lines: GodamLine[] | null | undefined;
  lang: Lang;
  defaultOpen?: boolean;
}) {
  const [hover, setHover] = useState(defaultOpen);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;
  const known = godamQty != null;
  const list = lines ?? [];

  return (
    <div
      data-godam-strip
      data-testid="pos-godam-strip"
      className="absolute bottom-1.5 left-1.5 right-1.5 z-10"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setPinned((v) => !v);
      }}
    >
      {open && (
        <div
          data-testid="pos-godam-lines"
          className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-28 overflow-y-auto rounded-lg border border-brand-800/15 bg-white/95 px-2 py-1.5 text-[11px] text-surface-800 shadow-md backdrop-blur-md dark:border-white/15 dark:bg-[#142848] dark:text-[#e7eef8]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-surface-500 dark:text-[#93a3bd]">
            {t("pos_godam_names", lang)}
          </p>
          {!known && <p className="pt-0.5">{t("pos_godam_unknown", lang)}</p>}
          {known && list.length === 0 && <p className="pt-0.5">{t("pos_godam_empty", lang)}</p>}
          {known &&
            list.map((line, i) => (
              <p key={`${line.name}-${i}`} className="flex justify-between gap-2 pt-0.5">
                <span className="min-w-0 truncate">{line.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">{formatGodamQty(line.qty)}</span>
              </p>
            ))}
        </div>
      )}
      <div className="flex items-center justify-center gap-1.5 rounded-lg border border-brand-800/15 bg-white/75 px-1.5 py-1 text-[11px] font-semibold text-surface-800 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-[#101f42]/80 dark:text-[#e7eef8]">
        <span className="inline-flex items-center">
          <i className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${shopQtyToneClass(shopQty)}`} />
          <em className="mr-1 font-semibold not-italic opacity-70">{t("pos_dukan", lang)}</em>
          <b className="tabular-nums">{formatGodamQty(shopQty)}</b>
        </span>
        <span className="opacity-40">|</span>
        <span className="inline-flex items-center">
          <i className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${known && godamQty > 0 ? "bg-[#3d6cb5] dark:bg-[#8eb4f0]" : "bg-surface-400"}`} />
          <em className="mr-1 font-semibold not-italic opacity-70">{t("pos_godam", lang)}</em>
          <b className="tabular-nums">{formatGodamQty(godamQty)}</b>
        </span>
      </div>
    </div>
  );
}

export function GodamHint({
  shopQty,
  godamQty,
  minStock,
  lang,
  className = "",
}: {
  shopQty: number;
  godamQty: number | null | undefined;
  minStock: number | null | undefined;
  lang: Lang;
  className?: string;
}) {
  const kind = godamHint(shopQty, godamQty ?? null, minStock);
  if (!kind) return null;
  return (
    <p
      data-testid="pos-godam-hint"
      data-godam-hint={kind}
      className={`mt-1.5 rounded-md border border-amber-300 bg-[#fff7e6] px-1.5 py-1 text-[10px] font-semibold leading-snug text-amber-900 dark:border-amber-300/35 dark:bg-amber-400/15 dark:text-amber-100 ${className}`}
    >
      {t(kind === "out" ? "pos_godam_hint_out" : "pos_godam_hint_low", lang)}
    </p>
  );
}
