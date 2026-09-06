import { cn } from "@/lib/utils/format";

/**
 * Har hisse ka unwan — ek hi shakl mein.
 *
 * `eyebrow` chhota upar wala lafz hai (jaise "Farmer Services"), jo
 * batata hai ke ye hissa kis baare mein hai. Wo isi liye hai ke banda
 * safhe ko poora parhe baghair bhi jaan sake ke wo kahan khaRa hai.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  center = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(center ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A9791A]">{eyebrow}</p>
      )}
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-surface-900 sm:text-4xl dark:text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-7 text-surface-600 dark:text-surface-400">{description}</p>
      )}
    </div>
  );
}
