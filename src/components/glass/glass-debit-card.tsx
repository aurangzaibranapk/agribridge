import { maskFrm } from "@/lib/glass/glass";

/** Green-to-navy debit card (sirf dikhawa). Asal data props se aata hai. */
export function GlassDebitCard({ code, name, balanceLabel, balance, sub, right }: {
  code: string; name: string; balanceLabel: string; balance: string; sub?: string | null; right?: string | null;
}) {
  return (
    <div className="gl-card w-full max-w-[520px] p-6 sm:p-7" style={{ aspectRatio: "85.6/54" }} dir="ltr" data-testid="glass-debit-card">
      <div className="relative z-[1] flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <p className="text-[15px] font-bold sm:text-[17px]">AgriBridge <span className="font-normal opacity-70">Kisan</span></p>
          <p className="text-[10px] opacity-85 sm:text-xs">DEBIT · AgriBridge</p>
        </div>
        <span className="gl-chip" />
        <p className="font-mono text-[17px] font-semibold tracking-[.18em] sm:text-[22px]" data-testid="glass-card-number">{maskFrm(code)}</p>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-wider opacity-75">{balanceLabel}</p>
            <p className="text-[26px] font-extrabold leading-tight sm:text-[34px]" data-testid="glass-card-balance">{balance}</p>
          </div>
          <div className="min-w-0 text-end">
            <p className="text-[10px] opacity-75">KISAN</p>
            <p className="truncate text-sm font-semibold uppercase">{name}</p>
            {sub && <p className="text-[10px] opacity-75">{sub}</p>}
            {right && <p className="text-[10px] opacity-75">{right}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
