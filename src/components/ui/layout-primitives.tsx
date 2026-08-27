import { cn } from "@/lib/utils/format";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900", className)}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-surface-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-surface-200 bg-surface-50 py-16 text-center dark:border-surface-700 dark:bg-surface-900">
      <p className="font-medium text-surface-700 dark:text-surface-200">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-surface-500 dark:text-surface-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
