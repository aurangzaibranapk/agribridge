"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MessageCircle, X, Send } from "lucide-react";
import { askChatbot } from "@/actions/chatbot";

interface Message { role: "user" | "bot"; text: string; link?: string }

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Assalam o Alaikum! Ask me about our products, services, or anything else — I'll do my best to help." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const result = await askChatbot(question);
      setMessages((m) => [...m, { role: "bot", text: result.answer, link: result.link }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat assistant"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[28rem] w-80 flex-col overflow-hidden rounded-card border border-surface-200 bg-white shadow-xl dark:border-surface-800 dark:bg-surface-900">
          <div className="border-b border-surface-100 bg-brand-600 p-3 dark:border-surface-800">
            <p className="text-sm font-semibold text-white">AgriBridge Assistant</p>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"}`}>
                  {m.text}
                </span>
                {m.link && (
                  <div>
                    <Link href={m.link} className="mt-1 inline-block text-xs text-brand-700 hover:underline dark:text-brand-400">Open page →</Link>
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="text-xs text-surface-400 dark:text-surface-500">Typing...</p>}
          </div>
          <div className="flex items-center gap-2 border-t border-surface-100 p-2 dark:border-surface-800">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask a question..."
              className="h-9 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:border-surface-700 dark:bg-surface-800 dark:text-white"
            />
            <button onClick={handleSend} disabled={loading} className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
