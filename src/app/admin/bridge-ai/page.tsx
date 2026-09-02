"use client";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const EXAMPLE_QUESTIONS = [
  "Aaj business ka kya haal hai?",
  "Kaunse products low stock mein hain?",
  "Total receivables aur payables kitne hain?",
];

export default function BridgeAiPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const lang = useLang();
  // "?" panel se "AI se poochein" -> sawal pehle se likha hua aata hai (266).
  const searchParams = useSearchParams();
  const [input, setInput] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [actionsEnabled, setActionsEnabled] = useState(false);
  const [togglingActions, setTogglingActions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    fetch("/api/bridge-ai/settings")
      .then((res) => res.json())
      .then((data) => setActionsEnabled(!!data.actionsEnabled))
      .catch(() => {});
  }, []);

  async function toggleActions() {
    const next = !actionsEnabled;
    setTogglingActions(true);
    try {
      const res = await fetch("/api/bridge-ai/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionsEnabled: next }),
      });
      const data = await res.json();
      setActionsEnabled(!!data.actionsEnabled);
    } catch {
      // no-op, toggle stays at old value
    } finally {
      setTogglingActions(false);
    }
  }

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/bridge-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer ?? data.error ?? "Kuch masla ho gaya." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Connection mein masla ho gaya, dobara koshish karein." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title={t("ba_title", lang)} description="Apne business ke baare mein sawal poochein - live data se jawab milega" />
        <div className="mt-1 flex shrink-0 items-center gap-2 rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-800 dark:bg-surface-900">
          <span className="text-xs font-medium text-surface-600 dark:text-surface-400">{t("at_ai_proposals", lang)}</span>
          <button
            type="button"
            onClick={toggleActions}
            disabled={togglingActions}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              actionsEnabled ? "bg-brand-600" : "bg-surface-300 dark:bg-surface-700"
            }`}
            aria-label={actionsEnabled ? "AI action proposals ON hain, band karne ke liye click karein" : "AI action proposals OFF hain, chalu karne ke liye click karein"}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                actionsEnabled ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={`text-xs font-semibold ${actionsEnabled ? "text-brand-600" : "text-surface-400"}`}>
            {actionsEnabled ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      <div className="mt-4 flex h-[65vh] flex-col rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Sparkles className="h-8 w-8 text-brand-400" />
              <p className="text-sm text-surface-500">{t("ba_ask_anything", lang)}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-surface-200 px-3 py-1.5 text-xs text-surface-600 hover:border-brand-300 hover:text-brand-700 dark:border-surface-700 dark:text-surface-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <span
                className={`inline-block max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
          {loading && <p className="text-xs text-surface-400">{t("ba_thinking", lang)}</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-surface-100 p-3 dark:border-surface-800">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder={t("ba_write_question", lang)}
            className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}