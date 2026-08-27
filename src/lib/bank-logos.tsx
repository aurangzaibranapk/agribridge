// Maps a finance_accounts.name to the matching bank logo file in
// /public/bank-logos - matched by looking for the bank's short name
// anywhere in the account name (so "HBL Current Account" still matches).
const BANK_LOGO_MAP: Record<string, string> = {
  hbl: "/bank-logos/hbl.png",
  habib: "/bank-logos/hbl.png",
  ubl: "/bank-logos/ubl.png",
  united: "/bank-logos/ubl.png",
  alfalah: "/bank-logos/alfalah.png",
  faysal: "/bank-logos/faysal.png",
  bop: "/bank-logos/bop.png",
  punjab: "/bank-logos/bop.png",
};
export function getBankLogo(accountName: string): string | null {
  const normalized = accountName.toLowerCase();
  for (const key of Object.keys(BANK_LOGO_MAP)) {
    if (normalized.includes(key)) return BANK_LOGO_MAP[key];
  }
  return null;
}
export function BankLogo({ name, size = 16 }: { name: string; size?: number }) {
  const src = getBankLogo(name);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={name}
      className="shrink-0 object-contain"
      style={{ height: size, width: "auto", maxWidth: size * 2.2 }}
    />
  );
}