"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";

const QUICK_ASKS = [
  "Aaj business ka short status do",
  "Pichlay 30 din mein kis category ki sale sab se zyada hai?",
  "Top staff aur unki sale batao",
  "Agle 15 din ke liye kya stock mangwana hai?",
];

export function AiCommandCenter() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(text = question) {
    const message = text.trim();
    if (!message || loading) return;
    setQuestion(message);
    setLoading(true);
    try {
      const response = await fetch("/api/bridge-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: [] }),
      });
      const data = await response.json();
      setAnswer(data.answer ?? data.error ?? "AI ka jawab nahi mila.");
    } catch {
      setAnswer("AI service se connection nahi ho saka. Dobara koshish karein.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-4 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-surface-900 dark:to-emerald-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-surface-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-violet-600" /> AI Business Command Center
          </p>
          <p className="mt-1 text-xs text-surface-500">Live ERP data se report, staff ranking aur stock advice poochein.</p>
        </div>
        <a href="/admin/bridge-ai" className="text-xs font-semibold text-brand-700 hover:underline">Full AI kholein →</a>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void ask(); }}
          placeholder="AI se poochhein… jaise: top staff kaun hai?"
          className="h-10 min-w-0 flex-1 rounded-xl border border-surface-200 bg-white px-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-surface-700 dark:bg-surface-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading || !question.trim()}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Poochhein
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_ASKS.map((item) => (
          <button key={item} type="button" onClick={() => void ask(item)} className="rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 text-[11px] text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-surface-900 dark:text-violet-200">
            {item}
          </button>
        ))}
      </div>
      {answer && <div className="mt-3 whitespace-pre-line rounded-xl border border-white/80 bg-white/80 p-3 text-xs leading-relaxed text-surface-700 dark:border-surface-700 dark:bg-surface-900/70 dark:text-surface-200">{answer}</div>}
    </section>
  );
}
