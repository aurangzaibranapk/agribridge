"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, FileText, Plus, QrCode, X } from "lucide-react";
import { wt, type WalletV2Data, type WLang } from "@/lib/portal/kisan-wallet";
import { GlassStyles } from "@/components/glass/glass-styles";
import { GlassDebitCard } from "@/components/glass/glass-debit-card";
import { rsFmt, withdrawLink } from "@/lib/glass/glass";
import { GW, gw } from "@/lib/glass/wallet-labels";

const HID = "Rs ••••••";

/**
 * Kisan Wallet -- glassy debit card andaz (owner approved 20 Oct 2026).
 * Wahi asal data (WalletV2Data) jo #169 mein tha; koi likhai nahi.
 */
export function KisanWalletGlass({ data, lang, qr, links }: {
  data: WalletV2Data; lang: WLang; qr: { path: string; view: number } | null;
  links: { khata: string; pay: string; order: string; classic: string; statement?: string; withdraw?: string };
}) {
  const [hidden, setHidden] = useState(false);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem("kw2_hidden") === "1"); } catch { /* */ } }, []);
  const toggleHide = () => setHidden((h) => { try { localStorage.setItem("kw2_hidden", h ? "0" : "1"); } catch { /* */ } return !h; });
  const amt = (v: number) => (hidden ? HID : rsFmt(v));
  const L = (k: keyof typeof GW) => gw(k, lang);
  const owe = data.baqaya > 0;
  const actions = [
    { k: "deposit" as const, href: links.pay, i: <Plus className="h-6 w-6" /> },
    { k: "withdraw" as const, href: links.withdraw ?? withdrawLink(data.code), i: <ArrowUp className="h-6 w-6" />, ext: true },
    { k: "qr" as const, onClick: () => setShowQr(true), i: <QrCode className="h-6 w-6" /> },
    { k: "statement" as const, href: links.statement ?? "/portal/wallet/statement", i: <FileText className="h-6 w-6" /> },
  ];

  return (
    <div className="gl-bg mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6" data-testid="kisan-wallet-glass">
      <GlassStyles />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500 dark:text-slate-400">Kisan Wallet · <span className="gl-ur normal-case">کسان والیٹ</span></p>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">{L("title")}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleHide} aria-pressed={hidden} data-testid="kw2-eye" className="gl-act inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold text-surface-800 dark:text-slate-100">
            {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {hidden ? wt("show", lang) : wt("hide", lang)}
          </button>
          <Link href={links.classic} className="gl-act inline-flex min-h-10 items-center px-3 text-sm font-semibold text-surface-700 dark:text-slate-200">{wt("classic", lang)}</Link>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div className="space-y-3">
          <GlassDebitCard
            code={data.code} name={data.name}
            balanceLabel={owe ? "BAQAYA · BALANCE DUE" : "BALANCE"}
            balance={amt(data.baqaya)}
            sub={data.memberSince ? `Since ${data.memberSince}` : null}
            right={data.plan ? `${data.plan.label}${data.plan.acres ? ` · ${data.plan.acres} acre` : ""}` : null}
          />
          {data.creditLimit != null && (
            <div className="gl-panel p-4">
              <div className="flex justify-between text-xs text-surface-600 dark:text-slate-300">
                <span>{wt("limit", lang)}: <b>{amt(data.creditLimit)}</b></span>
                <span>{wt("avail", lang)}: <b className="text-emerald-700 dark:text-emerald-300">{amt(data.gunjaish ?? 0)}</b></span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div className={`h-full rounded-full ${(data.usedPct ?? 0) > 80 ? "bg-rose-500" : (data.usedPct ?? 0) > 50 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${Math.max(2, data.usedPct ?? 0)}%` }} />
              </div>
            </div>
          )}
        </div>

        <section className="gl-panel p-5 sm:p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[15px] font-semibold text-surface-900 dark:text-white">{L("quick")}</p>
            <p className="text-[10.5px] uppercase tracking-wide text-surface-500 dark:text-slate-400">Quick actions</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {actions.map((a) => {
              const inner = <>{a.i}<span>{L(a.k)}</span></>;
              const cls = "gl-act flex min-h-[86px] flex-col items-center justify-center gap-2 p-3 text-center text-[13px] font-semibold text-surface-800 [&>svg]:text-emerald-700 dark:text-slate-100 dark:[&>svg]:text-emerald-300";
              return a.onClick
                ? <button key={a.k} type="button" onClick={a.onClick} className={cls} data-testid={`gl-act-${a.k}`}>{inner}</button>
                : a.ext
                  ? <a key={a.k} href={a.href} target="_blank" rel="noopener noreferrer" className={cls} data-testid={`gl-act-${a.k}`}>{inner}</a>
                  : <Link key={a.k} href={a.href!} className={cls} data-testid={`gl-act-${a.k}`}>{inner}</Link>;
            })}
          </div>

          <div className="mb-1 mt-6 flex items-baseline justify-between">
            <p className="text-[15px] font-semibold text-surface-900 dark:text-white">{L("recent")}</p>
            <p className="gl-ur text-[12px] text-surface-500 dark:text-slate-400">حالیہ لین دین</p>
          </div>
          {data.entries.length === 0 ? (
            <p className="py-4 text-sm text-surface-500 dark:text-slate-400">{wt("none", lang)}</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {data.entries.map((e, i) => {
                const paid = e.direction === "adaigi";
                return (
                  <li key={`${e.ref}-${i}`} className="flex items-center gap-3 py-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${paid ? "bg-emerald-600" : "bg-[#1e3a6e]"}`}>
                      {paid ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-surface-900 dark:text-slate-100">{e.label}</p>
                      <p className="text-[11px] uppercase text-surface-500 dark:text-slate-400"><bdi dir="ltr">{e.date ?? ""}</bdi> · {wt(e.direction, lang)}</p>
                    </div>
                    <p className={`text-sm font-bold ${paid ? "text-emerald-600 dark:text-emerald-300" : "text-surface-900 dark:text-white"}`}><bdi dir="ltr">{paid ? "+ " : "− "}{amt(e.amount)}</bdi></p>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
            <Link href={links.khata} className="text-emerald-700 hover:underline dark:text-emerald-300">{wt("khata", lang)}</Link>
            <Link href={links.order} className="text-emerald-700 hover:underline dark:text-emerald-300">{wt("order", lang)}</Link>
          </div>
        </section>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={() => setShowQr(false)}>
          <div className="gl-panel w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-surface-900 dark:text-white">{L("qr")}</p>
              <button type="button" onClick={() => setShowQr(false)} aria-label="Band"><X className="h-5 w-5 text-surface-500" /></button>
            </div>
            <div className="mx-auto aspect-square w-56 rounded-xl bg-white p-2">
              {qr ? <svg viewBox={`0 0 ${qr.view} ${qr.view}`} className="h-full w-full" shapeRendering="crispEdges" role="img" aria-label="QR"><path d={qr.path} fill="#0b1f17" /></svg>
                : <span className="flex h-full items-center justify-center text-sm text-surface-600">{wt("noQr", lang)}</span>}
            </div>
            <p className="mt-2 text-sm font-semibold text-surface-800 dark:text-slate-100">{data.code}</p>
            <p className="mt-1 text-[11px] text-surface-500 dark:text-slate-400">{wt("fine", lang)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
