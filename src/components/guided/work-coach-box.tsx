"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bot, Camera, Send, X, Lightbulb } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Turn {
  role: "user" | "assistant";
  text: string;
  image?: string;
}

/** Jawab mein /admin/... raaste link ban jate hain -- "yahan jayein" ek click. */
export function CoachText({ text }: { text: string }) {
  const parts = text.split(/(\/admin\/[A-Za-z0-9\-_/?=&.%]+)/g);
  return (
    <span className="whitespace-pre-line">
      {parts.map((p, i) =>
        p.startsWith("/admin/") ? (
          <Link key={i} href={p.replace(/[.,)]+$/, "")} className="font-medium text-brand-700 underline dark:text-brand-300">
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

/**
 * "Aaj kya karna hai?" -- Work Coach ka box (Guided ERP C). Har
 * dashboard par. Sawal likhein ya screenshot lagayein; jawab role,
 * ijazat aur feature ki maloomat ke mutabiq, safhe ke link ke sath.
 */
export function WorkCoachBox({ placeholder }: { placeholder?: string }) {
  const lang = useLang();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ mimeType: string; data: string; preview: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      const data = url.split(",")[1] ?? "";
      setImage({ mimeType: file.type || "image/png", data, preview: url });
    };
    reader.readAsDataURL(file);
  }

  async function send() {
    const q = input.trim();
    if ((!q && !image) || loading) return;
    setTurns((tt) => [...tt, { role: "user", text: q || t("wc_explain_shot", lang), image: image?.preview }]);
    setInput("");
    const img = image;
    setImage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/bridge-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          image: img ? { mimeType: img.mimeType, data: img.data } : undefined,
          // Pichhli baat sath -- tajweez ka draft aur "haan" ek silsile mein rahein (269).
          history: turns.slice(-8).map((x) => ({ role: x.role, text: x.text })),
        }),
      });
      const data = await res.json();
      setTurns((tt) => [...tt, { role: "assistant", text: data.answer ?? data.error ?? t("wc_error", lang) }]);
    } catch {
      setTurns((tt) => [...tt, { role: "assistant", text: t("wc_error", lang) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-card border border-brand-200 bg-white dark:border-brand-900/40 dark:bg-surface-900">
      <div className="flex items-center gap-2 border-b border-surface-200 px-4 py-2.5 dark:border-surface-800">
        <Bot className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{t("wc_title", lang)}</h3>
        <button
          type="button"
          onClick={() => setInput(t("sg_prefill", lang))}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200"
          title={t("sg_button_hint", lang)}
        >
          <Lightbulb className="h-3.5 w-3.5" /> {t("sg_button", lang)}
        </button>
      </div>
      {turns.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto px-4 py-3">
          {turns.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              {m.image && <img src={m.image} alt="" className="mb-1 ml-auto max-h-24 rounded border border-surface-200" />}
              <span className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"}`}>
                {m.role === "assistant" ? <CoachText text={m.text} /> : m.text}
              </span>
            </div>
          ))}
          {loading && <p className="text-xs text-surface-400">{t("ba_thinking", lang)}</p>}
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {image && (
          <span className="relative">
            <img src={image.preview} alt="" className="h-9 w-9 rounded border border-surface-200 object-cover" />
            <button type="button" onClick={() => setImage(null)} className="absolute -right-1.5 -top-1.5 rounded-full bg-surface-700 p-0.5 text-white">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={placeholder ?? t("wc_placeholder", lang)}
          className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()} title={t("wc_screenshot", lang)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:border-brand-400 hover:text-brand-700 dark:border-surface-700">
          <Camera className="h-4 w-4" />
        </button>
        <button type="button" onClick={send} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
