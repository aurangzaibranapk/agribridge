"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createShop, updateShop, updateShopStatus, deleteShop, type ActionState } from "@/actions/shops";
import { EmptyState } from "@/components/ui/layout-primitives";
import { Store, Plus, Pencil, Trash2, Ban, Play, Power } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  karyana: "Karyana",
  agri_inputs: "Agri Inputs",
  grain_procurement: "Grain Procurement",
  dairy: "Dairy",
  machinery_fleet: "Machinery & Fleet",
};

interface Shop {
  id: string;
  name: string;
  code: string | null;
  business_type: string;
  branch_id: string;
  is_active: boolean;
  status: string;
  suspend_reason: string | null;
  suspended_at: string | null;
  branch_name?: string;
  /** null = ginti nahi ho saki (sifar nahi). */
  stock: number | null;
  staff: number | null;
  sales: number | null;
}

interface Branch {
  id: string;
  name: string;
}

export function ShopsListClient({ shops, branches }: { shops: Shop[]; branches: Branch[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [suspending, setSuspending] = useState<Shop | null>(null);
  const lang = useLang();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => {
              setEditing(null);
              setSuspending(null);
              setShowAdd(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            {t("sh_add_new", lang)}
          </button>
        </div>

        {shops.length === 0 ? (
          <EmptyState title={t("sh_none", lang)} description="Upar 'Nayi Shop Add Karein' se pehli shop banayein." />
        ) : (
          <div className="space-y-2">
            {shops.map((s) => (
              <ShopRow
                key={s.id}
                shop={s}
                onEdit={() => {
                  setShowAdd(false);
                  setSuspending(null);
                  setEditing(s);
                }}
                onSuspend={() => {
                  setShowAdd(false);
                  setEditing(null);
                  setSuspending(s);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showAdd ? (
        <AddShopForm branches={branches} onDone={() => setShowAdd(false)} />
      ) : editing ? (
        <EditShopForm shop={editing} branches={branches} onDone={() => setEditing(null)} />
      ) : suspending ? (
        <SuspendForm shop={suspending} onDone={() => setSuspending(null)} />
      ) : (
        <div className="rounded-card border border-dashed border-surface-200 bg-white p-6 text-center text-sm text-surface-400 dark:border-surface-800 dark:bg-surface-900">
          "Nayi Shop Add Karein" dabayein taake form khule.
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, lang }: { status: string; lang: any }) {
  const map: Record<string, string> = {
    active: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    inactive: "bg-surface-100 text-surface-500 dark:bg-surface-800 dark:text-surface-400",
    suspended: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  };
  const label: Record<string, string> = {
    active: t("sh_active", lang),
    inactive: t("sh_inactive", lang),
    suspended: t("sh_suspended", lang),
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? map.inactive}`}>
      {label[status] ?? status}
    </span>
  );
}

function ShopRow({ shop, onEdit, onSuspend }: { shop: Shop; onEdit: () => void; onSuspend: () => void }) {
  const lang = useLang();

  // Jis dukan ke peeche maal, bikri ya mulazim khaRe hon wo mit nahi
  // sakti (rok database par hai). Ye baat delete dabane se PEHLE dikhni
  // chahiye. Ginti hi na ho saki ho (null) to delete rok dete hain --
  // "pata nahi" par mitana wo qadam hai jo wapas nahi hota.
  const unknown = shop.stock === null || shop.staff === null || shop.sales === null;
  const busy = (shop.stock ?? 0) !== 0 || (shop.staff ?? 0) > 0 || (shop.sales ?? 0) > 0;
  const canDelete = !unknown && !busy;

  const bits: string[] = [];
  bits.push(shop.stock === null ? "maal —" : `maal ${shop.stock}`);
  bits.push(shop.sales === null ? "bikri —" : `bikri ${shop.sales}`);
  bits.push(shop.staff === null ? "mulazim —" : `mulazim ${shop.staff}`);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
            <Store className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-surface-900 dark:text-white">{shop.name}</p>
            <p className="text-xs text-surface-500">
              {shop.branch_name} · {BUSINESS_TYPE_LABELS[shop.business_type] ?? shop.business_type}
              {shop.code ? ` · ${shop.code}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-surface-400">{bits.join(" · ")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={shop.status} lang={lang} />

          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("sh_edit", lang)}
          </button>

          {shop.status === "active" ? (
            <StatusButton
              shopId={shop.id}
              status="inactive"
              label={t("sh_make_inactive", lang)}
              icon={<Power className="h-3.5 w-3.5" />}
            />
          ) : (
            <StatusButton
              shopId={shop.id}
              status="active"
              label={t("sh_make_active", lang)}
              icon={<Play className="h-3.5 w-3.5" />}
            />
          )}

          {shop.status !== "suspended" && (
            <button
              onClick={onSuspend}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              <Ban className="h-3.5 w-3.5" /> {t("sh_suspend", lang)}
            </button>
          )}

          <ShopDeleteButton shopId={shop.id} shopName={shop.name} disabled={!canDelete} />
        </div>
      </div>

      {shop.status === "suspended" && shop.suspend_reason && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {t("sh_suspended_since", lang)}
          {shop.suspended_at ? ` ${new Date(shop.suspended_at).toLocaleDateString("en-GB")}` : ""} — {shop.suspend_reason}
        </p>
      )}

      {!canDelete && (
        <p className="mt-2 text-xs text-surface-500">{t("sh_delete_locked", lang)}</p>
      )}
    </div>
  );
}

function StatusButton({
  shopId,
  status,
  label,
  icon,
}: {
  shopId: string;
  status: string;
  label: string;
  icon: React.ReactNode;
}) {
  const [state, formAction] = useFormState(updateShopStatus, initialState);
  return (
    <form action={formAction} className="inline-flex flex-col items-end">
      <input type="hidden" name="id" value={shopId} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-2.5 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
      >
        {icon} {label}
      </button>
      {state.error && <span className="mt-1 text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

/**
 * Dukan mitane ka button.
 *
 * Aam DeleteButton ghalti ka paighaam phenk deta hai. Yahan wo paighaam
 * hi asal cheez hai: database rok kar batata hai ke "is dukan ke godam
 * mein 2293 maal para hai". Wo baat na dikhe to banda samajhta hai
 * button toota hua hai, aur dobara dabata rehta hai.
 */
function ShopDeleteButton({ shopId, shopName, disabled }: { shopId: string; shopName: string; disabled: boolean }) {
  const [state, formAction] = useFormState(deleteShop, initialState);
  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-end"
      onSubmit={(e) => {
        if (!confirm(`"${shopName}" mitane lage hain. Ye wapas nahi aati. Theek hai?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={shopId} />
      <DeleteSubmit disabled={disabled} />
      {state.error && <span className="mt-1 max-w-xs text-right text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

function DeleteSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      <Trash2 className="h-3.5 w-3.5" /> {pending ? "..." : "Delete"}
    </button>
  );
}

function BusinessTypeOptions() {
  const lang = useLang();
  return (
    <>
      <option value="karyana">{t("sh_karyana", lang)}</option>
      <option value="agri_inputs">{t("sh_agri_inputs", lang)}</option>
      <option value="grain_procurement">{t("sh_grain", lang)}</option>
      <option value="dairy">{t("sh_dairy", lang)}</option>
      <option value="machinery_fleet">{t("sh_machinery", lang)}</option>
    </>
  );
}

function AddShopForm({ branches, onDone }: { branches: Branch[]; onDone: () => void }) {
  const [state, formAction] = useFormState(createShop, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onDone, 800);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 font-display text-sm font-semibold text-surface-900 dark:text-white">{t("sh_new", lang)}</h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <form action={formAction} className="space-y-2">
        <input name="name" required placeholder={t("sh_name_eg", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" />
        <select name="branch_id" required className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800">
          <option value="">- Branch Select Karein -</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="business_type" required className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800">
          <BusinessTypeOptions />
        </select>
        <input name="code" placeholder={t("sh_code_eg", lang)} className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800" />
        <SubmitButton label="Shop Banayein" />
      </form>
    </div>
  );
}

function EditShopForm({ shop, branches, onDone }: { shop: Shop; branches: Branch[]; onDone: () => void }) {
  const [state, formAction] = useFormState(updateShop, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onDone, 800);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h3 className="mb-3 font-display text-sm font-semibold text-surface-900 dark:text-white">
        {t("sh_edit_title", lang)}
      </h3>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      {/* key: ek dukan se doosri par jaate waqt form ke khane purane
          rah jate hain -- aur banda doosri dukan ka naam mehfooz kar
          baithta hai. */}
      <form key={shop.id} action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={shop.id} />
        <input
          name="name"
          required
          defaultValue={shop.name}
          placeholder={t("sh_name_eg", lang)}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
        />
        <select
          name="branch_id"
          required
          defaultValue={shop.branch_id}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
        >
          <option value="">- Branch Select Karein -</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          name="business_type"
          required
          defaultValue={shop.business_type}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
        >
          <BusinessTypeOptions />
        </select>
        <input
          name="code"
          defaultValue={shop.code ?? ""}
          placeholder={t("sh_code_eg", lang)}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
        />
        <div className="flex gap-2">
          <SubmitButton label={t("sh_save", lang)} />
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 dark:border-surface-700 dark:text-surface-300"
          >
            {t("sh_cancel", lang)}
          </button>
        </div>
      </form>
    </div>
  );
}

function SuspendForm({ shop, onDone }: { shop: Shop; onDone: () => void }) {
  const [state, formAction] = useFormState(updateShopStatus, initialState);
  const lang = useLang();
  if (state.success) setTimeout(onDone, 800);

  return (
    <div className="rounded-card border border-amber-200 bg-white p-4 shadow-card dark:border-amber-900/40 dark:bg-surface-900">
      <h3 className="mb-1 font-display text-sm font-semibold text-surface-900 dark:text-white">
        {t("sh_suspend_title", lang)} — {shop.name}
      </h3>
      <p className="mb-3 text-xs text-surface-500">{t("sh_suspend_note", lang)}</p>
      {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <form key={shop.id} action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={shop.id} />
        <input type="hidden" name="status" value="suspended" />
        <label className="block text-xs font-medium text-surface-600 dark:text-surface-300">
          {t("sh_suspend_reason", lang)}
        </label>
        <textarea
          name="suspend_reason"
          required
          rows={3}
          placeholder={t("sh_suspend_reason_eg", lang)}
          className="w-full rounded-lg border border-surface-200 p-2 text-sm dark:border-surface-700 dark:bg-surface-800"
        />
        <div className="flex gap-2">
          <SubmitButton label={t("sh_suspend", lang)} tone="amber" />
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-600 dark:border-surface-700 dark:text-surface-300"
          >
            {t("sh_cancel", lang)}
          </button>
        </div>
      </form>
    </div>
  );
}

function SubmitButton({ label, tone = "brand" }: { label: string; tone?: "brand" | "amber" }) {
  const { pending } = useFormStatus();
  const cls = tone === "amber" ? "bg-amber-600 hover:bg-amber-700" : "bg-brand-600 hover:bg-brand-700";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex-1 rounded-lg py-2 text-sm font-medium text-white disabled:opacity-60 ${cls}`}
    >
      {pending ? "..." : label}
    </button>
  );
}
