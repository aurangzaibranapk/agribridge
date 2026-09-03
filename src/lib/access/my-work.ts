import { createServiceClient } from "@/lib/supabase/service";
import { loadNeedsAttention, filterAttention, type AttentionItem } from "@/lib/access/needs-attention";
import type { NavGroupData, NavEntry } from "@/lib/access/nav";
import type { Lang, TranslationKey } from "@/lib/i18n/translations";

/**
 * "Mera Kaam" ka dhancha -- cards ki fehrist se ek kaam ka naqsha.
 *
 * Malik ka aitraaz (3 September): Manager ke login par safha 50 ek jaise
 * safaid dabbon mein phail jata tha. Har card ki ahmiyat barabar lagti
 * thi, aur wohi feature chaar department mein dobara nazar aata tha.
 *
 * Ab tarteeb ye hai:
 *
 *   Kya baqi hai   ->  Aaj ka kaam  ->  Department  ->  us ke auzaar
 *
 * Teen usool jin par ye bana hai:
 *
 * 1. EK feature EK jagah. Ek cheez kai dashboard par lagi ho sakti hai
 *    (aur wo theek hai -- ijazat wahan se bhi milti hai), magar is safhe
 *    par wo ek hi dafa dikhegi: apne asal department mein. "Master
 *    Command" ab sirf wo cheezein rakhta hai jo kisi department ki nahi.
 *    Baqi jagahon ke naam card par chhote tag ki shakl mein rehte hain,
 *    taake banda jaanta rahe ke ye cheez wahan bhi kaam aati hai.
 *
 * 2. Ginti sirf sachi. Har card par adad nahi lagta -- sirf wahan jahan
 *    waqai koi aisi fehrist hai jo khatam ho sakti hai. Aur jo ginti kisi
 *    wajah se na mile wo "—" rehti hai, sifar nahi. Sifar kehta hai
 *    "dekh liya, kuch nahi"; "—" kehta hai "hisaab nahi mila". Do alag
 *    baatein.
 *
 * 3. Ahmiyat role se aati hai, marzi se nahi. "Aaj ka kaam" mein wohi
 *    cheezein aati hain jin par is role ka roz haath paRta hai -- aur
 *    jin par abhi kuch baqi ho wo pehle. Koi feature chhupta nahi: sab
 *    kuch neeche apne department mein maujood rehta hai.
 */

export interface CardBadge {
  /** null = ginti mili hi nahi -- safhe par "—". */
  count: number | null;
  tone: "red" | "amber" | "blue" | "gray";
  label: TranslationKey | null;
}

export interface WorkCard extends NavEntry {
  badge: CardBadge | null;
  /** Aur kin department mein ye cheez kaam aati hai. */
  tags: string[];
}

export interface DeptBlock {
  key: string;
  label: string;
  icon: string | null;
  tools: WorkCard[];
  /** Kitne auzaar -- card par likha jata hai. */
  toolCount: number;
  /** Kitni cheezein tawajjo maang rahi hain (null = hisaab nahi mila). */
  attention: number | null;
}

export interface MyWorkModel {
  quick: WorkCard[];
  departments: DeptBlock[];
  totalCards: number;
}

/**
 * Har role ka rozana ka kaam -- yehi "Aaj ka kaam" mein upar aata hai.
 *
 * Ye fehrist ijazat nahi deti; sirf tarteeb batati hai. Jo cheez is
 * bande ko khulti hi nahi, wo yahan likhi ho kar bhi nazar nahi aayegi.
 */
const QUICK_BY_ROLE: Record<string, string[]> = {
  owner: ["submissions", "access-requests", "reconciliation", "cash-close", "command-center", "stock-count"],
  super_admin: ["submissions", "access-requests", "users", "permissions", "reconciliation"],
  admin: ["submissions", "access-requests", "users", "permissions", "reconciliation"],
  manager: ["submissions", "access-requests", "stock-count", "cash-close", "reconciliation", "field-watch"],
  finance: ["finance", "cash-close", "reconciliation", "bank-reconcile", "suppliers", "staff-khata"],
  sales_staff: ["pos", "khata", "agri-orders", "agri-returns", "products", "farmers"],
  warehouse: ["inventory", "stock-count", "stock-ledger", "agri-returns", "purchases"],
  procurement: ["purchases", "suppliers", "products.setup", "rate-master", "grain-procurement"],
  hr: ["hr", "hr.attendance-log", "staff-khata", "hr.whatsapp"],
  milk_collection: ["milk-collection.collect", "milk-collection.verify", "milk-collection.routes", "milk-collection.cost-per-liter"],
  machinery: ["machinery-rental", "machinery-rental.dashboard", "machinery-rental.calendar"],
  admin_assistant: ["submissions", "messages", "contact-messages", "notifications"],
};

/** Ek se ziyada jagah lagi cheez ka asal ghar -- "master" kabhi nahi. */
const AGGREGATE_DASHBOARD = "master";

/**
 * Kis card par kaun sa adad. Chaabi feature ka raasta (sawal ke nishan se
 * pehle wala hissa) hai, kyunke attention ki qatarein raaste se milti
 * hain, feature ki chaabi se nahi.
 */
function badgesByRoute(items: AttentionItem[]): Map<string, CardBadge> {
  const out = new Map<string, CardBadge>();
  const order = { red: 0, amber: 1, blue: 2, gray: 3 } as const;
  for (const it of items) {
    const path = it.href.split("?")[0];
    const prev = out.get(path);
    // Ek hi safhe par do qatarein hon (misal purchases: manzoori aur
    // wapas bheji hui) to zyada sangeen wali card par aati hai -- aur
    // dono ki ginti joR di jati hai, kyunke banda wahan ja kar dono
    // dekhega.
    const merged: CardBadge = {
      count: prev == null ? it.count : prev.count == null || it.count == null ? null : prev.count + it.count,
      tone: prev && order[prev.tone] <= order[it.tone] ? prev.tone : it.tone,
      label: prev ? null : it.label,
    };
    out.set(path, merged);
  }
  return out;
}

/** Ek aur ginti: kisi safhe par "kitni cheezein hain" (kaam baqi nahi). */
async function infoBadges(): Promise<Map<string, CardBadge>> {
  const out = new Map<string, CardBadge>();
  const service = createServiceClient();

  async function count(table: string, apply: (q: any) => any): Promise<number | null> {
    try {
      const { count: n, error } = await apply(service.from(table as never).select("id", { count: "exact", head: true }));
      return error ? null : (n ?? 0);
    } catch {
      return null;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const [sales, products] = await Promise.all([
    count("pos_sales", (q) => q.gte("created_at", today)),
    count("products", (q) => q.eq("status", "active")),
  ]);

  // Ye adad "kaam baqi hai" nahi kehte, sirf halat batate hain -- is liye
  // rang neutral hai aur inhen tawajjo wali ginti mein nahi gina jata.
  if (sales !== null) out.set("/admin/pos", { count: sales, tone: "gray", label: "mw_b_sales_today" });
  if (products !== null) out.set("/admin/inventory", { count: products, tone: "gray", label: "mw_b_products" });
  return out;
}

export async function buildMyWork(
  groups: NavGroupData[],
  allowedRoutes: string[] | null,
  role: string,
  _lang: Lang
): Promise<MyWorkModel> {
  const [all, info] = await Promise.all([loadNeedsAttention(), infoBadges()]);
  const mine = filterAttention(all, allowedRoutes);
  const badges = badgesByRoute(mine);

  // Kaun sa feature kis kis dashboard par hai -- tags ke liye.
  const homesOf = new Map<string, string[]>();
  for (const g of groups) {
    for (const item of g.items) {
      homesOf.set(item.href, [...(homesOf.get(item.href) ?? []), g.label]);
    }
  }

  function decorate(item: NavEntry, ownDashboardLabel: string): WorkCard {
    return {
      ...item,
      badge: badges.get(item.href) ?? info.get(item.href) ?? null,
      tags: (homesOf.get(item.href) ?? []).filter((l) => l !== ownDashboardLabel),
    };
  }

  // EK feature EK jagah: pehle wo dashboard jo "master" nahi. Jo cheez
  // sirf master par hai, wohi master mein rehti hai.
  const placed = new Set<string>();
  const real = groups.filter((g) => g.key !== AGGREGATE_DASHBOARD);
  const aggregate = groups.filter((g) => g.key === AGGREGATE_DASHBOARD);

  const departments: DeptBlock[] = [];
  for (const g of [...real, ...aggregate]) {
    const tools: WorkCard[] = [];
    for (const item of g.items) {
      if (placed.has(item.href)) continue;
      placed.add(item.href);
      tools.push(decorate(item, g.label));
    }
    if (tools.length === 0) continue;

    // Department ki tawajjo: sirf wo cards jin par waqai kaam baqi hai.
    // Agar kisi card ki ginti hi nahi mili to poore department ka adad
    // NULL kar dete hain -- adhoore hisaab ko poora dikhana jhoot hai.
    let attention: number | null = 0;
    for (const c of tools) {
      if (!c.badge || c.badge.tone === "gray") continue;
      if (c.badge.count === null) { attention = null; break; }
      attention += c.badge.count > 0 ? 1 : 0;
    }

    departments.push({
      key: g.key,
      label: g.label,
      icon: g.icon ?? null,
      tools,
      toolCount: tools.length,
      attention,
    });
  }

  // "Aaj ka kaam": pehle role ki apni fehrist, phir jin par abhi kuch
  // baqi hai. Chhe se ziyada nahi -- warna ye bhi wahi lambi fehrist ban
  // jayegi jis se bhaag rahe hain.
  const byKeyGuess = new Map<string, WorkCard>();
  for (const d of departments) for (const c of d.tools) byKeyGuess.set(c.href, c);

  const wanted = QUICK_BY_ROLE[role] ?? [];
  const quick: WorkCard[] = [];
  const seen = new Set<string>();

  for (const key of wanted) {
    // feature ki chaabi se raasta banana theek nahi (chaabi mein nuqte
    // hote hain), is liye raaste se milaya jata hai.
    const guess = `/admin/${key.replace(/\./g, "/")}`;
    const card = byKeyGuess.get(guess);
    if (card && !seen.has(card.href)) { seen.add(card.href); quick.push(card); }
  }

  // Jin par abhi kuch baqi hai wo bhi upar aane chahiyen, chahe role ki
  // fehrist mein na hon.
  for (const d of departments) {
    for (const c of d.tools) {
      if (quick.length >= 6) break;
      if (seen.has(c.href)) continue;
      if (c.badge && c.badge.tone !== "gray" && (c.badge.count === null || c.badge.count > 0)) {
        seen.add(c.href);
        quick.push(c);
      }
    }
  }

  // Jin par kaam baqi hai wo pehle.
  quick.sort((a, b) => {
    const w = (c: WorkCard) => (c.badge && c.badge.tone === "red" ? 0 : c.badge && c.badge.tone !== "gray" ? 1 : 2);
    return w(a) - w(b);
  });

  return {
    quick: quick.slice(0, 6),
    departments,
    totalCards: placed.size,
  };
}
