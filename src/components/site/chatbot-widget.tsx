"use client";

import { useEffect, useRef, useState } from "react";
import localFont from "next/font/local";
import Link from "next/link";
import { MessageCircle, Send, X } from "lucide-react";
import { askChatbot } from "@/actions/chatbot";
import { textDirection } from "@/lib/chat/language";
import { t, type Lang } from "@/lib/i18n/translations";

const urdu = localFont({
  src: "../../app/login/fonts/noto-nastaliq-urdu.woff2",
  variable: "--font-urdu",
  display: "swap",
  weight: "400 700",
});

interface Message { role: "user" | "bot"; text: string; link?: string }

export function ChatbotWidget({ lang }: { lang: Lang }) {
  const greeting = t("sp_chat_greeting", lang);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "bot", text: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages((current) => {
      if (current.some((m) => m.role === "user")) return current;
      const next = t("sp_chat_greeting", lang);
      if (current.length === 1 && current[0]?.text === next) return current;
      return [{ role: "bot", text: next }];
    });
  }, [lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const result = await askChatbot(question, lang);
      setMessages((m) => [...m, { role: "bot", text: result.answer, link: result.link }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: t("sp_chat_error", lang) }]);
    } finally {
      setLoading(false);
    }
  }

  const rtl = lang === "ur";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("sp_open_chat", lang)}
        data-testid="chat-toggle"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div
          data-testid="chat-panel"
          dir={rtl ? "rtl" : "ltr"}
          className={`${urdu.variable} fixed bottom-24 right-5 z-40 flex h-[min(34rem,calc(100vh-6.5rem))] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-card border border-surface-200 bg-white shadow-xl dark:border-surface-800 dark:bg-surface-900`}
        >
          <div className="border-b border-surface-100 bg-brand-600 p-3 dark:border-surface-800">
            <p className={`text-sm font-semibold text-white ${rtl ? "font-urdu leading-relaxed" : ""}`}>{t("sp_assistant", lang)}</p>
          </div>
          <div ref={scrollRef} data-testid="chat-log" className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => {
              const dir = textDirection(m.text);
              return (
                <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                  <span
                    dir={dir}
                    data-testid={m.role === "bot" ? "chat-bot" : "chat-user"}
                    className={`inline-block max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${dir === "rtl" ? "font-urdu leading-relaxed" : ""} ${m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"}`}
                  >
                    {m.text}
                  </span>
                  {m.link && (
                    <div>
                      <Link href={m.link} className="mt-1 inline-block text-xs text-brand-700 hover:underline dark:text-brand-400">{t("sp_open_page", lang)}</Link>
                    </div>
                  )}
                </div>
              );
            })}
            {loading && <p className="text-xs text-surface-400 dark:text-surface-500">{t("sp_typing", lang)}</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-surface-100 p-2 dark:border-surface-800">
            <input
              value={input}
              dir={rtl ? "rtl" : "ltr"}
              data-testid="chat-input"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("sp_ask_question", lang)}
              className={`h-9 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white ${rtl ? "font-urdu" : ""}`}
            />
            <button type="button" onClick={handleSend} disabled={loading} data-testid="chat-send" aria-label={t("sp_ask_question", lang)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
