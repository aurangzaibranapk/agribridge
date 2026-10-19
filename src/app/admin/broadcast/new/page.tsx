import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t, type TranslationKey } from "@/lib/i18n/translations";
import { broadcastDict } from "@/lib/i18n/dict/broadcast";
import { DEPARTMENTS } from "@/lib/departments";
import { Wizard } from "./wizard";

export const dynamic = "force-dynamic";

export default async function NewBroadcastPage() {
  const supabase = createClient();
  const db = supabase as unknown as SupabaseClient;
  const lang = getLanguageFromCookies("rm");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me || !["owner", "super_admin", "admin", "manager"].includes(me.role)) redirect("/admin/broadcast");
  const [{ data: tpls }, { data: camps }] = await Promise.all([
    db.from("message_templates").select("id, name, lang, category, body, var_count, meta_status").order("name"),
    db.from("booking_campaigns").select("id, name, crop, is_active").order("created_at", { ascending: false }).limit(30),
  ]);
  const L = Object.fromEntries(Object.keys(broadcastDict).map((k) => [k, t(k as TranslationKey, lang)])) as Record<string, string>;
  return (
    <Wizard L={L} rtl={lang === "ur"} templates={(tpls ?? []) as any} campaigns={(camps ?? []).map((c: any) => ({ id: c.id, name: c.name, crop: c.crop }))}
      departments={DEPARTMENTS.map((d) => ({ key: d.key, label: d.label }))} />
  );
}
