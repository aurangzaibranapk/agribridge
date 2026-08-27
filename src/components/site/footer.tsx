import Link from "next/link";
import { Facebook, Youtube, Music2, Phone, MapPin, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const SOCIALS = [
  { icon: Facebook, href: "https://www.facebook.com/share/18y1poYepQ/", label: "Facebook" },
  { icon: Music2, href: "https://www.tiktok.com/@kisanecomahabali", label: "TikTok" },
  { icon: Youtube, href: "https://www.youtube.com/@alranatraders", label: "YouTube" },
];

async function getSetting(supabase: ReturnType<typeof createClient>, key: string, fallback: string) {
  const { data } = await supabase.from("website_settings").select("value").eq("key", key).single();
  return data?.value ? String(data.value).replace(/^"|"$/g, "") : fallback;
}

export async function SiteFooter() {
  const supabase = createClient();
  const [phone, address] = await Promise.all([
    getSetting(supabase, "contact_phone", ""),
    getSetting(supabase, "contact_address", ""),
  ]);
  const whatsappDigits = phone.replace(/\D/g, "");

  return (
    <footer className="border-t border-surface-200 bg-surface-900 text-surface-200">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <p className="font-display text-lg font-semibold text-white">Al Rana Traders</p>
            <p className="mt-2 text-sm text-surface-400">Agriculture inputs, trusted by farmers across Pakistan — bridged, verified, delivered.</p>

            <div className="mt-4 space-y-1.5 text-sm text-surface-400">
              {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-2 hover:text-white">
                  <Phone className="h-4 w-4 shrink-0" /> {phone}
                </a>
              )}
              {address && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" /> {address}
                </p>
              )}
              {whatsappDigits && (
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-green-400 hover:text-green-300"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" /> Chat on WhatsApp
                </a>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="text-surface-400 hover:text-white">
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Explore</p>
            <ul className="mt-2 space-y-1 text-sm text-surface-400">
              <li><Link href="/products" className="hover:text-white">Products</Link></li>
              <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Company</p>
            <ul className="mt-2 space-y-1 text-sm text-surface-400">
              <li><Link href="/about" className="hover:text-white">About Us</Link></li>
              <li><Link href="/register/farmer" className="hover:text-white">Farmer Registration</Link></li>
              <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Legal</p>
            <ul className="mt-2 space-y-1 text-sm text-surface-400">
              <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms-and-conditions" className="hover:text-white">Terms & Conditions</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-surface-800 pt-6 text-xs text-surface-500">© {new Date().getFullYear()} Al Rana Traders. All rights reserved.</p>
      </div>
    </footer>
  );
}
