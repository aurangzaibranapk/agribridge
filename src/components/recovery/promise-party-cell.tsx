"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, MessageCircle } from "lucide-react";
import { promiseCardFileSlug, promiseCardSvg, PROMISE_CARD_HEIGHT, PROMISE_CARD_WIDTH, type PromiseCardInput } from "@/lib/recovery/promise-card";

/** Party column: asal naam, reminder card, personal WhatsApp, Recovery dashboard. */
export function PromisePartyCell({
  name,
  phone,
  partyType,
  recoveryHref,
  whatsAppHref,
  card,
}: {
  name: string | null;
  phone: string | null;
  partyType: string;
  recoveryHref: string;
  whatsAppHref: string | null;
  card: PromiseCardInput;
}) {
  const label = name || "Naam nahi mila";
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const svg = promiseCardSvg(card);
  const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  async function pngBlob(): Promise<Blob | null> {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("card"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = PROMISE_CARD_WIDTH;
      canvas.height = PROMISE_CARD_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, PROMISE_CARD_WIDTH, PROMISE_CARD_HEIGHT);
      return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function onDownload() {
    const blob = await pngBlob();
    if (!blob) {
      setNotice("Card ki tasveer nahi ban saki.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `al-rana-reminder-${promiseCardFileSlug(label)}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice("Card download ho gayi. WhatsApp chat mein ye tasveer attach karein.");
  }

  async function onShare() {
    const blob = await pngBlob();
    if (!blob) {
      setNotice("Card ki tasveer nahi ban saki.");
      return;
    }
    const file = new File([blob], `al-rana-reminder-${promiseCardFileSlug(label)}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: "Al Rana Traders reminder" });
        return;
      } catch {
        // Banda ne share band kar diya, ya browser tasveer share nahi karta.
      }
    }
    await onDownload();
  }

  return (
    <div className="space-y-1">
      <p className="font-medium text-surface-800 dark:text-surface-100">{label}</p>
      <p className="text-xs text-surface-500">
        <span className="capitalize">{partyType}</span>
        {phone ? (
          <span dir="ltr">
            {" "}
            · {phone}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
          className="inline-flex items-center rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-800"
        >
          Reminder card
        </button>
        {whatsAppHref ? (
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
          >
            WhatsApp
          </a>
        ) : (
          <span
            className="inline-flex cursor-not-allowed items-center rounded-lg bg-surface-200 px-2.5 py-1 text-xs font-semibold text-surface-500"
            title="Phone number nahi mila — WhatsApp nahi khul sakta"
          >
            WhatsApp
          </span>
        )}
      </div>
      <Link href={recoveryHref} className="block text-xs font-medium text-brand-700 underline dark:text-brand-300">
        Recovery dashboard
      </Link>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[92vh] w-full max-w-sm overflow-auto rounded-card bg-white p-4 shadow-xl dark:bg-surface-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">Reminder card</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-surface-500 hover:text-surface-800">
                Close
              </button>
            </div>
            <img src={preview} alt={`Payment reminder card for ${label}`} className="w-full rounded-lg border border-surface-200" />
            <p className="mt-2 text-xs text-surface-500">
              Ye tasveer bhejein. WhatsApp sirf {label} ki chat kholta hai — card yahan se download ya share karke attach karein.
            </p>
            {notice && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="button" onClick={onShare} className="flex flex-col items-center gap-1 rounded-lg bg-emerald-700 py-2 text-xs font-semibold text-white">
                <MessageCircle className="h-4 w-4" /> Share
              </button>
              <button type="button" onClick={onDownload} className="flex flex-col items-center gap-1 rounded-lg border border-surface-200 py-2 text-xs font-semibold text-surface-700">
                <Download className="h-4 w-4" /> Download
              </button>
              {whatsAppHref ? (
                <a href={whatsAppHref} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1 rounded-lg border border-emerald-600 py-2 text-xs font-semibold text-emerald-800">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              ) : (
                <span className="flex flex-col items-center gap-1 rounded-lg bg-surface-100 py-2 text-xs text-surface-400">WhatsApp</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
