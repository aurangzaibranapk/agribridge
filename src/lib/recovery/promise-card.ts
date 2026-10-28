/**
 * Al Rana Traders ki payment-reminder card.
 * Tasveer hi reminder hai — plain-text bubble nahi.
 * Numbers pehle se format hon (`Rs …` ya "—").
 */

export type PromiseCardInput = {
  partyName: string;
  promiseDate: string;
  promiseAmount: string;
  totalOutstanding: string;
  totalReceived: string;
};

export const PROMISE_CARD_WIDTH = 900;
export const PROMISE_CARD_HEIGHT = 1280;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

function nameSize(name: string): number {
  if (name.length > 28) return 30;
  if (name.length > 18) return 36;
  return 46;
}

function heroSize(amount: string): number {
  if (amount.length > 16) return 40;
  if (amount.length > 12) return 48;
  return 58;
}

function sideSize(amount: string): number {
  if (amount.length > 14) return 24;
  if (amount.length > 11) return 28;
  return 32;
}

/** Branded SVG. Party type yahan naam ki jagah nahi aata. */
export function promiseCardSvg(input: PromiseCardInput): string {
  const name = input.partyName.trim() || "Naam nahi mila";
  const greet = name === "Naam nahi mila" ? "Assalam o Alaikum" : `Assalam o Alaikum ${name} sb`;
  const date = input.promiseDate.trim() || "—";
  const promise = input.promiseAmount.trim() || "—";
  const outstanding = input.totalOutstanding.trim() || "—";
  const received = input.totalReceived.trim() || "—";
  const w = PROMISE_CARD_WIDTH;
  const h = PROMISE_CARD_HEIGHT;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Al Rana Traders payment reminder for ${esc(name)}">
  <rect width="${w}" height="${h}" fill="#f4f1e8"/>
  <rect width="${w}" height="300" fill="#174d2b"/>
  <circle cx="820" cy="40" r="120" fill="#1f6b3a"/>
  <circle cx="70" cy="260" r="90" fill="#145c32"/>
  <rect y="300" width="${w}" height="10" fill="#d9a62e"/>
  <text x="56" y="78" fill="#f3e6c0" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="4" font-weight="700">AL RANA TRADERS</text>
  <text x="56" y="148" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700">Payment Reminder</text>
  <text x="56" y="196" fill="#d6ebda" font-family="Arial, Helvetica, sans-serif" font-size="22">Quality inputs · Stronger yields</text>
  <text x="56" y="248" fill="#f3e6c0" font-family="Arial, Helvetica, sans-serif" font-size="20">${esc(greet)}</text>
  <rect x="40" y="340" width="820" height="900" rx="28" fill="#ffffff"/>
  <text x="72" y="420" fill="#68736b" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="2">PARTY</text>
  <text x="72" y="478" fill="#123c22" font-family="Arial, Helvetica, sans-serif" font-size="${nameSize(name)}" font-weight="700">${esc(name)}</text>
  <text x="72" y="560" fill="#68736b" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="2">PROMISE DATE</text>
  <text x="72" y="608" fill="#17221a" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700">${esc(date)}</text>
  <rect x="72" y="650" width="756" height="210" rx="22" fill="#eaf5ec"/>
  <text x="100" y="704" fill="#1f6b3a" font-family="Arial, Helvetica, sans-serif" font-size="16" letter-spacing="2">THIS PROMISE</text>
  <text x="100" y="790" fill="#174d2b" font-family="Arial, Helvetica, sans-serif" font-size="${heroSize(promise)}" font-weight="700">${esc(promise)}</text>
  <rect x="72" y="890" width="360" height="150" rx="18" fill="#f7f8f5"/>
  <text x="96" y="930" fill="#68736b" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="1">TOTAL OUTSTANDING</text>
  <text x="96" y="954" fill="#1f6b3a" font-family="Arial, Helvetica, sans-serif" font-size="13">still to collect</text>
  <text x="96" y="1004" fill="#17221a" font-family="Arial, Helvetica, sans-serif" font-size="${sideSize(outstanding)}" font-weight="700">${esc(outstanding)}</text>
  <rect x="468" y="890" width="360" height="150" rx="18" fill="#fff8e8"/>
  <text x="492" y="930" fill="#68736b" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="1">TOTAL PAYMENT</text>
  <text x="492" y="954" fill="#b88722" font-family="Arial, Helvetica, sans-serif" font-size="13">already received</text>
  <text x="492" y="1004" fill="#174d2b" font-family="Arial, Helvetica, sans-serif" font-size="${sideSize(received)}" font-weight="700">${esc(received)}</text>
  <text x="72" y="1105" fill="#17221a" font-family="Arial, Helvetica, sans-serif" font-size="24">Meherbani karke apna wada poora karein.</text>
  <text x="72" y="1148" fill="#17221a" font-family="Arial, Helvetica, sans-serif" font-size="24">Shukriya.</text>
  <text x="72" y="1196" fill="#1f6b3a" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">— Al Rana Traders</text>
</svg>`;
}

export function promiseCardFileSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "party";
}
