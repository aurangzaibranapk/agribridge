/**
 * WhatsApp len-den alert (txn_alert template) ke 7 khane.
 *
 * Template ka matn (Meta mein manzoor shuda, Utility, English):
 *
 *   AgriBridge Alert - Al Rana Traders
 *   {{1}}: Rs {{2}}
 *   Party: {{3}}
 *   Account: {{4}}
 *   Date: {{5}}
 *   Ref: {{6}}
 *   Detail: {{7}}
 *   Ye khud-kaar paighaam hai.
 *
 * Meta template ke khane mein naya line, tab ya 4 se zyada khali jagah
 * qubool nahi karta -- is liye har khana saaf kiya jata hai.
 */
export interface TxnAlertRow {
  id: string;
  entry_number: string | null;
  entry_date: string | null;
  alert_type: string;
  amount: number | string;
  party_label: string | null;
  account_label: string | null;
  detail: string | null;
  created_at: string;
}

function clean(value: unknown, max = 120): string {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatPkr(amount: number | string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Entry ki tareekh + darj hone ka waqt (PKT). */
export function formatAlertDate(row: Pick<TxnAlertRow, "entry_date" | "created_at">): string {
  const created = new Date(row.created_at);
  const time = created.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
  });
  let date: string;
  if (row.entry_date) {
    const [y, m, d] = row.entry_date.slice(0, 10).split("-");
    date = `${d}-${m}-${y}`;
  } else {
    date = created.toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" }).replace(/\//g, "-");
  }
  return `${date} (darj ${time} PKT)`;
}

export function buildTxnAlertParams(row: TxnAlertRow): string[] {
  return [
    clean(row.alert_type, 40),
    clean(formatPkr(row.amount), 30),
    clean(row.party_label, 80),
    clean(row.account_label, 120),
    clean(formatAlertDate(row), 40),
    clean(row.entry_number, 40),
    clean(row.detail, 160),
  ];
}
