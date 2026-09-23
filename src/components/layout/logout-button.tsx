"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

export function LogoutButton() {
  const lang = useLang();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="rounded-lg p-2 text-surface-500 hover:bg-surface-100" title={t("sh_logout", lang)}>
      <LogOut className="h-4 w-4" />
    </button>
  );
}
