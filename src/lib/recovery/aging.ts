/**
 * Wasooli (receivables) ka khalis hisaab -- koi database nahi, is liye
 * test ho sakta hai. SQL (migration 523, fn_customer_receivable_aging)
 * bilkul yahi FIFO qaida chalata hai.
 */

export interface RecoverySettings {
  due_days: number;
  reminder_day: number;
  final_notice_day: number;
  block_overdue_credit: boolean;
  default_credit_limit: number | null;
  min_amount: number;
  reminders_enabled: boolean;
}

export const DEFAULT_RECOVERY_SETTINGS: RecoverySettings = {
  due_days: 30,
  reminder_day: 15,
  final_notice_day: 30,
  block_overdue_credit: true,
  default_credit_limit: null,
  min_amount: 100,
  reminders_enabled: false,
};

export interface LedgerLine {
  date: string; // YYYY-MM-DD
  debit: number;
  credit: number;
}

export interface AgingResult {
  balance: number;
  oldestUnpaidDate: string | null;
  oldestDays: number | null;
  dueDate: string | null;
  bucket0to15: number;
  bucket15to30: number;
  bucket30plus: number;
}

const DAY = 86_400_000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * DAY).toISOString().slice(0, 10);
}

/** FIFO: har wapsi sab se purane udhaar ko pehle chukati hai. */
export function computeAging(lines: LedgerLine[], asOf: string, dueDays = 30): AgingResult {
  const inRange = lines.filter((l) => l.date <= asOf);
  const totalCr = inRange.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const debits = inRange
    .filter((l) => (Number(l.debit) || 0) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const balance = r2(inRange.reduce((s, l) => s + (Number(l.debit) || 0) - (Number(l.credit) || 0), 0));

  let cum = 0;
  let oldest: string | null = null;
  let b1 = 0, b2 = 0, b3 = 0;
  for (const d of debits) {
    cum += Number(d.debit);
    const open = Math.max(0, Math.min(Number(d.debit), cum - totalCr));
    if (open <= 0.009) continue;
    if (!oldest) oldest = d.date;
    const age = daysBetween(d.date, asOf);
    if (age < 15) b1 += open;
    else if (age < 30) b2 += open;
    else b3 += open;
  }
  if (balance <= 0.009 || !oldest) {
    return { balance, oldestUnpaidDate: null, oldestDays: null, dueDate: null, bucket0to15: 0, bucket15to30: 0, bucket30plus: 0 };
  }
  return {
    balance,
    oldestUnpaidDate: oldest,
    oldestDays: daysBetween(oldest, asOf),
    dueDate: addDays(oldest, dueDays),
    bucket0to15: r2(b1),
    bucket15to30: r2(b2),
    bucket30plus: r2(b3),
  };
}

/** Kya naya udhaar band hai? (sirf jab 30+ din purana baqaya ho) */
export function isCreditBlocked(
  aging: { balance: number; oldestDays: number | null },
  s: RecoverySettings
): boolean {
  if (!s.block_overdue_credit) return false;
  if (aging.balance < s.min_amount) return false;
  return (aging.oldestDays ?? 0) >= s.due_days;
}

export type ReminderStage = "day15" | "day30";

/** Aaj kaun si yaad-dihani banti hai -- ooncha stage pehle. */
export function reminderStageFor(
  aging: { balance: number; oldestDays: number | null },
  s: RecoverySettings
): ReminderStage | null {
  if (aging.balance < s.min_amount || aging.oldestDays == null) return null;
  if (aging.oldestDays >= s.final_notice_day) return "day30";
  if (aging.oldestDays >= s.reminder_day) return "day15";
  return null;
}

export function formatRs(n: number): string {
  return "Rs " + Math.round(n).toLocaleString("en-PK");
}

export function formatDatePk(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

export function buildReminderMessage(input: {
  stage: ReminderStage;
  customerName: string;
  amount: number;
  dueDate: string;
  shopName: string;
}): string {
  const { customerName, amount, dueDate, shopName } = input;
  if (input.stage === "day15") {
    return (
      `Assalam-o-Alaikum ${customerName} sahib,\n` +
      `${shopName} ki taraf se meharbani se yaad-dihani: aap ke khate mein ${formatRs(amount)} baqi hain. ` +
      `Adaigi ki aakhri tareekh ${formatDatePk(dueDate)} hai. ` +
      `Baraye meharbani waqt par adaigi kar dein. Agar adaigi ho chuki hai to is paighaam ko nazar-andaz kar dein.\n` +
      `Shukriya -- ${shopName}`
    );
  }
  return (
    `Assalam-o-Alaikum ${customerName} sahib,\n` +
    `AAKHRI NOTICE: ${shopName} ke khate mein aap ke ${formatRs(amount)} baqi hain, jin ki aakhri tareekh ${formatDatePk(dueDate)} thi. ` +
    `Baraye meharbani foran adaigi kar dein. Adaigi tak naya udhaar band rahe ga.\n` +
    `Shukriya -- ${shopName}`
  );
}

export function blockMessage(name: string, overdue: number, days: number): string {
  return (
    `"${name}" ka ${formatRs(overdue)} udhaar ${days} din se purana hai (30 din ki hadd guzar chuki). ` +
    `Pehle purana baqaya wasool karein -- naya udhaar band hai. Naqad bikri ho sakti hai. ` +
    `Sirf Admin/Owner wajah likh kar ijazat de sakta hai.`
  );
}
