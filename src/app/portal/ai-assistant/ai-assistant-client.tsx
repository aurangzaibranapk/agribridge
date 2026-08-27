"use client";
import { useState, useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { approveFarmerAiRequest, rejectFarmerAiRequest, type ActionState } from "@/actions/farmer-ai";
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
    <div dir="rtl" className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 text-center">
        <h1 className="font-display text-xl font-bold text-surface-900">کسان AI اسسٹنٹ</h1>
        <p className="mt-1 text-sm text-surface-500">اپنی زبان میں بولیں - اردو، پنجابی، پشتو، سندھی، بلوچی، کسی بھی زبان میں</p>
      </div>

      {pendingOnly.length > 0 && (
        <div className="mb-4 rounded-card border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-amber-800">منظوری کے منتظر ({pendingOnly.length})</h2>
          <div className="space-y-2">
            {pendingOnly.map((r) => (
              <PendingRequestCard key={r.id} request={r} />
            ))}
          </div>
        </div>
      )}

      <div className="flex h-[55vh] flex-col rounded-card border border-surface-200 bg-white shadow-card">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Sparkles className="h-8 w-8 text-brand-400" />
              <p className="text-sm text-surface-500">مائیک دبائیں اور بولیں، یا لکھیں، مثلاً:</p>
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
            <div key={i} className={m.role === "user" ? "text-left" : "text-right"}>
              <span
                className={`inline-block max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))}
          {loading && <p className="text-xs text-surface-400">سوچ رہا ہے...</p>}
        </div>

        <div className="flex items-center gap-2 border-t border-surface-100 p-3">
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
            className="h-10 flex-1 rounded-lg border border-surface-200 bg-white px-3 text-sm"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        {recording && <p className="pb-2 text-center text-xs text-red-600">ریکارڈ ہو رہا ہے... رکنے کے لیے چوکور بٹن دبائیں</p>}
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
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm">
      <div>
        <span className="text-xs font-medium text-brand-600">{INTENT_LABELS[request.intent_type] ?? request.intent_type}</span>
        <p className="text-sm text-surface-800">{request.description}</p>
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
  return (
    <button type="submit" disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-60">
      <X className="h-3.5 w-3.5" />
    </button>
  );
}