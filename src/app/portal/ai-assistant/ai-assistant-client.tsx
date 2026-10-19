"use client";
import { useState, useRef, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { approveFarmerAiRequest, rejectFarmerAiRequest, type ActionState } from "@/actions/farmer-ai";
import { useLang } from "@/lib/i18n/lang-context";
import { t as tr } from "@/lib/i18n/translations";
import { Mic, Send, Sparkles, Check, X, Loader2, Square } from "lucide-react";

const initialState: ActionState = {};

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface PendingRequest {
  id: string;
  intent_type: string;
  description: string;
  status: string;
  created_at: string;
}

const INTENT_LABELS: Record<string, string> = {
  log_expense: "خرچہ",
  request_machinery: "مشینری کی درخواست",
  request_fertilizer: "کھاد/دوا کی درخواست",
  sell_produce: "فصل بیچنا",
};

const EXAMPLES = [
  "آج اس ایکڑ میں ڈیزل کا 2000 خرچہ ہوا",
  "مجھے ٹریکٹر چاہیے 5 ایکڑ کے لیے",
  "میری گندم بیچنی ہے 50 من",
];

export function AiAssistantClient({ farmerName, pendingRequests }: { farmerName: string; pendingRequests: PendingRequest[] }) {
  const lang = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        sendAudio(audioBlob);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch {
      alert("Microphone access nahi mila. Browser settings mein permission dein.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function sendAudio(audioBlob: Blob) {
    setMessages((m) => [...m, { role: "user", text: "🎤 (Voice message)" }]);
    setLoading(true);
    try {
      const base64 = await blobToBase64(audioBlob);
      const res = await fetch("/api/farmer-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, audioMimeType: "audio/webm" }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer ?? data.error ?? "Kuch masla ho gaya." }]);
      if (data.draftCreated) setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Connection mein masla ho gaya." }]);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/farmer-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", text: data.answer ?? data.error ?? "Kuch masla ho gaya." }]);
      if (data.draftCreated) setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Connection mein masla ho gaya." }]);
    } finally {
      setLoading(false);
    }
  }

  const pendingOnly = pendingRequests.filter((r) => r.status === "pending");

  return (
    <div dir="rtl" className="pf-fit mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 fit:gap-2.5 fit:py-3">
      <div className="mb-4 text-center fit:mb-0">
        <h1 className="font-display text-xl font-bold text-surface-900 dark:text-white">کسان AI اسسٹنٹ</h1>
        <p className="mt-1 text-sm text-surface-500 dark:text-slate-400">اپنی زبان میں بولیں - اردو، پنجابی، پشتو، سندھی، بلوچی، کسی بھی زبان میں</p>
      </div>

      <div className="pf-grow pf-grid grid gap-4 fit:grid-cols-[1.9fr_1fr] fit:gap-2.5">
      <aside className="pf-scroll space-y-3 fit:col-start-2 fit:row-start-1" data-testid="ai-requests">
      {pendingOnly.length > 0 && (
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h2 className="mb-3 text-sm font-semibold text-amber-800">منظوری کے منتظر ({pendingOnly.length})</h2>
          <div className="space-y-2">
            {pendingOnly.map((r) => (
              <PendingRequestCard key={r.id} request={r} />
            ))}
          </div>
        </div>
      )}
      <div className="hidden rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-700 dark:bg-surface-900 fit:block">
        <h2 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{tr("os2_history", lang)} ({pendingRequests.length - pendingOnly.length})</h2>
        {pendingRequests.filter((r) => r.status !== "pending").length === 0 && <p className="py-4 text-center text-xs text-surface-400">—</p>}
        {pendingRequests.filter((r) => r.status !== "pending").map((r) => (
          <div key={r.id} className="flex items-start justify-between gap-2 border-b border-surface-100 py-2 text-xs last:border-0 dark:border-surface-800">
            <div className="min-w-0"><span className="font-medium text-brand-600">{INTENT_LABELS[r.intent_type] ?? r.intent_type}</span><p className="truncate text-surface-700 dark:text-slate-200">{r.description}</p></div>
            <span className="shrink-0 rounded-full bg-surface-100 px-2 py-0.5 text-[10px] text-surface-600 dark:bg-surface-800 dark:text-slate-300">{r.status}</span>
          </div>
        ))}
      </div>
      </aside>

      <div className="flex h-[55vh] flex-col rounded-card fit:col-start-1 fit:row-start-1 fit:h-auto fit:min-h-0 border border-surface-200 bg-white shadow-card dark:bg-surface-900 dark:border-surface-700">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Sparkles className="h-8 w-8 text-brand-400" />
              <p className="text-sm text-surface-500 dark:text-slate-400">مائیک دبائیں اور بولیں، یا لکھیں، مثلاً:</p>
              <div className="flex flex-col items-center gap-2">
                {EXAMPLES.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-surface-200 px-3 py-1.5 text-xs text-surface-600 hover:border-brand-300 hover:text-brand-700 dark:text-slate-300 dark:border-surface-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-start" : "text-end"}>
              <span
                className={`inline-block max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:text-slate-200 dark:bg-surface-800"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
          {loading && <p className="text-xs text-surface-400">سوچ رہا ہے...</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-surface-100 p-3 dark:border-surface-800">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              recording ? "animate-pulse bg-red-600 text-white" : "bg-brand-600 text-white hover:bg-brand-700"
            }`}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="یہاں لکھیں یا مائیک دبائیں..."
            className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm dark:bg-surface-900 dark:border-surface-700"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-50 dark:text-slate-300 dark:bg-surface-800"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {recording && <p className="pb-2 text-center text-xs text-red-600">ریکارڈ ہو رہا ہے... رکنے کے لیے چوکور بٹن دبائیں</p>}
      </div>
      </div>
    </div>
  );
}

function PendingRequestCard({ request }: { request: PendingRequest }) {
  const [approveState, approveAction] = useFormState(approveFarmerAiRequest, initialState);
  const [rejectState, rejectAction] = useFormState(rejectFarmerAiRequest, initialState);

  if (approveState.success || rejectState.success) {
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm dark:bg-surface-900">
      <div>
        <span className="text-xs font-medium text-brand-600">{INTENT_LABELS[request.intent_type] ?? request.intent_type}</span>
        <p className="text-sm text-surface-800 dark:text-slate-200">{request.description}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <form action={approveAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <ApproveButton />
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <RejectButton />
        </form>
      </div>
    </div>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  const lang = useLang();
  return (
    <button type="submit" disabled={pending} aria-label={tr("ph6_a_reject", lang)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-60 dark:text-slate-300 dark:bg-surface-800">
      <X className="h-3.5 w-3.5" />
    </button>
  );
}