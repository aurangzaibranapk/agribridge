import { SHOP_PHONE_DISPLAY, isPlaceholderAddress, unwrapWebsiteSetting } from "@/lib/cms/website-setting";
import { loadOpenVacancies } from "@/lib/jobs/load-open-vacancies";
import { LIVE_VACANCY_COPY } from "@/lib/jobs/vacancy-preview";
import { createClient } from "@/lib/supabase/server";
import { defaultContact, scrubPublicReply, type PublicFacts } from "@/lib/chat/public-knowledge";

const CACHE_MS = 60_000;

let cache: { at: number; facts: PublicFacts } | null = null;

export function clearPublicFactsCache(): void {
  cache = null;
}

function previewOn(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.CAREERS_PREVIEW === "1";
}

function dbConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Sirf woh tables jo website pehle se public dikhati hai.
 * Khata, tankhwah, aur andar ka hisaab — yahan select nahi.
 * Session client RLS ke peeche hai. Bari chabi nahi.
 */
export async function loadPublicFacts(): Promise<PublicFacts> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.facts;
  const facts = await fetchPublicFacts();
  cache = { at: Date.now(), facts };
  return facts;
}

async function fetchPublicFacts(): Promise<PublicFacts> {
  const contact = defaultContact();
  const facts: PublicFacts = {
    products: [],
    vacancies: previewOn() ? LIVE_VACANCY_COPY : [],
    branches: [],
    faqs: [],
    contact,
  };
  if (!dbConfigured()) return facts;

  try {
    const supabase = createClient();
    const [products, faqs, vacancies, branches, settings] = await Promise.all([
      supabase
        .from("products")
        .select("name, pack_size, selling_price")
        .eq("is_deleted", false)
        .eq("is_available", true)
        .order("name")
        .limit(40),
      supabase
        .from("faqs")
        .select("question, answer")
        .eq("is_published", true)
        .order("display_order")
        .limit(20),
      previewOn() ? Promise.resolve({ data: null }) : loadOpenVacancies().then((rows) => ({ data: rows })).catch(() => ({ data: null })),
      supabase
        .from("branches")
        .select("name, district, tehsil, address")
        .eq("is_active", true)
        .order("name")
        .limit(30),
      supabase
        .from("website_settings")
        .select("key, value")
        .in("key", ["contact_email", "contact_phone", "contact_address", "business_hours"]),
    ]);

    facts.products = (products.data ?? []).map((row) => ({
      name: scrubPublicReply(String(row.name ?? ""), "en"),
      pack: row.pack_size?.trim() || null,
      price: row.selling_price == null ? null : Number(row.selling_price),
    })).filter((row) => row.name.length > 0);

    facts.faqs = (faqs.data ?? []).map((row) => ({
      question: scrubPublicReply(String(row.question ?? ""), "en"),
      answer: scrubPublicReply(String(row.answer ?? ""), "en"),
    })).filter((row) => row.question && row.answer);

    if (!previewOn() && vacancies.data && vacancies.data.length > 0) {
      facts.vacancies = vacancies.data;
    }

    facts.branches = (branches.data ?? []).map((row) => {
      const place = [row.district, row.tehsil, row.address].map((part) => part?.trim()).filter(Boolean).join(", ");
      return {
        name: scrubPublicReply(String(row.name ?? ""), "en"),
        place: place ? scrubPublicReply(place, "en") : null,
      };
    }).filter((row) => row.name.length > 0);

    const setting = new Map((settings.data ?? []).map((row) => [row.key, unwrapWebsiteSetting(row.value)]));
    const email = setting.get("contact_email")?.trim();
    const phone = setting.get("contact_phone")?.trim();
    const address = setting.get("contact_address")?.trim();
    const hours = setting.get("business_hours")?.trim();
    facts.contact = {
      email: email || contact.email,
      phone: phone || contact.phone || SHOP_PHONE_DISPLAY,
      address: address && !isPlaceholderAddress(address) ? scrubPublicReply(address, "en") : null,
      hours: hours || contact.hours,
    };
  } catch (err) {
    console.error("public chat facts:", err instanceof Error ? err.message : "load failed");
  }
  return facts;
}

/** Sirf usi login ka naam, RLS ke zariye. Phone, role, khata nahi. */
export async function loadOwnName(): Promise<string | null> {
  if (!dbConfigured()) return null;
  try {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return null;
    const { data } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const name = data?.full_name?.trim();
    return name ? scrubPublicReply(name, "en") : null;
  } catch {
    return null;
  }
}
