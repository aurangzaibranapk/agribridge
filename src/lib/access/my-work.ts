import { createServiceClient } from "@/lib/supabase/service";
import { loadRegistry } from "@/lib/access/registry";
import { loadNeedsAttention, filterAttention, type AttentionItem } from "@/lib/access/needs-attention";
import type { NavGroupData, NavEntry } from "@/lib/access/nav";
import { t, type Lang, type TranslationKey } from "@/lib/i18n/translations";

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
  /**
   * Tayyar (tarjuma shuda) naam -- chaabi NAHI.
   *
   * Pehle yahan `TranslationKey` jata tha aur card us par seedha likh
   * deta tha: screen par "1 na_access_pending" nazar aaya. Chaabi code
   * ki zaban hai; is safhe par sirf wo lafz aane chahiyen jo banda
   * parh sake.
   */
  label: string | null;
}

export interface WorkCard extends NavEntry {
  badge: CardBadge | null;
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
  /** Pehle teen auzaar ke naam -- band qatar par jhalak. */
  preview: string[];
}

export interface MyWorkModel {
  quick: WorkCard[];
  departments: DeptBlock[];
  totalCards: number;
}

/**
 * Har role ka rozana ka kaam -- sirf TARTEEB ke liye.
 *
 * Malik ka refinement (4 September): "Aaj ka kaam" mein fixed menu cards
 * nahi hone chahiyen, sirf wo cheezein jin par WAQAI aaj kuch baqi hai.
 * Is liye ye fehrist ab ye tay nahi karti ke card aayega ya nahi -- wo
 * faisla asal ginti karti hai. Ye sirf itna kehti hai ke jab do cheezein
 * barabar ki hon to is role ke liye kaun si pehle rakhi jaye.
 *
 * Aur ye fehrist ijazat nahi deti: jo cheez is bande ko khulti hi nahi,
 * wo yahan likhi ho kar bhi nazar nahi aayegi.
 */
export const QUICK_BY_ROLE: Record<string, string[]> = {
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

/**
 * Login ke foran baad kaun sa department khula mile.
 *
 * Doodh wala banda roz Doodh hi kholta hai -- usay har dafa ek click
 * karwana bekar hai. Manager/Owner ke liye jaan boojh kar KOI nahi: un
 * ka kaam kisi ek department mein nahi, aur sab band rahen to nazar
 * "Aaj ka kaam" par rehti hai.
 */
const HOME_DASHBOARD: Record<string, string> = {
  milk_collection: "milk",
  sales_staff: "sales",
  warehouse: "inventory",
  procurement: "purchase",
  finance: "finance",
  hr: "hr",
  machinery: "machinery",
  admin_assistant: "admin",
};

export function defaultDashboardForRole(role: string): string | null {
  return HOME_DASHBOARD[role] ?? null;
}

/** Ek se ziyada jagah lagi cheez ka asal ghar -- "master" kabhi nahi. */
const AGGREGATE_DASHBOARD = "master";

/**
 * Kis card par kaun sa adad. Chaabi feature ka raasta (sawal ke nishan se
 * pehle wala hissa) hai, kyunke attention ki qatarein raaste se milti
 * hain, feature ki chaabi se nahi.
 */
function badgesByRoute(items: AttentionItem[], lang: Lang): Map<string, CardBadge> {
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
      label: prev ? null : t(it.label, lang),
    };
    out.set(path, merged);
  }
  return out;
}

/** Ek aur ginti: kisi safhe par "kitni cheezein hain" (kaam baqi nahi). */
async function infoBadges(lang: Lang): Promise<Map<string, CardBadge>> {
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
  if (sales !== null) out.set("/admin/pos", { count: sales, tone: "gray", label: t("mw_b_sales_today", lang) });
  if (products !== null) out.set("/admin/inventory", { count: products, tone: "gray", label: t("mw_b_products", lang) });
  return out;
}

export async function buildMyWork(
  groups: NavGroupData[],
  allowedRoutes: string[] | null,
  role: string,
  lang: Lang
): Promise<MyWorkModel> {
  const [all, info, purposes] = await Promise.all([loadNeedsAttention(), infoBadges(lang), purposeByRoute(lang)]);
  const mine = filterAttention(all, allowedRoutes);
  const badges = badgesByRoute(mine, lang);

  function decorate(item: NavEntry): WorkCard {
    return {
      ...item,
      // Card ka doosra jumla: pehle feature ka apna, warna us ki likhi
      // hui madad ka "maqsad". Dono na hon to KUCH NAHI -- khali jagah
      // bharne ke liye jumla bana dena bande ko ghalat safhe par bhejta
      // hai. (Malik ka refinement: yahan pehle "MASTER COMMAND · FINANCE"
      // jaisi technical mapping aati thi -- wo staff ke kaam ki nahi.)
      description: item.description ?? purposes.get(item.href) ?? null,
      badge: badges.get(item.href) ?? info.get(item.href) ?? null,
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
      tools.push(decorate(item));
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
      preview: tools.slice(0, 3).map((c) => c.label),
    });
  }

  // "Aaj ka kaam" -- sirf wo cheezein jin par WAQAI aaj kuch baqi hai.
  // Fixed menu cards yahan nahi aate (malik ka refinement): agar kuch
  // pending nahi to ye hissa hi nahi banta aur safha "sab clear" kehta
  // hai. Ek khali qatar dikhane se behtar hai ke banda dekh le ke aaj
  // kuch nahi hai.
  const order = QUICK_BY_ROLE[role] ?? [];
  const rank = new Map(order.map((k, i) => [`/admin/${k.replace(/\./g, "/")}`, i]));

  const quick: WorkCard[] = [];
  for (const d of departments) {
    for (const c of d.tools) {
      if (!c.badge || c.badge.tone === "gray") continue;
      // null = ginti nahi mili. Ye bhi upar aana chahiye: "—" dekh kar
      // banda khud kholta hai. Sifar wala card yahan nahi aata.
      if (c.badge.count !== null && c.badge.count <= 0) continue;
      quick.push(c);
    }
  }

  const tone = (c: WorkCard) => (c.badge?.tone === "red" ? 0 : c.badge?.tone === "amber" ? 1 : 2);
  quick.sort((a, b) => tone(a) - tone(b) || (rank.get(a.href) ?? 99) - (rank.get(b.href) ?? 99));

  return {
    quick: quick.slice(0, 6),
    departments,
    totalCards: placed.size,
  };
}

/**
 * Feature ka "maqsad" -- card ka doosra jumla, chuni hui zaban mein.
 *
 * Ye pehle se likha hua hai (feature_help), sirf yahan tak nahi pahunch
 * raha tha. 183 mein se sirf 25 features ka apna doosra jumla bhara hua
 * hai; madad ki qatar us kami ka bara hissa poora kar deti hai.
 */
async function purposeByRoute(lang: Lang): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const service = createServiceClient();
    const registry = await loadRegistry(lang);
    const { data } = await service
      .from("feature_help")
      .select("feature_key, purpose")
      .eq("lang", lang === "en" ? "en" : "rm");
    for (const row of data ?? []) {
      const f = registry.features.get(row.feature_key as string);
      if (f && row.purpose) out.set(f.route, row.purpose as string);
    }
  } catch {
    // Madad na mile to card sirf naam ke sath aayega -- ye kami hai,
    // jhoot nahi.
  }
  return out;
}
