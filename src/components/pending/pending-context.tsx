"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { pathAllowed } from "@/lib/access/route-match";
import {
  categoriesForPath, newArrivals, totals, type PendingCount, type PendingItem,
} from "@/lib/pending/categories";
import { PendingToast } from "@/components/pending/pending-toast";

/**
 * Ek hi poll poore admin ke liye (sidebar, mobile menu, ghanti, toast).
 * Har 60 second + tab par wapas aane par. fn_admin_pending_counts()
 * SECURITY INVOKER hai -- jo ginti aati hai wo isi bande ki RLS ki hai.
 *
 * 582 abhi live par na laga ho to RPC ghalti deta hai: phir `enabled=false`
 * aur sab kuch pehle jaisa (koi badge nahi, purani ghanti). Koi message,
 * WhatsApp ya email yahan se nahi jata -- toast sirf screen par.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

interface Ctx {
  enabled: boolean;
  counts: PendingCount[];
  refresh: () => Promise<void>;
  markSeen: (categories: string[]) => Promise<void>;
  loadItems: (limit?: number, category?: string | null) => Promise<PendingItem[]>;
}
const PendingCtx = createContext<Ctx>({
  enabled: false,
  counts: [],
  refresh: async () => {},
  markSeen: async () => {},
  loadItems: async () => [],
});

export const PENDING_POLL_MS = 60_000;
export const PENDING_PAGE = "/admin/my-work/pending";

export function PendingProvider({ allowedRoutes, active = true, children }: { allowedRoutes: string[] | null; active?: boolean; children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [counts, setCounts] = useState<PendingCount[]>([]);
  const [toast, setToast] = useState<{ item: PendingItem | null; category: string; n: number } | null>(null);
  const prevRef = useRef<PendingCount[] | null>(null);
  const pathname = usePathname();
  const allowedKey = allowedRoutes ? allowedRoutes.join("|") : "*";

  const rpc = useCallback((): Rpc => {
    const sb = createClient();
    return sb.rpc.bind(sb) as unknown as Rpc;
  }, []);

  const scope = useCallback(
    (rows: PendingCount[]) => (allowedRoutes ? rows.filter((r) => pathAllowed(allowedRoutes, r.route.split(/[?#]/, 1)[0])) : rows),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allowedKey]
  );

  const loadItems = useCallback(
    async (limit = 10, category: string | null = null) => {
      const { data, error } = await rpc()("fn_admin_pending_items", { p_limit: limit, p_category: category });
      if (error || !Array.isArray(data)) return [];
      const rows = data as PendingItem[];
      return allowedRoutes ? rows.filter((r) => pathAllowed(allowedRoutes, r.route)) : rows;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rpc, allowedKey]
  );

  const refresh = useCallback(async () => {
    const { data, error } = await rpc()("fn_admin_pending_counts");
    if (error || !Array.isArray(data)) {
      setEnabled(false);
      return;
    }
    const rows = scope(data as PendingCount[]);
    setEnabled(true);
    setCounts(rows);
    const arrived = newArrivals(prevRef.current, rows);
    prevRef.current = rows;
    if (arrived.length) {
      const cat = arrived[0];
      const n = rows.find((r) => r.category === cat)?.naya ?? 1;
      const list = await loadItems(200, cat);
      const newest = [...list].filter((i) => i.is_new).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
      setToast({ item: newest, category: cat, n: Number(n) || 1 });
    }
  }, [rpc, scope, loadItems]);

  const markSeen = useCallback(
    async (categories: string[]) => {
      if (!categories.length) return;
      await rpc()("fn_admin_pending_mark_seen", { p_categories: categories });
      await refresh();
    },
    [rpc, refresh]
  );

  useEffect(() => {
    if (!active) return;
    void refresh();
    const id = setInterval(() => void refresh(), PENDING_POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, active]);

  // Safha khula = us category ka "Naya" dekh liya (Pending wahi rehta hai).
  useEffect(() => {
    if (!enabled || !pathname || pathname.startsWith(PENDING_PAGE)) return;
    const cats = categoriesForPath(counts, pathname);
    if (cats.length) void markSeen(cats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, enabled]);

  const value = useMemo(() => ({ enabled, counts, refresh, markSeen, loadItems }), [enabled, counts, refresh, markSeen, loadItems]);
  return (
    <PendingCtx.Provider value={value}>
      {children}
      {toast && <PendingToast toast={toast} onClose={() => setToast(null)} />}
    </PendingCtx.Provider>
  );
}

export function usePending() {
  const ctx = useContext(PendingCtx);
  const sum = useMemo(() => totals(ctx.counts), [ctx.counts]);
  return { ...ctx, totals: sum };
}
