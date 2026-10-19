"use client";
import { useRef, useState } from "react";
import { fitSize, PHOTO_MAX_PX, THUMB_PX } from "@/lib/portal/dairy-pl";

async function shrink(file: File, max: number, quality: number): Promise<File> {
  const bmp = await createImageBitmap(file);
  const { w, h } = fitSize(bmp.width, bmp.height, max);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("x"))), "image/webp", quality));
  return new File([blob], max === THUMB_PX ? "thumb.webp" : "photo.webp", { type: blob.type || "image/webp" });
}
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);

/** Tasveer chunein -> browser mein chhoti (1600px + 320px WebP) -> form ke saath jaati hai. */
export function PhotoPicker({ title, hint, shrunkWord, current, tall }: { title: string; hint: string; shrunkWord: string; current?: string | null; tall?: boolean }) {
  const photoRef = useRef<HTMLInputElement>(null), thumbRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(f.type)) { setInfo("✕ JPG/PNG/WebP · max 8 MB"); e.target.value = ""; return; }
    setBusy(true);
    try {
      let big = await shrink(f, PHOTO_MAX_PX, 0.82);
      if (big.size > 880_000) big = await shrink(f, 1200, 0.72);
      const small = await shrink(f, THUMB_PX, 0.75);
      const d1 = new DataTransfer(); d1.items.add(big); photoRef.current!.files = d1.files;
      const d2 = new DataTransfer(); d2.items.add(small); thumbRef.current!.files = d2.files;
      setPreview(URL.createObjectURL(big));
      setInfo(`${kb(f.size)} → ${kb(big.size)} (${shrunkWord})`);
    } catch { setInfo("✕"); } finally { setBusy(false); e.target.value = ""; }
  }
  return (
    <div className="space-y-2">
      <label className={`relative grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 text-center text-xs text-surface-500 hover:border-green-500 dark:border-surface-700 dark:bg-surface-800 dark:text-slate-400 ${tall ? "h-56" : "h-44"}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="p-4"><span className="block text-3xl">📤</span><b className="block text-surface-800 dark:text-slate-100">{title}</b>{hint}</span>
        )}
        {preview && <span className="absolute bottom-2 end-2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white">📷 {title}</span>}
        {busy && <span className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold text-green-800 dark:bg-black/60 dark:text-green-200">…</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={pick} />
      </label>
      <input ref={photoRef} type="file" name="photo" className="hidden" />
      <input ref={thumbRef} type="file" name="photo_thumb" className="hidden" />
      {info && <p className="text-[11px] text-surface-500 dark:text-slate-400">{info}</p>}
    </div>
  );
}
