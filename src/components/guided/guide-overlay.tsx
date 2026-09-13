"use client";

import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, X, MapPin } from "lucide-react";

interface GuideStep {
  path: string;
  target: string | null;
  text: string;
}
interface Guide {
  key: string;
  title: string;
  steps: GuideStep[];
}

/**
 * Training Mode ka guide (274, malik ki priority 3): AI sirf "Stock par
 * jayein" na kahe -- asal button roshan ho aur "Next" aage le jaye.
 *
 * URL: ?guide=<module>&step=<n>. Har qadam ka safha aur (ho to) button ka
 * nishan (data-guide). Doosre safhe par hon to us safhe ka link roshan
 * hota hai aur "Wahan jayein" wahan le jata hai.
 */
export function GuideOverlay() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = sp.get("guide");
  const step = Math.max(1, Number(sp.get("step") ?? 1) || 1);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!key) {
      setGuide(null);
      return;
    }
    let alive = true;
    fetch(`/api/guide?key=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (alive) setGuide(g && Array.isArray(g.steps) ? g : null);
      })
      .catch(() => alive && setGuide(null));
    return () => {
      alive = false;
    };
  }, [key]);

  const cur = guide?.steps[step - 1] ?? null;
  const curPath = cur ? cur.path.split("?")[0] : null;
  const onPage = !!cur && pathname === curPath;

  const locate = useCallback(() => {
    if (!cur) return;
    let el: Element | null = null;
    if (onPage) {
      if (cur.target) el = document.querySelector(cur.target);
    } else {
      el = document.querySelector(`a[href="${cur.path}"]`) ?? document.querySelector(`a[href="${curPath}"]`) ?? document.querySelector(`a[href^="${curPath}?"]`);
    }
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      setMissing(false);
    } else {
      setRect(null);
      setMissing(onPage ? !!cur.target : true);
    }
  }, [cur, onPage, curPath]);

  useLayoutEffect(() => {
    if (!cur) return;
    locate();
    const t = setTimeout(locate, 400);
    const t2 = setTimeout(() => {
      if (!rect) locate();
    }, 1200);
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, pathname, locate]);

  useEffect(() => {
    if (!rect) return;
    const y = rect.top + window.scrollY;
    if (rect.top < 80 || rect.bottom > window.innerHeight - 160) window.scrollTo({ top: Math.max(0, y - 160), behavior: "smooth" });
  }, [rect?.top, rect?.left]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key || !guide || !cur) return null;

  const withGuide = (path: string, n: number) => {
    const [p, q] = path.split("?");
    const params = new URLSearchParams(q ?? "");
    params.set("guide", guide.key);
    params.set("step", String(n));
    return `${p}?${params.toString()}`;
  };
  const total = guide.steps.length;
  const next = () => {
    if (step < total) router.push(withGuide(guide.steps[step].path, step + 1));
    else router.push(`/admin/academy?done=${guide.key}`);
  };
  const prev = () => step > 1 && router.push(withGuide(guide.steps[step - 2].path, step - 1));
  const close = () => router.replace(pathname);
  const goThere = () => router.push(withGuide(cur.path, step));

  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] rounded-lg ring-4 ring-amber-400 ring-offset-2 ring-offset-white animate-pulse dark:ring-offset-surface-900"
          style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <div className="fixed bottom-4 right-4 z-[71] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-amber-300 bg-white p-3 text-sm shadow-xl dark:border-amber-700 dark:bg-surface-900">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {guide.title} · {step}/{total}
          </span>
          <button type="button" onClick={close} className="text-surface-400 hover:text-surface-700" aria-label="close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-surface-800 dark:text-surface-100">{cur.text}</p>
        {!onPage && (
          <p className="mt-1 flex items-center gap-1 text-xs text-surface-500">
            <MapPin className="h-3.5 w-3.5" /> {cur.path}
          </p>
        )}
        {onPage && missing && <p className="mt-1 text-xs text-surface-500">Button abhi is safhe par nazar nahi aa raha -- shayad pehle koi qatar chunni ho.</p>}
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={prev} disabled={step <= 1} className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs disabled:opacity-40 dark:border-surface-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Pichhla
          </button>
          {onPage ? (
            <button type="button" onClick={next} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
              {step < total ? "Next" : "Mukammal"} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button type="button" onClick={goThere} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
              Wahan jayein <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}
