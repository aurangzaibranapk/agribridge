import { Mail, MapPin, Clock, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContactForm } from "@/app/(site)/contact/contact-form";

export const dynamic = "force-dynamic";

async function getSetting(supabase: any, key: string, fallback: string) {
  const { data } = await supabase.from("website_settings").select("value").eq("key", key).single();
  return data?.value ? String(data.value).replace(/^"|"$/g, "") : fallback;
}

export default async function ContactPage() {
  const supabase = createClient();
  const [email, phone, address, hours, mapsUrl] = await Promise.all([
    getSetting(supabase, "contact_email", "info@alranatraders.pk"),
    getSetting(supabase, "contact_phone", ""),
    getSetting(supabase, "contact_address", "Pakistan"),
    getSetting(supabase, "business_hours", "Monday – Saturday: 7AM – 7PM"),
    getSetting(supabase, "google_maps_embed_url", ""),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold text-surface-900 dark:text-white">We&apos;re Here to Help</h1>
        <p className="mx-auto mt-2 max-w-lg text-surface-500 dark:text-surface-400">
          Questions about products, orders, dealership, or partnership — reach us any of these ways.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-2">
        <div className="space-y-5">
          <ContactItem icon={Mail} label="Email" value={email} href={`mailto:${email}`} />
          <ContactItem icon={MapPin} label="Address" value={address} />
          <ContactItem icon={Clock} label="Business Hours" value={hours} />

          <div className="flex flex-wrap gap-2 pt-2">
            {phone && (
              <a href={`tel:${phone}`} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            <a href={`mailto:${email}`} className="inline-flex items-center gap-2 rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
              <Mail className="h-4 w-4" /> Email
            </a>
          </div>

          {mapsUrl && (
            <div className="mt-4 overflow-hidden rounded-card border border-surface-200 dark:border-surface-700">
              <iframe src={mapsUrl} width="100%" height="220" style={{ border: 0 }} loading="lazy" title="Location map" />
            </div>
          )}
        </div>

        <ContactForm />
      </div>
    </div>
  );
}

function ContactItem({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-surface-400 dark:text-surface-500">{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium text-surface-900 hover:text-brand-700 dark:text-white">{value}</a>
        ) : (
          <p className="text-sm font-medium text-surface-900 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  );
}
