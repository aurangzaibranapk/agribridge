"use client";
import { useState, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { sendMessage, markConversationRead, type ActionState } from "@/actions/messages";
import { Send, Paperclip, Bot, FileText, X } from "lucide-react";

const initialState: ActionState = {};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin", admin: "Admin", owner: "Owner", admin_assistant: "Admin Assistant",
  manager: "Manager", sales_staff: "Sales", finance: "Finance", warehouse: "Warehouse",
  hr: "HR", procurement: "Procurement", milk_collection: "Milk Collection", machinery: "Machinery", ai_assistant: "AI Assistant",
};

interface Contact {
  id: string;
  full_name: string;
  role: string;
  unreadCount: number;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
}

export function MessagesClient({ currentUserId, contacts, messages }: { currentUserId: string; contacts: Contact[]; messages: Message[] }) {
  const [selectedId, setSelectedId] = useState(contacts[0]?.id ?? "");
  const router = useRouter();

  // Poll every 5 seconds so conversations feel "live" without a full
  // websocket setup — cheap and reliable on shared hosting.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [router]);

  const selectedContact = contacts.find((c) => c.id === selectedId);
  const conversation = messages.filter(
    (m) => (m.sender_id === currentUserId && m.recipient_id === selectedId) || (m.sender_id === selectedId && m.recipient_id === currentUserId)
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" style={{ height: "70vh" }}>
      <div className="overflow-y-auto rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        {contacts.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`flex w-full items-center justify-between border-b border-surface-100 px-3 py-2.5 text-left last:border-0 dark:border-surface-800 ${
              selectedId === c.id ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-surface-50 dark:hover:bg-surface-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {c.role === "ai_assistant" ? <Bot className="h-4 w-4 text-brand-600" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-200 text-xs font-medium text-surface-600">{c.full_name[0]}</span>}
              <div>
                <p className="text-sm font-medium text-surface-900 dark:text-white">{c.full_name}</p>
                <p className="text-xs text-surface-400">{ROLE_LABELS[c.role] ?? c.role}</p>
              </div>
            </div>
            {c.unreadCount > 0 && <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{c.unreadCount}</span>}
          </button>
        ))}
        {contacts.length === 0 && <p className="p-4 text-center text-sm text-surface-400">Koi contact nahi mila.</p>}
      </div>

      <div className="flex flex-col overflow-hidden rounded-card border border-surface-200 bg-white shadow-card lg:col-span-2 dark:border-surface-800 dark:bg-surface-900">
        {selectedContact ? (
          <ChatWindow currentUserId={currentUserId} contact={selectedContact} conversation={conversation} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-surface-400">Koi contact select karein.</div>
        )}
      </div>
    </div>
  );
}

function ChatWindow({ currentUserId, contact, conversation }: { currentUserId: string; contact: Contact; conversation: Message[] }) {
  const [, markReadAction] = useFormState(markConversationRead, initialState);
  const [state, formAction] = useFormState(sendMessage, initialState);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length]);

  useEffect(() => {
    if (contact.unreadCount > 0) {
      const fd = new FormData();
      fd.set("sender_id", contact.id);
      markReadAction(fd);
    }
  }, [contact.id]);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        {contact.role === "ai_assistant" ? <Bot className="h-5 w-5 text-brand-600" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-200 text-sm font-medium text-surface-600">{contact.full_name[0]}</span>}
        <div>
          <p className="text-sm font-medium text-surface-900 dark:text-white">{contact.full_name}</p>
          <p className="text-xs text-surface-400">{ROLE_LABELS[contact.role] ?? contact.role}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {conversation.length === 0 && <p className="py-6 text-center text-xs text-surface-400">Koi message nahi hai abhi. Baat shuru karein.</p>}
        {conversation.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${isMine ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"}`}>
                {m.message && <p className="whitespace-pre-line">{m.message}</p>}
                {m.attachment_url && m.attachment_type === "image" && (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.attachment_url} alt="attachment" className="mt-1 max-h-48 rounded-lg" />
                  </a>
                )}
                {m.attachment_url && m.attachment_type === "file" && (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 text-xs underline">
                    <FileText className="h-3 w-3" /> File Dekhein
                  </a>
                )}
                <p className={`mt-1 text-[10px] ${isMine ? "text-brand-100" : "text-surface-400"}`}>{new Date(m.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {state.error && <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}

      <form ref={formRef} action={formAction} encType="multipart/form-data" className="flex items-center gap-2 border-t border-surface-100 p-3 dark:border-surface-800">
        <input type="hidden" name="recipient_id" value={contact.id} />
        <label className="cursor-pointer text-surface-400 hover:text-surface-600">
          <Paperclip className="h-5 w-5" />
          <input type="file" name="attachment" accept="image/*,application/pdf" className="hidden" />
        </label>
        <input name="message" placeholder="Message likhein..." className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm" />
        <SubmitButton />
      </form>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 p-2 text-white hover:bg-brand-700 disabled:opacity-60">
      <Send className="h-4 w-4" />
    </button>
  );
}