"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markConversationRead, type ActionState } from "@/actions/messages";
import { sendBroadcastMessage, type ActionState as BroadcastActionState } from "@/actions/messages-broadcast";
import {
  MessageCircle, X, Send, Paperclip, Bot, FileText, ArrowLeft, Users,
  Camera, KeyRound, Lightbulb, HelpCircle, GraduationCap, Search, Megaphone,
} from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { CoachMessage } from "@/components/guided/coach-message";

const initialState: ActionState = {};
const initialBroadcastState: BroadcastActionState = {};

/**
 * Assistant + Paighaam + Tajaweez -- ek hi panel (276).
 *
 * Pehle do alag tajurbe the: "My Work" ke upar AI ka bada box, aur neeche
 * daayen kone mein messages ka widget. Staff ko ye faisla karna paRta tha
 * ke us ka sawal kis darwaze ka hai -- aur AI sirf usi safhe par milta
 * tha jahan box laga hota tha.
 *
 * Ab AI har safhe par isi panel mein hai, aur wahi panel paighaam aur
 * tajaweez bhi rakhta hai.
 *
 * UI ek jagah hai, magar RECORD ALAG rehte hain (malik ka rule):
 *   AI ki baat  -> /api/bridge-ai (Work Coach)
 *   Insani baat -> staff_messages
 *   Tajweez     -> suggestions
 *   Ijazat      -> access_requests
 * Ye is liye ke audit aur ijazat saaf rahen: AI se ki gayi guftagu kisi
 * sathi ka paighaam nahi ban jati, aur tajweez ka apna number rehta hai.
 */

type Tab = "ai" | "msg" | "sug";

interface Contact { id: string; name: string; role: string; roleLabel: string; isAi: boolean }
interface Dept { key: string; label: string; count: number }
interface Directory {
  me: { id: string; name: string; role: string };
  isMaster: boolean;
  canAnnounce: boolean;
  announceCount: number;
  contacts: Contact[];
  departments: Dept[];
  recent: string[];
}
interface Message {
  id: string; sender_id: string; recipient_id: string;
  message: string | null; attachment_url: string | null; attachment_type: string | null;
  created_at: string; is_read: boolean;
}
interface Suggestion { id: string; number: string | null; title: string; status: string; priority: string | null; created_at: string }
interface Turn { role: "user" | "assistant"; text: string; image?: string }

export function AssistantPanel() {
  const lang = useLang();
  const pathname = usePathname();
  // Bare screen par panel khula hi rehta hai (malik ka reference): safha
  // teen hisson ka ban jata hai -- navigation, kaam, aur AI. Chhoti
  // screen par wo jagah cheen leta, is liye wahan band. Banda band kar
  // de to yaad rakha jata hai.
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("ai");

  useEffect(() => {
    let want = window.innerWidth >= 1280;
    try {
      const saved = localStorage.getItem("agribridge:assistant-open");
      if (saved === "0") want = false;
      if (saved === "1") want = window.innerWidth >= 1024;
    } catch {
      /* storage band ho to bhi chalta rahe */
    }
    setOpen(want);
  }, []);

  // Panel safhe ka teesra khana NAHI hai -- wo neeche daayen kone mein
  // tairta hua chhota window hai (malik ki tasheeh). Is liye safhe se
  // jagah nahi maangta; sirf apni halat yaad rakhta hai.
  useEffect(() => {
    try {
      localStorage.setItem("agribridge:assistant-open", open ? "1" : "0");
    } catch {
      /* yaad na rahe to bhi chalta rahe */
    }
  }, [open]);
  const [dir, setDir] = useState<Directory | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  // Paighaam kis ke sath khula hai: banda, department, ya elaan.
  const [withId, setWithId] = useState<string | null>(null);
  const [withDept, setWithDept] = useState<Dept | null>(null);
  const [announce, setAnnounce] = useState(false);
  const [search, setSearch] = useState("");

  async function loadMessages(uid: string) {
    const { data } = await supabase
      .from("staff_messages")
      .select("*")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
  }

  async function loadDirectory() {
    const res = await fetch("/api/messages/contacts");
    if (res.ok) setDir(await res.json());
  }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    await Promise.all([loadDirectory(), loadMessages(user.id)]);
  }

  // Kya kitni dafa poochna hai -- do alag cheezein hain, is liye do alag
  // hisaab:
  //
  //   Paighaam badalte rehte hain -- panel khula ho to 5 second, band ho
  //   to 30 (band panel par sirf gol button ka hara nishan chahiye).
  //   Directory (kaun kis se baat kar sakta hai) mahine mein shayad ek
  //   dafa badalti hai. Pehle wo bhi har 5 second par poori dobara aati
  //   thi -- har mulazim ki screen se, sara din. Ab sirf shuru mein aur
  //   panel kholne par.
  useEffect(() => {
    loadAll();
  }, []);

  // Sidebar ka "AI Assistant" wala button isi panel ko kholta hai --
  // do alag AI banane ki zaroorat nahi thi.
  useEffect(() => {
    function open() { setOpen(true); setTab("ai"); }
    document.addEventListener("agribridge:open-assistant", open);
    return () => document.removeEventListener("agribridge:open-assistant", open);
  }, []);

  useEffect(() => {
    if (!userId) return;
    const gap = open ? 5000 : 30000;
    const id = setInterval(() => loadMessages(userId), gap);
    return () => clearInterval(id);
  }, [userId, open]);

  useEffect(() => {
    if (open) loadDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!userId) return null;

  const unreadTotal = messages.filter((m) => m.recipient_id === userId && !m.is_read).length;
  const unreadBy: Record<string, number> = {};
  messages.forEach((m) => {
    if (m.recipient_id === userId && !m.is_read) unreadBy[m.sender_id] = (unreadBy[m.sender_id] ?? 0) + 1;
  });

  const contacts = dir?.contacts ?? [];
  const selected = contacts.find((c) => c.id === withId) ?? null;
  const conversation = messages.filter(
    (m) => (m.sender_id === userId && m.recipient_id === withId) || (m.sender_id === withId && m.recipient_id === userId)
  );
  const inThread = !!(selected || withDept || announce);

  function back() { setWithId(null); setWithDept(null); setAnnounce(false); }

  const header = announce
    ? t("ap_announce", lang)
    : withDept
      ? withDept.label
      : selected
        ? selected.name
        : t("ap_title", lang);

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("ap_title", lang)}
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
        <div className="fixed bottom-5 right-5 z-50 flex h-[520px] w-[370px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-xl border border-surface-200 bg-white shadow-2xl xl:h-[520px] xl:w-[380px] dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between bg-brand-700 px-3.5 py-3 text-white">
            <div className="flex items-center gap-2">
              {tab === "msg" && inThread && (
                <button onClick={back} className="rounded p-0.5 hover:bg-white/20" aria-label="back">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <span className="text-sm font-semibold">{header}</span>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-0.5 hover:bg-white/20" aria-label="close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex border-b border-surface-200 text-xs dark:border-surface-800">
            {([["ai", t("ap_tab_ai", lang)], ["msg", t("ap_tab_msg", lang)], ["sug", t("ap_tab_sug", lang)]] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => { setTab(k); if (k !== "msg") back(); }}
                className={`flex-1 px-2 py-2 font-medium ${tab === k ? "border-b-2 border-brand-600 text-brand-700 dark:text-brand-300" : "text-surface-500 hover:text-surface-700"}`}
              >
                {label}
                {k === "msg" && unreadTotal > 0 && (
                  <span className="ml-1 rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">{unreadTotal}</span>
                )}
              </button>
            ))}
          </div>

          {tab === "ai" && <AssistantTab pathname={pathname} />}

          {tab === "sug" && <SuggestionsTab onAsk={() => setTab("ai")} />}

          {tab === "msg" && !inThread && (
            <DirectoryPane
              dir={dir}
              search={search}
              setSearch={setSearch}
              unreadBy={unreadBy}
              onPerson={(id) => setWithId(id)}
              onDept={(d) => setWithDept(d)}
              onAnnounce={() => setAnnounce(true)}
            />
          )}

          {tab === "msg" && announce && (
            <GroupSendPane
              kind="all"
              count={dir?.announceCount ?? 0}
              onDone={() => { back(); loadMessages(userId); }}
            />
          )}

          {tab === "msg" && withDept && (
            <GroupSendPane
              kind="department"
              deptKey={withDept.key}
              deptLabel={withDept.label}
              count={withDept.count}
              onDone={() => { back(); loadMessages(userId); }}
            />
          )}

          {tab === "msg" && selected && (
            <ChatPane
              currentUserId={userId}
              contact={selected}
              conversation={conversation}
              unread={unreadBy[selected.id] ?? 0}
              onSent={() => loadMessages(userId)}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Assistant -- Work Coach ki baat cheet                               */
/* ------------------------------------------------------------------ */

function AssistantTab({ pathname }: { pathname: string }) {
  const lang = useLang();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ mimeType: string; data: string; preview: string } | null>(null);
  const [loading, setLoading] = useState(false);
  // Raasta -> safhe ka naam. Is ke baghair jawab mein khula URL nazar
  // aata hai; is ke sath safhe ke naam wala button.
  const [labels, setLabels] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns.length, loading]);

  useEffect(() => {
    fetch("/api/features/labels")
      .then((r) => (r.ok ? r.json() : { labels: {} }))
      .then((d) => setLabels(d.labels ?? {}))
      .catch(() => setLabels({}));
  }, []);

  function pickImage(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      setImage({ mimeType: file.type || "image/png", data: url.split(",")[1] ?? "", preview: url });
    };
    reader.readAsDataURL(file);
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if ((!q && !image) || loading) return;
    setTurns((tt) => [...tt, { role: "user", text: q || t("wc_explain_shot", lang), image: image?.preview }]);
    setInput("");
    const img = image;
    setImage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/bridge-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          image: img ? { mimeType: img.mimeType, data: img.data } : undefined,
          history: turns.slice(-8).map((x) => ({ role: x.role, text: x.text })),
        }),
      });
      const data = await res.json();
      setTurns((tt) => [...tt, { role: "assistant", text: data.answer ?? data.error ?? t("wc_error", lang) }]);
    } catch {
      setTurns((tt) => [...tt, { role: "assistant", text: t("wc_error", lang) }]);
    } finally {
      setLoading(false);
    }
  }

  const quick: [string, JSX.Element, string][] = [
    [t("ap_qa_access", lang), <KeyRound key="k" className="h-3.5 w-3.5" />, t("ma_ask_prefill", lang)],
    [t("ap_qa_sugg", lang), <Lightbulb key="l" className="h-3.5 w-3.5" />, t("sg_prefill", lang)],
    [t("ap_qa_explain", lang), <HelpCircle key="h" className="h-3.5 w-3.5" />, `${t("ap_qa_explain", lang)}: ${pathname}`],
  ];

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {turns.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-surface-50 px-3 py-2.5 dark:bg-surface-800">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <p className="text-sm text-surface-700 dark:text-surface-200">{t("ap_greet", lang)}</p>
            </div>
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-surface-400">{t("ap_qa", lang)}</p>
            <div className="flex flex-wrap gap-1.5">
              {quick.map(([label, icon, prefill]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setInput(prefill)}
                  className="inline-flex items-center gap-1 rounded-full border border-surface-200 px-2.5 py-1 text-[11px] font-medium text-surface-700 hover:border-brand-400 hover:text-brand-700 dark:border-surface-700 dark:text-surface-300"
                >
                  {icon} {label}
                </button>
              ))}
              <Link
                href="/admin/academy"
                className="inline-flex items-center gap-1 rounded-full border border-surface-200 px-2.5 py-1 text-[11px] font-medium text-surface-700 hover:border-brand-400 hover:text-brand-700 dark:border-surface-700 dark:text-surface-300"
              >
                <GraduationCap className="h-3.5 w-3.5" /> {t("ap_qa_training", lang)}
              </Link>
            </div>
            <p className="px-1 text-[11px] text-surface-400">{t("ap_ai_not_human", lang)}</p>
          </div>
        )}
        {turns.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            {m.image && <img src={m.image} alt="" className="mb-1 ml-auto max-h-24 rounded border border-surface-200" />}
            <span className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-800 dark:bg-surface-800 dark:text-surface-200"}`}>
              {m.role === "assistant" ? <CoachMessage text={m.text} labels={labels} /> : m.text}
            </span>
          </div>
        ))}
        {loading && <p className="text-xs text-surface-400">{t("ba_thinking", lang)}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-1.5 border-t border-surface-100 p-2 dark:border-surface-800">
        {image && (
          <span className="relative">
            <img src={image.preview} alt="" className="h-8 w-8 rounded border border-surface-200 object-cover" />
            <button type="button" onClick={() => setImage(null)} className="absolute -right-1.5 -top-1.5 rounded-full bg-surface-700 p-0.5 text-white">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("wc_placeholder", lang)}
          className="h-9 flex-1 rounded-lg border border-surface-200 bg-white px-2.5 text-xs dark:border-surface-700 dark:bg-surface-800 dark:text-white"
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => fileRef.current?.click()} title={t("wc_screenshot", lang)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:border-brand-400 dark:border-surface-700">
          <Camera className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => send()} disabled={loading} className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Tajaweez                                                            */
/* ------------------------------------------------------------------ */

const SUG_TONE: Record<string, string> = {
  new: "bg-blue-100 text-blue-800", reviewing: "bg-amber-100 text-amber-800",
  planned: "bg-violet-100 text-violet-800", done: "bg-green-100 text-green-800",
  rejected: "bg-surface-200 text-surface-700", duplicate: "bg-surface-200 text-surface-700",
};

function SuggestionsTab({ onAsk }: { onAsk: () => void }) {
  const lang = useLang();
  const [items, setItems] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    fetch("/api/suggestions/mine")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <button
        type="button"
        onClick={onAsk}
        className="mb-3 flex w-full items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left dark:border-amber-900/40 dark:bg-amber-900/20"
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span className="text-xs text-amber-900 dark:text-amber-200">{t("ap_sug_hint", lang)}</span>
      </button>

      {items === null && <p className="text-xs text-surface-400">…</p>}
      {items !== null && items.length === 0 && <p className="py-4 text-center text-xs text-surface-400">{t("ap_sug_none", lang)}</p>}
      <ul className="space-y-1.5">
        {(items ?? []).map((s) => (
          <li key={s.id} className="rounded-lg border border-surface-200 px-3 py-2 dark:border-surface-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-surface-900 dark:text-white">{s.title}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${SUG_TONE[s.status] ?? "bg-surface-200 text-surface-700"}`}>{s.status}</span>
            </div>
            {s.number && <p className="mt-0.5 text-[10px] text-surface-400">{s.number}</p>}
          </li>
        ))}
      </ul>
      <Link href="/admin/improvements" className="mt-3 block text-center text-xs font-medium text-brand-700 underline dark:text-brand-300">
        {t("ap_sug_all", lang)}
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paighaam -- directory                                               */
/* ------------------------------------------------------------------ */

function DirectoryPane({
  dir, search, setSearch, unreadBy, onPerson, onDept, onAnnounce,
}: {
  dir: Directory | null;
  search: string;
  setSearch: (s: string) => void;
  unreadBy: Record<string, number>;
  onPerson: (id: string) => void;
  onDept: (d: Dept) => void;
  onAnnounce: () => void;
}) {
  const lang = useLang();
  if (!dir) return <p className="p-4 text-center text-xs text-surface-400">…</p>;

  const q = search.trim().toLowerCase();
  const match = (c: Contact) => !q || c.name.toLowerCase().includes(q) || c.roleLabel.toLowerCase().includes(q);
  const byId = new Map(dir.contacts.map((c) => [c.id, c]));
  const recent = dir.recent.map((id) => byId.get(id)).filter((c): c is Contact => !!c).filter(match);
  const depts = dir.departments.filter((d) => !q || d.label.toLowerCase().includes(q));
  const staff = dir.contacts.filter(match);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 flex items-center gap-2 border-b border-surface-100 bg-white px-3 py-2 dark:border-surface-800 dark:bg-surface-900">
        <Search className="h-3.5 w-3.5 text-surface-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("ap_search", lang)}
          className="w-full bg-transparent text-xs text-surface-800 outline-none placeholder:text-surface-400 dark:text-surface-200"
        />
      </div>

      {recent.length > 0 && (
        <Section label={t("ap_recent", lang)}>
          {recent.map((c) => <PersonRow key={c.id} c={c} unread={unreadBy[c.id] ?? 0} onClick={() => onPerson(c.id)} />)}
        </Section>
      )}

      {depts.length > 0 && (
        <Section label={t("ap_departments", lang)}>
          {depts.map((d) => (
            <button key={d.key} onClick={() => onDept(d)} className="flex w-full items-center gap-2 border-b border-surface-100 px-3 py-2 text-left hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-200 text-surface-600 dark:bg-surface-700">
                <Users className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm text-surface-900 dark:text-white">{d.label}</span>
              <span className="ml-auto text-[10px] text-surface-400">{t("ap_dept_count", lang).replace("{n}", String(d.count))}</span>
            </button>
          ))}
        </Section>
      )}

      <Section label={t("ap_staff", lang)}>
        {staff.map((c) => <PersonRow key={c.id} c={c} unread={unreadBy[c.id] ?? 0} onClick={() => onPerson(c.id)} />)}
        {staff.length === 0 && <p className="px-3 py-3 text-center text-xs text-surface-400">{t("sh_no_contact", lang)}</p>}
      </Section>

      {dir.canAnnounce && (
        <Section label={t("ap_admin_only", lang)}>
          <button onClick={onAnnounce} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-brand-50 dark:hover:bg-brand-900/20">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
              <Megaphone className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-medium text-brand-700 dark:text-brand-300">{t("ap_announce", lang)}</span>
          </button>
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="bg-surface-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-surface-500 dark:bg-surface-800">{label}</p>
      {children}
    </div>
  );
}

function PersonRow({ c, unread, onClick }: { c: Contact; unread: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between border-b border-surface-100 px-3 py-2 text-left hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800">
      <span className="flex items-center gap-2">
        {c.isAi ? (
          <Bot className="h-4 w-4 text-brand-600" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-200 text-xs font-medium text-surface-600 dark:bg-surface-700">{c.name[0]}</span>
        )}
        <span>
          <span className="block text-sm text-surface-900 dark:text-white">{c.name}</span>
          <span className="block text-[10px] text-surface-400">{c.roleLabel}</span>
        </span>
      </span>
      {unread > 0 && <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Elaan / department ko paighaam -- ginti ki tasdeeq ke sath           */
/* ------------------------------------------------------------------ */

function GroupSendPane({
  kind, deptKey, deptLabel, count, onDone,
}: {
  kind: "all" | "department";
  deptKey?: string;
  deptLabel?: string;
  count: number;
  onDone: () => void;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(sendBroadcastMessage, initialBroadcastState);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) { formRef.current?.reset(); setConfirming(false); onDone(); }
  }, [state.success]);

  // Elaan wapas nahi aata -- is liye bhejne se pehle ginti saamne.
  const confirmText = t("ap_announce_confirm", lang).replace("{n}", String(count));

  return (
    <div className="flex flex-1 flex-col justify-between p-3">
      <div className="space-y-2">
        <p className="text-xs text-surface-600 dark:text-surface-300">
          {kind === "all" ? t("sh_all_staff_note", lang) : t("ap_dept_to", lang).replace("{d}", deptLabel ?? "")}
        </p>
        <p className="text-[11px] text-surface-400">{t("ap_dept_count", lang).replace("{n}", String(count))}</p>
        {state.error && <p className="rounded bg-red-50 px-2 py-1 text-[10px] text-red-700">{state.error}</p>}
      </div>

      <form
        ref={formRef}
        action={formAction}
        encType="multipart/form-data"
        className="space-y-2 border-t border-surface-100 pt-2 dark:border-surface-800"
        onSubmit={(e) => {
          // Pehla submit sirf tasdeeq maangta hai.
          if (!confirming) { e.preventDefault(); setConfirming(true); }
        }}
      >
        {kind === "department" && <input type="hidden" name="department_key" value={deptKey} />}
        <div className="flex items-center gap-1.5">
          <label className="cursor-pointer text-surface-400 hover:text-surface-600">
            <Paperclip className="h-4 w-4" />
            <input type="file" name="attachment" accept="image/*,application/pdf" className="hidden" />
          </label>
          <input name="message" placeholder={t("sh_write_announcement", lang)} className="flex-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-800" />
        </div>
        {confirming ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-900/20">
            <p className="mb-2 text-[11px] font-medium text-amber-900 dark:text-amber-200">{confirmText}</p>
            <div className="flex gap-1.5">
              <GroupSubmit label={t("ap_announce_yes", lang)} />
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-surface-300 px-2 py-1 text-[11px] text-surface-600 dark:border-surface-700">
                {t("ap_cancel", lang)}
              </button>
            </div>
          </div>
        ) : (
          <button type="submit" className="w-full rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            {t("sh_send_all_staff", lang)}
          </button>
        )}
      </form>
    </div>
  );
}

function GroupSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Ek banday se baat                                                   */
/* ------------------------------------------------------------------ */

function ChatPane({
  currentUserId, contact, conversation, onSent, unread,
}: {
  currentUserId: string;
  contact: Contact;
  conversation: Message[];
  onSent: () => void;
  unread: number;
}) {
  const lang = useLang();
  const [, markReadAction] = useFormState(markConversationRead, initialState);
  const [state, formAction] = useFormState(sendMessage, initialState);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [conversation.length]);

  useEffect(() => {
    if (unread > 0) {
      const fd = new FormData();
      fd.set("sender_id", contact.id);
      markReadAction(fd);
    }
  }, [contact.id]);

  useEffect(() => {
    if (state.success) { formRef.current?.reset(); onSent(); }
  }, [state.success]);

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {conversation.length === 0 && <p className="py-6 text-center text-xs text-surface-400">{t("sh_no_messages", lang)}</p>}
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
                    <FileText className="h-3 w-3" />{t("sh_file", lang)}
                  </a>
                )}
                <p className={`mt-0.5 text-[9px] ${isMine ? "text-white/70" : "text-surface-400"}`}>
                  {new Date(m.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
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
        <input name="message" placeholder={t("sh_ask_question", lang)} className="flex-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-800" />
        <ChatSubmit />
      </form>
    </>
  );
}

function ChatSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-60">
      <Send className="h-3.5 w-3.5" />
    </button>
  );
}
