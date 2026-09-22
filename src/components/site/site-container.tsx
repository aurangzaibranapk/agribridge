import { cn } from "@/lib/utils/format";

/**
 * Safhe ki chaurai — ek jagah se.
 *
 * Har safhe par `mx-auto max-w-7xl px-4 sm:px-6 lg:px-8` dohrane se
 * ek din koi safha doosron se hat jata hai, aur wo farq nazar bhi nahi
 * aata jab tak dono safhe sath rakh kar na dekhe jayein.
 */
export function SiteContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
