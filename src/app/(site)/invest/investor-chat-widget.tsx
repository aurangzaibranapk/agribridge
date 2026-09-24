"use client";
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface Message {
  role: "user" | "model";
  text: string;
}

const EXAMPLES = [
  "Kaise invest kar sakta hoon?",
  "Kya aap cash lete hain?",
  "Mujhe kya milega isme?",
];

export function InvestorChatWidget() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", text: question }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const res = await fetch("/api/investor-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "model", text: data.answer ?? data.error ?? "Kuch masla ho gaya." }]);
    } catch {
      setMessages((m) => [...m, { role: "model", text: "Connection mein masla ho gaya, dobara koshish karein." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-700"
      >{t("sp_start_conversation", lang)}</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="flex h-[32rem] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl dark:bg-surface-900">
            <div className="flex items-center justify-between rounded-t-2xl bg-brand-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-semibold">{t("sp_investment_assistant", lang)}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <MessageCircle className="h-8 w-8 text-brand-300" />
                  <p className="text-sm text-surface-500">{t("sp_ask_anything", lang)}</p>
                  <div className="flex flex-col items-center gap-2">
                    {EXAMPLES.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="rounded-full border border-surface-200 px-3 py-1.5 text-xs text-surface-600 hover:border-brand-300 hover:text-brand-700"
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
                      m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"
                    }`}
                  >
                    {m.text}
                  </span>
                </div>
              ))}
              {loading && <p className="text-xs text-surface-400">{t("sp_typing", lang)}</p>}
            </div>

            <div className="flex items-center gap-2 border-t border-surface-100 p-3 dark:border-surface-800">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
                placeholder={t("sp_write_question", lang)}
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
      )}
    </>
  );
}