"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * AI ka jawab screen par -- saaf jumlon mein, nishanon ke baghair.
 *
 * Malik ka aitraaz (4 September): jawab mein `###`, `**` aur backtick
 * lafzi tor par nazar aa rahe the, aur andar khule URL. Wo ChatGPT ka
 * kachcha output lagta hai, karobari assistant nahi.
 *
 * Do cheezein sath ki gayin, aur jaan boojh kar dono:
 *
 *   1. AI ko hidayat di gayi ke ye nishan likhe hi na (work-coach.ts ka
 *      "JAWAB KA MEYAAR"). Asal ilaaj yehi hai.
 *   2. Yahan wo nishan phir bhi aa jayen to unhen chhupaya nahi jata --
 *      unhen un ki asal shakl di jati hai: sarkhi, moti likhai, fehrist.
 *      Sirf renderer laga kar masla dhaanp dena kaafi nahi hota, magar
 *      renderer ke baghair ek dafa ka bhi phisalna bande ko nazar aa
 *      jata hai.
 *
 * Aur raasta (/admin/...) ab khula URL nahi -- safhe ke NAAM wala button
 * ban jata hai. Naam `labels` se aata hai; na mile to raasta waise hi
 * rehta hai (ghalat naam likhne se khali chhoRna behtar hai).
 */

function stripMarks(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/, "")
    .trim();
}

/** Ek line ke andar: moti likhai, code aur raaste. */
function Inline({ text, labels }: { text: string; labels: Record<string, string> }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\/admin\/[A-Za-z0-9\-_/?=&.%]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("/admin/")) {
          const clean = p.replace(/[.,)]+$/, "");
          const label = labels[clean.split("?")[0]];
          return (
            <Link
              key={i}
              href={clean}
              className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-[12px] font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300"
            >
              {label ?? clean}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          );
        }
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-surface-900 dark:text-surface-100">
              {p.slice(2, -2)}
            </strong>
          );
        }
        if (p.startsWith("`") && p.endsWith("`")) return <span key={i}>{p.slice(1, -1)}</span>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function CoachMessage({ text, labels = {} }: { text: string; labels?: Record<string, string> }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];

  function flush(key: string) {
    if (bullets.length === 0) return;
    out.push(
      <ul key={key} className="my-1 space-y-0.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-[1px] text-brand-600">•</span>
            <span className="flex-1">
              <Inline text={b} labels={labels} />
            </span>
          </li>
        ))}
      </ul>
    );
    bullets = [];
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush(`u${idx}`);
      return;
    }
    // Fehrist: -, *, ✓, ✔ ya "1." se shuru
    const bullet = line.match(/^\s*(?:[-*•]|✓|✔|\d+[.)])\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flush(`u${idx}`);
    // Sarkhi: ### ... ya poori line moti likhai mein
    const heading = line.match(/^#{1,6}\s+(.*)$/) || line.match(/^\*\*(.+)\*\*:?$/);
    if (heading) {
      out.push(
        <p key={`h${idx}`} className="mt-2 font-semibold text-surface-900 first:mt-0 dark:text-surface-100">
          {stripMarks(heading[1])}
        </p>
      );
      return;
    }
    out.push(
      <p key={`p${idx}`} className="mt-1 first:mt-0">
        <Inline text={line} labels={labels} />
      </p>
    );
  });
  flush("uend");

  return <span className="block leading-relaxed">{out}</span>;
}
