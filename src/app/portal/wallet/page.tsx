import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, CalendarClock, Hourglass, Landmark, Milk, ShieldCheck, Smartphone, Store, Download, Wallet as WalletIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { WalletView } from "@/components/wallet/wallet-view";
import { checkFarmerVerification } from "@/lib/utils/verification-gate";
import { VerificationGateMessage } from "@/components/portal/verification-gate-message";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { loadKhata } from "@/lib/portal/khata-load";
import {
  agingBars, breakdown, creditUse, filterStatement, parseRange, promiseProgress, qs, rangePresets, rs, sourceCards,
  statementTotals, STATEMENT_FILTERS,
} from "@/lib/portal/khata";
import { Badge, Card, CardHead, HeroPill, SourceCard, longDate, shortDate } from "@/components/portal/khata/khata-parts";
import { StatementTable } from "@/components/portal/khata/statement-table";
import { loadKisanWalletV2 } from "@/lib/portal/kisan-wallet-load";
import { KisanWalletV2 } from "@/components/portal/kisan-wallet/kisan-wallet-v2";
import { kisanWalletV2Enabled, showWalletV2, wt } from "@/lib/portal/kisan-wallet";

export const dynamic = "force-dynamic";

const BAND_TONE: Record<string, string> = { platinum: "violet", gold: "amber", silver: "slate", bronze: "amber", low: "rose" };
const CAT_BAR: Record<string, string> = {
  karyana: "bg-orange-500", khaad: "bg-green-600", vets: "bg-pink-500", dukaan: "bg-rose-500", naqad: "bg-amber-500",
  purana: "bg-slate-500", doodh: "bg-sky-500", gandum: "bg-lime-600", machinery: "bg-yellow-500", qist: "bg-violet-500", deegar: "bg-surface-400",
};

export default async function FarmerWalletPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const supabase = createClient();
  const lang = getLanguageFromCookies();
  const L = (k: TranslationKey) => t(k, lang);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");
  const gate = await checkFarmerVerification(farmer.id);
  if (!gate.allowed) {
    return <VerificationGateMessage reason={gate.reason!} />;
  }

  // Kisan Wallet v2 (flag KISAN_WALLET_V2) -- band ho to neeche purana safha bilkul waisa hi.
  const v2Flag = kisanWalletV2Enabled();
  if (showWalletV2(process.env, searchParams?.look)) {
    const v2 = await loadKisanWalletV2(farmer.id);
    if (v2) return <KisanWalletV2 lang={lang} data={v2.data} qr={v2.qr} links={v2.links} />;
  }

  const range = parseRange(searchParams ?? {});
  const [{ summary: s, rows: allRows }, walletRes] = await Promise.all([
    loadKhata(range.from, range.to),
    supabase.from("wallets").select("id, balance, held_balance").eq("owner_type", "farmer").eq("owner_id", farmer.id).maybeSingle(),
  ]);
  const wallet = walletRes.data;
  const { data: transactions } = wallet
    ? await supabase
        .from("wallet_transactions")
        .select("id, type, direction, amount, balance_after, notes, created_at")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const asOf = s?.as_of || new Date().toISOString().slice(0, 10);
  const year = Number(asOf.slice(0, 4));
  const rows = filterStatement(allRows, range.filter);
  const totals = statementTotals(rows);
  const cards = s ? sourceCards(s) : null;
  const parts = s ? breakdown(s) : [];
  const maxPart = Math.max(1, ...parts.map((p) => Math.abs(p.balance)));
  const credit = s ? creditUse(s) : null;
  const owed = s?.owed ?? 0;
  const heroTone = owed > 0 ? "from-rose-700 via-red-600 to-orange-600" : "from-emerald-700 via-green-600 to-teal-600";
  const presets = rangePresets(asOf);
  const keep = { from: range.from, to: range.to };
  const pdfHref = `/portal/wallet/statement${qs({ ...keep, f: range.filter === "all" ? null : range.filter })}`;
  const pmCh = s?.promise?.channel === "signed" ? "pk_ch_signed" : s?.promise?.channel === "otp" ? "pk_ch_otp" : "pk_ch_verbal";
  const signed = (v: number) => (v > 0 ? `${rs(v)} ${L("pk_owed_short")}` : v < 0 ? `${rs(-v)} ${L("pk_receive_short")}` : rs(0));

  const showOldWallet = !!(wallet && (Number(wallet.balance ?? 0) !== 0 || Number(wallet.held_balance ?? 0) !== 0 || (transactions ?? []).length > 0));
  const oldWallet = showOldWallet && wallet ? (
    <Card>
            <CardHead title={L("pk_wallet")} right={<WalletIcon className="h-4 w-4 text-surface-400" />} />
            <WalletView
              lang={lang}
              balance={Number(wallet.balance ?? 0)}
              heldBalance={Number(wallet.held_balance ?? 0)}
              transactions={(transactions ?? []).map((tx) => ({ ...tx, amount: Number(tx.amount), balance_after: Number(tx.balance_after) }))}
            />
          </Card>
  ) : null;

  return (
    <div className="pf-fit mx-auto w-full max-w-[1760px] space-y-5 px-4 py-6 sm:px-6 fit:gap-2.5 fit:space-y-0 fit:py-3">
      {v2Flag && (
        <div className="flex justify-end print:hidden">
          <Link href="/portal/wallet" className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white dark:bg-indigo-600">{wt("newLook", lang)}</Link>
        </div>
      )}
      <div className="space-y-5 fit:grid fit:grid-cols-[1.15fr_2fr] fit:gap-2.5 fit:space-y-0">
      {/* Hero */}
      <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-r ${heroTone} p-6 text-white shadow-lg fit:rounded-2xl fit:px-4 fit:py-3`}>
        <span className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm text-white/85">{L("pk_hero_eyebrow")}</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight fit:mt-0 fit:text-3xl">{rs(Math.abs(owed))}</p>
            <p className="mt-1 text-sm text-white/90">
              {owed > 0 ? L("pk_you_owe") : owed < 0 ? L("pk_we_owe") : L("pk_settled")} · {L("pk_as_of").replace("{d}", longDate(asOf, lang))}
            </p>
            {s && (
              <div className="mt-3 flex flex-wrap gap-2 text-[12px] fit:mt-2 fit:gap-1.5 fit:text-[11px]">
                {s.promise && (
                  <HeroPill>
                    <CalendarClock className="h-3.5 w-3.5" /> {L("pk_pill_promise")}: {rs(s.promise.amount)} · {shortDate(s.promise.date, lang, year)}
                  </HeroPill>
                )}
                {s.aging.oldest_days != null && owed > 0 && (
                  <HeroPill>
                    <Hourglass className="h-3.5 w-3.5" /> {L("pk_pill_oldest")}: {s.aging.oldest_days} {L("pk_days")}
                  </HeroPill>
                )}
                {s.credit_limit > 0 && <HeroPill>{L("pk_pill_limit")} {rs(s.credit_limit)}</HeroPill>}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 print:hidden fit:flex-col">
            <a href="#adaigi" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow hover:bg-rose-50">
              <Banknote className="h-4 w-4" /> {L("pk_btn_pay")}
            </a>
            <Link href={pdfHref} className="inline-flex items-center gap-2 rounded-xl border border-white/50 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
              <Download className="h-4 w-4" /> {L("pk_btn_pdf")}
            </Link>
          </div>
        </div>
      </section>
      {s && (
            // Char source cards
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 fit:grid-cols-2 fit:gap-2.5">
              <SourceCard tone="rose" label={L("pk_card_shop")} value={rs(Math.abs(cards!.shop))} sub={cards!.shop === 0 ? L("pk_card_none") : cards!.shop < 0 ? signed(cards!.shop) : L("pk_card_shop_sub")} href={`${qs({ ...keep, f: "udhaar" })}#statement`} />
              <SourceCard tone="sky" label={L("pk_card_milk")} value={rs(Math.abs(cards!.milk))} sub={cards!.milk === 0 ? L("pk_card_milk_none") : signed(cards!.milk)} href={`${qs({ ...keep, f: "doodh" })}#statement`} />
              <SourceCard tone="lime" label={L("pk_card_grain")} value={rs(Math.abs(cards!.grain))} sub={cards!.grain === 0 ? L("pk_card_none") : signed(cards!.grain)} href={`${qs({ ...keep, f: "gandum" })}#statement`} />
              <SourceCard
                tone="violet"
                label={L("pk_card_qist")}
                value={cards!.qistRemaining == null ? "—" : rs(cards!.qistRemaining)}
                sub={cards!.qistRemaining == null ? L("pk_card_qist_none") : cards!.qistNext ? `${L("pk_card_qist_next")}: ${shortDate(cards!.qistNext, lang, year)}` : L("pk_card_none")}
              />
            </section>
      )}
      </div>

      {!s ? (
        <Card><p className="text-sm text-surface-600 dark:text-slate-300">{L("pk_no_khata")}</p></Card>
      ) : (
        <>

          <div className="pf-grow pf-grid grid gap-5 lg:grid-cols-3 fit:gap-2.5">
            <div className="space-y-5 lg:col-span-2 fit:flex fit:min-h-0 fit:flex-col fit:space-y-0">
              {/* Statement */}
              <Card id="statement" className="pf-panel fit:flex-1 fit:p-3.5">
                <CardHead
                  title={L("pk_statement")}
                  sub={`${L("pk_statement_sub")} · ${rows.filter((r) => !r.is_opening).length} ${L("pk_rows")}`}
                  right={
                    <div className="flex flex-wrap gap-1.5">
                      {STATEMENT_FILTERS.map((f) => (
                        <Link
                          key={f}
                          href={`${qs({ ...keep, f: f === "all" ? null : f }) || "?"}#statement`}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${range.filter === f ? "border-green-600 bg-green-600 text-white" : "border-surface-200 text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-slate-300 dark:hover:bg-surface-800"}`}
                        >
                          {L(`pk_f_${f}` as TranslationKey)}
                        </Link>
                      ))}
                    </div>
                  }
                />
                {/* Tareekh filter */}
                <form method="get" action="#statement" className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-surface-50 p-3 text-xs dark:bg-surface-800/50 fit:mb-2 fit:p-2">
                  {range.filter !== "all" && <input type="hidden" name="f" value={range.filter} />}
                  <label className="flex flex-col gap-1 text-surface-600 dark:text-slate-300">
                    {L("pk_from")}
                    <input type="date" name="from" defaultValue={range.from ?? ""} className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-white dark:[color-scheme:dark]" />
                  </label>
                  <label className="flex flex-col gap-1 text-surface-600 dark:text-slate-300">
                    {L("pk_to")}
                    <input type="date" name="to" defaultValue={range.to ?? ""} className="rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-surface-900 dark:border-surface-700 dark:bg-surface-900 dark:text-white dark:[color-scheme:dark]" />
                  </label>
                  <button type="submit" className="rounded-lg bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">{L("pk_apply")}</button>
                  <div className="ms-auto flex flex-wrap gap-1.5">
                    {presets.map((p) => {
                      const active = (p.from ?? null) === range.from && (p.to ?? null) === range.to;
                      return (
                        <Link key={p.key} href={`${qs({ from: p.from, to: p.to, f: range.filter === "all" ? null : range.filter }) || "?"}#statement`}
                          className={`rounded-lg px-2.5 py-1.5 font-semibold ${active ? "bg-surface-900 text-white dark:bg-white dark:text-surface-900" : "text-surface-600 hover:bg-white dark:text-slate-300 dark:hover:bg-surface-900"}`}>
                          {L(`pk_p_${p.key}` as TranslationKey)}
                        </Link>
                      );
                    })}
                  </div>
                </form>
                {rows.filter((r) => !r.is_opening).length === 0 && !rows.some((r) => r.is_opening) ? (
                  <p className="py-8 text-center text-sm text-surface-500 dark:text-slate-400">{L("pk_no_rows")}</p>
                ) : (
                  <div className="pf-body"><StatementTable rows={rows} totals={totals} lang={lang} year={year} /></div>
                )}
              </Card>

            </div>

            <div className="pf-scroll space-y-5 fit:space-y-2.5">
              {/* Umar */}
              <Card>
                <CardHead title={L("pk_aging")} right={<span className="text-xs text-surface-500 dark:text-slate-400">{L("pk_aging_tag")}</span>} />
                {owed <= 0 ? (
                  <p className="text-sm text-surface-500 dark:text-slate-400">{L("pk_aging_none")}</p>
                ) : (
                  <div className="space-y-3">
                    {agingBars(s.aging).map((b) => (
                      <div key={b.key}>
                        <div className="flex justify-between text-[13px] text-surface-700 dark:text-slate-200">
                          <span>{L(b.key === "d0_15" ? "pk_age_0_15" : b.key === "d16_30" ? "pk_age_16_30" : "pk_age_30")}</span>
                          <span className="font-bold text-surface-900 dark:text-white">{rs(b.amount)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                          <div className={`h-full rounded-full ${b.tone}`} style={{ width: `${b.pct}%` }} />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-surface-500 dark:text-slate-400">{L("pk_aging_note")}</p>
                  </div>
                )}
              </Card>

              {/* Wada */}
              <Card>
                <CardHead
                  title={L("pk_promise")}
                  right={s.promise ? <Badge tone={s.promise.days_left < 0 ? "rose" : "indigo"}>{s.promise.days_left < 0 ? L("pk_promise_late") : L("pk_promise_open")}</Badge> : undefined}
                />
                {s.promise ? (
                  <>
                    <p className="text-2xl font-bold text-surface-900 dark:text-white">{rs(s.promise.amount)}</p>
                    <p className="text-xs text-surface-500 dark:text-slate-400">
                      {L("pk_due_on").replace("{d}", longDate(s.promise.date, lang))} · {L(pmCh as TranslationKey)} · {Math.max(0, s.promise.days_left)} {L("pk_promise_left")}
                      {s.promise.fulfilled > 0 ? ` · ${rs(s.promise.fulfilled)} ${L("pk_promise_paid")}` : ""}
                    </p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(3, promiseProgress(s.promise, asOf))}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-surface-500 dark:text-slate-400">{L("pk_promise_none")}</p>
                )}
              </Card>

              {/* Had aur darja */}
              <Card>
                <CardHead
                  title={L("pk_credit")}
                  right={s.score?.band ? <Badge tone={BAND_TONE[s.score.band] ?? "slate"}>{L(`pmd_band_${s.score.band}` as TranslationKey)}</Badge> : undefined}
                />
                {credit && credit.limit > 0 ? (
                  <>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold text-surface-900 dark:text-white">{rs(credit.limit)}</p>
                      <p className="text-xs text-surface-500 dark:text-slate-400">{credit.pct}% {L("pk_credit_used")}</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                      <div className={`h-full rounded-full ${credit.pct > 80 ? "bg-rose-500" : credit.pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(2, credit.pct)}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800/60"><p className="text-surface-500 dark:text-slate-400">{L("pk_credit_used")}</p><p className="font-bold text-surface-900 dark:text-white">{rs(credit.used)}</p></div>
                      <div className="rounded-lg bg-surface-50 p-2 dark:bg-surface-800/60"><p className="text-surface-500 dark:text-slate-400">{L("pk_credit_avail")}</p><p className="font-bold text-emerald-600 dark:text-emerald-300">{rs(credit.available)}</p></div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-surface-500 dark:text-slate-400">{L("pk_credit_none")}</p>
                )}
                <div className="mt-3 flex items-center justify-between rounded-xl border border-surface-200 p-3 text-xs dark:border-surface-700">
                  <span className="flex items-center gap-2 text-surface-600 dark:text-slate-300"><ShieldCheck className="h-4 w-4 text-violet-500" />{L("pk_score")}</span>
                  <span className="font-bold text-surface-900 dark:text-white">
                    {s.score?.score != null ? `${s.score.score}/100` : L("pk_score_none")}
                    {s.level ? ` · ${L(`pmd_level_${s.level}` as TranslationKey)}` : ""}
                  </span>
                </div>
                {s.last_payment && (
                  <p className="mt-2 text-xs text-surface-500 dark:text-slate-400">
                    {L("pk_last_payment")}: <span className="font-semibold text-emerald-600 dark:text-emerald-300">{rs(s.last_payment.amount)}</span> · {shortDate(s.last_payment.date, lang, year)}
                  </p>
                )}
              </Card>

              {/* Qism-waar */}
              <Card>
                <CardHead title={L("pk_breakdown")} sub={L("pk_breakdown_sub")} />
                {parts.length === 0 ? (
                  <p className="text-sm text-surface-500 dark:text-slate-400">{L("pk_card_none")}</p>
                ) : (
                  <ul className="space-y-3">
                    {parts.map((p) => (
                      <li key={p.category}>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-semibold text-surface-800 dark:text-slate-100">{L(`pk_cat_${p.category}` as TranslationKey)}</span>
                          <span className={`font-bold ${p.balance > 0 ? "text-rose-600 dark:text-rose-300" : p.balance < 0 ? "text-emerald-600 dark:text-emerald-300" : "text-surface-500"}`}>{signed(p.balance)}</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                          <div className={`h-full rounded-full ${CAT_BAR[p.category] ?? "bg-surface-400"}`} style={{ width: `${Math.max(3, Math.round((Math.abs(p.balance) / maxPart) * 100))}%` }} />
                        </div>
                        <p className="mt-0.5 text-[11px] text-surface-500 dark:text-slate-400">
                          {L("pk_f_udhaar")} {rs(p.udhaar)} · {L("pk_f_adaigi")} {rs(p.adaigi)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {/* Adaigi ke tareeqe */}
              <Card id="adaigi">
                <CardHead title={L("pk_pay_ways")} />
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { k: "pk_pay_easypaisa", i: <Smartphone className="h-4 w-4" />, c: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" },
                    { k: "pk_pay_bank", i: <Landmark className="h-4 w-4" />, c: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" },
                    { k: "pk_pay_milk", i: <Milk className="h-4 w-4" />, c: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200" },
                    { k: "pk_pay_cash", i: <Store className="h-4 w-4" />, c: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200" },
                  ].map((w) => (
                    <div key={w.k} className="flex items-center gap-2.5 rounded-xl border border-surface-200 bg-surface-50 p-3 text-[12.5px] font-semibold text-surface-800 dark:border-surface-700 dark:bg-surface-800/60 dark:text-slate-100">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${w.c}`}>{w.i}</span>
                      <span className="leading-tight">{L(w.k as TranslationKey)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-surface-500 dark:text-slate-400">{L("pk_pay_note")}</p>
              </Card>
              {oldWallet}
            </div>
          </div>
        </>
      )}
      {/* Purana digital wallet -- hataya nahi; khata na ho to yahan */}
      {!s && oldWallet}

    </div>
  );
}
