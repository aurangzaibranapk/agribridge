"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, MessageCircle, Printer, Volume2, VolumeX, X } from "lucide-react";
import { encodeQr, qrSvgPath } from "@/lib/qr/qr-encode";
import { BRAND_NAME, brandTagline } from "@/lib/brand";
import { useLang } from "@/lib/i18n/lang-context";
import { printFrames, QUEUE_KEY, receiptText, receiptWhatsAppUrl, rsFmt, SOUND_KEY, soundOn, type ReceiptData } from "@/lib/glass/glass";

/** Kamyab post ke baad raseed print animation. Awaaz default BAND. Kuch khud nahi bhejta. */
export function queueReceipt(r: ReceiptData) {
  try { sessionStorage.setItem(QUEUE_KEY, JSON.stringify(r)); } catch { /* */ }
}

/** Page reload ke baad queue se raseed dikhata hai (recovery modal reload karta hai). */
export function ReceiptHost() {
  const [r, setR] = useState<ReceiptData | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(QUEUE_KEY);
      if (raw) { sessionStorage.removeItem(QUEUE_KEY); setR(JSON.parse(raw)); }
    } catch { /* */ }
  }, []);
  return r ? <ReceiptPrint receipt={r} onClose={() => setR(null)} /> : null;
}

function buzz() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const len = 1.2;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / ctx.sampleRate;
      d[i] = (Math.random() * 2 - 1) * 0.12 * (0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 38)) * Math.min(1, (len - t) * 4);
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2400;
    src.connect(f).connect(ctx.destination); src.start();
    src.onended = () => ctx.close();
  } catch { /* */ }
}

async function downloadPdf(r: ReceiptData) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([226, 420]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 395;
  receiptText(r).replace(/[^\x20-\x7E\n]/g, "-").split("\n").forEach((line, i) => {
    page.drawText(line, { x: 14, y, size: i === 0 ? 11 : 9, font: i === 0 || line.startsWith("Raqam") ? bold : font, color: rgb(0.06, 0.12, 0.23) });
    y -= i === 0 ? 18 : 14;
  });
  const q = encodeQr(`${r.no} ${rsFmt(r.amount)}`);
  const s = 3; const ox = 14; const oy = y - q.size * s - 10;
  q.modules.forEach((row, yy) => row.forEach((on, xx) => { if (on) page.drawRectangle({ x: ox + xx * s, y: oy + (q.size - yy) * s, width: s, height: s, color: rgb(0.06, 0.12, 0.23) }); }));
  const bytes = await doc.save();
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a"); a.href = url; a.download = `raseed-${r.no}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ReceiptPrint({ receipt: r, onClose, phone, autoCloseMs }: { receipt: ReceiptData; onClose: () => void; phone?: string | null; autoCloseMs?: number }) {
  const [sound, setSound] = useState(false);
  const [pct, setPct] = useState(0);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);
  const lang = useLang();
  const qr = useMemo(() => qrSvgPath(encodeQr(`${BRAND_NAME} ${r.no} ${rsFmt(r.amount)}`)), [r.no, r.amount]);

  useEffect(() => { try { setSound(soundOn(localStorage.getItem(SOUND_KEY))); } catch { /* */ } }, []);
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frames = printFrames(!!reduced);
    timers.current.forEach(clearTimeout); timers.current = [];
    frames.forEach((p, i) => timers.current.push(window.setTimeout(() => setPct(p), i * 220)));
    let on = false; try { on = soundOn(localStorage.getItem(SOUND_KEY)); } catch { /* */ }
    if (on && !reduced) buzz();
    if (autoCloseMs) timers.current.push(window.setTimeout(onClose, autoCloseMs));
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const toggleSound = () => setSound((s) => { try { localStorage.setItem(SOUND_KEY, s ? "0" : "1"); } catch { /* */ } return !s; });
  const done = pct >= 100;
  const head = r.kind === "pos" ? "POS Raseed" : r.kind === "wallet" ? "Wallet Jama Raseed" : "Payment Raseed";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4 print:static print:bg-white" role="dialog" aria-modal="true" aria-label={head} data-testid="receipt-print">
      <style dangerouslySetInnerHTML={{ __html: `.rp-paper{transition:max-height .22s linear}@media (prefers-reduced-motion: reduce){.rp-paper{transition:none}}
.rp-torn{background:linear-gradient(-45deg,transparent 6px,#fffdf8 0),linear-gradient(45deg,transparent 6px,#fffdf8 0);background-size:12px 12px;height:10px}
@media print{body *{visibility:hidden}.rp-print,.rp-print *{visibility:visible}.rp-print{position:absolute;left:0;top:0}}` }} />
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="relative z-[2] h-14 w-full max-w-[330px] rounded-2xl border border-white/70 bg-white/70 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#12203c]/80 print:hidden">
          <span className={`absolute right-5 top-3 h-2 w-2 rounded-full ${done ? "bg-emerald-500 shadow-[0_0_10px_#1f9d5c]" : "bg-amber-400 shadow-[0_0_10px_#f0b429]"}`} />
          <span className="absolute inset-x-7 bottom-3 h-2 rounded bg-[#0f1f3a] shadow-inner" />
          <button type="button" onClick={onClose} aria-label="Band karein" className="absolute left-3 top-2 text-surface-500"><X className="h-4 w-4" /></button>
        </div>
        <div className="rp-paper -mt-4 w-[260px] overflow-hidden" style={{ maxHeight: `${Math.max(6, pct) * 5.2}px` }}>
          <div className="rp-print bg-[#fffdf8] px-5 pb-3 pt-6 text-center text-[12px] text-[#0f1f3a] shadow-xl" data-testid="receipt-paper">
            <p className="text-[15px] font-bold tracking-[.18em]">{BRAND_NAME}</p>
            <p className={`text-[10px] text-[#7a889c] ${lang === "ur" ? "font-urdu" : "uppercase tracking-wide"}`}>{brandTagline(lang)}</p>
            <p className="text-[10px] uppercase tracking-wide text-[#7a889c]">{head}</p>
            <p className="mt-2 font-semibold text-emerald-700">Kamyab · <span className="gl-ur" style={{ fontFamily: "'Noto Nastaliq Urdu',serif" }}>کامیاب</span></p>
            {(r.from || r.to) && <p className="mt-1 font-semibold">{r.from ?? "—"} se → {r.to ?? "—"}</p>}
            <p className="text-[26px] font-extrabold">{rsFmt(r.amount)}</p>
            <div className="my-2 border-t border-dashed border-[#b8c0cc]" />
            <div className="space-y-0.5 text-start">
              <p className="flex justify-between"><span className="text-[#5b6b82]">Raseed #</span><b>{r.no}</b></p>
              <p className="flex justify-between"><span className="text-[#5b6b82]">Tarikh</span><b>{r.date}</b></p>
              {(r.lines ?? []).map(([a, b]) => <p key={a} className="flex justify-between gap-2"><span className="text-[#5b6b82]">{a}</span><b className="truncate">{b}</b></p>)}
            </div>
            <div className="my-2 border-t border-dashed border-[#b8c0cc]" />
            <svg viewBox={`0 0 ${qr.view} ${qr.view}`} className="mx-auto h-24 w-24" shapeRendering="crispEdges" role="img" aria-label="QR"><path d={qr.path} fill="#0f1f3a" /></svg>
            <p className="mt-1 text-[#5b6b82]">Shukriya · {BRAND_NAME}</p>
          </div>
          {done && <div className="rp-torn" />}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2 print:hidden">
          <button type="button" onClick={() => { setPct(0); setRun((n) => n + 1); setTimeout(() => window.print(), 1400); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-semibold text-white"><Printer className="h-4 w-4" />Dobara print</button>
          <a href={receiptWhatsAppUrl(r, phone)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/70 bg-white/80 px-3 text-xs font-semibold text-surface-800 backdrop-blur" data-testid="receipt-wa"><MessageCircle className="h-4 w-4 text-emerald-700" />WhatsApp share</a>
          <button type="button" onClick={() => downloadPdf(r)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/70 bg-white/80 px-3 text-xs font-semibold text-surface-800 backdrop-blur"><Download className="h-4 w-4 text-emerald-700" />PDF</button>
          <button type="button" onClick={toggleSound} aria-pressed={sound} data-testid="receipt-sound" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/70 bg-white/80 px-3 text-xs font-semibold text-surface-800 backdrop-blur">
            {sound ? <Volume2 className="h-4 w-4 text-emerald-700" /> : <VolumeX className="h-4 w-4 text-surface-500" />}Awaaz {sound ? "On" : "Off"}
          </button>
        </div>
      </div>
    </div>
  );
}
