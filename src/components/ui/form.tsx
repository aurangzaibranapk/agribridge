import { cn } from "@/lib/utils/format";
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type LabelHTMLAttributes, forwardRef } from "react";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" }>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
        size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-xs",
        variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "secondary" && "bg-surface-100 text-surface-900 border border-surface-200 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-100 dark:border-surface-700 dark:hover:bg-surface-700",
        variant === "ghost" && "text-surface-800 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900",
        "placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
        "disabled:bg-surface-100 disabled:text-surface-400",
        "dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:placeholder:text-surface-500 dark:disabled:bg-surface-900",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-900",
        "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
        "dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300", className)} {...props} />;
}

export const Textarea = forwardRef<HTMLTextAreaElement, import("react").TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-900",
        "placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
        "dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100 dark:placeholder:text-surface-500",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

const badgeTones = {
  green: "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  amber: "bg-wheat-400/20 text-wheat-600 dark:bg-wheat-500/10 dark:text-wheat-400",
  red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  gray: "bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
} as const;

export function Badge({ tone = "gray", children, className }: { tone?: keyof typeof badgeTones; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}
