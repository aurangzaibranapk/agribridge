"use client";
import { useMemo, useState } from "react";
import { shrinkImage } from "@/lib/image-capture";
import { Camera, Check, Loader2, Search, AlertTriangle } from "lucide-react";

export interface FarmerOption {
  id: string;
  full_name: string;
  farmer_code: string;
}

interface SavedLine {
  collectionNumber: string;
  farmerName: string;
  liters: number;
  flags: string[];
}

/**
 * Maidan ka collection screen.
 *
 * Ye form seedha database se baat nahi karta -- /api/milk/collect ko
 * JSON bhejta hai, wahi darwaza jo WhatsApp aur aage chal kar app
 * istemal karengi. Server action rakhna aasan hota, magar phir offline
 * mode ke waqt poora screen dobara likhna parta: offline mein entry
 * pehle device par rukti hai aur baad mein wahi JSON bheja jata hai.
 *
 * client_uuid yahin banta hai, bhejne se PEHLE. Ye ahem hai: agar jawab
 * aate waqt network toot jaye to user dobara bhejta hai, aur wohi
 * client_uuid dobara jane se entry do dafa nahi banti.
 */
export function CollectForm({ farmers }: { farmers: FarmerOption[] }) {
  const [query, setQuery] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [liters, setLiters] = useState("");
  const [lr, setLr] = useState("");
  const [shift, setShift] = useState(() => (new Date().getHours() < 14 ? "morning" : "evening"));
  const [photo, setPhoto] = useState<{ base64: string; mimeType: string; bytes: number } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedLine[]>([]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return farmers.slice(0, 8);
    return farmers
      .filter((f) => f.full_name.toLowerCase().includes(q) || f.farmer_code.toLowerCase().includes(q))
      .slice(0, 8);
  }, [farmers, query]);

  const chosen = farmers.find((f) => f.id === farmerId) ?? null;
  const ready = !!farmerId && Number(liters) > 0;

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      setPhoto(await shrinkImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tasveer nahi li ja saki.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError("");

    // Nishan bhejne se PEHLE banta hai -- network toot jane par dobara
    // bhejne se entry do dafa nahi banti.
    const clientUuid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    try {
      const response = await fetch("/api/milk/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "website",
          items: [
            {
              client_uuid: clientUuid,
              farmer_id: farmerId,
              liters: Number(liters),
              lr: lr === "" ? null : Number(lr),
              shift,
              collected_at: new Date().toISOString(),
              lr_image_base64: photo?.base64,
              lr_image_mime: photo?.mimeType,
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Mahfooz nahi ho saka.");
        return;
      }

      const line = data.results?.[0];
      if (!line?.ok) {
        setError(line?.error ?? "Mahfooz nahi ho saka.");
        return;
      }

      setSaved((prev) => [
        {
          collectionNumber: line.collection_number,
          farmerName: line.farmer_name || chosen?.full_name || "",
          liters: line.liters,
          flags: line.flags ?? [],
        },
        ...prev,
      ]);

      // Agla kisan foran — maidan mein qatar lagi hoti hai.
      setFarmerId("");
      setQuery("");
      setLiters("");
      setLr("");
      setPhoto(null);
    } catch {
      setError("Server tak nahi pahuncha ja saka. Dobara koshish karein.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <label className="text-xs font-medium text-surface-600">Kisan *</label>
        {chosen ? (
          <div className="mt-1 flex items-center justify-between rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 dark:bg-brand-950/20">
            <span className="text-sm font-medium text-surface-900 dark:text-white">
              {chosen.farmer_code} — {chosen.full_name}
            </span>
            <button type="button" onClick={() => setFarmerId("")} className="text-xs text-brand-700 underline">
              badlein
            </button>
          </div>
        ) : (
          <>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Naam ya code likhein"
                className="w-full rounded-lg border border-surface-200 p-2 pl-9 text-sm"
              />
            </div>
            <ul className="mt-1 divide-y divide-surface-100 rounded-lg border border-surface-200 dark:divide-surface-800 dark:border-surface-800">
              {matches.length === 0 && <li className="px-3 py-2 text-xs text-surface-400">Koi kisan nahi mila.</li>}
              {matches.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setFarmerId(f.id)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <span className="font-medium">{f.farmer_code}</span> — {f.full_name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-surface-600">Litre *</label>
            <input
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-lg font-semibold"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">LR</label>
            <input
              value={lr}
              onChange={(e) => setLr(e.target.value)}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-lg font-semibold"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-medium text-surface-600">Shift</label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {[
              { value: "morning", label: "Subah" },
              { value: "evening", label: "Shaam" },
            ].map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setShift(s.value)}
                className={`rounded-lg border p-2 text-sm font-medium ${
                  shift === s.value
                    ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/20"
                    : "border-surface-200 text-surface-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-1 text-xs font-medium text-surface-600">
            <Camera className="h-3 w-3" /> LR ki photo
          </label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPhoto(e.target.files?.[0])}
            className="mt-1 w-full rounded-lg border border-surface-200 p-1.5 text-xs"
          />
          {photoBusy && <p className="mt-1 text-xs text-surface-500">Tasveer taiyar ho rahi hai...</p>}
          {photo && (
            <p className="mt-1 text-xs text-green-700">
              Tasveer taiyar ({Math.round(photo.bytes / 1024)} KB)
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!ready || busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {busy ? "Bheja ja raha hai..." : "Mahfooz Karein"}
        </button>

        <p className="mt-2 text-center text-xs text-surface-500">
          FAT chiller par lagega — raqam us waqt banegi.
        </p>
      </div>

      {saved.length > 0 && (
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">
            Abhi mahfooz kiye ({saved.length})
          </h3>
          <ul className="divide-y divide-surface-100 dark:divide-surface-800">
            {saved.map((s) => (
              <li key={s.collectionNumber} className="py-2">
                <p className="text-sm text-surface-900 dark:text-white">
                  {s.farmerName} — <span className="font-semibold">{s.liters} L</span>
                </p>
                <p className="text-xs text-surface-400">{s.collectionNumber}</p>
                {s.flags.map((f) => (
                  <p key={f} className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {f}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
