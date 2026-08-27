import { cn } from "@/lib/utils/format";
import type { LucideIcon } from "lucide-react";

const gradients = {
  default: "from-surface-500 to-surface-700",
  warn: "from-amber-400 to-orange-500",
  brand: "from-emerald-400 to-emerald-600",
  orange: "from-orange-400 to-red-500",
  blue: "from-sky-400 to-blue-600",
  purple: "from-violet-400 to-purple-600",
  green: "from-green-400 to-green-600",
  red: "from-red-400 to-red-600",
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof gradients;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[110px] flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:shadow-xl",
        gradients[tone]
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/80">{label}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight">{value}</p>
      <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-white/10" />
    </div>
  );
}