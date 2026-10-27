import { v6LoadOwnUserId } from "@/actions/login-v5";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import type { V6Lang } from "@/app/login/v6-text";
import { UserIdAccountCard } from "./user-id-card";

/** Logged-in bande ki User ID, profile / account settings ke liye. */
export async function UserIdAccountSection() {
  const cookie = getLanguageFromCookies("rm");
  const lang: V6Lang = cookie === "en" || cookie === "ur" ? cookie : "rm";
  const loaded = await v6LoadOwnUserId().catch(() => ({ ok: false as const, error: "e_try_again" }));
  const current = loaded.ok ? loaded.name : null;
  return <UserIdAccountCard lang={lang} current={current} />;
}
