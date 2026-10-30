"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";
import { assignLoginPlace, type PlaceActionState } from "@/actions/login-place";
import { GlassStyles } from "@/components/glass/glass-styles";
import { useFormState } from "@/lib/hooks/use-safe-form-state";
import { brandName } from "@/lib/brand";
import {
  branchRequired,
  describePlaceChange,
  keepsAllCustomerPortal,
  shopOptionLabel,
  shopsForBranch,
  validateLoginPlace,
  type PlaceBranch,
  type PlaceShop,
} from "@/lib/access/login-place";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: PlaceActionState = {};

function SaveButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="user-place-save"
      disabled={pending || disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

export function UserPlaceCard({
  userId,
  fullName,
  role,
  branchId: currentBranchId,
  shopId: currentShopId,
  branches,
  shops,
  initialOpen = false,
  previewMode = false,
}: {
  userId: string;
  fullName: string;
  role: string;
  branchId: string | null;
  shopId: string | null;
  branches: PlaceBranch[];
  shops: PlaceShop[];
  initialOpen?: boolean;
  previewMode?: boolean;
}) {
  const lang = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [branchId, setBranchId] = useState(currentBranchId ?? "");
  const [shopId, setShopId] = useState(currentShopId ?? "");
  const [state, formAction] = useFormState(assignLoginPlace, initialState);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const mustBranch = branchRequired(role);
  const shopChoices = shopsForBranch(shops, branchId || null, shopId || null);
  const error = previewError ?? state.error;
  const notice = previewNotice ?? state.notice;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!state.success || previewMode) return;
    router.refresh();
  }, [state.success, previewMode, router]);

  function openCard() {
    setBranchId(currentBranchId ?? "");
    setShopId(currentShopId ?? "");
    setPreviewError(null);
    setPreviewNotice(null);
    setOpen(true);
  }

  function onBranch(next: string) {
    setBranchId(next);
    setShopId((current) => {
      const allowed = shopsForBranch(shops, next || null, current || null);
      return allowed.some((shop) => shop.id === current) ? current : "";
    });
  }

  function onPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const verdict = validateLoginPlace({
      role,
      branchId: branchId || null,
      shopId: shopId || null,
      beforeBranchId: currentBranchId,
      beforeShopId: currentShopId,
      branches,
      shops,
    });
    if (!verdict.ok) {
      setPreviewError(verdict.error);
      setPreviewNotice(null);
      return;
    }
    const change = describePlaceChange({
      beforeBranchId: currentBranchId,
      beforeShopId: currentShopId,
      afterBranchId: verdict.branchId,
      afterShopId: verdict.shopId,
      branches,
      shops,
    });
    setPreviewError(null);
    setPreviewNotice(change.changed ? change.description : t("us_place_same", lang));
  }

  return (
    <>
      <button
        type="button"
        onClick={openCard}
        data-testid={`user-place-open-${userId}`}
        className="mt-1 rounded-lg border border-brand-200 bg-white/80 px-2 py-1 text-[11px] font-semibold text-brand-800 shadow-sm backdrop-blur hover:bg-white"
      >
        {t("us_place_open", lang)}
      </button>
      {open && mounted
        ? createPortal(
        <div
          className="fixed inset-0 z-[240] flex items-start justify-center overflow-y-auto bg-[#6d7f99]/40 px-4 py-10 backdrop-blur-[3px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <GlassStyles />
          <form
            action={previewMode ? undefined : formAction}
            onSubmit={previewMode ? onPreview : undefined}
            data-testid="user-place-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-place-title"
            className="gl-bg w-full max-w-md"
          >
            <div className="gl-panel relative p-6 sm:p-7">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("us_place_cancel", lang)}
                className="absolute right-4 top-4 rounded-full p-1 text-surface-500 hover:bg-white/70"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-300">{brandName(lang)}</p>
              <h2 id="user-place-title" className="mt-3 font-display text-xl font-semibold text-surface-900 dark:text-white">
                {t("us_place_title", lang)}
              </h2>
              <p className="mt-0.5 text-sm font-medium text-surface-700 dark:text-surface-200">{fullName}</p>
              <p className="mt-3 text-xs leading-relaxed text-surface-600 dark:text-surface-300">{t("us_place_rule", lang)}</p>

              <input type="hidden" name="user_id" value={userId} />

              <label className="mt-5 block text-xs font-semibold text-surface-700 dark:text-surface-200" htmlFor={`branch-${userId}`}>
                {t("us_place_branch", lang)}
              </label>
              <select
                id={`branch-${userId}`}
                name="branch_id"
                data-testid="user-place-branch"
                value={branchId}
                onChange={(event) => onBranch(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/80 bg-white/75 px-3 py-2.5 text-sm text-surface-800 outline-none backdrop-blur focus:border-brand-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
              >
                <option value="">{mustBranch ? t("us_place_pick", lang) : t("us_place_org_branch", lang)}</option>
                {branchId && !branches.some((branch) => branch.id === branchId) ? (
                  <option value={branchId}>{t("us_place_missing", lang)}</option>
                ) : null}
                {branches
                  .filter((branch) => branch.is_active !== false || branch.id === currentBranchId)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.is_active === false ? " (band)" : ""}
                    </option>
                  ))}
              </select>

              <label className="mt-4 block text-xs font-semibold text-surface-700 dark:text-surface-200" htmlFor={`shop-${userId}`}>
                {t("us_place_shop", lang)}
              </label>
              {!branchId ? (
                <p className="mt-1 text-xs text-surface-500" data-testid="user-place-shop-wait">
                  {t("us_pick_branch_first", lang)}
                </p>
              ) : (
                <>
                  <select
                    id={`shop-${userId}`}
                    name="shop_id"
                    data-testid="user-place-shop"
                    value={shopId}
                    onChange={(event) => setShopId(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/80 bg-white/75 px-3 py-2.5 text-sm text-surface-800 outline-none backdrop-blur focus:border-brand-500 dark:border-white/10 dark:bg-white/10 dark:text-white"
                  >
                    <option value="">{t("us_place_no_shop", lang)}</option>
                    {shopId && !shopChoices.some((shop) => shop.id === shopId) ? (
                      <option value={shopId}>{t("us_place_missing", lang)}</option>
                    ) : null}
                    {shopChoices.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shopOptionLabel(shop)}
                      </option>
                    ))}
                  </select>
                  {shopChoices.length === 0 ? (
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{t("us_place_empty_shops", lang)}</p>
                  ) : null}
                </>
              )}

              {keepsAllCustomerPortal(role) ? (
                <p className="gl-sec mt-4 px-3 py-2 text-xs leading-relaxed text-surface-700 dark:text-surface-200" data-testid="user-place-portal">
                  {t("us_place_portal", lang)}
                </p>
              ) : null}

              {error ? (
                <p className="mt-3 text-xs text-red-700" data-testid="user-place-error" role="alert">
                  {error}
                </p>
              ) : null}
              {notice ? (
                <p className="mt-3 text-xs font-medium text-emerald-800 dark:text-emerald-300" data-testid="user-place-notice">
                  {notice}
                </p>
              ) : null}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 rounded-2xl px-3 text-sm font-medium text-surface-600 hover:bg-white/60"
                >
                  {t("us_place_cancel", lang)}
                </button>
                <SaveButton label={t("us_place_save", lang)} disabled={false} />
              </div>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
