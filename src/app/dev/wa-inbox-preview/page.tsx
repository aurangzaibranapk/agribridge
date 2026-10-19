import { notFound } from "next/navigation";
import { inboxPreviewAllowed } from "@/lib/whatsapp/inbox/flag";
import { applyFilter, filterCounts, parseFilter, type InboxLang } from "@/lib/whatsapp/inbox/model";
import { InboxShell } from "@/components/whatsapp-inbox/inbox-shell";
import { SAMPLE_CONVS, SAMPLE_MESSAGES, SAMPLE_NOW, SAMPLE_PARTY, SAMPLE_STAFF, SAMPLE_TEMPLATES } from "@/lib/whatsapp/inbox/fixtures";

export const dynamic = "force-dynamic";

/** DEV-ONLY preview (namoona data) -- production mein 404. Asal page wohi InboxShell chalata hai. */
export default function Preview({ searchParams }: { searchParams: { f?: string; c?: string; lang?: string; theme?: string; sheet?: string } }) {
  if (!inboxPreviewAllowed()) notFound();
  const lang = (["en", "rm", "ur"].includes(String(searchParams.lang)) ? searchParams.lang : "rm") as InboxLang;
  const filter = parseFilter(searchParams.f);
  const sel = SAMPLE_CONVS.find((c) => c.id === searchParams.c) ?? null;
  return (
    <div className={searchParams.theme === "dark" ? "dark" : ""}>
      <div className="min-h-screen bg-[#f4f6f3] p-0 dark:bg-[#0b1220]">
        <div className="flex">
          <aside className="hidden w-16 shrink-0 flex-col items-center gap-3 bg-[#e6ede4] py-3 text-lg dark:bg-[#0f1a30] md:flex" style={{ height: "100dvh" }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3f6b4a] text-xs font-extrabold text-white dark:bg-emerald-500 dark:text-[#06210f]">AB</span>
            <span>🏠</span><span className="rounded-xl bg-[#c9d9c5] p-1.5 dark:bg-[#1c2b4d]">💬</span><span>✅</span><span>🧾</span><span>🌾</span><span>👥</span>
          </aside>
          <main className="min-w-0 flex-1 p-0 [&_[data-testid=wa-inbox]]:h-[100dvh] [&_[data-testid=wa-inbox]]:rounded-none">
            <InboxShell key={sel?.id ?? "none"} lang={lang} filter={filter} search="" counts={filterCounts(SAMPLE_CONVS, "me")}
              conversations={applyFilter(SAMPLE_CONVS, filter, "me")} selected={sel} messages={sel ? SAMPLE_MESSAGES[sel.id] ?? [] : []}
              party={sel && sel.party_kind !== "unknown" ? SAMPLE_PARTY : null} templates={SAMPLE_TEMPLATES} staff={SAMPLE_STAFF}
              isAdmin now={SAMPLE_NOW} basePath="/dev/wa-inbox-preview" preview initialSheet={searchParams.sheet === "1"} />
          </main>
        </div>
      </div>
    </div>
  );
}
