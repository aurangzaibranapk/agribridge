"use client";

import { useRef, useState } from "react";
import { Bell, Download, MessageCircle, Send, X } from "lucide-react";

/**
 * Gahak ko payment reminder -- ek "professional slip" (Khatabook jaisa)
 * jo staff apne hi WhatsApp/SMS se bhej sake.
 *
 * Malik ne ek doosri app ka reminder dikhaya (13 September): raqam,
 * tareekh, dukan ka naam aur number ek saaf tasveer ki tarah, jo seedha
 * WhatsApp share sheet mein chali jati hai. Yahan wahi cheez Canvas se
 * banayi jati hai -- koi nayi library nahi, browser ka apna Canvas kaafi
 * hai.
 *
 * Company ka naam/number kahin hardcode nahi -- `website_settings` se
 * aata hai (public site isi se chalti hai), taake agar malik wahan badal
 * dein to yahan bhi khud badal jaye.
 */

const BRAND = "#1f6b3a";
const DANGER = "#c03636";
const INK = "#17221a";
const MUTED = "#68736b";
const LINE = "#cbd4cc";

function rs(n: number): string {
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSlip(
  canvas: HTMLCanvasElement,
  p: { customerName: string; amountDue: number; companyName: string; companyPhone: string | null }
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 900;
  const H = 1000;
  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = BRAND;
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 32px Arial, sans-serif";
  ctx.fillText("Payment Reminder", 40, 58);

  ctx.fillStyle = MUTED;
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(p.customerName, 40, 150);

  roundRect(ctx, 40, 185, W - 80, 220, 18);
  ctx.fillStyle = "#fdecec";
  ctx.fill();
  ctx.fillStyle = DANGER;
  ctx.font = "700 62px Arial, sans-serif";
  ctx.fillText(rs(p.amountDue), 70, 300);
  ctx.fillStyle = INK;
  ctx.font = "400 26px Arial, sans-serif";
  ctx.fillText("Aap ki taraf se hamein adaigi baqi hai", 70, 355);

  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  ctx.fillStyle = INK;
  ctx.font = "400 24px Arial, sans-serif";
  ctx.fillText(`Tareekh: ${today}`, 40, 470);

  ctx.strokeStyle = LINE;
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, H - 170);
  ctx.lineTo(W - 40, H - 170);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = INK;
  ctx.font = "600 28px Arial, sans-serif";
  ctx.fillText(`Bheja: ${p.companyName}`, 40, H - 110);
  if (p.companyPhone) {
    ctx.fillStyle = MUTED;
    ctx.font = "400 24px Arial, sans-serif";
    ctx.fillText(p.companyPhone, 40, H - 72);
  }
}

export function ReminderSlipButton({
  customerName,
  customerPhone,
  amountDue,
  companyName,
  companyPhone,
}: {
  customerName: string;
  customerPhone: string | null;
  amountDue: number;
  companyName: string;
  companyPhone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function onOpen() {
    setNotice(null);
    setOpen(true);
    // Modal render hone ke baad hi canvas element milta hai.
    setTimeout(() => {
      if (canvasRef.current) drawSlip(canvasRef.current, { customerName, amountDue, companyName, companyPhone });
    }, 0);
  }

  const waNumber = customerPhone ? `92${customerPhone.replace(/\D/g, "").replace(/^0/, "")}` : null;
  const textMsg = `${companyName}: Aap ki taraf se ${rs(amountDue)} baqi hai. Barah-e-meherbani jald adaigi karein.${companyPhone ? ` Raabta: ${companyPhone}` : ""}`;

  async function canvasToFile(): Promise<File | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    return new File([blob], `reminder-${customerName.replace(/\s+/g, "-")}.png`, { type: "image/png" });
  }

  async function onShareImage() {
    const file = await canvasToFile();
    if (!file) return;
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean; share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void> };
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: "Payment Reminder", text: textMsg });
        return;
      } catch {
        // Banda ne share cancel kar diya -- download wale raaste par chale jate hain.
      }
    }
    onDownload();
    setNotice("Ye phone/browser seedha share nahi karta -- tasveer download ho gayi, ab WhatsApp mein attach kar dein.");
  }

  function onDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `reminder-${customerName.replace(/\s+/g, "-")}.png`;
    a.click();
  }

  function onWhatsApp() {
    const base = waNumber ? `https://wa.me/${waNumber}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(textMsg)}`, "_blank");
  }

  function onSms() {
    const target = customerPhone ?? "";
    window.location.href = `sms:${target}?body=${encodeURIComponent(textMsg)}`;
  }

  return (
    <>
      <button
        onClick={onOpen}
        className="flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
      >
        <Bell className="h-4 w-4" /> Reminder Bhejein
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Payment Reminder</h3>
              <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 overflow-hidden rounded-lg border border-surface-200 dark:border-surface-700">
              <canvas ref={canvasRef} className="block w-full" />
            </div>

            {notice && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">{notice}</p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onShareImage}
                className="flex flex-col items-center gap-1 rounded-lg bg-brand-600 py-2.5 text-xs font-medium text-white hover:bg-brand-700"
              >
                <Send className="h-4 w-4" /> WhatsApp (tasveer)
              </button>
              <button
                onClick={onDownload}
                className="flex flex-col items-center gap-1 rounded-lg border border-surface-200 py-2.5 text-xs font-medium text-surface-600 hover:bg-surface-50"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={onSms}
                className="flex flex-col items-center gap-1 rounded-lg border border-surface-200 py-2.5 text-xs font-medium text-surface-600 hover:bg-surface-50"
              >
                <MessageCircle className="h-4 w-4" /> SMS
              </button>
            </div>
            {!customerPhone && (
              <p className="mt-2 text-[11px] text-surface-400">
                Is gahak ka mobile number darj nahi -- WhatsApp/SMS button dabane par number khud daalna paRega.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
