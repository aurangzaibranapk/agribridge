"use client";
import { useEffect, useRef } from "react";
import { nextFocusIndex } from "@/lib/portal/nav";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Phone drawer (role=dialog): khulte hi focus andar, Tab bahar nahi jata,
 * Esc band karta hai, peeche ka safha nahi hilta, band hone par focus wapas
 * usi button par.
 */
export function useDrawer(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = ref.current;
    const items = () => Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (items().find((el) => el.getAttribute("aria-current") === "page") ?? items()[0])?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const list = items();
      if (!list.length) return;
      e.preventDefault();
      const i = nextFocusIndex(list.indexOf(document.activeElement as HTMLElement), list.length, e.shiftKey);
      list[i]?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, close]);
  return ref;
}

/** Tab bar ka "More" drawer kholta hai -- dono alag components, is liye event. */
export const OPEN_MENU_EVENT = "portal:open-menu";
