import { createServiceClient } from "@/lib/supabase/service";

/**
 * AgriBridge Inbox — bahar se aane wala kaam, ek jagah.
 *
 * Malik ka naqsha (5 September): *"Har banda → apna simple dashboard.
 * Har channel → same ERP. Har request → AI samjhe. Har action → existing
 * workflow."* Us naqshe ka bara hissa pehle se bana hua hai — Command
 * Center, Mera Kaam, department workspaces, approvals, audit. Jo cheez
 * WAQAI nahi thi wo yehi hai: **ek darwaza**.
 *
 * Aaj bahar se kaam AATH alag jaghon par girta hai, aur har ek ka apna
 * safha hai:
 *
 *   WhatsApp se staff ka bheja hua  -> whatsapp_submissions
 *   AI ka banaya hua draft          -> bridge_ai_action_requests
 *   Website ka rabta form           -> contact_messages
 *   Marketplace ka order            -> agri_orders
 *   Ijazat ki darkhwast             -> access_requests
 *   Behtari ki tajweez              -> suggestions
 *
 * In mein se koi bhi ek safha khulne tak intezar karta hai. Jo safha
 * kisi ne aaj nahi khola, us mein para kaam kisi ko nazar nahi aata --
 * aur "kisi ko nazar nahi aaya" is project mein sab se mehnga masla
 * hai.
 *
 * Ye file NAYA data nahi banati. Ek bhi nayi table nahi. Ye sirf wohi
 * qatarein ikattha kar ke ek shakal mein laati hai, aur har ek ke sath
 * WO SAFHA jahan us ka kaam hota hai.
 *
 * -------------------------------------------------------------------
 * DO USOOL:
 *
 * 1. **Ginti nahi, qatar.** `needs-attention.ts` pehle se ginti deta hai
 *    ("das purchase manzoori ke muntazir hain"). Ginti bata deti hai ke
 *    kaam hai; wo ye nahi batati ke kaam KYA hai. Inbox qatar dikhata
 *    hai -- kis ne bheja, kya kaha, kab.
 *
 * 2. **Jo na mile wo NULL, sifar nahi.** Har source alag se laaya jata
 *    hai aur kisi ek ke nakaam hone par baqi nahi rukte -- magar us
 *    source ke saamne "nahi mila" likha jata hai. RLS ya ijazat ki rok
 *    khali jawab deti hai, khata nahi; us khali ko "kuch nahi aaya"
 *    samajh lena is project mein teen dafa ghalat adad de chuka hai.
 */

export type InboxSource =
  | "whatsapp"
  | "ai_draft"
  | "website"
  | "marketplace"
  | "access"
  | "suggestion";

export interface InboxItem {
  id: string;
  source: InboxSource;
  /** Kis ne bheja -- naam, ya jo maloom ho. */
  kisNe: string | null;
  /** Ek line mein kya chahiye. */
  kya: string;
  /** Thori si tafseel, agar ho. */
  tafseel: string | null;
  /** Kab aaya (ISO). */
  kab: string;
  /** Kahan ja kar kaam hota hai. */
  raasta: string;
  /** Kitna zaroori -- laal sirf wahan jahan waqai rukawat hai. */
  tone: "red" | "amber" | "blue" | "gray";
}

/** Kis source ka kaam kis safhe par hota hai. */
export const INBOX_ROUTES: Record<InboxSource, string> = {
  whatsapp: "/admin/submissions",
  ai_draft: "/admin/bridge-ai/action-requests",
  website: "/admin/contact-messages",
  marketplace: "/admin/agri-orders",
  access: "/admin/access-requests",
  suggestion: "/admin/improvements",
};

export const INBOX_LABELS: Record<InboxSource, string> = {
  whatsapp: "WhatsApp",
  ai_draft: "AI ka draft",
  website: "Website",
  marketplace: "Marketplace",
  access: "Ijazat",
  suggestion: "Tajweez",
};

export interface InboxResult {
  items: InboxItem[];
  /** Jo source is dafa nahi parha ja saka -- khali aur nakaam ka farq. */
  naKhule: InboxSource[];
}

function line(v: unknown, max = 140): string | null {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Har source apni koshish khud karta hai.
 *
 * Ek source ka nakaam hona baqi saat ko nahi rokta -- warna ek table par
 * ijazat ki rok poore Inbox ko khali kar deti, aur khali Inbox ka matlab
 * "aaj koi kaam nahi" ban jata.
 */
async function safely<T>(
  source: InboxSource,
  fn: () => Promise<T[]>,
  naKhule: InboxSource[]
): Promise<T[]> {
  try {
    return await fn();
  } catch {
    naKhule.push(source);
    return [];
  }
}

export async function loadInbox(limitPerSource = 20): Promise<InboxResult> {
  const service = createServiceClient();
  const naKhule: InboxSource[] = [];

  const [whatsapp, aiDrafts, website, marketplace, access, suggestions] = await Promise.all([
    // 1. WhatsApp -- staff ne tasveer/paighaam bheja, manzoori baqi.
    safely<InboxItem>("whatsapp", async () => {
      const { data, error } = await service
        .from("whatsapp_submissions")
        .select("id, submission_number, kind, raw_text, ai_summary, party_name, original_amount, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limitPerSource);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: `wa:${r.id}`,
        source: "whatsapp" as const,
        kisNe: line(r.party_name) ?? line(r.submission_number),
        kya: line(r.ai_summary) ?? line(r.kind) ?? "WhatsApp se bheja gaya",
        tafseel:
          [line(r.raw_text, 90), r.original_amount ? `Rs ${Number(r.original_amount).toLocaleString()}` : null]
            .filter(Boolean)
            .join(" · ") || null,
        kab: String(r.created_at),
        raasta: INBOX_ROUTES.whatsapp,
        tone: "amber" as const,
      }));
    }, naKhule),

    // 2. AI ka draft -- AI ne samjha aur draft banaya, faisla insaan ka.
    safely<InboxItem>("ai_draft", async () => {
      const { data, error } = await service
        .from("bridge_ai_action_requests")
        .select("id, action_type, description, details, created_at, status")
        // `needs_changes` bhi KHULA kaam hai -- wapas bheja gaya hai,
        // khatam nahi hua. Sirf `pending` ginna us ko chhupa deta.
        .in("status", ["pending", "needs_changes"])
        .order("created_at", { ascending: false })
        .limit(limitPerSource);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: `ai:${r.id}`,
        source: "ai_draft" as const,
        kisNe: "AgriBridge AI",
        kya: line(r.description) ?? line(r.action_type) ?? "AI ka draft",
        tafseel: line(r.action_type),
        kab: String(r.created_at),
        raasta: INBOX_ROUTES.ai_draft,
        tone: "blue" as const,
      }));
    }, naKhule),

    // 3. Website ka rabta form.
    safely<InboxItem>("website", async () => {
      const { data, error } = await service
        .from("contact_messages")
        .select("id, name, phone, message, created_at, status")
        // `read` ka matlab sirf "kisi ne dekh liya" hai -- jawab abhi
        // baqi hai. Jawab dene par status `responded` ho jata hai.
        .in("status", ["new", "read"])
        .order("created_at", { ascending: false })
        .limit(limitPerSource);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: `web:${r.id}`,
        source: "website" as const,
        kisNe: line(r.name),
        kya: line(r.message) ?? "Website se paighaam",
        tafseel: line(r.phone),
        kab: String(r.created_at),
        raasta: INBOX_ROUTES.website,
        tone: "gray" as const,
      }));
    }, naKhule),

    // 4. Marketplace ka order -- jo abhi manzoori ke muntazir hain.
    safely<InboxItem>("marketplace", async () => {
      const { data, error } = await service
        .from("agri_orders")
        .select("id, order_number, partner_name, grand_total, status, created_at")
        .in("status", ["draft", "submitted", "sales_verified", "finance_verified"])
        .order("created_at", { ascending: false })
        .limit(limitPerSource);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: `ord:${r.id}`,
        source: "marketplace" as const,
        kisNe: line(r.partner_name),
        kya: `Order ${line(r.order_number) ?? ""} — Rs ${Number(r.grand_total ?? 0).toLocaleString()}`,
        tafseel: line(r.status),
        kab: String(r.created_at),
        raasta: INBOX_ROUTES.marketplace,
        tone: "amber" as const,
      }));
    }, naKhule),

    // 5. Ijazat ki darkhwast -- ye rukawat hoti hai, is liye laal.
    safely<InboxItem>("access", async () => {
      const { data, error } = await service
        .from("access_requests")
        .select("id, number, feature_key, reason, risk_level, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(limitPerSource);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: `acc:${r.id}`,
        source: "access" as const,
        kisNe: line(r.number),
        kya: `Ijazat chahiye: ${line(r.feature_key) ?? "—"}`,
        tafseel: line(r.reason, 90),
        kab: String(r.created_at),
        raasta: INBOX_ROUTES.access,
        // Ijazat ka intezar kisi ka kaam ROKE hue hota hai.
        tone: "red" as const,
      }));
    }, naKhule),

    // 6. Behtari ki tajweez -- rukawat nahi, is liye halka rang.
    safely<InboxItem>("suggestion", async () => {
      const { data, error } = await service
        .from("suggestions")
        .select("id, number, title, problem, category, created_at, status")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(limitPerSource);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: `sug:${r.id}`,
        source: "suggestion" as const,
        kisNe: line(r.number),
        kya: line(r.title) ?? "Tajweez",
        tafseel: line(r.problem, 90),
        kab: String(r.created_at),
        raasta: INBOX_ROUTES.suggestion,
        tone: "gray" as const,
      }));
    }, naKhule),
  ]);

  const items = [...whatsapp, ...aiDrafts, ...website, ...marketplace, ...access, ...suggestions].sort(
    (a, b) => new Date(b.kab).getTime() - new Date(a.kab).getTime()
  );

  return { items, naKhule };
}

/**
 * Sirf wo qatarein jin ka safha is bande par khulta hai.
 *
 * Band darwaze ka kaam dikhana waqt bhi zaya karta hai aur bharosa bhi
 * -- banda us par click karta hai aur "ijazat nahi" par ja girta hai.
 * `allowedRoutes` null ho to koi rok nahi (Owner/Admin).
 */
export function filterInbox(items: InboxItem[], allowedRoutes: string[] | null): InboxItem[] {
  if (!allowedRoutes) return items;
  return items.filter((i) => allowedRoutes.some((r) => i.raasta === r || i.raasta.startsWith(r + "/")));
}
