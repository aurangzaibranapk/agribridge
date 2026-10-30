"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, EyeOff, RotateCw, BookOpen, Banknote, ShoppingCart } from "lucide-react";
import { catIcon, HELPLINE, wt, type WalletV2Data, type WLang } from "@/lib/portal/kisan-wallet";
import { BRAND_NAME } from "@/lib/brand";

const rs = (v: number) => `Rs ${Math.round(Math.abs(v)).toLocaleString("en-PK")}`;
const HID = "Rs ••••••";

export function KisanWalletV2({ data, lang, qr, links }: {
  data: WalletV2Data; lang: WLang; qr: { path: string; view: number } | null;
  links: { khata: string; pay: string; order: string; classic: string };
}) {
  const [hidden, setHidden] = useState(false);
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem("kw2_hidden") === "1"); } catch { /* */ } }, []);
  const toggleHide = () => setHidden((h) => { try { localStorage.setItem("kw2_hidden", h ? "0" : "1"); } catch { /* */ } return !h; });
  const L = (k: Parameters<typeof wt>[0]) => wt(k, lang);
  const amt = (v: number) => (hidden ? HID : rs(v));
  const owe = data.baqaya >= 0;

  return (
    <div className="kw2 mx-auto w-full max-w-[980px] space-y-4 px-4 py-5 sm:px-6" data-testid="kisan-wallet-v2">
      <style>{`
        .kw2-scene{perspective:1400px}
        .kw2-card{position:relative;width:100%;aspect-ratio:85.6/54;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.2,.7,.2,1)}
        .kw2-card.is-flipped{transform:rotateY(180deg)}
        .kw2-face{position:absolute;inset:0;border-radius:18px;overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;color:#fdf6e3;box-shadow:0 18px 40px -18px rgba(10,30,20,.55)}
        .kw2-back{transform:rotateY(180deg)}
        .kw2-bg{background:radial-gradient(120% 90% at 0% 0%,#2f7d5b 0%,#165a3f 45%,#0d3b2a 100%)}
        .dark .kw2-bg{background:radial-gradient(120% 90% at 0% 0%,#1f3a6b 0%,#13254a 50%,#0a1630 100%)}
        .kw2-gloss{position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,0) 38%,rgba(255,255,255,0) 62%,rgba(255,255,255,.08) 100%);pointer-events:none}
        .kw2-chip{width:13%;max-width:56px;aspect-ratio:1.3;flex-shrink:0;border-radius:6px;background:linear-gradient(135deg,#f6dd8f,#c9a227 55%,#e9cf7a)}
        .kw2-gold{color:#f1d27a}
        @media (prefers-reduced-motion: reduce){.kw2-card{transition:none}}
      `}</style>

      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-surface-900 dark:text-white">{L("title")}</h1>
        <div className="flex items-center gap-1 rounded-full border border-surface-200 bg-white p-1 text-xs font-semibold dark:border-surface-700 dark:bg-surface-900">
          <Link href={links.classic} className="rounded-full px-3 py-1 text-surface-600 hover:bg-surface-100 dark:text-slate-300 dark:hover:bg-surface-800">{L("classic")}</Link>
          <span className="rounded-full bg-emerald-700 px-3 py-1 text-white dark:bg-indigo-600">{L("newLook")}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="kw2-scene mx-auto w-full max-w-[460px]">
            <div className={`kw2-card ${flipped ? "is-flipped" : ""}`} dir="ltr">
              {/* Saamne */}
              <div className="kw2-face kw2-bg" aria-hidden={flipped}>
                <div className="kw2-gloss" />
                <div className="relative flex h-full flex-col justify-between p-[5.5%]">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[clamp(11px,3.2vw,15px)] font-extrabold tracking-wide">{BRAND_NAME}</p>
                    </div>
                    <p className="kw2-gold text-[clamp(9px,2.4vw,12px)] font-bold tracking-[.25em]">KISAN CARD</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="kw2-chip" />
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 opacity-80" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7a7 7 0 0 1 0 10M12 5a10 10 0 0 1 0 14M16 3a13 13 0 0 1 0 18" /></svg>
                    {data.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.photo} alt="" className="ms-auto h-10 w-10 shrink-0 rounded-full border-2 border-[#f1d27a] object-cover" />
                    ) : (
                      <span className="ms-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#f1d27a] text-sm font-bold">{data.initials}</span>
                    )}
                  </div>
                  <p className="font-mono text-[clamp(14px,4.4vw,22px)] tracking-[.14em] [text-shadow:0_1px_0_rgba(0,0,0,.35)]">{data.cardNumber}</p>
                  <div className="flex items-end justify-between gap-2 text-[clamp(8px,2.2vw,11px)]">
                    <div className="min-w-0">
                      <p className="truncate text-[clamp(11px,3vw,15px)] font-bold tracking-wider">{data.nameCaps}</p>
                      <p className="opacity-80">{data.code}</p>
                    </div>
                    <div className="text-end">
                      {data.memberSince && <p><span className="opacity-70">{L("since")} </span><b>{data.memberSince}</b></p>}
                      {data.plan && <p><span className="opacity-70">{L("plan")} </span><b className="kw2-gold">{data.plan.label}{data.plan.acres ? ` · ${data.plan.acres} ${L("acre")}` : ""}</b></p>}
                    </div>
                  </div>
                </div>
              </div>
              {/* Peeche */}
              <div className="kw2-face kw2-back kw2-bg" aria-hidden={!flipped}>
                <div className="kw2-gloss" />
                <div className="mt-[7%] h-[17%] bg-black/80" />
                <div className="flex gap-[4%] p-[5%] pt-[4%]">
                  <div className="aspect-square w-[30%] shrink-0 rounded-lg bg-white p-1">
                    {qr ? (
                      <svg viewBox={`0 0 ${qr.view} ${qr.view}`} className="h-full w-full" shapeRendering="crispEdges" role="img" aria-label="QR"><path d={qr.path} fill="#0b1f17" /></svg>
                    ) : (
                      <span className="flex h-full items-center justify-center text-center text-[9px] font-semibold text-surface-600">{L("noQr")}</span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5 text-[clamp(9px,2.4vw,12px)]">
                    <p className="kw2-gold font-bold">{data.code}</p>
                    {data.mobile && <p>{L("mobile")}: <b>{hidden ? data.mobileMasked : data.mobile}</b></p>}
                    <p className="opacity-70">{L("helpline")}</p>
                    <p className="font-bold">{HELPLINE}</p>
                  </div>
                </div>
                <p className="absolute inset-x-[5%] bottom-[5%] text-[clamp(7px,1.8vw,9px)] leading-snug opacity-75" dir={lang === "ur" ? "rtl" : "ltr"}>{L("fine")}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <button type="button" onClick={() => setFlipped((f) => !f)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 text-sm font-semibold text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100" aria-pressed={flipped}>
              <RotateCw className="h-4 w-4" /> {L("flip")}
            </button>
            <button type="button" onClick={toggleHide} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 text-sm font-semibold text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-slate-100" aria-pressed={hidden} data-testid="kw2-eye">
              {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {hidden ? L("show") : L("hide")}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[#e6dcc3] bg-[#fbf7ee] p-5 dark:border-surface-700 dark:bg-surface-900">
            <p className="text-sm text-surface-600 dark:text-slate-300">{owe ? L("baqaya") : L("receive")}</p>
            <p className={`mt-1 text-4xl font-extrabold tracking-tight ${owe && data.baqaya > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}><bdi dir="ltr">{amt(data.baqaya)}</bdi></p>
            {data.creditLimit != null && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-surface-600 dark:text-slate-300">
                  <span>{L("limit")}: <b><bdi dir="ltr">{amt(data.creditLimit)}</bdi></b></span>
                  <span>{L("avail")}: <b className="text-emerald-700 dark:text-emerald-300"><bdi dir="ltr">{amt(data.gunjaish ?? 0)}</bdi></b></span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#e9e1cc] dark:bg-surface-800">
                  <div className={`h-full rounded-full ${(data.usedPct ?? 0) > 80 ? "bg-rose-500" : (data.usedPct ?? 0) > 50 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${Math.max(2, data.usedPct ?? 0)}%` }} />
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { href: links.khata, k: "khata" as const, i: <BookOpen className="h-6 w-6" /> },
              { href: links.pay, k: "pay" as const, i: <Banknote className="h-6 w-6" /> },
              { href: links.order, k: "order" as const, i: <ShoppingCart className="h-6 w-6" /> },
            ].map((b) => (
              <Link key={b.k} href={b.href} className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 p-3 text-center text-sm font-bold text-white shadow hover:bg-emerald-800 dark:bg-indigo-600 dark:hover:bg-indigo-500">
                {b.i}{L(b.k)}
              </Link>
            ))}
          </div>

          <section className="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-900">
            <p className="mb-2 text-sm font-bold text-surface-900 dark:text-white">{L("recent")}</p>
            {data.entries.length === 0 ? (
              <p className="text-sm text-surface-500 dark:text-slate-400">{L("none")}</p>
            ) : (
              <ul className="divide-y divide-surface-100 dark:divide-surface-800">
                {data.entries.map((e, i) => (
                  <li key={`${e.ref}-${i}`} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef3ea] text-lg dark:bg-surface-800">{catIcon(e.category)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-surface-800 dark:text-slate-100">{e.label}</p>
                      <p className="text-xs text-surface-500 dark:text-slate-400"><bdi dir="ltr">{e.date ?? ""}</bdi> · {L(e.direction)}</p>
                    </div>
                    <p className={`text-sm font-bold ${e.direction === "udhaar" ? "text-rose-600 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}`}><bdi dir="ltr">{e.direction === "udhaar" ? "+" : "−"}{amt(e.amount)}</bdi></p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
