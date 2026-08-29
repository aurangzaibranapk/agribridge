import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MachineryPageClient } from "./machinery-page-client";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";

/**
 * Kisan ka machinery wala safha.
 *
 * Is file mein pehle ek TARJUME KI FEHRIST parhi hui thi -- wohi jo
 * src/lib/i18n/translations.ts mein hai. Safha yahan tha hi nahi, is
 * liye poora project build hi nahi hota tha: Next us folder mein page.tsx
 * dekhta hai aur us se `default` maangta hai, jo is fehrist mein tha
 * nahi. Repo ke pehle commit se yahi haal tha.
 *
 * Safha wapas banaya gaya hai, banaya nahi gaya se aage barh kar: doosre
 * hisse (machinery-page-client, machinery-form, MachineryChart) pehle se
 * poore mojood the aur theek the -- unhein bulane wala koi nahi tha.
 *
 * Kaam ka tareeqa: kisan apna khet chunta hai, us khet par jo fasal
 * likhi hai us ke saamne "ye machine chahiye" ka button aata hai, aur
 * dabane par neeche wala form khud bhar jata hai. Ye is liye ke kisan se
 * ye poochhna ke "kitne acre?" aksar andaze ka jawab laata hai, jabke
 * raqba pehle se us ke khet ke record mein maujood hai.
 */

// Kaun si fasal par kaun si machine. Ye fehrist jaan boojh kar chhoti
// hai: ye sirf pehla mashwara hai, form mein kisan ise badal sakta hai.
const MACHINE_FOR_CROP: Record<string, { value: string; label: string }> = {
  wheat: { value: "harvester", label: "Harvester" },
  gandum: { value: "harvester", label: "Harvester" },
  rice: { value: "harvester", label: "Harvester" },
  chawal: { value: "harvester", label: "Harvester" },
  maize: { value: "thresher", label: "Thresher" },
  makai: { value: "thresher", label: "Thresher" },
  cotton: { value: "rotavator", label: "Rotavator" },
  sugarcane: { value: "tractor", label: "Tractor" },
};

function machineFor(cropName: string) {
  return MACHINE_FOR_CROP[cropName.trim().toLowerCase()] ?? { value: "rotavator", label: "Rotavator" };
}

export default async function PortalMachineryPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: farmer } = await supabase.from("farmers").select("id").eq("user_id", user.id).single();
  if (!farmer) redirect("/login");

  // Profile ka darwaza yahan jaan boojh kar NAHI hai. Machinery booking
  // wo pehla kaam hai jo naya kisan karna chahta hai; usay "pehle apni
  // profile mukammal karein" keh kar rok dena ka matlab hai ke wo phone
  // rakh de aur kisi aur se machine le le.
  const { data: farms } = await supabase
    .from("farms")
    .select("id, name, area_acres")
    .eq("farmer_id", farmer.id)
    .order("name");

  const farmIds = (farms ?? []).map((f) => f.id);
  const { data: crops } = farmIds.length
    ? await supabase
        .from("crop_history")
        .select("farm_id, crop_name, area_sown_acres")
        .in("farm_id", farmIds)
        .is("harvest_booked_at", null)
    : { data: [] };

  const farmData = (farms ?? []).map((f) => {
    const mine = (crops ?? []).filter((c) => c.farm_id === f.id);
    const sown = mine.reduce((sum, c) => sum + Number(c.area_sown_acres ?? 0), 0);
    const totalArea = Number(f.area_acres ?? 0);
    return {
      id: f.id,
      name: f.name,
      totalArea,
      crops: mine.map((c) => {
        const m = machineFor(c.crop_name ?? "");
        return {
          cropName: c.crop_name ?? "-",
          area: Number(c.area_sown_acres ?? 0),
          suggestedMachine: m.value,
          suggestedMachineLabel: m.label,
        };
      }),
      // Khali zameen kabhi manfi nahi dikhti: agar record mein fasal ka
      // raqba khet se zyada likha ho (aisa hota hai) to "-2 acre khali"
      // likhna sirf uljhan paida karta hai.
      khaliZameen: Math.max(0, totalArea - sown),
    };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/portal/dashboard" className="mb-4 inline-block text-sm text-surface-500 hover:text-brand-700">
        ← {t("back_to_dashboard", lang)}
      </Link>
      <h1 className="font-display text-2xl font-semibold text-surface-900">{t("machinery_title", lang)}</h1>
      <p className="mt-1 text-sm text-surface-500">{t("machinery_subtitle", lang)}</p>
      <div className="mt-6">
        <MachineryPageClient farms={farmData} />
      </div>
    </div>
  );
}
