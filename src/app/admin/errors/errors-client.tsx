"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, Check, ChevronDown, ChevronRight } from "lucide-react";
import { resolveError, type ErrorActionState } from "@/actions/errors";
import { Card } from "@/components/ui/layout-primitives";

const initial: ErrorActionState = {};

export interface ErrorRow {
  fingerprint: string;
  module: string;
  message: string;
  route: string | null;
  detail: string | null;
  digest: string | null;
  severity: string;
  kitniDafa: number;
  khuli: number;
  pehliDafa: string;
  aakhriDafa: string;
}

const TONE: Record<string, string> = {
  rukawat: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  ghalti: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  khabar: "bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300",
};

const LABEL: Record<string, string> = {
  rukawat: "kaam ruk gaya",
  ghalti: "ghalti",
  khabar: "khabar",
};

function kab(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const minute = Math.round((Date.now() - d.getTime()) / 60000);
  if (minute < 1) return "abhi";
  if (minute < 60) return `${minute} minute pehle`;
  const ghante = Math.round(minute / 60);
  if (ghante < 24) return `${ghante} ghante pehle`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function ErrorsClient({
  rows,
  khuliGinti,
  kulGinti,
  sabDikhayein,
}: {
  rows: ErrorRow[];
  khuliGinti: number;
  kulGinti: number;
  sabDikhayein: boolean;
}) {
  const [state, formAction] = useFormState(resolveError, initial);
  const [khula, setKhula] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/errors"
          className={
            !sabDikhayein
              ? "rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-200"
              : "rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-600 dark:border-surface-800 dark:bg-surface-900"
          }
        >
          Khuli ({khuliGinti})
        </Link>
        <Link
          href="/admin/errors?sab=1"
          className={
            sabDikhayein
              ? "rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-200"
              : "rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-xs font-medium text-surface-600 dark:border-surface-800 dark:bg-surface-900"
          }
        >
          Sab ({kulGinti})
        </Link>
      </div>

      {state.error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {state.notice}
        </p>
      )}

      {rows.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <Check className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-3 text-sm font-medium text-surface-800 dark:text-surface-200">
              {sabDikhayein ? "Khate mein abhi koi kharabi darj nahi." : "Koi khuli kharabi nahi."}
            </p>
            <p className="mt-1 text-xs text-surface-500">
              Jab bhi kahin kuch tootega, wo khud ba khud yahan aa jayega.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const isOpen = khula === r.fingerprint;
            const halShuda = r.khuli === 0;
            return (
              <div
                key={r.fingerprint}
                className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900"
              >
                <button
                  type="button"
                  onClick={() => setKhula(isOpen ? null : r.fingerprint)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-800/50"
                >
                  {isOpen ? (
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                        {r.module}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[r.severity] ?? TONE.ghalti}`}>
                        {LABEL[r.severity] ?? r.severity}
                      </span>
                      {/* Ek hi masla chalees dafa aaya ho to chalees
                          qatarein nahi -- ek qatar aur us par ginti. */}
                      {r.kitniDafa > 1 && (
                        <span className="rounded-full bg-surface-800 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-surface-100 dark:text-surface-900">
                          {r.kitniDafa} dafa
                        </span>
                      )}
                      {halShuda && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          hal ho gayi
                        </span>
                      )}
                    </div>
                    <p className="mt-1 break-words font-mono text-xs text-surface-800 dark:text-surface-200">
                      {r.message}
                    </p>
                    <p className="mt-0.5 text-[11px] text-surface-500">
                      {r.route ? `${r.route} · ` : ""}aakhri dafa {kab(r.aakhriDafa)}
                    </p>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-surface-100 px-4 py-3 dark:border-surface-800">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      <Row k="Safha" v={r.route ?? "—"} />
                      <Row k="Pehli dafa" v={kab(r.pehliDafa)} />
                      <Row k="Aakhri dafa" v={kab(r.aakhriDafa)} />
                      {/* Digest server ke log mein bhi wohi hota hai --
                          asal khata isi se dhoondhi jati hai. */}
                      <Row k="digest" v={r.digest ?? "—"} mono />
                    </dl>

                    {r.detail && (
                      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-50 p-3 font-mono text-[11px] leading-relaxed text-surface-700 dark:bg-surface-800 dark:text-surface-300">
                        {r.detail}
                      </pre>
                    )}

                    {!halShuda && (
                      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
                        <input type="hidden" name="fingerprint" value={r.fingerprint} />
                        <input
                          name="note"
                          placeholder="Kya kiya ke ye masla khatam hua?"
                          className="h-9 min-w-[240px] flex-1 rounded-lg border border-surface-200 px-3 text-sm outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-800"
                        />
                        <ResolveButton />
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Card className="mt-4 border-surface-200 dark:border-surface-800">
        <p className="flex items-center gap-2 text-sm font-medium text-surface-800 dark:text-surface-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> Ye safha kaise bharta hai
        </p>
        <p className="mt-1 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
          Jab bhi kisi safhe par kuch tootta hai, ya AI nakaam hota hai, ya database koi rok lagata hai — wo khabar
          khud ba khud yahan aa jati hai. Kisi ko screenshot bhejne ki zaroorat nahi.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
          Hal shuda kharabi <strong>mitai nahi jati</strong> — us par nishan lagta hai. Mita dene se ye sawal kabhi
          jawab nahi paata ke ye masla pehle bhi aaya tha ya nahi.
        </p>
      </Card>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-surface-500">{k}:</dt>
      <dd className={`min-w-0 break-all text-surface-800 dark:text-surface-200 ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}

function ResolveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
    >
      <Check className="h-4 w-4" /> {pending ? "…" : "Hal ho gayi"}
    </button>
  );
}
