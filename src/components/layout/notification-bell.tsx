"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

/**
 * Ghanti -- ab sirf adad nahi, khud ittila'at bhi.
 *
 * Malik ka aitraaz (4 September): ghanti par 7 likha aata tha, magar
 * click karne par ittila'at nahi khulti thin -- compact wali patti us
 * ko /admin/contact-messages par le ja rahi thi, jo bilkul doosri cheez
 * hai. Adad `notifications` se aata tha aur click kahin aur -- yani
 * ginti aur darwaza do alag cheezon ke the.
 *
 * Ab ek hi jagah se dono: click par wahi qatarein khulti hain jin ka
 * adad upar likha hai. Tarteeb bhi wohi jo maangi gayi: **pehle wo jo
 * parhi nahi gayin, phir parhi hui.** Nayi cheez neeche dab jaye to
 * ghanti bekar ho jati hai.
 *
 * "Parh li" ka nishan usi waqt lagta hai jab banda us par click kare --
 * khud ba khud nahi. Panel khulte hi sab ko parha hua likh dena wo
 * ittila mita deta hai jise banda ne dekha tak nahi.
 */

interface Item {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
}

function waqt(iso: string): string {
  const d = new Date(iso);
  const mint = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mint < 1) return "abhi";
  if (mint < 60) return `${mint} min`;
  if (mint < 1440) return `${Math.floor(mint / 60)} ghante`;
  return d.toLocaleDateString();
}

export function NotificationBell({ initialCount, href }: { initialCount: number; href: string }) {
  const lang = useLang();
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { count: liveCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false);
    setCount(liveCount ?? 0);
  }, []);

  useEffect(() => {
    const interval = setInterval(refreshCount, 45000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Bahar click ya Escape -- panel band.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setItems([]);
      return;
    }
    // Bina parhi hui pehle (is_read false = pehle), phir nayi se purani.
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, link_url, is_read, created_at")
      .eq("recipient_user_id", user.id)
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Item[]);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(null);
      void load();
      void refreshCount();
    }
  }

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setItems((cur) => (cur ?? []).map((i) => (i.id === id ? { ...i, is_read: true } : i)));
    setCount((c) => Math.max(0, c - 1));
  }

  async function markAll() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("recipient_user_id", user.id).eq("is_read", false);
    setItems((cur) => (cur ?? []).map((i) => ({ ...i, is_read: true })));
    setCount(0);
  }

  const unread = (items ?? []).filter((i) => !i.is_read);
  const read = (items ?? []).filter((i) => i.is_read);

  function Row({ item }: { item: Item }) {
    const body = (
      <>
        <p className={`text-sm ${item.is_read ? "text-surface-600 dark:text-surface-400" : "font-semibold text-surface-900 dark:text-white"}`}>
          {item.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-surface-500">{item.message}</p>
        <p className="mt-0.5 text-[11px] text-surface-400">{waqt(item.created_at)}</p>
      </>
    );

    const cls = `block w-full px-3 py-2.5 text-left transition hover:bg-surface-50 dark:hover:bg-surface-800 ${
      item.is_read ? "" : "border-l-2 border-l-brand-600 bg-brand-25 dark:bg-brand-950/20"
    }`;

    if (item.link_url) {
      return (
        <Link href={item.link_url} className={cls} onClick={() => { if (!item.is_read) void markRead(item.id); setOpen(false); }}>
          {body}
        </Link>
      );
    }
    return (
      <button type="button" className={cls} onClick={() => { if (!item.is_read) void markRead(item.id); }}>
        {body}
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={t("nbell_title", lang)}
        className="relative rounded-lg p-2 text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-surface-200 bg-white shadow-lg dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center justify-between border-b border-surface-200 px-3 py-2 dark:border-surface-800">
            <p className="text-sm font-semibold text-surface-900 dark:text-white">{t("nbell_title", lang)}</p>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline dark:text-brand-400"
              >
                <Check className="h-3 w-3" />
                {t("nbell_mark_all", lang)}
              </button>
            )}
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {items === null && <p className="px-3 py-6 text-center text-xs text-surface-400">{t("nbell_loading", lang)}</p>}
            {items !== null && items.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-surface-400">{t("nbell_none", lang)}</p>
            )}

            {unread.length > 0 && (
              <>
                <p className="bg-surface-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-surface-500 dark:bg-surface-800/50">
                  {t("nbell_unread", lang)} · {unread.length}
                </p>
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                  {unread.map((i) => (
                    <Row key={i.id} item={i} />
                  ))}
                </div>
              </>
            )}

            {read.length > 0 && (
              <>
                <p className="bg-surface-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-surface-500 dark:bg-surface-800/50">
                  {t("nbell_read", lang)}
                </p>
                <div className="divide-y divide-surface-100 dark:divide-surface-800">
                  {read.map((i) => (
                    <Row key={i.id} item={i} />
                  ))}
                </div>
              </>
            )}
          </div>

          <Link
            href={href}
            onClick={() => setOpen(false)}
            className="block border-t border-surface-200 px-3 py-2 text-center text-xs font-medium text-brand-700 hover:bg-surface-50 dark:border-surface-800 dark:text-brand-400 dark:hover:bg-surface-800"
          >
            {t("nbell_see_all", lang)}
          </Link>
        </div>
      )}
    </div>
  );
}
