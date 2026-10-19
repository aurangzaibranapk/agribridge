"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, LocateFixed } from "lucide-react";
import { project, unproject, fitView, TILE } from "@/lib/maps/mercator";
import { tileConfig, tileUrl, TILE_REFERRER_POLICY } from "@/lib/maps/tiles";

const TILES = tileConfig();

export interface MapPin { id: string; lat: number; lng: number; color?: string; label?: string; active?: boolean }

/**
 * Halka naqsha (koi library nahi): OSM tiles + pins. Tile na aayein
 * (kamzor internet) to bhi grid par pins sahi jagah dikhti hain.
 * onPick diya ho to tap se pin lagti hai.
 */
export function PinMap({ pins, onPick, height: fixedHeight = 280, className = "", fitKey, fill = false }: {
  pins: MapPin[]; onPick?: (lat: number, lng: number) => void; height?: number; className?: string; fitKey?: string;
  /** true: parent ki poori oonchai le (ek-screen layout); warna `height` px. */
  fill?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [fillH, setFillH] = useState(fixedHeight);
  const height = fill ? fillH : fixedHeight;
  const [view, setView] = useState(() => fitView(pins, 640, height));
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => { setW(el.clientWidth || 640); if (fill) setFillH(el.clientHeight || fixedHeight); };
    const ro = new ResizeObserver(measure); ro.observe(el); measure();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setView(fitView(pins, w, height)); }, [fitKey, w, height]);

  const c = project(view.center.lat, view.center.lng, view.zoom);
  const ox = Math.round(c.x - w / 2), oy = Math.round(c.y - height / 2);
  const tiles = useMemo(() => {
    const out: { key: string; x: number; y: number; url: string }[] = []; const n = 2 ** view.zoom;
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + w) / TILE); tx++)
      for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + height) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        out.push({ key: `${view.zoom}/${tx}/${ty}`, x: tx * TILE - ox, y: ty * TILE - oy, url: tileUrl(TILES.template, view.zoom, wx, ty) });
      }
    return out;
  }, [ox, oy, w, height, view.zoom]);

  const zoom = (d: number) => setView((v) => ({ ...v, zoom: Math.max(4, Math.min(18, v.zoom + d)) }));
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, center: unproject(d.cx - dx, d.cy - dy, v.zoom) }));
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (d && !d.moved && onPick && ref.current) {
      const r = ref.current.getBoundingClientRect();
      const p = unproject(ox + (e.clientX - r.left), oy + (e.clientY - r.top), view.zoom);
      onPick(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6);
    }
  };

  return (
    <div ref={ref} style={{ height: fill ? "100%" : height }} className={`relative touch-none select-none overflow-hidden rounded-xl border border-surface-200 bg-[#e8f0ea] bg-[linear-gradient(rgba(15,80,50,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(15,80,50,.07)_1px,transparent_1px)] bg-[size:32px_32px] dark:border-surface-700 dark:bg-[#15263d] ${onPick ? "cursor-crosshair" : "cursor-grab"} ${className}`}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} role="application" aria-label="Farm map">
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={t.key} src={t.url} alt="" draggable={false} loading="lazy" referrerPolicy={TILE_REFERRER_POLICY}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
          className="pointer-events-none absolute h-64 w-64 max-w-none dark:brightness-[.72] dark:contrast-[1.1] dark:hue-rotate-180 dark:invert" style={{ left: t.x, top: t.y }} />
      ))}
      {pins.map((p) => {
        const q = project(p.lat, p.lng, view.zoom);
        return (
          <div key={p.id} title={p.label} className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ left: Math.round(q.x - ox), top: Math.round(q.y - oy) }}>
            <svg width={p.active ? 34 : 26} height={p.active ? 44 : 34} viewBox="0 0 26 34" className="drop-shadow-md">
              <path d="M13 0C5.8 0 0 5.7 0 12.8 0 22.4 13 34 13 34s13-11.6 13-21.2C26 5.7 20.2 0 13 0z" fill={p.color ?? "#e5484d"} stroke="#fff" strokeWidth="2" />
              <circle cx="13" cy="12.5" r="4.5" fill="#fff" />
            </svg>
            {p.label && p.active && <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-surface-900/85 px-2 py-0.5 text-[11px] font-medium text-white">{p.label}</span>}
          </div>
        );
      })}
      <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border border-surface-200 bg-white/95 shadow dark:border-surface-700 dark:bg-surface-900/95" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1)} className="p-1.5 text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800"><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(-1)} className="border-t border-surface-200 p-1.5 text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Fit" onClick={() => setView(fitView(pins, w, height))} className="border-t border-surface-200 p-1.5 text-surface-700 hover:bg-surface-100 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"><LocateFixed className="h-4 w-4" /></button>
      </div>
      <a href={TILES.attributionUrl} target="_blank" rel="noopener noreferrer" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
        className="absolute bottom-0 right-0 rounded-tl-md bg-white/85 px-1.5 py-0.5 text-[10px] text-surface-600 hover:underline dark:bg-surface-900/85 dark:text-surface-300">{TILES.attribution}</a>
    </div>
  );
}
