"use client";
import { useState, useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markConversationRead, type ActionState } from "@/actions/messages";
import { sendBroadcastMessage, type ActionState as BroadcastActionState } from "@/actions/messages-broadcast";
import { MessageCircle, X, Send, Paperclip, Bot, FileText, ArrowLeft, Users } from "lucide-react";

const initialState: ActionState = {};
const initialBroadcastState: BroadcastActionState = {};

const STAFF_ROLES = [
  "owner", "super_admin", "admin", "manager", "sales_staff", "finance",
  "warehouse", "admin_assistant", "hr", "procurement", "milk_collection", "ai_assistant",
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin", admin: "Admin", owner: "Owner", admin_assistant: "Admin Assistant",
  manager: "Manager", sales_staff: "Sales", finance: "Finance", warehouse: "Warehouse",
  hr: "HR", procurement: "Procurement", milk_collection: "Milk Collection", ai_assistant: "AI Assistant",
};

interface Contact {
  id: string;
  full_name: string;
  role: string;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  is_read: boolean;
}

export function MessagesWidget() {
  const [open, setOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const supabase = createClient();

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: contactsRaw } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", STAFF_ROLES)
      .eq("is_active", true)
      .neq("id", user.id)
      .order("full_name");
    setContacts((contactsRaw ?? []).map((c) => ({ id: c.id, full_name: c.full_name ?? "User", role: c.role })));

    const { data: allMessages } = await supabase
      .from("staff_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: true });
    setMessages(allMessages ?? []);
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const unreadTotal = currentUserId ? messages.filter((m) => m.recipient_id === currentUserId && !m.is_read).length : 0;
  const unreadBySender: Record<string, number> = {};
  if (currentUserId) {
    messages.forEach((m) => {
      if (m.recipient_id === currentUserId && !m.is_read) unreadBySender[m.sender_id] = (unreadBySender[m.sender_id] ?? 0) + 1;
    });
  }

  const selectedContact = contacts.find((c) => c.id === selectedId);
  const conversation = currentUserId
    ? messages.filter((m) => (m.sender_id === currentUserId && m.recipient_id === selectedId) || (m.sender_id === selectedId && m.recipient_id === currentUserId))
    : [];

  if (!currentUserId) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl hover:bg-brand-700"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadTotal > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[340px] flex-col overflow-hidden rounded-xl border border-surface-200 bg-white shadow-2xl dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between bg-brand-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              {(selectedId || showBroadcast) && (
                <button onClick={() => { setSelectedId(null); setShowBroadcast(false); }} className="rounded p-0.5 hover:bg-white/20">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <span className="text-sm font-semibold">
                {showBroadcast ? "Sab Staff Ko Bhejein" : selectedContact ? selectedContact.full_name : "AgriBridge Messages"}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-0.5 hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!selectedId && !showBroadcast && (
            <div className="flex-1 overflow-y-auto">
              <button
                onClick={() => setShowBroadcast(true)}
                className="flex w-full items-center gap-2 border-b border-surface-100 bg-brand-50 px-3 py-2.5 text-left hover:bg-brand-100 dark:border-surface-800 dark:bg-brand-900/20"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Sab Staff Ko Bhejein</p>
                  <p className="text-xs text-brand-500">Ek message, sab ko chala jayega</p>
                </div>
              </button>
              {contacts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="flex w-full items-center justify-between border-b border-surface-100 px-3 py-2.5 text-left hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
                >
                  <div className="flex items-center gap-2">
                    {c.role === "ai_assistant" ? (
                      <Bot className="h-4 w-4 text-brand-600" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-200 text-xs font-medium text-surface-600">{c.full_name[0]}</span>
                    )}
                    <div>
                      <p className="text-sm font-medium text-surface-900 dark:text-white">{c.full_name}</p>
                      <p className="text-xs text-surface-400">{ROLE_LABELS[c.role] ?? c.role}</p>
                    </div>
                  </div>
                  {unreadBySender[c.id] > 0 && <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadBySender[c.id]}</span>}
                </button>
              ))}
              {contacts.length === 0 && <p className="p-4 text-center text-xs text-surface-400">Koi contact nahi mila.</p>}
            </div>
          )}

          {showBroadcast && <BroadcastPane onSent={() => { loadData(); setShowBroadcast(false); }} />}

          {selectedId && !showBroadcast && (
            <ChatPane currentUserId={currentUserId} contact={selectedContact!} conversation={conversation} onSent={loadData} unread={unreadBySender[selectedId] ?? 0} />
          )}
        </div>
      )}
    </>
  );
}

function BroadcastPane({ onSent }: { onSent: () => void }) {
  const [state, formAction] = useFormState(sendBroadcastMessage, initialBroadcastState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onSent();
    }
  }, [state.success]);

  return (
    <div className="flex flex-1 flex-col justify-between p-3">
      <div>
        <p className="mb-2 text-xs text-surface-500">Ye message sab active staff (Sales, Finance, Warehouse, HR, etc) ko chala jayega.</p>
        {state.error && <p className="mb-2 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">{state.error}</p>}
      </div>
      <form ref={formRef} action={formAction} encType="multipart/form-data" className="flex items-center gap-1.5 border-t border-surface-100 pt-2 dark:border-surface-800">
        <label className="cursor-pointer text-surface-400 hover:text-surface-600">
          <Paperclip className="h-4 w-4" />
          <input type="file" name="attachment" accept="image/*,application/pdf" className="hidden" />
        </label>
        <input name="message" placeholder="Elaan likhein..." className="flex-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs" />
        <BroadcastSubmitButton />
      </form>
    </div>
  );
}

function BroadcastSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-60">
      <Send className="h-3.5 w-3.5" />
    </button>
  );
}

function ChatPane({ currentUserId, contact, conversation, onSent, unread }: { currentUserId: string; contact: Contact; conversation: Message[]; onSent: () => void; unread: number }) {
  const [, markReadAction] = useFormState(markConversationRead, initialState);
  const [state, formAction] = useFormState(sendMessage, initialState);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.length]);

  useEffect(() => {
    if (unread > 0) {
      const fd = new FormData();
      fd.set("sender_id", contact.id);
      markReadAction(fd);
    }
  }, [contact.id]);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      onSent();
    }
  }, [state.success]);

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {conversation.length === 0 && <p className="py-6 text-center text-xs text-surface-400">Koi message nahi hai abhi.</p>}
        {conversation.map((m) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-1.5 text-xs ${isMine ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"}`}>
                {m.message && <p className="whitespace-pre-line">{m.message}</p>}
                {m.attachment_url && m.attachment_type === "image" && (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                    <img src={m.attachment_url} alt="attachment" className="mt-1 max-h-32 rounded-lg" />
                  </a>
                )}
                {m.attachment_url && m.attachment_type === "file" && (
                  <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 underline">
                    <FileText className="h-3 w-3" /> File
                  </a>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {state.error && <p className="mx-3 mb-1 rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">{state.error}</p>}
      <form ref={formRef} action={formAction} encType="multipart/form-data" className="flex items-center gap-1.5 border-t border-surface-100 p-2 dark:border-surface-800">
        <input type="hidden" name="recipient_id" value={contact.id} />
        <label className="cursor-pointer text-surface-400 hover:text-surface-600">
          <Paperclip className="h-4 w-4" />
          <input type="file" name="attachment" accept="image/*,application/pdf" className="hidden" />
        </label>
        <input name="message" placeholder="Ask a question..." className="flex-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs" />
        <SubmitButton />
      </form>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-60">
      <Send className="h-3.5 w-3.5" />
    </button>
  );
}