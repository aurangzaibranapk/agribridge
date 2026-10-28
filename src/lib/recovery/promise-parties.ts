import { pkWhatsAppDigits } from "@/lib/hr/id-card-profile";

/**
 * Promise-to-Pay ki party ka naam.
 *
 * Recovery dashboard (`fn_recovery_outstanding` aur money-party load)
 * yahi columns padhta hai: customer.name, farmer.full_name,
 * dealer.business_name, supplier.name — phone har jagah phone_number.
 * payment_promises par sirf party_type + party_id hota hai, is liye
 * naam yahin se jorta hai. Check constraint bhi yahi char qismen.
 *
 * WhatsApp yahan Business API nahi. Card ki tasveer asal reminder hai.
 * wa.me sirf staff ke apne WhatsApp mein usi number ki chat kholta hai,
 * taake wo download ki hui card attach kar sake. Number
 * `pkWhatsAppDigits` se 03xx → 92xx banta hai.
 */

export const PROMISE_PARTY_SOURCES = {
  customer: { table: "customers", name: "name", phone: "phone_number" },
  farmer: { table: "farmers", name: "full_name", phone: "phone_number" },
  dealer: { table: "dealers", name: "business_name", phone: "phone_number" },
  supplier: { table: "suppliers", name: "name", phone: "phone_number" },
} as const;

export type PromisePartyType = keyof typeof PROMISE_PARTY_SOURCES;

export type PromiseParty = {
  name: string | null;
  phone: string | null;
};

type QueryResult = { data: Record<string, unknown>[] | null };

export type PartyLookupDb = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, ids: string[]) => PromiseLike<QueryResult>;
    };
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOCUS_RE = /^(customer|farmer|dealer|supplier):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const CHUNK = 150;

function clean(value: unknown): string | null {
  const text = value == null ? "" : String(value).trim();
  return text || null;
}

/** Recovery dashboard ka wahi reminder raasta. Customer par ?customer= pehle se credit card kholta hai. */
export function promiseRecoveryHref(partyType: string, partyId: string): string {
  if (partyType === "customer") return `/admin/finance/recovery?customer=${partyId}`;
  return `/admin/finance/recovery?focus=${encodeURIComponent(`${partyType}:${partyId}`)}`;
}

/**
 * Recovery list mein kis party ko pehle se chuna hua dikhana hai.
 * `focus=farmer:<uuid>` seedha; `customer=<uuid>` wahi customer.
 */
export function recoveryFocusKey(input: { focus?: string | null; customer?: string | null }): string | null {
  const focus = input.focus?.trim();
  if (focus) {
    const match = FOCUS_RE.exec(focus);
    if (match) return `${match[1].toLowerCase()}:${match[2].toLowerCase()}`;
  }
  const customer = input.customer?.trim();
  if (customer && UUID_RE.test(customer)) return `customer:${customer.toLowerCase()}`;
  return null;
}

/** Focused party jis page par hai, wahi page khule — warna galat banda preview par aa jata. */
export function focusPageIndex(
  parties: { type: string; id: string }[],
  focusKey: string | null,
  pageSize: number,
): { key: string | null; page: number } {
  if (!focusKey || pageSize < 1) return { key: null, page: 0 };
  const want = focusKey.toLowerCase();
  const idx = parties.findIndex((p) => `${p.type}:${p.id}`.toLowerCase() === want);
  if (idx < 0) return { key: null, page: 0 };
  return { key: `${parties[idx].type}:${parties[idx].id}`, page: Math.floor(idx / pageSize) };
}

export async function loadPromiseParties(
  db: PartyLookupDb,
  rows: { party_type: string; party_id: string }[],
): Promise<Map<string, PromiseParty>> {
  const idsByType = new Map<PromisePartyType, string[]>();
  for (const row of rows) {
    if (!PROMISE_PARTY_SOURCES[row.party_type as PromisePartyType] || !row.party_id) continue;
    const type = row.party_type as PromisePartyType;
    const list = idsByType.get(type) ?? [];
    list.push(row.party_id);
    idsByType.set(type, list);
  }

  const directory = new Map<string, PromiseParty>();
  await Promise.all(
    Array.from(idsByType.entries()).map(async ([type, ids]) => {
      const src = PROMISE_PARTY_SOURCES[type];
      const uniq = Array.from(new Set(ids));
      for (let i = 0; i < uniq.length; i += CHUNK) {
        const part = uniq.slice(i, i + CHUNK);
        const { data } = await db.from(src.table).select(`id, ${src.name}, ${src.phone}`).in("id", part);
        for (const hit of data ?? []) {
          const id = clean(hit.id);
          if (!id) continue;
          const name = clean(hit[src.name]);
          const phone = clean(hit[src.phone]);
          if (!name && !phone) continue;
          directory.set(`${type}:${id}`, { name, phone });
        }
      }
    }),
  );
  return directory;
}

export function promisePartyOf(
  directory: Map<string, PromiseParty>,
  partyType: string,
  partyId: string,
): PromiseParty {
  return directory.get(`${partyType}:${partyId}`) ?? { name: null, phone: null };
}

export function promiseMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Table jitna hi grouping. Raqam darj na ho to em dash — sifar jhoot hota. */
export function formatPromiseAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const n = Math.round(value * 100) / 100;
  return n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}

export function formatPromiseDate(iso: string | null | undefined): string {
  const raw = String(iso ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw || "—";
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Card par "Rs …", aur jis raqam ka indraj hi nahi us par dash — sifar nahi. */
export function rsLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `Rs ${formatPromiseAmount(value)}`;
}

/** Chat khulne ki ek chhoti line. Lamba matn card ki tasveer par hai, bubble mein nahi. */
export function promiseChatOpener(name: string | null): string {
  const who = name?.trim();
  return who
    ? `Assalam o Alaikum ${who} sb, Al Rana Traders ki payment reminder card.`
    : "Assalam o Alaikum, Al Rana Traders ki payment reminder card.";
}

/** Staff ke personal WhatsApp ka link. Phone na ban sake to null — khali chat nahi kholte. */
export function promiseWhatsAppHref(phone: string | null, text: string): string | null {
  const digits = pkWhatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Recovery dashboard jitna khata: customer 1100, farmer 1150,
 * dealer 1160, supplier 2000. Credit = wasooli (kul adaigi).
 */
export const RECOVERY_RECEIPT_ACCOUNT: Record<string, string> = {
  customer: "1100",
  farmer: "1150",
  dealer: "1160",
  supplier: "2000",
};

type ReceiptResult = {
  data: { party_type?: string; party_id?: string; credit?: unknown }[] | null;
  error: { message: string } | null;
};

type ReceiptFilter = {
  eq: (column: string, value: string) => ReceiptFilter;
  in: (column: string, values: string[]) => ReceiptFilter;
  gt: (column: string, value: number) => ReceiptFilter;
  range: (from: number, to: number) => PromiseLike<ReceiptResult>;
};

export type ReceiptLookupDb = {
  from: (table: string) => {
    select: (columns: string) => ReceiptFilter;
  };
};

const RECEIPT_PAGE = 1000;
const RECEIPT_CAP = 20000;

/**
 * Kul adaigi. Kamyaabi par map (jo party lines mein na ho wo 0 — dekh liya).
 * Error ya adhoori paging par null — "—" likhen, sifar nahi.
 */
export async function loadPartyReceipts(
  db: ReceiptLookupDb,
  rows: { party_type: string; party_id: string }[],
): Promise<Map<string, number> | null> {
  const idsByType = new Map<string, string[]>();
  for (const row of rows) {
    if (!RECOVERY_RECEIPT_ACCOUNT[row.party_type] || !row.party_id) continue;
    const list = idsByType.get(row.party_type) ?? [];
    list.push(row.party_id);
    idsByType.set(row.party_type, list);
  }
  const totals = new Map<string, number>();
  for (const [type, ids] of idsByType) {
    for (const id of new Set(ids)) totals.set(`${type}:${id}`, 0);
  }
  for (const [type, ids] of idsByType) {
    const code = RECOVERY_RECEIPT_ACCOUNT[type];
    const uniq = Array.from(new Set(ids));
    for (let i = 0; i < uniq.length; i += 150) {
      const part = uniq.slice(i, i + 150);
      let from = 0;
      while (from <= RECEIPT_CAP) {
        const { data, error } = await db
          .from("journal_lines")
          .select("party_type,party_id,credit")
          .eq("party_type", type)
          .eq("account_code", code)
          .in("party_id", part)
          .gt("credit", 0)
          .range(from, from + RECEIPT_PAGE - 1);
        if (error) return null;
        const batch = data ?? [];
        for (const line of batch) {
          const id = clean(line.party_id);
          const n = Number(line.credit);
          if (!id || !Number.isFinite(n)) continue;
          const key = `${type}:${id}`;
          totals.set(key, (totals.get(key) ?? 0) + n);
        }
        if (batch.length < RECEIPT_PAGE) break;
        from += RECEIPT_PAGE;
        if (from > RECEIPT_CAP) return null;
      }
    }
  }
  for (const [key, value] of totals) totals.set(key, Math.round(value * 100) / 100);
  return totals;
}

export function indexOutstanding(
  rows: { party_type?: string; party_id?: string; outstanding?: unknown }[] | null,
): Map<string, number> | null {
  if (!rows) return null;
  const map = new Map<string, number>();
  for (const row of rows) {
    const type = clean(row.party_type);
    const id = clean(row.party_id);
    const n = Number(row.outstanding);
    if (!type || !id || !Number.isFinite(n)) continue;
    map.set(`${type}:${id}`, n);
  }
  return map;
}

/** Map na ho to null (maloom nahi). Party fehrist mein na ho to bhi null — andaaza sifar nahi. */
export function outstandingOf(map: Map<string, number> | null, partyType: string, partyId: string): number | null {
  if (!map) return null;
  const value = map.get(`${partyType}:${partyId}`);
  return value == null ? null : value;
}

/** Map na ho to null. Map ho aur koi credit line na ho to 0 — dekh liya, wasooli nahi. */
export function receivedOf(map: Map<string, number> | null, partyType: string, partyId: string): number | null {
  if (!map) return null;
  return map.get(`${partyType}:${partyId}`) ?? 0;
}
