"use client";
import { useRef, useState } from "react";
import { updateAiInstructions, type ActionState } from "@/actions/ai-instructions";

function parseItems(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function AiInstructionsForm({ currentInstructions }: { currentInstructions: string }) {
  const [items, setItems] = useState<string[]>(parseItems(currentInstructions));
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);

  function addItem(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, trimmed]);
    setInput("");
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setExtractMsg(null);
    const reader = new FileReader();
    reader.onload = () => setImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function extractFromImage() {
    if (!imgFile) return;
    setExtracting(true);
    setExtractMsg(null);
    try {
      const fd = new FormData();
      fd.append("image", imgFile);
      const res = await fetch("/api/ai-extract-instructions", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "AI error");
      const extracted: string[] = json.items ?? [];
      if (extracted.length === 0) {
        setExtractMsg("Image mein koi instruction nahi mili.");
      } else {
        setItems((prev) => [...prev, ...extracted]);
        setExtractMsg(`${extracted.length} instruction(s) shamil ho gayi.`);
        setImgPreview(null);
        setImgFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch (e) {
      setExtractMsg(e instanceof Error ? e.message : "Kuch ghalat hua.");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaveMsg(null);
    const joined = items.join("\n");
    const fd = new FormData();
    fd.append("instructions", joined);
    const state: ActionState = await updateAiInstructions({}, fd);
    setSaving(false);
    if (state.success) setSaveMsg({ type: "ok", text: "Instructions save ho gayi!" });
    else setSaveMsg({ type: "err", text: state.error ?? "Error" });
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Add instruction */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-3 text-sm font-medium text-surface-700 dark:text-surface-300">
          Nai instruction shamil karein
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(input))}
            placeholder="Misal: Weekend par report mat bhejo"
            className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <button
            type="button"
            onClick={() => addItem(input)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Shamil
          </button>
        </div>
      </div>

      {/* Image upload */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-3 text-sm font-medium text-surface-700 dark:text-surface-300">
          Image se instructions nikaalein (AI)
        </p>
        <p className="mb-3 text-xs text-surface-400">
          Haath se likhi notes, screenshot — AI parh ke list mein shamil kar dega.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onImageChange}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border border-dashed border-brand-400 px-4 py-3 text-sm text-brand-600 hover:bg-brand-50 dark:border-brand-600 dark:text-brand-400 dark:hover:bg-surface-800"
        >
          📷 Image chunein
        </button>

        {imgPreview && (
          <div className="mt-3 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgPreview} alt="preview" className="max-h-48 rounded-lg object-contain" />
            <button
              type="button"
              onClick={extractFromImage}
              disabled={extracting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {extracting ? "AI parh raha hai..." : "AI se Extract Karein"}
            </button>
          </div>
        )}

        {extractMsg && (
          <p className={`mt-2 text-xs ${extractMsg.includes("nahi") ? "text-amber-600" : "text-brand-600"}`}>
            {extractMsg}
          </p>
        )}
      </div>

      {/* Instructions list */}
      <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <p className="mb-3 text-sm font-medium text-surface-700 dark:text-surface-300">
          Abhi ki instructions ({items.length})
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-surface-400">Koi instruction nahi — upar se shamil karein.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-lg bg-surface-50 px-3 py-2 text-sm dark:bg-surface-800"
              >
                <span className="mt-0.5 flex-1 text-surface-700 dark:text-surface-200">{item}</span>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-surface-400 hover:text-red-500"
                  aria-label="Hatao"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* hidden textarea for server action */}
        <textarea ref={hiddenRef} name="instructions" className="hidden" readOnly value={items.join("\n")} />

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Save ho raha hai..." : "Instructions Save Karein"}
          </button>
          {saveMsg && (
            <p className={`text-xs ${saveMsg.type === "ok" ? "text-brand-600" : "text-red-600"}`}>
              {saveMsg.text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
