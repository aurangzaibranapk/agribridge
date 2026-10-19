"use client";
import { AnimatedSearch } from "@/components/ui/animated-search";
import type { SearchLang } from "@/lib/ui/animated-search";

/**
 * Topbar ka naya search (flag NEXT_PUBLIC_ANIM_SEARCH=1). Wahi GET form,
 * wahi `q` param, wahi /admin/search -- sirf andaz naya. Ctrl+K aur '/'.
 */
export function TopbarAnimatedSearch({ action, placeholder, lang }: { action: string; placeholder: string; lang: SearchLang }) {
  return (
    <form action={action} role="search" className="hidden max-w-md flex-1 items-center lg:flex">
      <AnimatedSearch
        shortcut
        lang={lang}
        placeholder={placeholder === "Search..." ? undefined : placeholder}
        inputProps={{ name: "q", type: "search" }}
      />
    </form>
  );
}
