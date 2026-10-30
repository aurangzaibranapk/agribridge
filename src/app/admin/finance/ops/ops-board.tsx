"use client";

import Link from "next/link";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { approveFuelEntry } from "@/actions/fuel";
import { approveGeneratorEntry } from "@/actions/generator";
import { approveMaintenance, branchVerifyMaintenance } from "@/actions/maintenance";
import { ArtLogo } from "@/components/brand/art-logo";
import { BRAND_COPY } from "@/lib/brand";
import { pkr } from "@/lib/recovery/credit-report";
import type { OpsDeskModel, OpsQueueItem, OpsReview } from "@/lib/finance/ops-desk";

const empty = {};

function money(n: number | null): string {
  if (n == null) return "—";
  const neg = n < 0;
  return `${neg ? "− " : ""}Rs ${pkr(Math.abs(n))}`;
}

function ReviewForm({ item }: { item: OpsQueueItem }) {
  const review = item.review;
  if (review.kind === "held") {
    if (review.reason === "self") {
      return <p className="text-xs font-semibold text-amber-200">Apni entry — doosra karega</p>;
    }
    return <p className="text-xs text-white/45">{item.statusLabel}</p>;
  }
  if (review.kind === "open_claims") {
    return (
      <Link href={item.href} className="inline-flex rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-[#062a1e]">
        Qatar par faisla
      </Link>
    );
  }
  return <DecisionForm item={item} review={review} />;
}

function DecisionForm({ item, review }: { item: OpsQueueItem; review: Exclude<OpsReview, { kind: "held" } | { kind: "open_claims" }> }) {
  const action =
    review.kind === "approve_fuel" ? approveFuelEntry : review.kind === "approve_generator" ? approveGeneratorEntry : review.kind === "branch_verify" ? branchVerifyMaintenance : approveMaintenance;
  const [state, formAction] = useFormState(action, empty);
  const idName = review.kind === "approve_fuel" || review.kind === "approve_generator" ? "log_id" : "maintenance_id";
  const commentName = review.kind === "branch_verify" ? "branch_comment" : review.kind === "approve_maintenance" ? "approve_comment" : "approval_comment";
  const label = review.kind === "branch_verify" ? "Branch verify" : "Manzoor";
  return (
    <form action={formAction} className="mt-2 flex flex-col gap-1.5">
      <input type="hidden" name={idName} value={item.id} />
      <input
        name={commentName}
        required
        minLength={5}
        placeholder="Comment (kam az kam 5 harf)"
        className="w-full rounded-lg border border-white/15 bg-black/20 px-2 py-1.5 text-xs text-white placeholder:text-white/35"
      />
      <button type="submit" className="w-fit rounded-xl bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-[#062a1e]">
        {label}
      </button>
      {"error" in state && state.error ? <p className="text-[11px] text-rose-300">{String(state.error)}</p> : null}
      {"success" in state && state.success ? <p className="text-[11px] text-emerald-300">Ho gaya.</p> : null}
    </form>
  );
}

const RAIL = [
  { href: "/admin/finance/ops", label: "Tel aur ops", ur: "تیل اور آپریشن" },
  { href: "/admin/milk-collection/fuel", label: "Route ka tel", ur: "روٹ کا تیل" },
  { href: "/admin/hr/payroll?view=cards", label: "Mazdoor payroll", ur: "مزدور پے رول" },
  { href: "/admin/finance", label: "Cash book", ur: "کیش بک" },
];

export function OpsBoard({ model }: { model: OpsDeskModel }) {
  const brand = BRAND_COPY.rm;
  const payrollStatus =
    model.payroll.status === "none"
      ? "Is mahine ka run nahi"
      : model.payroll.status === "draft"
        ? "Draft"
        : model.payroll.status === "submitted"
          ? "Manzoori baqi"
          : model.payroll.status === "approved"
            ? "Manzoor"
            : model.payroll.status === "paid"
              ? "Ada"
              : model.payroll.read
                ? model.payroll.status ?? "—"
                : "—";

  return (
    <div id="ops-desk" data-testid="ops-desk" className="overflow-hidden rounded-[28px] border border-white/10 bg-[#07140f] text-white shadow-[0_30px_80px_-36px_rgba(0,0,0,.85)]">
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="flex flex-col gap-4 border-b border-white/10 bg-[#0d1c16]/90 p-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <ArtLogo width={28} />
            <div>
              <p className="font-display text-sm font-semibold">{brand.name}</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            {RAIL.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 hover:bg-white/5">
                <span className="block font-medium">{item.label}</span>
                <span className="block text-[11px] text-white/40">{item.ur}</span>
              </Link>
            ))}
          </nav>
          <p className="mt-auto text-[11px] leading-relaxed text-white/40">Finance aur HR — maujooda tel, marammat aur payroll. Alag float nahi.</p>
        </aside>

        <div className="min-w-0 p-4 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Tel aur ops</h1>
              <p className="mt-1 text-sm text-white/60">
                Is mahine ka kharcha aur jo manzoori maangta hai <span className="text-white/35">({model.monthLabel})</span>
              </p>
            </div>
            <Link href={model.payroll.href} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-emerald-200">
              Mazdoor payroll
            </Link>
          </header>

          <section className="mt-5 grid gap-3 md:grid-cols-3">
            {model.cards.map((card) => (
              <article key={card.key} data-testid={`ops-card-${card.key}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{card.title}</h2>
                    <p className="text-[11px] text-emerald-200/70">{card.titleUr}</p>
                  </div>
                  <Link href={card.href} className="text-[11px] text-white/50 hover:text-white">
                    Safha
                  </Link>
                </div>
                <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{money(card.amount)}</p>
                <p className="mt-1 text-xs text-white/50">
                  Manzoori baqi: {card.pending == null ? "—" : card.pending}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-white/70">
                  {card.lines.map((line) => (
                    <li key={line.label} className="flex justify-between gap-2">
                      <span>{line.label}</span>
                      <span className="tabular-nums">{money(line.amount)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-white/35">{card.blurb}</p>
              </article>
            ))}
          </section>

          <section className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Mazdoor — is mahine</h2>
                <p className="text-[11px] text-emerald-100/70">پے رول · {payrollStatus}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold tabular-nums">{money(model.payroll.read ? model.payroll.payable : null)}</p>
                <p className="text-xs text-white/60">Staff: {model.payroll.read ? model.payroll.staff ?? "—" : "—"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link className="rounded-full bg-white/10 px-3 py-1" href={`${model.payroll.href.replace("view=cards", "view=cards")}`}>
                Cards
              </Link>
              <Link className="rounded-full bg-white/10 px-3 py-1" href={model.payroll.href.replace("view=cards", "view=people")}>
                Log
              </Link>
              <Link className="rounded-full bg-white/10 px-3 py-1" href={model.payroll.href.replace("view=cards", "view=tx")}>
                Harkatein
              </Link>
            </div>
          </section>

          {model.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-amber-200">
              {model.notes.map((n) => (
                <li key={n}>{n} Raqam sifar nahi.</li>
              ))}
            </ul>
          )}

          <section className="mt-5">
            <h2 className="font-semibold">Needs you</h2>
            <p className="text-xs text-white/45">Jo entry aap ki manzoori maangti hai. Admin/Owner apni entry bhi kar sakte hain. Baqi apni nahi.</p>
            {model.queue.length === 0 ? (
              <p data-testid="ops-queue-empty" className="mt-3 rounded-2xl border border-white/10 px-4 py-8 text-center text-sm text-white/50">
                Koi khuli manzoori nahi.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {model.queue.map((item) => (
                  <li key={`${item.source}-${item.id}`} data-testid="ops-queue-item" className={`rounded-2xl border p-4 ${item.anomaly ? "border-rose-400/50 bg-rose-950/20" : "border-amber-300/30 bg-amber-950/10"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-white/60">
                          {item.who ?? "—"} · {item.asset ?? "—"} · {item.date || "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{money(item.amount)}</p>
                        <p className="text-[11px] text-amber-100/80">{item.statusLabel}</p>
                      </div>
                    </div>
                    <ReviewForm item={item} />
                    <Link href={item.href} className="mt-2 inline-block text-[11px] text-white/40 hover:text-white">
                      Poora safha
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="border-t border-white/10 p-4 lg:border-l lg:border-t-0">
          <h2 className="font-semibold">Is mahine ki harkatein</h2>
          <p className="text-[11px] text-white/40">Manzoor ya rad ho chuka. Jama nahi.</p>
          {model.movements.length === 0 ? (
            <p className="mt-4 text-sm text-white/45">Is mahine koi faisla nahi.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {model.movements.map((m) => (
                <li key={m.id} className="border-b border-white/10 pb-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{m.title}</p>
                      <p className="text-[11px] text-white/45">{m.detail}</p>
                      <p className="text-[11px] text-white/35">{m.date} · {m.statusLabel}</p>
                    </div>
                    <p className="shrink-0 tabular-nums text-rose-200">{m.amount == null ? "—" : `− ${money(m.amount)}`}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-white/35">
            Doosri app ka wallet ya bank brand is desk par nahi. Cash book apne safhe par hai.
          </p>
        </aside>
      </div>
    </div>
  );
}
