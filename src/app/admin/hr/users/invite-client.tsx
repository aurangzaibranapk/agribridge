"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mail, MessageCircle, Smartphone } from "lucide-react";
import { createPartyInvite, sendPartyInvite } from "@/actions/party-invite";
import {
  PARTY_ROLES,
  buildInviteMessage,
  parsePartyForm,
  planSend,
  roleSpec,
  type InviteAccount,
  type InviteChannel,
  type InviteSend,
  type PartyRoleKey,
} from "@/lib/party-invite";

const CHANNELS: { key: InviteChannel; label: string; className: string; Icon: typeof MessageCircle }[] = [
  { key: "whatsapp", label: "WhatsApp pe bhejein", className: "bg-[#3ecf6e] text-[#08301c] hover:bg-[#34b862]", Icon: MessageCircle },
  { key: "email", label: "Email pe bhejein", className: "bg-[#3b82f6] text-white hover:bg-[#2f6fe0]", Icon: Mail },
  { key: "sms", label: "SMS pe bhejein", className: "bg-[#24352e] text-[#d5e6dc] hover:bg-[#2c4038]", Icon: Smartphone },
];

export function InviteClient({
  loginUrl,
  branches,
  accounts,
  sends,
  dbError,
  previewMode = false,
}: {
  loginUrl: string;
  branches: { id: string; name: string }[];
  accounts: InviteAccount[];
  sends: InviteSend[];
  dbError: string | null;
  previewMode?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState<PartyRoleKey>(accounts[0]?.role ?? "dealer");
  const [activeId, setActiveId] = useState<string | null>(accounts[0]?.id ?? null);
  const [localAccounts, setLocalAccounts] = useState<InviteAccount[]>(accounts);
  const [localSends, setLocalSends] = useState<InviteSend[]>(sends);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<InviteChannel | null>(null);

  const active = localAccounts.find((a) => a.id === activeId) ?? null;
  const timeline = localSends
    .filter((s) => s.accountId === active?.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const draft = useMemo(() => {
    if (!active) return null;
    return buildInviteMessage({
      fullName: active.fullName,
      role: active.role,
      branchName: active.branchName,
      phone: active.phone,
      email: active.email,
      loginUrl,
    });
  }, [active, loginUrl]);

  async function onCreate(formData: FormData) {
    setError(null);
    const parsed = parsePartyForm({
      role: formData.get("role"),
      fullName: formData.get("full_name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      branchId: formData.get("branch_id"),
    });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (previewMode) {
      const branchName = branches.find((b) => b.id === parsed.value.branchId)?.name ?? "";
      const account: InviteAccount = {
        id: `local-${Date.now()}`,
        role: parsed.value.role,
        fullName: parsed.value.fullName,
        phone: parsed.value.phone,
        email: parsed.value.email,
        branchName,
        createdAt: new Date().toISOString(),
      };
      setLocalAccounts((list) => [account, ...list]);
      setActiveId(account.id);
      return;
    }
    setBusy(true);
    const result = await createPartyInvite({}, formData);
    setBusy(false);
    if (result.error || !result.account) {
      setError(result.error ?? "Account nahi bana.");
      return;
    }
    setLocalAccounts((list) => [result.account!, ...list.filter((a) => a.id !== result.account!.id)]);
    setActiveId(result.account.id);
    router.refresh();
  }

  async function confirmSend() {
    if (!active || !preview) return;
    setError(null);
    const plan = planSend({
      channel: preview,
      fullName: active.fullName,
      role: active.role,
      branchName: active.branchName,
      phone: active.phone,
      email: active.email,
      loginUrl,
    });
    if (previewMode) {
      const send: InviteSend = {
        id: `local-send-${Date.now()}`,
        accountId: active.id,
        channel: preview,
        recipient: plan.recipient || "—",
        subject: plan.subject,
        content: plan.text,
        status: plan.ok ? "sent" : "failed",
        error: plan.error,
        createdAt: new Date().toISOString(),
      };
      setLocalSends((list) => [send, ...list]);
      if (!plan.ok) setError(plan.error);
      setPreview(null);
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("account_id", active.id);
    fd.set("channel", preview);
    const result = await sendPartyInvite({}, fd);
    setBusy(false);
    if (result.send) setLocalSends((list) => [result.send!, ...list.filter((s) => s.id !== result.send!.id)]);
    if (result.error) setError(result.error);
    setPreview(null);
    router.refresh();
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_20%_0%,#1a6b45_0%,transparent_42%),linear-gradient(180deg,#0d2b20_0%,#071610_100%)] px-4 py-6 text-white sm:px-6">
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#9dccb0]">Kisan Pakistan</p>
        <h1 className="mt-1 font-display text-2xl font-semibold">Naya dealer / buyer banayein</h1>
        <p className="mt-1 max-w-xl text-sm text-[#b7d4c4]">
          Admin account banata hai, phir WhatsApp, email ya SMS. Bhejne se pehle poora paigham dikhta hai aur timeline mein likhta hai.
        </p>
      </header>

      {dbError && (
        <p className="mb-4 rounded-xl border border-amber-400/40 bg-amber-950/50 px-3 py-2 text-sm text-amber-100" data-testid="party-db-error">
          {dbError}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <form
          className="rounded-2xl border border-white/10 bg-[#123528]/90 p-4 shadow-xl"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreate(new FormData(event.currentTarget));
          }}
        >
          <input type="hidden" name="role" value={role} />
          <Field label="Role">
            <div className="flex flex-wrap gap-2">
              {PARTY_ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  data-testid={`party-role-${r.key}`}
                  onClick={() => setRole(r.key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${role === r.key ? "bg-[#3ecf6e] text-[#08301c]" : "bg-[#1c4636] text-[#d5e6dc]"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Naam">
            <input name="full_name" required defaultValue={previewMode ? "Bilal Traders" : ""} className={inputCls} placeholder="Bilal Traders" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mobile">
              <input name="phone" required defaultValue={previewMode ? "+92 301 7654321" : ""} className={inputCls} placeholder="+92 301 7654321" />
            </Field>
            <Field label="Email (Email bhejne ke liye zarori)">
              <input name="email" type="email" defaultValue={previewMode ? "bilal.traders@gmail.com" : ""} className={inputCls} placeholder="bilal.traders@gmail.com" />
            </Field>
          </div>
          <Field label="Branch">
            <select name="branch_id" required className={inputCls} defaultValue={branches[0]?.id ?? ""}>
              <option value="">Branch chunein</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          {error && !preview && <p className="mb-3 rounded-lg bg-red-950/70 px-3 py-2 text-sm text-red-100" data-testid="party-error">{error}</p>}
          <button type="submit" disabled={busy} data-testid="party-create" className="mt-1 h-11 w-full rounded-xl bg-[#3ecf6e] text-sm font-bold text-[#08301c] disabled:opacity-60">
            {busy ? "Ban raha hai..." : "Account banayein"}
          </button>
          {localAccounts.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8fb5a2]">Haal ke account</p>
              <ul className="space-y-1">
                {localAccounts.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setActiveId(a.id)} className={`w-full rounded-lg px-2 py-1.5 text-left text-sm ${a.id === activeId ? "bg-white/10" : "hover:bg-white/5"}`}>
                      <span className="font-medium">{a.fullName}</span>
                      <span className="ml-2 text-xs text-[#9dccb0]">{roleSpec(a.role)?.label} · {a.branchName}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <section className="rounded-2xl border border-white/10 bg-[#123528]/90 p-4 shadow-xl" data-testid="party-send-panel">
          {active ? (
            <>
              <p className="inline-flex items-center gap-1 rounded-full bg-[#1f7a4d] px-2.5 py-1 text-xs font-semibold text-[#d8ffe8]">
                <Check className="h-3.5 w-3.5" /> Account ban gaya
              </p>
              <h2 className="mt-3 text-lg font-semibold">{active.fullName} ko bhejein</h2>
              <p className="text-sm text-[#b7d4c4]">Login link + OTP se pehli dafa sign-in</p>
              <div className="mt-4 space-y-2">
                {CHANNELS.map(({ key, label, className, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    data-testid={`party-send-${key}`}
                    onClick={() => { setError(null); setPreview(key); }}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-60 ${className}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#8fb5a2]">Bhejne se pehle message dikhaya jayega · record timeline mein</p>
            </>
          ) : (
            <p className="text-sm text-[#b7d4c4]">Pehle baayi taraf account banayein. Us ke baad yahan se invite jayega.</p>
          )}

          <div className="mt-4 border-t border-white/10 pt-3" data-testid="party-timeline">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8fb5a2]">Timeline</p>
            {timeline.length === 0 ? (
              <p className="text-sm text-[#8fb5a2]">Abhi koi bheja hua paigham nahi.</p>
            ) : (
              <ul className="space-y-2">
                {timeline.map((s) => (
                  <TimelineRow key={s.id} send={s} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {preview && active && draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" data-testid="party-preview">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#10281f] p-5 text-white shadow-2xl">
            <h3 className="text-lg font-semibold">Bhejne se pehle</h3>
            <p className="mt-1 text-sm text-[#b7d4c4]">
              {CHANNELS.find((c) => c.key === preview)?.label} · {active.fullName}
            </p>
            {preview === "email" && !active.email && (
              <p className="mt-3 rounded-lg bg-red-950/80 px-3 py-2 text-sm text-red-100">Email bhejne ke liye email zaroori hai. Confirm par wajah timeline mein likhegi.</p>
            )}
            {error && <p className="mt-3 rounded-lg bg-red-950/80 px-3 py-2 text-sm text-red-100">{error}</p>}
            <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-sm leading-relaxed text-[#e7f6ee]">{draft.text}</pre>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="rounded-lg px-3 py-2 text-sm text-[#d5e6dc]">Wapas</button>
              <button type="button" disabled={busy} data-testid="party-preview-confirm" onClick={() => void confirmSend()} className="rounded-lg bg-[#3ecf6e] px-4 py-2 text-sm font-bold text-[#08301c] disabled:opacity-60">
                {busy ? "Bhej raha hai..." : "Ab bhejein"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRow({ send }: { send: InviteSend }) {
  const [open, setOpen] = useState(false);
  const when = new Date(send.createdAt).toLocaleString("en-PK", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <li className="rounded-xl bg-black/20 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[#9dccb0]">{when}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs uppercase">{send.channel}</span>
        <span>{send.recipient}</span>
        <span className={send.status === "sent" ? "text-[#8ee7b0]" : "text-red-300"}>{send.status === "sent" ? "gaya" : "nahi gaya"}</span>
        <button type="button" className="ml-auto text-xs font-semibold text-[#8ee7b0] underline" data-testid="party-dekhein" onClick={() => setOpen((v) => !v)}>
          {open ? "Band karein" : "Dekhein"}
        </button>
      </div>
      {send.status === "failed" && send.error && (
        <p className="mt-1 text-xs text-red-200" data-testid="party-fail-reason">Wajah: {send.error}</p>
      )}
      {open && (
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-xs leading-relaxed text-[#e7f6ee]" data-testid="party-full-content">{send.content}</pre>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[#c5e0d2]">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "h-11 w-full rounded-xl border border-white/10 bg-[#0c241c] px-3 text-sm text-white outline-none focus:border-[#3ecf6e]";
