"use client";

import { useEffect, useState, type FormEvent } from "react";
import { v6ChangeUserId, v6UserIdCheck } from "@/actions/login-v5";
import { userIdProblem } from "@/lib/auth/login-v6-ui";
import { t6, type V6Lang } from "@/app/login/v6-text";

/**
 * Account settings par User ID -- ikhtiyari, aur baad mein badal sakte hain.
 * Shakl aur uniqueness wahi hai jo login v6 istemal karti hai.
 * Khali chhorne se purani ID nahi mit-ti.
 */
export function UserIdAccountCard({ lang, current }: { lang: V6Lang; current: string | null }) {
  const tr = (k: string, v?: Record<string, string | number>) => t6(lang, k, v);
  const [value, setValue] = useState(current ?? "");
  const [hint, setHint] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const owned = (current ?? "").trim().toLowerCase();

  useEffect(() => {
    const v = value.trim().toLowerCase();
    if (!v) { setHint(null); setChecking(false); return; }
    if (owned && v === owned) { setChecking(false); setHint({ ok: true, text: tr("uid_yours") }); return; }
    const shape = userIdProblem(v);
    if (shape) { setChecking(false); setHint({ ok: false, text: tr(shape) }); return; }
    setChecking(true);
    const id = setTimeout(async () => {
      const r = await v6UserIdCheck(v).catch(() => ({ ok: false as const, error: "e_try_again" }));
      setChecking(false);
      setHint(r.ok ? { ok: true, text: tr("uid_ok", { u: r.name }) } : { ok: false, text: tr(("error" in r && r.error) || "e_try_again") });
    }, 400);
    return () => clearTimeout(id);
  }, [value, owned, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await v6ChangeUserId(value).catch(() => ({ ok: false as const, error: "e_try_again" }));
    setBusy(false);
    if (r.ok) {
      setValue(r.name);
      setHint({ ok: true, text: tr("uid_saved") });
    } else setHint({ ok: false, text: tr(r.error ?? "e_try_again") });
  }

  const unchanged = owned && value.trim().toLowerCase() === owned;
  const canSave = Boolean(value.trim()) && !busy && (unchanged || hint?.ok);

  return (
    <section data-testid="user-id-account" className="rounded-card border border-surface-200 bg-white p-5 dark:border-surface-700 dark:bg-surface-900">
      <h2 className="font-display text-base font-semibold text-surface-900 dark:text-white">{tr(current ? "uid_have_title" : "uid_settings_title")}</h2>
      <p className="mt-1 text-xs text-surface-500 dark:text-slate-400">{tr("uid_settings_p")}</p>
      <form onSubmit={save} className="mt-4 space-y-2">
        <div>
          <label htmlFor="account-user-id" className="mb-1 block text-xs font-medium text-surface-700 dark:text-slate-200">{tr("uid")}</label>
          <input
            id="account-user-id"
            dir="ltr"
            autoComplete="username"
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="aslam.farms"
            className="w-full rounded-lg border border-surface-200 px-3 py-2 font-mono text-sm lowercase dark:border-surface-700 dark:bg-surface-950"
          />
          <p className="mt-1 text-[11px] text-surface-400">{tr("uid_rule")}</p>
          {checking && <p className="mt-1 text-[11px] text-surface-400">{tr("uid_checking")}</p>}
          {!checking && hint && (
            <p role="status" className={`mt-1 text-[11px] font-medium ${hint.ok ? "text-brand-700" : "text-red-600"}`}>{hint.ok ? "✓ " : ""}{hint.text}</p>
          )}
        </div>
        <button type="submit" disabled={!canSave} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? tr("wait") : tr("uid_save")}
        </button>
      </form>
    </section>
  );
}
