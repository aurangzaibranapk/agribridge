"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";

export const LIGHTBOX_ZOOM_STEPS = [1, 1.5, 2, 3] as const;
export function nextZoom(current: number, dir: 1 | -1): number {
  const steps = LIGHTBOX_ZOOM_STEPS as readonly number[];
  const i = Math.max(0, steps.indexOf(current));
  return steps[Math.min(steps.length - 1, Math.max(0, i + dir))];
}

/** Thumbnail that opens the image in an in-page lightbox instead of a new tab. */
export function LightboxImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full cursor-zoom-in text-left" aria-label={`${alt} bara kar ke dekhein`}>
        <img src={src} alt={alt} className={className} />
      </button>
      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => nextZoom(z, 1));
      if (e.key === "-") setZoom((z) => nextZoom(z, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const btn = "flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20";
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[1000] flex flex-col bg-black/85" onClick={onClose}>
      <div className="flex flex-wrap items-center justify-end gap-2 p-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={btn} onClick={() => setZoom((z) => nextZoom(z, -1))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <span className="text-xs text-white/80">{Math.round(zoom * 100)}%</span>
        <button type="button" className={btn} onClick={() => setZoom((z) => nextZoom(z, 1))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        <a className={btn} href={src} download target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" />Download</a>
        <a className={btn} href={src} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Naye tab mein kholein</a>
        <button type="button" className={btn} onClick={onClose} aria-label="Band karein"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-3" onClick={onClose}>
        <img src={src} alt={alt} onClick={(e) => { e.stopPropagation(); setZoom((z) => (z === 1 ? 2 : 1)); }}
          style={{ width: zoom === 1 ? undefined : `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none" }}
          className={`mx-auto ${zoom === 1 ? "max-h-full cursor-zoom-in object-contain" : "cursor-zoom-out"}`} />
      </div>
    </div>,
    document.body,
  );
}
