"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "@/lib/i18n/translations";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, ScanLine } from "lucide-react";

export function BarcodeCameraModal({
  onDetected,
  onClose,
  lang,
}: {
  onDetected: (code: string) => void;
  onClose: () => void;
  /** Zaban server se aati hai -- dekhein pos-client.tsx ka note. */
  lang: Lang;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: { stop: () => void } | undefined;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
        if (result && !detectedRef.current) {
          detectedRef.current = true;
          onDetected(result.getText());
        }
      })
      .then((c) => {
        controls = c;
      })
      .catch(() => {
        setError("Camera access nahi mil saka. Browser permissions check karein.");
      });

    return () => {
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-card bg-white p-4 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            <ScanLine className="h-4 w-4 text-brand-600" /> {t("pos_scan_barcode", lang)}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <p className="py-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="w-full" muted playsInline />
          </div>
        )}

        <p className="mt-3 text-center text-xs text-surface-400">
          {t("pos_scan_camera_hint", lang)}
        </p>
      </div>
    </div>
  );
}