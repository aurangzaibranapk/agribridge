import { Check, ChevronRight } from "lucide-react";

/**
 * "Agla qadam" ki patti (Guided ERP, B). Har process ek hi shakl mein:
 * jo ho gaya ✓, jo abhi hai (roshan), jo aage hai (halka). Staff ko
 * raasta yaad nahi rakhna paRta.
 */
export interface Step {
  label: string;
  state: "done" | "current" | "todo";
  href?: string;
}

export function NextStepStrip({ steps, compact = false }: { steps: Step[]; compact?: boolean }) {
  return (
    <ol className={`flex flex-wrap items-center gap-y-1 ${compact ? "text-[11px]" : "text-xs"}`}>
      {steps.map((s, i) => (
        <li key={i} className="flex items-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
              s.state === "done"
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : s.state === "current"
                  ? "bg-brand-600 font-medium text-white"
                  : "bg-surface-100 text-surface-400 dark:bg-surface-800"
            }`}
          >
            {s.state === "done" && <Check className="h-3 w-3" />}
            {s.href && s.state === "current" ? <a href={s.href}>{s.label}</a> : s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 text-surface-300" />}
        </li>
      ))}
    </ol>
  );
}

/** Supplier purchase ka raasta: draft → manzoori → maal ginna → product setup → sale ready. */
export function purchaseSteps(
  p: { status: string; review_status: string },
  labels: { draft: string; approval: string; receive: string; setup: string; ready: string },
  setupPending: boolean
): Step[] {
  const cancelled = p.status === "cancelled" || p.review_status === "rejected";
  const received = p.status === "received";
  const approved = p.review_status === "approved";
  if (cancelled) return [{ label: labels.draft, state: "done" }, { label: labels.approval, state: "current" }];
  return [
    { label: labels.draft, state: "done" },
    { label: labels.approval, state: approved ? "done" : "current" },
    { label: labels.receive, state: received ? "done" : approved ? "current" : "todo" },
    { label: labels.setup, state: received ? (setupPending ? "current" : "done") : "todo", href: "/admin/products/setup" },
    { label: labels.ready, state: received && !setupPending ? "done" : "todo" },
  ];
}
