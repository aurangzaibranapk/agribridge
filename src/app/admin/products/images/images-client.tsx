"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  checkImageModels,
  generateImageDraft,
  generateMissingImages,
  approveImageDraft,
  rejectImageDraft,
  type ImageState,
} from "@/actions/product-images";
import { Card } from "@/components/ui/layout-primitives";
import { Sparkles, Check, X, Package, AlertTriangle } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/translations";

const initial: ImageState = {};

interface MissingRow {
  product_id: string;
  name: string;
  pack_size: string | null;
  unit_code: string | null;
  is_branded: boolean;
  has_draft: boolean;
}

interface DraftRow {
  id: string;
  product_id: string;
  image_url: string;
  is_branded: boolean;
  model: string | null;
  generated_at: string;
  name: string;
  pack_size: string | null;
  current_image_url: string | null;
  current_is_real: boolean;
}

export function ProductImagesClient({
  lang,
  missingCount,
  missing,
  drafts,
}: {
  lang: Lang;
  /** NULL = ginti ho hi nahi saki. Sifar se ALAG. */
  missingCount: number | null;
  missing: MissingRow[];
  drafts: DraftRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">
            {t("pi_missing", lang)}
          </p>
          {/* Ginti na ho sake to "—". Sifar likh dena "sab ki tasveer lagi
              hui hai" kehna hai -- aur us bharose par koi dekhta hi
              nahi. */}
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {missingCount == null ? <span className="text-surface-400">—</span> : missingCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">
            {t("pi_drafts_open", lang)}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-surface-900 dark:text-white">
            {drafts.length}
          </p>
        </Card>
        <BulkCard lang={lang} />
      </div>

      {/* ---- Dekhne wale masode ---- */}
      <Card>
        <h2 className="mb-1 font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("pi_review", lang)}
        </h2>
        <p className="mb-3 text-xs text-surface-500">{t("pi_review_note", lang)}</p>

        {drafts.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-400">{t("pi_no_drafts", lang)}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drafts.map((d) => (
              <DraftCard key={d.id} draft={d} lang={lang} />
            ))}
          </div>
        )}
      </Card>

      {/* ---- Jin ki tasveer nahi ---- */}
      <Card>
        <h2 className="mb-1 font-display text-base font-semibold text-surface-900 dark:text-white">
          {t("pi_list", lang)}
        </h2>
        <p className="mb-3 text-xs text-surface-500">{t("pi_list_note", lang)}</p>

        {missing.length === 0 ? (
          <p className="py-6 text-center text-sm text-surface-400">{t("pi_none_missing", lang)}</p>
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {missing.map((m) => (
              <div key={m.product_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
                    {m.name}
                    {m.pack_size ? <span className="text-surface-400"> {m.pack_size}</span> : null}
                  </p>
                  {/* Naam wali cheez par saaf likha jata hai ke AI se asal
                      dabbe ki tasveer nahi maangi jayegi. */}
                  {m.is_branded && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" /> {t("pi_branded", lang)}
                    </p>
                  )}
                </div>
                {m.has_draft ? (
                  <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs text-surface-500 dark:bg-surface-800">
                    {t("pi_has_draft", lang)}
                  </span>
                ) : (
                  <OneButton productId={m.product_id} lang={lang} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function BulkCard({ lang }: { lang: Lang }) {
  const [state, formAction] = useFormState(generateMissingImages, initial);
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-surface-500">{t("pi_bulk", lang)}</p>
      <form action={formAction} className="mt-2 flex items-center gap-2">
        {/* Ek dafa mein 15 se zyada nahi. Har tasveer paisa aur waqt
            dono lagati hai; ek hi dabane par 300 banwa dena wo qadam hai
            jis ka nateeja bill aane tak nazar nahi aata. */}
        <input
          type="number"
          name="kitni"
          min={1}
          max={15}
          defaultValue={5}
          className="h-9 w-20 rounded-lg border border-surface-200 px-2 text-sm dark:border-surface-700 dark:bg-surface-800"
        />
        <BulkButton lang={lang} />
      </form>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
      {state.notice && <p className="mt-2 text-xs text-emerald-700">{state.notice}</p>}

      {/* Model ka naam pehle code mein haath se likha hua tha aur us
          chaabi par maujood nahi tha -- safha 404 deta raha. Google ke
          paighaam mein hi hal likha tha ("Call ModelService.ListModels"),
          magar wo sawal safhe par poocha hi nahi ja sakta tha. Ab poocha
          ja sakta hai. */}
      <ModelCheck />
    </Card>
  );
}

/** Kaunse model is chaabi par waqai maujood hain. Kuch badalta nahi. */
function ModelCheck() {
  const [state, formAction] = useFormState(checkImageModels, initial);
  return (
    <div className="mt-3 border-t border-surface-100 pt-2 dark:border-surface-800">
      <form action={formAction}>
        <CheckButton />
      </form>
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
      {state.notice && <p className="mt-2 text-xs text-surface-600 dark:text-surface-400">{state.notice}</p>}
      {state.models && (
        <div className="mt-2 space-y-1">
          {state.models.tasveerWale.length > 0 && (
            <p className="text-[11px] leading-relaxed text-emerald-800 dark:text-emerald-300">
              <strong>Tasveer bana sakte hain:</strong> {state.models.tasveerWale.join(", ")}
            </p>
          )}
          {state.models.baqi.length > 0 && (
            <p className="text-[11px] leading-relaxed text-surface-500">
              <strong>Baqi model (sirf likhai):</strong> {state.models.baqi.slice(0, 25).join(", ")}
              {state.models.baqi.length > 25 ? " …" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CheckButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-[11px] font-medium text-brand-700 hover:underline disabled:opacity-60 dark:text-brand-300"
    >
      {pending ? "poochh raha hoon…" : "Kaunse model chalte hain? (jaanchein)"}
    </button>
  );
}

function BulkButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Sparkles className="h-4 w-4" /> {pending ? t("pi_working", lang) : t("pi_generate", lang)}
    </button>
  );
}

function OneButton({ productId, lang }: { productId: string; lang: Lang }) {
  const [state, formAction] = useFormState(generateImageDraft, initial);
  return (
    <form action={formAction} className="flex flex-col items-end">
      <input type="hidden" name="product_id" value={productId} />
      <OneSubmit lang={lang} />
      {state.error && <span className="mt-1 max-w-xs text-right text-[11px] text-red-600">{state.error}</span>}
    </form>
  );
}

function OneSubmit({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-60 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-300"
    >
      <Sparkles className="h-3.5 w-3.5" /> {pending ? t("pi_working", lang) : t("pi_generate_one", lang)}
    </button>
  );
}

function DraftCard({ draft, lang }: { draft: DraftRow; lang: Lang }) {
  const [okState, okAction] = useFormState(approveImageDraft, initial);
  const [noState, noAction] = useFormState(rejectImageDraft, initial);
  const [replaceOk, setReplaceOk] = useState(false);

  return (
    <div className="overflow-hidden rounded-card border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="relative aspect-square bg-surface-50 dark:bg-surface-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={draft.image_url} alt={draft.name} className="h-full w-full object-contain p-2" loading="lazy" />
        {/* AI ki banayi hui tasveer par nishaan hamesha lagta hai --
            safhe par bhi aur database mein bhi. Bina nishaan ke wo asal
            tasveer ki tarah parhi jati hai. */}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-surface-600 shadow-sm dark:bg-surface-900/90 dark:text-surface-300">
          <Sparkles className="h-3 w-3" /> {t("pi_ai_made", lang)}
        </span>
      </div>

      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
          {draft.name}
          {draft.pack_size ? <span className="text-surface-400"> {draft.pack_size}</span> : null}
        </p>

        {draft.is_branded && (
          <p className="flex items-start gap-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {t("pi_branded_warn", lang)}
          </p>
        )}

        {draft.current_is_real && (
          <label className="flex items-start gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <input
              type="checkbox"
              checked={replaceOk}
              onChange={(e) => setReplaceOk(e.target.checked)}
              className="mt-0.5"
            />
            <span>{t("pi_replace_real", lang)}</span>
          </label>
        )}

        <div className="flex gap-2">
          <form action={noAction} className="flex-1">
            <input type="hidden" name="draft_id" value={draft.id} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-200 px-2 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-300"
            >
              <X className="h-3.5 w-3.5" /> {t("pi_reject", lang)}
            </button>
          </form>
          <form action={okAction} className="flex-1">
            <input type="hidden" name="draft_id" value={draft.id} />
            <input type="hidden" name="replace_ok" value={String(replaceOk)} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              <Check className="h-3.5 w-3.5" /> {t("pi_approve", lang)}
            </button>
          </form>
        </div>

        {(okState.error || noState.error) && (
          <p className="text-[11px] text-red-600">{okState.error || noState.error}</p>
        )}
      </div>
    </div>
  );
}
