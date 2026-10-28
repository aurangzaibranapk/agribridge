/**
 * Al Rana Traders ki payment-reminder card.
 * Corporate statement: safed card, gehra hara header, sona naam.
 * Patte, icon, status, aur Roman Urdu wada line nahi.
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
export const PROMISE_CARD_HEIGHT = 1100;

const FONT = "Inter, 'Segoe UI', Arial, Helvetica, sans-serif";

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
  if (name.length > 42) return 24;
  if (name.length > 32) return 28;
  if (name.length > 22) return 34;
  return 42;
}

function heroSize(amount: string): number {
  if (amount.length > 16) return 40;
  if (amount.length > 12) return 52;
  return 64;
}

function rowSize(amount: string): number {
  if (amount.length > 16) return 16;
  if (amount.length > 13) return 18;
  return 20;
}

/** Branded SVG. Party type yahan naam ki jagah nahi aata. */
export function promiseCardSvg(input: PromiseCardInput): string {
  const name = input.partyName.trim() || "Naam nahi mila";
  const date = input.promiseDate.trim() || "—";
  const promise = input.promiseAmount.trim() || "—";
  const outstanding = input.totalOutstanding.trim() || "—";
  const received = input.totalReceived.trim() || "—";
  const w = PROMISE_CARD_WIDTH;
  const h = PROMISE_CARD_HEIGHT;
  const row = rowSize(outstanding.length > received.length ? outstanding : received);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Al Rana Traders payment reminder for ${esc(name)}">
  <rect width="${w}" height="${h}" fill="#eef0f2"/>
  <rect x="36" y="36" width="828" height="1028" fill="#ffffff"/>
  <rect x="36" y="36" width="828" height="5" fill="#08261c"/>
  <rect x="36" y="41" width="828" height="124" fill="#0f3d2c"/>
  <text x="80" y="92" fill="#d4bc8a" font-family="${FONT}" font-size="14" letter-spacing="3.6" font-weight="600">AL RANA TRADERS</text>
  <text x="80" y="140" fill="#ffffff" font-family="${FONT}" font-size="34" font-weight="700">Payment Reminder</text>
  <text x="80" y="220" fill="#8e99a4" font-family="${FONT}" font-size="13" letter-spacing="1.8" font-weight="600">TO</text>
  <text x="80" y="274" fill="#1b2430" font-family="${FONT}" font-size="${nameSize(name)}" font-weight="700">${esc(name)}</text>
  <line x1="80" y1="316" x2="820" y2="316" stroke="#e6e8eb" stroke-width="1"/>
  <text x="80" y="364" fill="#8e99a4" font-family="${FONT}" font-size="13" letter-spacing="1.6" font-weight="600">PROMISE DATE</text>
  <text x="80" y="406" fill="#1b2430" font-family="${FONT}" font-size="22" font-weight="700">${esc(date)}</text>
  <text x="470" y="364" fill="#8e99a4" font-family="${FONT}" font-size="13" letter-spacing="1.6" font-weight="600">REFERENCE</text>
  <text x="470" y="406" fill="#1b2430" font-family="${FONT}" font-size="22" font-weight="700">Promise to Pay</text>
  <line x1="80" y1="448" x2="820" y2="448" stroke="#e6e8eb" stroke-width="1"/>
  <text x="80" y="500" fill="#8e99a4" font-family="${FONT}" font-size="13" letter-spacing="1.6" font-weight="600">PROMISED AMOUNT</text>
  <text x="80" y="576" fill="#14633c" font-family="${FONT}" font-size="${heroSize(promise)}" font-weight="700">${esc(promise)}</text>
  <rect x="80" y="612" width="740" height="160" fill="#f4f6f7" stroke="#e4e7ea" stroke-width="1"/>
  <text x="108" y="658" fill="#6b7380" font-family="${FONT}" font-size="18" font-weight="400">Total outstanding</text>
  <text x="792" y="658" fill="#1b2430" font-family="${FONT}" font-size="${row}" font-weight="700" text-anchor="end">${esc(outstanding)}</text>
  <line x1="108" y1="692" x2="792" y2="692" stroke="#e4e7ea" stroke-width="1"/>
  <text x="108" y="738" fill="#6b7380" font-family="${FONT}" font-size="18" font-weight="400">Total payment received</text>
  <text x="792" y="738" fill="#1b2430" font-family="${FONT}" font-size="${row}" font-weight="700" text-anchor="end">${esc(received)}</text>
  <text x="80" y="836" fill="#1b2430" font-family="${FONT}" font-size="20" font-weight="400">Please settle the promised amount by the date above.</text>
  <text x="80" y="874" fill="#1b2430" font-family="${FONT}" font-size="20" font-weight="400">Thank you for your continued business.</text>
  <line x1="80" y1="928" x2="820" y2="928" stroke="#e6e8eb" stroke-width="1"/>
  <text x="80" y="972" fill="#9aa3ad" font-family="${FONT}" font-size="16" font-weight="500">Al Rana Traders · Accounts</text>
  <text x="80" y="1006" fill="#b4bcc4" font-family="${FONT}" font-size="15" font-weight="400">This is an official payment reminder.</text>
</svg>`;
}

export function promiseCardFileSlug(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "party";
}
