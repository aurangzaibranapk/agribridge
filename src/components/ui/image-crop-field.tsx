"use client";

import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/form";

/**
 * Documents ka khana -- CNIC, tasveer -- do cheezein malik ne maangi
 * hain (7 September): (1) seedha camera se khenchna, sirf file chunna
 * nahi, aur (2) upload se pehle crop.
 *
 * Form khud plain HTML submit se chalta hai (`useFormState`), is liye
 * ye component server action ko chhta nahi hai -- crop hone ke baad
 * result ek CHHUPI hui `<input type="file" name={name}>` mein daal
 * diya jata hai (DataTransfer se), taake bahar wala form isay bilkul
 * usi tarah uthaye jaise seedha file chuni gayi ho. `uploadOne`
 * (farmer-profile.ts) ko is se kuch farq nahi parta.
 */
export function ImageCropField({
  name,
  label,
  existingUrl,
  aspect = 1,
  notUploadedLabel = "Abhi upload nahi hui.",
  outputMaxWidth = 900,
}: {
  name: string;
  label: string;
  existingUrl?: string | null;
  /** Width / height. CNIC ke liye ~1.6, tasveer ke liye 1. */
  aspect?: number;
  notUploadedLabel?: string;
  outputMaxWidth?: number;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const submitInputRef = useRef<HTMLInputElement>(null);
  const rawImgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [rawSrc, setRawSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<string | null>(null);

  const FRAME_W = 260;
  const FRAME_H = Math.round(FRAME_W / aspect);
  const displayScale = baseScale * zoom;

  function clampOffset(o: { x: number; y: number }, scale: number) {
    const imgW = natural.w * scale;
    const imgH = natural.h * scale;
    const maxX = Math.max(0, (imgW - FRAME_W) / 2);
    const maxY = Math.max(0, (imgH - FRAME_H) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawSrc(reader.result as string);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  }

  function onRawImgLoad() {
    const img = rawImgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNatural({ w, h });
    // "Cover" scale -- taake frame kabhi khali na dikhe, chahe photo
    // kisi bhi shape ki ho (mobile camera ki lambi ya CNIC ki chaudi).
    setBaseScale(Math.max(FRAME_W / w, FRAME_H / h));
    setOffset({ x: 0, y: 0 });
  }

  function onZoomChange(z: number) {
    setZoom(z);
    setOffset((o) => clampOffset(o, baseScale * z));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clampOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }, displayScale));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function cancelCrop() {
    setRawSrc(null);
    dragRef.current = null;
  }

  function confirmCrop() {
    const img = rawImgRef.current;
    if (!img || !natural.w) return;
    const imgW = natural.w * displayScale;
    const imgH = natural.h * displayScale;
    const left = FRAME_W / 2 - imgW / 2 + offset.x;
    const top = FRAME_H / 2 - imgH / 2 + offset.y;
    const srcW = FRAME_W / displayScale;
    const srcH = FRAME_H / displayScale;
    const srcX = Math.max(0, Math.min(natural.w - srcW, -left / displayScale));
    const srcY = Math.max(0, Math.min(natural.h - srcH, -top / displayScale));

    const outW = outputMaxWidth;
    const outH = Math.round(outW / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        if (submitInputRef.current) submitInputRef.current.files = dt.files;
        setPreview(URL.createObjectURL(blob));
        setRawSrc(null);
      },
      "image/jpeg",
      0.88
    );
  }

  const showImg = preview ?? existingUrl ?? null;

  return (
    <div>
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      {/* Ye wo khana hai jo asal mein form ke sath submit hota hai. */}
      <input ref={submitInputRef} type="file" name={name} hidden />

      {showImg ? (
        <img
          src={showImg}
          alt={label}
          className="mt-1 mb-2 rounded-lg border border-surface-200 object-cover"
          style={{ width: FRAME_W, height: FRAME_H }}
        />
      ) : (
        <p className="mt-1 mb-2 text-xs text-surface-400">{notUploadedLabel}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => galleryRef.current?.click()}>
          <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Gallery se chunein
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => cameraRef.current?.click()}>
          <Camera className="mr-1.5 h-3.5 w-3.5" /> Camera se khenchein
        </Button>
      </div>

      {rawSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 dark:bg-surface-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-surface-900 dark:text-white">{label} — sahi jagah par lagayein</p>
              <button type="button" onClick={cancelCrop} className="text-surface-400 hover:text-surface-600" aria-label="Band karein">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div
              className="relative mx-auto touch-none select-none overflow-hidden rounded-lg border border-surface-300 bg-surface-100 dark:border-surface-700 dark:bg-surface-800"
              style={{ width: FRAME_W, height: FRAME_H }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                ref={rawImgRef}
                src={rawSrc}
                onLoad={onRawImgLoad}
                alt=""
                draggable={false}
                className="absolute max-w-none select-none"
                style={{
                  width: natural.w * displayScale,
                  height: natural.h * displayScale,
                  left: FRAME_W / 2 - (natural.w * displayScale) / 2 + offset.x,
                  top: FRAME_H / 2 - (natural.h * displayScale) / 2 + offset.y,
                }}
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-surface-500">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoomChange(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <p className="mt-1 text-[11px] text-surface-400">Ghaseet kar (drag) photo ko sahi jagah par lein.</p>

            <div className="mt-3 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={cancelCrop}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" onClick={confirmCrop}>
                Use Photo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
