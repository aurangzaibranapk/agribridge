import Link from "next/link";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/**
 * Website ka footer -- malik ka final design (6 September).
 *
 * =====================================================================
 * RAABTE KI TAFSEEL CMS SE, HAATH SE NAHI
 * =====================================================================
 *
 * Design mein number aur pata seedha likhe hue the. Wo yahan JAAN
 * BOOJH KAR `website_settings` se aate hain, aur design wale sirf
 * fallback hain.
 *
 * Wajah: ye do cheezein admin par pehle se badalne ke qabil hain
 * (`contact_phone`, `contact_address`). Code mein likh dene ka matlab
 * hota ke malik admin par number badlein, aur footer purana number
 * dikhata rahe -- aur kisi ko pata na chale. Website ka number ghalat
 * hona wo qism ki khamoshi hai jo mahine baad "phone kyun nahi aaya"
 * ban kar nikalti hai.
 *
 * Shakl bilkul wohi hai jo design mein thi.
 */
const platform: string[][] = [
  ["Agriculture", "/agriculture"],
  ["Marketplace", "/marketplace"],
  ["Machinery", "/machinery"],
  ["Dairy", "/dairy"],
  ["Kisan AI", "/kisan-ai"],
];

const business: string[][] = [
  ["AgriBridge ERP", "/erp"],
  ["Kisan Services", "/kisan-services"],
  ["Grain & Produce", "/grain"],
  ["Partners", "/partner"],
  ["About Us", "/about"],
  ["Contact", "/contact"],
];

const support: string[][] = [
  ["FAQ", "/faq"],
  ["Blog", "/blog"],
  ["Gallery", "/gallery"],
  ["Privacy Policy", "/privacy-policy"],
  ["Disclaimer", "/disclaimer"],
  ["Cookie Policy", "/cookie-policy"],
];

/** Design ke adad -- sirf tab jab CMS par kuch darj hi na ho. */
const FALLBACK_PHONE = "+92 333 1116727";
const FALLBACK_ADDRESS = "Al Rana Traders, Chak Mahabali, Pakistan";

export async function PublicFooter() {
  // Wohi ehtiyaat jo layout mein: raabte ki tafseel na mile to footer
  // apne fallback par chalta hai, poori website nahi girti.
  let rows: { key: string; value: unknown }[] | null = null;
  try {
    const supabase = createClient();
    const res = await supabase
      .from("website_settings")
      .select("key, value")
      .in("key", ["contact_phone", "contact_address"]);
    rows = res.data;
  } catch (e) {
    console.error("PublicFooter: website_settings nahi mile —", e instanceof Error ? e.message : e);
  }

  const get = (key: string, fallback: string) => {
    const row = rows?.find((r) => r.key === key);
    const raw = row?.value == null ? "" : String(row.value).replace(/^"|"$/g, "").trim();
    return raw.length > 0 ? raw : fallback;
  };

  const phone = get("contact_phone", FALLBACK_PHONE);
  const address = get("contact_address", FALLBACK_ADDRESS);
  const whatsapp = phone.replace(/\D/g, "") || "923331116727";

  return (
    <footer className="bg-[#081f18] text-white">
      {/* MAIN */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* BRAND */}
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 font-black">
                ART
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">
                  Al Rana Traders
                </p>
                <p className="text-xl font-black">AgriBridge</p>
              </div>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-emerald-50/65">
              Agriculture, farmer services, marketplace, machinery, dairy, artificial intelligence aur
              business ERP ko ek connected platform par lane wala AgriBridge ecosystem.
            </p>

            <p className="mt-5 font-bold text-emerald-300">Beej se Bazaar tak — Business se AI tak.</p>

            <div className="mt-6 space-y-3 text-sm text-emerald-50/70">
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {address}
              </p>

              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 transition hover:text-white"
              >
                <MessageCircle className="h-4 w-4 text-emerald-400" />
                {phone}
              </a>

              <a
                href="mailto:info@alranatraders.pk"
                className="flex items-center gap-3 transition hover:text-white"
              >
                <Mail className="h-4 w-4 text-emerald-400" />
                info@alranatraders.pk
              </a>
            </div>
          </div>

          <FooterColumn title="Platform" links={platform} />
          <FooterColumn title="Business" links={business} />
          <FooterColumn title="Support" links={support} />
        </div>
      </div>

      {/* BOTTOM */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-emerald-50/50 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>© {new Date().getFullYear()} Al Rana Traders — ART AgriBridge. All rights reserved.</p>
          <p>Agriculture. Technology. One Bridge.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[][] }) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-emerald-300">{title}</h3>
      <ul className="mt-5 space-y-3">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-sm text-emerald-50/65 transition hover:text-white">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
