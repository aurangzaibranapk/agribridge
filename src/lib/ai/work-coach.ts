import { createServiceClient } from "@/lib/supabase/service";
import { loadNav } from "@/lib/access/nav";
import { loadNeedsAttention, filterAttention } from "@/lib/access/needs-attention";
import { departmentForRole, UNRESTRICTED_ROLES } from "@/lib/departments";
import { t, type Lang } from "@/lib/i18n/translations";

/**
 * Work Coach (Guided ERP, qadam C).
 *
 * AI ko teen cheezein di jati hain jo pehle nahi thin:
 *   1. Kaun pooch raha hai: role, department, aur kaun se raaste us par
 *      khulte hain. Wohi sawal shop boy aur admin ke liye alag jawab
 *      rakhta hai.
 *   2. System ka naqsha aur har feature ki likhi hui maloomat
 *      (feature_help). Jawab isi se -- AI ke apne ilm se nahi.
 *   3. Banday ki asal halat: aaj kya baqi hai (asal ginti se).
 *
 * AI ab bhi kuch mehfooz nahi karta. Draft banata hai, safha batata
 * hai, aage ka qadam batata hai.
 */

export interface CoachContext {
  userId: string;
  role: string;
  fullName: string;
  departmentKey: string | null;
  departmentLabel: string | null;
  unrestricted: boolean;
  allowedRoutes: string[] | null;
  features: { key: string; label: string; route: string; purpose: string | null; who: string | null; next: string | null; how: string[] }[];
  attention: { label: string; count: number | null; href: string }[];
  lang: Lang;
}

/** Purchase se POS tak ka raasta -- AI ko ye yaad nahi rakhna, yahan likha hai. */
export const SYSTEM_MAP = [
  "Supplier bill (photo/PDF/sheet) -> /admin/products/bill-rates (AI qatarein parhta hai, product milata hai, rate charhta hai)",
  "-> Purchase draft banta hai (/admin/purchases, review_status = submitted)",
  "-> Owner/Admin manzoor / wapas / radd (/admin/purchases, Jaanch)",
  "-> Maal ginna: theek aaya / toota / kam (/admin/inventory/receiving ya /admin/purchases, Maal Aa Gaya) -> stock charhta hai, supplier ka dena utne ka jitna theek aaya",
  "-> Product setup: rate, barcode, tasveer, miyaad, manzoori (/admin/products/setup) -> Sale Ready",
  "-> POS par bikri (/admin/pos); bina sale rate ke cheez bikti nahi (database ki rok)",
  "Shop order: shop request (/admin/pos/ordering ya AI draft) -> Sales verify -> Finance verify -> Manager approve -> Warehouse dispatch (stock bhejne wale se kam) -> Shop GRN (/admin/purchases/grn; theek/toota/kam) -> shop ka stock",
  "Shop se wapas: /admin/agri-returns (HQ receive kare tab stock aur khata hilte hain)",
  "Stock ka ek hi malik: har tabdeeli stock_movements ki harkat (Stock Ledger /admin/stock-ledger); ginti haath se nahi badalti",
  "Supplier ka dena = received purchases - adaigiyan (/admin/purchases/bills, /admin/suppliers); haath se nahi likha jata",
  "Kya mangwana hai: 30 din ki bikri se (/admin/products/reorder) -> purchase draft -> manzoori",
  "Product Masters (/admin/products/masters): qismein, brand, companies, Units (/admin/products/masters/units) aur Pack Sizes (/admin/products/masters/pack-sizes); units/pack ke aliases (bori = bag, 5 ltr = 5L) bill aur sheet ki matching mein kaam aate hain",
  "Sifar aur 'hisaab nahi rakha' ek cheez nahi: jahan adad na mile wahan '—' ya NULL, 0 nahi",
  "Ijazat: staff Work Coach se maangta hai -> darkhwast (ACC-...) -> Owner/Admin/head manzoor (/admin/access-requests) -> engine lagata hai; AI kabhi khud nahi lagata",
  "Ijazat ka takraao (Separation of Duties): qawaid access_conflict_rules mein (badalne ke qabil), report /admin/access-requests?tab=conflicts; manzoori se pehle jaanch: advise = batao, override = HIGH/CRITICAL sirf Owner/Admin wajah+miyaad ke sath, block = koi nahi; kuch khud nahi hatta, faisla insaan ka",
].join("\n");

export async function buildCoachContext(userId: string, lang: Lang): Promise<CoachContext | null> {
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, full_name, is_active").eq("id", userId).maybeSingle();
  if (!me || !me.is_active) return null;

  const nav = await loadNav(userId, me.role, lang);
  const unrestricted = nav.unrestricted || UNRESTRICTED_ROLES.includes(me.role);
  const allowedRoutes = unrestricted ? null : nav.allowedRoutes;
  const dept = departmentForRole(me.role);

  const [{ data: features }, { data: helps }, attentionAll] = await Promise.all([
    service.from("features").select("key, label, route").eq("is_active", true),
    service.from("feature_help").select("feature_key, purpose, who_uses, next_step, how_steps").eq("lang", "rm"),
    loadNeedsAttention(),
  ]);
  const helpByKey = new Map((helps ?? []).map((h) => [h.feature_key, h]));
  const visible = (features ?? []).filter((f) => !allowedRoutes || allowedRoutes.some((r) => f.route === r || f.route.startsWith(r + "/")));
  const featureRows = (features ?? []).map((f) => {
    const h = helpByKey.get(f.key);
    return { key: f.key, label: f.label, route: f.route, purpose: h?.purpose ?? null, who: h?.who_uses ?? null, next: h?.next_step ?? null, how: h?.how_steps ?? [] };
  });
  void visible;

  const attention = filterAttention(attentionAll, allowedRoutes).map((a) => ({ label: t(a.label, "rm"), count: a.count, href: a.href }));

  return {
    userId,
    role: me.role,
    fullName: me.full_name ?? "",
    departmentKey: dept?.key ?? null,
    departmentLabel: dept?.label ?? null,
    unrestricted,
    allowedRoutes,
    features: featureRows,
    attention,
    lang,
  };
}

/** AI ko banday aur system ka poora context -- system instruction ka hissa. */
export function coachInstruction(ctx: CoachContext): string {
  const routes = ctx.unrestricted
    ? "Ye Owner/Admin darje ka shakhs hai: sab safhe khulte hain."
    : `Is shakhs ko SIRF ye raaste khulte hain: ${(ctx.allowedRoutes ?? []).join(", ") || "(koi nahi)"}. Jo kaam in raaston par nahi hota, wo ye nahi kar sakta -- saaf batayein kaun karta hai (feature ki 'kaun' wali maloomat se) aur ye khud kya kar sakta hai.`;
  const featureLines = ctx.features
    .map((f) => {
      const parts = [`${f.label} [${f.key}] ${f.route}`];
      if (f.purpose) parts.push(`maqsad: ${f.purpose}`);
      if (f.who) parts.push(`kaun: ${f.who}`);
      if (f.how.length) parts.push(`qadam: ${f.how.join(" | ")}`);
      if (f.next) parts.push(`aage: ${f.next}`);
      return "- " + parts.join(" · ");
    })
    .join("\n");
  const attention = ctx.attention.length
    ? ctx.attention.map((a) => `- ${a.count == null ? "—" : a.count} ${a.label} -> ${a.href}`).join("\n")
    : "- kuch baqi nahi";

  return `
=== WORK COACH ===
Aap AgriBridge Work Coach hain. Sawal karne wala: ${ctx.fullName || "staff"}, role "${ctx.role}", department "${ctx.departmentLabel ?? "—"}".
${routes}

USOOL:
- Jawab Roman Urdu mein, chhota, qadam ba qadam. Jahan safha batana ho wahan us ka raasta likhein, misal: "/admin/products/setup" -- system usay link bana deta hai.
- Har jawab NEECHE likhi feature ki maloomat aur system ke naqshe se dein. Jo cheez in mein nahi, us par "ye mujhe nahi maloom" kahein -- andaza na lagayein.
- "Ab kya karoon" jaisa sawal ho to pehle "AAJ BAQI" wali fehrist dekhein aur us se batayein; aur tool get_my_work se taaza fehrist lein.
- Agar sawal kisi safhe ke baare mein ho ("ye safha samjhao", screenshot), to tool explain_page se us feature ki maloomat lein aur wohi batayein.
- Jo kaam is shakhs ke raaston par nahi, wo usay na sikhayein -- batayein kaun karta hai aur ye kya kar sakta hai.
- Aap kuch mehfooz nahi karte: sirf draft (draft_shop_order / propose_action), safha aur agla qadam.
- IJAZAT / ACCESS: staff kahe "mujhe X dekhne/karne ki ijazat chahiye", "mujhe Y department bhi do", ya Admin kahe "Usman ko Milk mein Collection Entry do" -- request_access tool confirmed=false se draft lein, staff ko saaf dikhayein: kya maang rahe hain aur kya NAHI (misal: "Aap Stock ka VIEW maang rahe hain, edit/transfer/approve nahi"), kab tak, kaun manzoor karega; "Darkhwast bhej doon?" -- HAAN par confirmed=true. AAP KABHI IJAZAT NAHI LAGATE, sirf darkhwast; manzoori insaan deta hai. Agar staff ko koi safha nahi khulta ("ye page nahi khulta"), yehi raasta batayein.
- TAKRAAO (Access Conflict): Owner/Admin/Manager/head pooche "kis ke paas takraao hai", "Ahmed ko X dena theek hai?" -- check_access_conflicts tool. Warning ka jumla saada rakhein, misal: "High Access Conflict: Ahmed ke paas Supplier Payment Create aur Verify already hai. Reverse dene se ek hi user create, verify aur reverse kar sakega. Recommended: Reverse Finance Manager ke paas rakhein." AAP KUCH NAHI HATATE -- detect, samjhao, behtar tarteeb batao; faisla insaan ka. request_access ke draft mein access_conflicts aaye to wo warnings zaroor dikhayein.
- TAJWEEZ / MASLA / BEHTARI: staff koi kami, masla ya idea bataye ("...hona chahiye", "...mushkil hai", "...ghalat dikhta hai"), to submit_suggestion tool confirmed=false ke sath bulayein, draft staff ko dikhayein, "Darj kar doon?" poochein; HAAN par confirmed=true. Bina haan ke kabhi darj na karein. Darj hone par number batayein.
- Screenshot mile to pehle us ke title/labels/URL se pehchanein ye kaun sa safha hai (neeche ki fehrist se), phir usi feature ki maloomat se samjhayein.

SYSTEM KA NAQSHA:
${SYSTEM_MAP}

AAJ BAQI (is shakhs ke liye, asal ginti):
${attention}

FEATURES AUR UN KI MALOOMAT:
${featureLines}
`;
}
