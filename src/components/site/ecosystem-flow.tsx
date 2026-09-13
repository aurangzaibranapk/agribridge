/**
 * Qadam ba qadam raasta (kisan ka safar, ERP ka bahaao).
 *
 * Desktop par ye ek qatar mein chalta hai, phone par neeche ki taraf --
 * aur ye grid se khud ho jata hai, do alag naqshe banane ki zarurat
 * nahi.
 *
 * Ginti (01, 02...) jaan boojh kar hai: ye fehrist nahi, TARTEEB hai.
 * Beej pehle aata hai, bazaar baad mein. Bina ginti ke ye sirf aath
 * lafz lagte hain.
 */
export function EcosystemFlow({
  steps,
  tone = "light",
}: {
  steps: string[];
  tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {steps.map((step, i) => (
        <li
          key={step}
          className={
            "rounded-xl border px-3 py-4 text-center " +
            (dark
              ? "border-white/10 bg-white/[0.06]"
              : "border-[#1E4A2E]/10 bg-white dark:border-surface-800 dark:bg-surface-900")
          }
        >
          <span
            className={
              "text-[11px] font-bold " + (dark ? "text-[#E8C767]" : "text-[#A9791A]")
            }
          >
            {String(i + 1).padStart(2, "0")}
          </span>
          <p
            className={
              "mt-1.5 text-sm font-semibold leading-5 " +
              (dark ? "text-white" : "text-surface-900 dark:text-white")
            }
          >
            {step}
          </p>
        </li>
      ))}
    </ol>
  );
}
