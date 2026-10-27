import Link from "next/link";
import { Calendar, Clock, FileCheck2, FileText, Hourglass, ShieldCheck, Sprout, UserRound, Wallet } from "lucide-react";
import { CustodyRail } from "./custody-rail";
import { NeedsActions } from "./needs-actions";
import { rsCompact } from "@/lib/cash-custody/needs";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";
import type { NeedsKpis, NeedsTone } from "@/lib/cash-custody/needs";

export interface NeedsCardModel {
  id: string;
  index: number;
  tone: NeedsTone;
  mode: "ask" | "approve" | "alert" | "none";
  title: string;
  titleAlt: string;
  detail: string;
  detailAlt: string;
  trail: string;
  age: string;
  askNote: string | null;
  askActor: string | null;
}

function Pair({ a, b, lang, altClass }: { a: TranslationKey; b: TranslationKey; lang: Lang; altClass?: string }) {
  return (
    <>
      {t(a, lang)} <span className={altClass ?? "font-normal text-emerald-300/90"}>({t(b, lang)})</span>
    </>
  );
}

function kpiText(n: number | null, money: boolean): string {
  if (n === null) return "—";
  return money ? rsCompact(n) : String(n);
}

const TONE = {
  rose: "border-rose-500/50 bg-rose-950/20",
  amber: "border-amber-400/50 bg-amber-950/15",
  green: "border-emerald-500/45 bg-emerald-950/20",
} as const;

function CardIcon({ tone }: { tone: NeedsTone }) {
  const box =
    tone === "rose"
      ? "bg-rose-500/15 text-rose-200"
      : tone === "amber"
        ? "bg-amber-400/15 text-amber-200"
        : "bg-emerald-500/15 text-emerald-200";
  const Icon = tone === "rose" ? FileText : tone === "amber" ? Wallet : FileCheck2;
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${box}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function NeedsBoard({
  lang,
  homeHref,
  queueCount,
  dateLabel,
  weekday,
  kpis,
  cards,
  error,
  labels,
}: {
  lang: Lang;
  homeHref: string;
  queueCount: number | null;
  dateLabel: string;
  weekday: string;
  kpis: NeedsKpis;
  cards: NeedsCardModel[];
  error: string | null;
  labels: {
    ask: string;
    askAlt: string;
    approve: string;
    approveAlt: string;
    alert: string;
    alertAlt: string;
    note: string;
    send: string;
    asked: string;
    trail: string;
  };
}) {
  const kpisView: { key: string; label: TranslationKey; alt: TranslationKey; value: string; icon: typeof Sprout; hot?: boolean }[] = [
    { key: "jama", label: "cny_kpi_jama", alt: "cny_kpi_jama_alt", value: kpiText(kpis.aajJama, true), icon: Sprout },
    { key: "stuck", label: "cny_kpi_stuck", alt: "cny_kpi_stuck_alt", value: kpiText(kpis.stuck, false), icon: Hourglass, hot: (kpis.stuck ?? 0) > 0 },
    { key: "manager", label: "cny_kpi_manager", alt: "cny_kpi_manager_alt", value: kpiText(kpis.managerPaas, false), icon: UserRound },
    { key: "verify", label: "cny_kpi_verify", alt: "cny_kpi_verify_alt", value: kpiText(kpis.verifyPending, false), icon: ShieldCheck },
  ];

  return (
    <div data-testid="cash-needs-board" className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07140f] text-white shadow-[0_30px_80px_-36px_rgba(0,0,0,.85)]">
      <div className="grid lg:grid-cols-[248px_minmax(0,1fr)]">
        <CustodyRail lang={lang} homeHref={homeHref} count={queueCount} />
        <div className="min-w-0 p-4 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-[1.7rem]">
                <Pair a="cny_title" b="cny_title_alt" lang={lang} />
              </h1>
              <p className="mt-1 text-sm text-white/60">
                <Pair a="cny_queue" b="cny_queue_alt" lang={lang} altClass="text-white/40" />
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
              <Calendar className="h-4 w-4 text-emerald-300" />
              <span>{dateLabel}</span>
              <span className="text-white/25">|</span>
              <span>{weekday}</span>
            </div>
          </header>

          <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {kpisView.map((k) => {
              const Icon = k.icon;
              return (
                <article
                  key={k.key}
                  data-testid={`cash-kpi-${k.key}`}
                  className={
                    "rounded-2xl border bg-white/[0.04] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] " +
                    (k.hot ? "border-amber-400/70" : "border-white/10")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-white/70">
                      <Pair a={k.label} b={k.alt} lang={lang} altClass="text-white/40" />
                    </p>
                    <span className={"grid h-8 w-8 place-items-center rounded-lg " + (k.hot ? "bg-amber-400/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200")}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 font-display text-2xl font-semibold tabular-nums text-white">{k.value}</p>
                </article>
              );
            })}
          </section>

          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <Pair a="cny_needs" b="cny_needs_alt" lang={lang} altClass="font-normal text-emerald-200/60" />
            </h2>
            {error && (
              <p className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                {t("cny_unread", lang)} {error}
              </p>
            )}
            {!error && cards.length === 0 && (
              <p data-testid="cash-needs-empty" className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/50">
                {t("cny_empty", lang)}
              </p>
            )}
            <ol className="mt-3 space-y-3">
              {cards.map((card) => (
                <li key={card.id} data-testid="cash-needs-card" data-needs-tone={card.tone} className={`rounded-2xl border p-4 ${TONE[card.tone]}`}>
                  <div className="flex gap-3">
                    <CardIcon tone={card.tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-white">
                            <Link href={`/admin/cash-custody/packet/${card.id}`} className="hover:underline">
                              ({card.index}) {card.title}
                            </Link>{" "}
                            <span className="font-normal text-white/45">({card.titleAlt})</span>
                          </h3>
                          <p className="mt-1 text-sm text-white/75">{card.detail}</p>
                          <p className="text-xs text-white/45">{card.detailAlt}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <p className="inline-flex items-center gap-1 text-xs text-white/55">
                            <Clock className="h-3.5 w-3.5" />
                            {card.age}
                          </p>
                          <NeedsActions
                            packetId={card.id}
                            mode={card.mode}
                            askLabel={labels.ask}
                            askAlt={labels.askAlt}
                            approveLabel={labels.approve}
                            approveAlt={labels.approveAlt}
                            alertLabel={labels.alert}
                            alertAlt={labels.alertAlt}
                            notePlaceholder={labels.note}
                            sendLabel={labels.send}
                          />
                        </div>
                      </div>
                      {card.trail && (
                        <p className="mt-3 text-xs leading-relaxed text-emerald-100/70">
                          {labels.trail}: {card.trail}
                        </p>
                      )}
                      {card.askNote && (
                        <p className="mt-2 text-xs text-amber-100/90">
                          {labels.asked}: {card.askNote}
                          {card.askActor ? ` · ${card.askActor}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
