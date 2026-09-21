"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  startCount,
  saveCounts,
  postCount,
  verifyCount,
  addExtraCountItem,
  renameProductFromCount,
  correctStockCountRate,
  type ActionState,
} from "@/actions/stock-count";
import { sendShortageToStaff } from "@/actions/stock-count-liability";
import { previewProductMerge, requestProductMerge } from "@/actions/product-merge";
import { saveMissingRates } from "@/actions/product-rates";
import { bestMatches, MATCH_STRONG } from "@/lib/product-match";
import { EyeOff, AlertTriangle, PlusCircle, X, Pencil, Check, Save, Merge, Tag } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

const initialState: ActionState = {};

function rs(v: number): string {
  return `Rs ${Math.round(v).toLocaleString()}`;
}

function Submit({ label, variant = "brand" }: { label: string; variant?: "brand" | "amber" }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  const colour =
    variant === "amber"
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-brand-600 hover:bg-brand-700";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${colour}`}
    >
      {pending ? t("sc_waiting", lang) : label}
    </button>
  );
}

function Feedback({ state }: { state: ActionState | undefined }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-400">
        {state.message}
      </p>
    );
  }
  return null;
}

export function StartCountForm({ warehouses }: { warehouses: { id: string; name: string }[] }) {
  const lang = useLang();
  const [state, formAction] = useFormState(startCount, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400">
          {t("sc_which_warehouse", lang)}
        </span>
        <select
          name="warehouse_id"
          required
          className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
        >
          <option value="">{t("sc_pick", lang)}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </label>
      <Feedback state={state} />
      <Submit label={t("sc_start_count", lang)} />
    </form>
  );
}

/**
 * Ginti ka safha -- yahan system ka adad kahin NAHI hai, na screen par,
 * na HTML mein. Hidden field mein bhej dena bhi kaafi nahi hota: page ka
 * source dekh kar adad mil jata hai.
 */
type CountLine = {
  id: string;
  productId: string;
  productName: string;
  unit: string | null;
  packSize: string | null;
  counted: number | null;
  salePrice: number | null;
  tradePrice: number | null;
  saleRatePending: boolean;
  tradeRatePending: boolean;
};

export function CountingSheet({
  countId,
  lines,
  canEditRates,
}: {
  countId: string;
  lines: CountLine[];
  canEditRates: boolean;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(saveCounts, initialState);
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.counted != null ? String(l.counted) : ""]))
  );
  // Jo cheez gin li gayi (khali nahi) wo "baqi" wali list se hat kar
  // neeche "gin li gayin" mein chali jati hai -- taake bhari fehrist mein
  // se sirf wohi bache jo abhi karni hain (14 September, malik ki maang).
  const [doneIds, setDoneIds] = useState<Set<string>>(
    () => new Set(lines.filter((l) => l.counted != null).map((l) => l.id))
  );

  // Duplicate ke liye system khud dekhta hai, staff ko poori list
  // chhaan kar dhoondna nahi paRta (malik, 14 September) -- wohi milaan
  // ka tareeqa jo bill/sheet ke naam catalogue se milata hai (product-
  // match.ts). Jis naam ka doosre naam se score STRONG (0.8+) ho, wo
  // sujhaav ban jata hai -- staff ko sirf tasdeeq karni hoti hai.
  const duplicateSuggestions = useMemo(() => {
    const others = lines.map((l) => ({ id: l.id, name: l.productName }));
    const map = new Map<string, { name: string; score: number }>();
    for (const l of lines) {
      const candidates = others.filter((o) => o.id !== l.id);
      const [top] = bestMatches(l.productName, null, candidates, 1);
      if (top && top.score >= MATCH_STRONG) {
        map.set(l.id, { name: top.item.name, score: top.score });
      }
    }
    return map;
  }, [lines]);

  function handleValueChange(id: string, v: string) {
    setValues((prev) => ({ ...prev, [id]: v }));
  }
  function handleBlur(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (values[id]?.trim()) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Har qatar apna alag "abhi mehfooz karein" button rakhti hai (malik,
  // 14 September) -- ginti khatam hone tak intezar nahi karna, jo cheez
  // gin li wo isi waqt bach jati hai, aakhri "Save" button ke bharose
  // nahi rehna paRta.
  function CountCell({ l }: { l: CountLine }) {
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [saveMsg, setSaveMsg] = useState("");
    const value = values[l.id] ?? "";

    async function handleSave() {
      if (!value.trim()) return;
      setSaveStatus("saving");
      const fd = new FormData();
      fd.set("count_id", countId);
      fd.set(`qty_${l.id}`, value);
      const result = await saveCounts({}, fd);
      if (result.error) {
        setSaveStatus("error");
        setSaveMsg(result.error);
      } else {
        setSaveStatus("saved");
        setSaveMsg("");
        setDoneIds((prev) => new Set(prev).add(l.id));
      }
    }

    return (
      <div>
        <div className="flex items-center justify-end gap-1.5">
          <input
            name={`qty_${l.id}`}
            type="number"
            min={0}
            step="0.001"
            inputMode="decimal"
            value={value}
            onChange={(e) => {
              handleValueChange(l.id, e.target.value);
              setSaveStatus("idle");
            }}
            onBlur={() => handleBlur(l.id)}
            placeholder="—"
            className="w-full rounded-lg border border-surface-300 px-2 py-1.5 text-right text-sm dark:border-surface-700 dark:bg-surface-900"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!value.trim() || saveStatus === "saving"}
            title={t("sc_save_row", lang)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border disabled:opacity-40 ${
              saveStatus === "saved"
                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
                : saveStatus === "error"
                  ? "border-red-300 text-red-600 dark:border-red-800"
                  : "border-surface-300 text-surface-500 hover:border-brand-400 hover:text-brand-600 dark:border-surface-700"
            }`}
          >
            {saveStatus === "saving" ? (
              <span className="text-xs">…</span>
            ) : saveStatus === "saved" ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
          </button>
        </div>
        {saveStatus === "error" && <p className="mt-1 text-right text-xs text-red-600">{saveMsg}</p>}
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const pending = lines.filter((l) => !doneIds.has(l.id) && (!q || l.productName.toLowerCase().includes(q)));
  const done = lines.filter((l) => doneIds.has(l.id));

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-surface-100 px-3 py-2.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300">
        <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {t("sc_hidden_note", lang)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-surface-500">
          {t("sc_total_items", lang)}: {lines.length} · {t("sc_remaining", lang)}: {lines.length - done.length}
        </p>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("sc_search_item", lang)}
        className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-900"
      />

      {/* Ginti karte waqt hi "kuch mila jo list mein nahi" darj karna hai
          -- is liye button upar wali (baqi) list ke sath hi rahe, sab
          bhar jane tak neeche scroll na karna paRe (malik, 14 September). */}
      <ExtraItemForm countId={countId} />

    <form action={formAction} className="space-y-3">
      <input type="hidden" name="count_id" value={countId} />

      <div className="overflow-hidden rounded-card border border-surface-200 dark:border-surface-800">
        <table className="w-full text-sm">
          <thead className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-900">
            <tr>
              <th className="w-10 px-4 py-2 text-right font-medium">#</th>
              <th className="px-4 py-2 font-medium">{t("sc_item", lang)}</th>
              <th className="w-44 px-4 py-2 text-right font-medium">{t("sc_you_counted", lang)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
            {pending.map((l, i) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-right text-xs tabular-nums text-surface-400">{i + 1}</td>
                <td className="px-4 py-2">
                  <ProductNameCell productId={l.productId} name={l.productName} otherNames={lines.map((x) => x.productName)} suggestedDuplicate={duplicateSuggestions.get(l.id)} />
                  {(l.packSize || l.unit) && (
                    <span className="block text-xs text-surface-400">
                      {[l.packSize, l.unit].filter(Boolean).join(" • ")}
                    </span>
                  )}
                  {canEditRates && (
                    <RateCell productId={l.productId} saleRatePending={l.saleRatePending} tradeRatePending={l.tradeRatePending} />
                  )}
                </td>
                <td className="px-4 py-2">
                  <CountCell l={l} />
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-surface-400">
                  {q ? t("sc_no_match", lang) : t("sc_all_done", lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {done.length > 0 && (
        <div className="overflow-hidden rounded-card border border-green-200 dark:border-green-900">
          <p className="border-b border-green-200 bg-green-50 px-4 py-2 text-xs font-medium text-green-800 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400">
            {t("sc_counted_done", lang)}: {done.length}
          </p>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {done.map((l) => (
              <div key={l.id} className="flex items-center gap-2 px-4 py-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1 truncate text-sm text-surface-600 dark:text-surface-400">
                  <ProductNameCell productId={l.productId} name={l.productName} otherNames={lines.map((x) => x.productName)} suggestedDuplicate={duplicateSuggestions.get(l.id)} />
                  {canEditRates && (
                    <RateCell productId={l.productId} saleRatePending={l.saleRatePending} tradeRatePending={l.tradeRatePending} />
                  )}
                </div>
                <div className="w-40">
                  <CountCell l={l} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Feedback state={state} />
      <Submit label={t("sc_save_counts", lang)} />
    </form>
    </div>
  );
}

/**
 * Naam theek karna -- ginti se bahar jane ki zaroorat nahi (14
 * September). Yahan `<form>` istemal nahi ho sakta (ye row us bade
 * `<form>` ke andar hai jo poori ginti save karta hai, aur ek form
 * doosre ke andar nahi ja sakta) -- is liye action seedha function ki
 * tarah bulaya jata hai, apna FormData khud bana kar.
 */
function ProductNameCell({
  productId,
  name,
  otherNames,
  suggestedDuplicate,
}: {
  productId: string;
  name: string;
  otherNames?: string[];
  suggestedDuplicate?: { name: string; score: number };
}) {
  const lang = useLang();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<ActionState>({});

  if (!editing) {
    return (
      <div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setValue(name);
              setFeedback({});
              setEditing(true);
            }}
            className="group flex items-center gap-1.5 text-left text-surface-800 dark:text-surface-200"
          >
            {name}
            <Pencil className="h-3 w-3 shrink-0 text-surface-300 group-hover:text-brand-600" />
          </button>
          <MergeButton productId={productId} name={name} otherNames={otherNames ?? []} suggestedTarget={suggestedDuplicate?.name} />
        </div>
        {suggestedDuplicate && (
          <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
            {t("sc_maybe_duplicate", lang)} &quot;{suggestedDuplicate.name}&quot;?
          </p>
        )}
      </div>
    );
  }

  async function save() {
    if (value.trim().length < 2) {
      setFeedback({ error: t("sc_rename_short", lang) });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set("product_id", productId);
    fd.set("new_name", value.trim());
    const result = await renameProductFromCount({}, fd);
    setSaving(false);
    setFeedback(result);
    if (result.success) setEditing(false);
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        className="rounded-lg border border-brand-400 px-2 py-1 text-sm dark:bg-surface-900"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-50"
        aria-label={t("sc_rename_save", lang)}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-200 text-surface-400 dark:border-surface-700"
        aria-label={t("sc_extra_close", lang)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {feedback.error && <span className="text-xs text-red-600">{feedback.error}</span>}
    </div>
  );
}

/**
 * Duplicate product ko doosre (asal) naam mein milane ki tajweez (malik,
 * 14 September): "koi product nikalni ho to request ho jaye ... us ke
 * against stock ho to duplicate naam par chala jaye, stock duplicate na
 * ho". Do qadam: pehle preview (kitna stock, kis naam mein), phir
 * "Tajweez bhejein" -- amal (stock hilana + purana naam hataana) sirf
 * Admin/Owner ki tasdeeq par hota hai, yahan kuch nahi badalta.
 */
function MergeButton({
  productId,
  name,
  otherNames,
  suggestedTarget,
}: {
  productId: string;
  name: string;
  otherNames: string[];
  suggestedTarget?: string;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [targetName, setTargetName] = useState(suggestedTarget ?? "");
  const [previewState, setPreviewState] = useState<Awaited<ReturnType<typeof previewProductMerge>>>({});
  const [previewBusy, setPreviewBusy] = useState(false);
  const [requestState, setRequestState] = useState<Awaited<ReturnType<typeof requestProductMerge>>>({});
  const [requestBusy, setRequestBusy] = useState(false);
  const listId = `sc-merge-names-${productId}`;

  if (requestState.success) {
    return <span className="text-xs text-green-700 dark:text-green-400">{requestState.message}</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setTargetName(suggestedTarget ?? "");
          setOpen(true);
        }}
        title={t("sc_merge_open", lang)}
        className={suggestedTarget ? "text-amber-500 hover:text-amber-700" : "text-surface-300 hover:text-brand-600"}
      >
        <Merge className="h-3 w-3" />
      </button>
    );
  }

  // Nested <form> ke andar <form> HTML mein ghalat hai (ye row us bade
  // <form> ke andar hai jo poori ginti save karta hai) -- seedha action
  // ko function ki tarah bulaya ja raha hai, <form action=...> se nahi.
  async function handlePreview() {
    setPreviewBusy(true);
    const fd = new FormData();
    fd.set("source_product_id", productId);
    fd.set("target_name", targetName);
    setPreviewState(await previewProductMerge({}, fd));
    setPreviewBusy(false);
  }

  async function handleRequest() {
    if (!previewState.preview) return;
    setRequestBusy(true);
    const fd = new FormData();
    fd.set("source_product_id", productId);
    fd.set("target_product_id", previewState.preview.targetProductId);
    setRequestState(await requestProductMerge({}, fd));
    setRequestBusy(false);
  }

  return (
    <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 p-2 text-xs dark:border-surface-700 dark:bg-surface-900">
      <p className="mb-1 text-surface-500">{t("sc_merge_note", lang)}</p>
      <div className="flex items-center gap-1">
        <input
          list={listId}
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          placeholder={t("sc_merge_target", lang)}
          className="w-40 rounded-lg border border-surface-300 px-2 py-1 dark:border-surface-700 dark:bg-surface-900"
        />
        <datalist id={listId}>
          {otherNames
            .filter((n) => n !== name)
            .map((n) => (
              <option key={n} value={n} />
            ))}
        </datalist>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewBusy}
          className="rounded-lg border border-surface-300 px-2 py-1 text-surface-600 hover:border-brand-400 disabled:opacity-50 dark:border-surface-700"
        >
          {previewBusy ? "…" : t("sc_merge_check", lang)}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-surface-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {previewState.error && <p className="mt-1 text-red-600">{previewState.error}</p>}

      {previewState.preview && (
        <div className="mt-1.5 rounded-lg bg-amber-50 p-1.5 dark:bg-amber-950/20">
          <p className="text-amber-800 dark:text-amber-400">
            {t("sc_merge_will_move", lang)} <b>{previewState.preview.totalQty}</b> → &quot;{previewState.preview.targetName}&quot;
          </p>
          {previewState.preview.rows.length > 0 && (
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/70">
              {previewState.preview.rows.map((r) => `${r.warehouseName}: ${r.qty}`).join(", ")}
            </p>
          )}
          <button
            type="button"
            onClick={handleRequest}
            disabled={requestBusy}
            className="mt-1 rounded-lg bg-brand-600 px-2 py-1 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {requestBusy ? "…" : t("sc_merge_send", lang)}
          </button>
        </div>
      )}
      {requestState.error && <p className="mt-1 text-red-600">{requestState.error}</p>}
    </div>
  );
}

/**
 * Rate Baqi -- ginti ke dauran hi bhar dena (malik, 14 September:
 * "yahan bhi sath sath rate hona chahiye jo add kar sakein"). Sirf
 * jahan asal mein khali ho (sale ya trade), aur sirf Owner/Admin/
 * Warehouse ke liye -- rate wahi ijazat hai jo /admin/products/rates-baqi
 * par hai, ginti se bahar jane ki zaroorat nahi paRti.
 */
function RateCell({
  productId,
  saleRatePending,
  tradeRatePending,
}: {
  productId: string;
  saleRatePending: boolean;
  tradeRatePending: boolean;
}) {
  const lang = useLang();
  const [sale, setSale] = useState("");
  const [trade, setTrade] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  if (!saleRatePending && !tradeRatePending) return null;
  if (status === "saved") {
    return <p className="mt-0.5 text-[11px] text-green-700 dark:text-green-400">{t("sc_rate_saved", lang)}</p>;
  }

  async function handleSave() {
    if (!sale.trim() && !trade.trim()) return;
    setStatus("saving");
    const fd = new FormData();
    fd.set("id", productId);
    if (sale.trim()) fd.set(`sale_${productId}`, sale.trim());
    if (trade.trim()) fd.set(`trade_${productId}`, trade.trim());
    const result = await saveMissingRates({}, fd);
    if (result.error) {
      setStatus("error");
      setMsg(result.error);
    } else {
      setStatus("saved");
    }
  }

  return (
    <div className="mt-1 flex items-center gap-1">
      <Tag className="h-3 w-3 shrink-0 text-amber-500" />
      {saleRatePending && (
        <input
          value={sale}
          onChange={(e) => setSale(e.target.value)}
          type="number"
          min={0}
          step="0.01"
          placeholder={t("sc_rate_sale", lang)}
          className="w-20 rounded-lg border border-amber-300 px-1.5 py-0.5 text-[11px] dark:border-amber-800 dark:bg-surface-900"
        />
      )}
      {tradeRatePending && (
        <input
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          type="number"
          min={0}
          step="0.01"
          placeholder={t("sc_rate_trade", lang)}
          className="w-20 rounded-lg border border-amber-300 px-1.5 py-0.5 text-[11px] dark:border-amber-800 dark:bg-surface-900"
        />
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={status === "saving" || (!sale.trim() && !trade.trim())}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-amber-300 text-amber-600 hover:bg-amber-50 disabled:opacity-40 dark:border-amber-800"
        title={t("sc_save_row", lang)}
      >
        <Save className="h-3 w-3" />
      </button>
      {status === "error" && <span className="text-[11px] text-red-600">{msg}</span>}
    </div>
  );
}

/**
 * Ginti ke dauran koi cheez mile jo list mein nahi thi (14 September).
 * Naam se milan pehle hota hai -- mile to usi ka stock badhta hai, na
 * mile to naya product ban jata hai. Rate khali chhoRa ja sakta hai --
 * "Rate Baqi" ki fehrist mein khud pahunch jayega.
 */
interface ExtraRow {
  id: number;
  name: string;
  quantity: string;
  rate: string;
}

function blankRow(id: number): ExtraRow {
  return { id, name: "", quantity: "", rate: "" };
}

function ExtraItemForm({ countId }: { countId: string }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(addExtraCountItem, initialState);
  const nextId = useRef(1);
  const [rows, setRows] = useState<ExtraRow[]>([blankRow(0)]);

  // Kaam ho jaye to fehrist khaali kar dete hain -- taake wahi qatarein
  // dobara na chali jayen agar banda ek aur cheez darj karna chahe.
  useEffect(() => {
    if (state.success) setRows([blankRow(nextId.current++)]);
  }, [state.success]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
      >
        <PlusCircle className="h-4 w-4" /> {t("sc_extra_open", lang)}
      </button>
    );
  }

  function updateRow(id: number, field: "name" | "quantity" | "rate", value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, blankRow(nextId.current++)]);
  }
  function removeRow(id: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));
  }

  const itemsJson = JSON.stringify(
    rows
      .filter((r) => r.name.trim() && r.quantity.trim())
      .map((r) => ({
        name: r.name.trim(),
        quantity: Number(r.quantity),
        purchasePrice: r.rate.trim() === "" ? null : Number(r.rate),
      }))
  );

  return (
    <div className="rounded-lg border border-dashed border-surface-300 p-3 dark:border-surface-700">
      <p className="mb-2 text-sm font-medium text-surface-900 dark:text-white">{t("sc_extra_title", lang)}</p>
      <p className="mb-3 text-xs text-surface-500">{t("sc_extra_note", lang)}</p>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="count_id" value={countId} />
        <input type="hidden" name="items" value={itemsJson} />

        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_120px_120px_auto]">
              <input
                value={r.name}
                onChange={(e) => updateRow(r.id, "name", e.target.value)}
                placeholder={t("sc_extra_name", lang)}
                className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
              <input
                value={r.quantity}
                onChange={(e) => updateRow(r.id, "quantity", e.target.value)}
                type="number"
                min={0}
                step="0.001"
                placeholder={t("sc_extra_qty", lang)}
                className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
              <input
                value={r.rate}
                onChange={(e) => updateRow(r.id, "rate", e.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder={t("sc_extra_rate", lang)}
                className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm dark:border-surface-700 dark:bg-surface-900"
              />
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                disabled={rows.length === 1}
                className="flex items-center justify-center rounded-lg border border-surface-200 px-2 text-surface-400 hover:text-red-600 disabled:opacity-30 dark:border-surface-700"
                aria-label={t("sc_extra_remove_row", lang)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <PlusCircle className="h-3.5 w-3.5" /> {t("sc_extra_add_row", lang)}
        </button>

        <div>
          <ExtraSubmit label={t("sc_extra_add", lang)} />
        </div>
      </form>
      <Feedback state={state} />
      <button type="button" onClick={() => setOpen(false)} className="mt-2 text-xs text-surface-400 underline">
        {t("sc_extra_close", lang)}
      </button>
    </div>
  );
}

function ExtraSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "…" : label}
    </button>
  );
}

/**
 * "Extra Item" se joRi gayi cheez ka rate kabhi ulta likha jata hai
 * (malik, 15 September: "rate ki jagah quantity, quantity ki jagah
 * rate") -- ye seedha Milan ke journal entry mein chala jata hai, is
 * liye Owner/Admin ko yahin se theek karne ka raasta chahiye. Sirf
 * Owner/Admin ko dikhta hai (canApprove) -- staff yahan tak Review par
 * aata bhi nahi.
 */
function RateCorrectionCell({ lineId, unitCost }: { lineId: string; unitCost: number }) {
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(String(unitCost));
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  if (status === "saved") {
    return (
      <p className="rounded-lg border border-green-300 bg-green-50 px-1.5 py-1 text-[11px] font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
        ✓ Saved — {msg}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[10px] text-surface-400 underline hover:text-brand-600">
        Rate: {rs(unitCost)} — ghalat hai?
      </button>
    );
  }

  // Nested <form> ke andar <form> HTML mein ghalat hai (ye poora khana
  // pehle se ReviewSheet ke apne <form> ke andar hai) -- browser is se
  // "unexpectedly submitted" error deta hai aur click kaam nahi karta.
  // Isi liye seedha action ko function ki tarah bulaya ja raha hai,
  // <form action=...> se nahi (jaisa RateCell/MergeButton yahi karte hain).
  async function handleSave() {
    setStatus("saving");
    const fd = new FormData();
    fd.set("line_id", lineId);
    fd.set("new_rate", rate);
    fd.set("note", note);
    const result = await correctStockCountRate({}, fd);
    if (result.error) {
      setStatus("error");
      setMsg(result.error);
    } else {
      setStatus("saved");
      setMsg(result.message ?? "");
    }
  }

  return (
    <div className="mt-1 w-48 space-y-1 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-1.5 text-left dark:border-amber-800 dark:bg-amber-950/10">
      <input
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        type="number"
        min={0}
        step="0.01"
        placeholder="Sahi rate"
        className="w-full rounded-lg border border-amber-300 px-1.5 py-1 text-xs dark:border-amber-800 dark:bg-surface-900"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Wajah (jaise: rate ulta likha gaya tha)"
        className="w-full rounded-lg border border-amber-300 px-1.5 py-1 text-xs dark:border-amber-800 dark:bg-surface-900"
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-lg bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700 disabled:opacity-40"
        >
          {status === "saving" ? "…" : "Theek Karein"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-surface-400">
          Cancel
        </button>
      </div>
      {status === "error" && <p className="text-[11px] text-red-600">{msg}</p>}
    </div>
  );
}

/**
 * Milaan ka safha -- ab dono adad saamne hain, aur har farq par wajah
 * maangi jati hai.
 */
export function ReviewSheet({
  countId,
  lines,
  status,
  canVerify,
  canApprove,
}: {
  countId: string;
  lines: {
    id: string;
    productName: string;
    unit: string | null;
    expected: number | null;
    counted: number | null;
    difference: number | null;
    unitCost: number;
    reason: string | null;
  }[];
  /** 'counting' | 'verified'. */
  status: string;
  /** Branch Manager: sirf apni branch ki tasdeeq -- final post nahi. */
  canVerify: boolean;
  canApprove: boolean;
}) {
  const lang = useLang();
  const [postState, postAction] = useFormState(postCount, initialState);
  const [verifyState, verifyAction] = useFormState(verifyCount, initialState);
  const [staffState, staffAction] = useFormState(sendShortageToStaff, initialState);
  const state = canApprove ? postState : verifyState;
  const gaps = lines.filter((l) => (l.difference ?? 0) !== 0);
  const matched = lines.length - gaps.length;
  const hasShortage = gaps.some((l) => (l.difference ?? 0) < 0);
  // Tasdeeq ke baad reason ke khane already bhare/lock -- dobara wajah
  // maangna Manager se ho chuka kaam dobara karwana hota.
  const readOnlyReasons = status === "verified" && !canApprove;

  const canAct = canApprove || canVerify;
  const formAction = canApprove ? postAction : verifyAction;

  return (
    <form action={canAct ? formAction : undefined} className="space-y-3">
      <input type="hidden" name="count_id" value={countId} />

      <p className="text-sm text-surface-600 dark:text-surface-400">
        {matched} {t("sc_matched", lang)}
        {gaps.length > 0 && ` ${gaps.length} ${t("sc_gaps_note", lang)}`}
      </p>

      {gaps.length > 0 && (
        <div className="overflow-hidden rounded-card border border-red-200 dark:border-red-900">
          <table className="w-full text-sm">
            <thead className="border-b border-red-200 bg-red-50 text-left text-xs text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t("sc_item", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_expected", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_found", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_difference", lang)}</th>
                <th className="px-3 py-2 text-right font-medium">Rate</th>
                <th className="px-3 py-2 text-right font-medium">{t("sc_worth", lang)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100 dark:divide-red-900/40">
              {gaps.map((l) => {
                const diff = l.difference ?? 0;
                const value = diff * l.unitCost;
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2">
                      <span className="text-surface-800 dark:text-surface-200">{l.productName}</span>
                      <input
                        name={`reason_${l.id}`}
                        required={!readOnlyReasons}
                        readOnly={readOnlyReasons}
                        minLength={5}
                        maxLength={255}
                        defaultValue={l.reason ?? ""}
                        placeholder={t("sc_what_happened", lang)}
                        className="mt-1 w-full rounded-lg border border-surface-300 px-2 py-1 text-xs read-only:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:read-only:bg-surface-800"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-500">{l.expected}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-900 dark:text-white">
                      {l.counted}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium tabular-nums ${
                        diff < 0 ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      {diff > 0 ? "+" : ""}
                      {diff}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="tabular-nums text-surface-700 dark:text-surface-300">{rs(l.unitCost)}</span>
                      {canApprove && (
                        <div className="mt-1">
                          <RateCorrectionCell lineId={l.id} unitCost={l.unitCost} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">{rs(Math.abs(value))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-surface-500">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("sc_post_note", lang)}
      </p>

      {canAct ? (
        <>
          <Feedback state={state} />
          <div className="flex flex-wrap items-center gap-2">
            <Submit
              label={canApprove ? t("sc_finish_review", lang) : t("sc_verify_review", lang)}
              variant={gaps.length > 0 ? "amber" : "brand"}
            />
            {canApprove && hasShortage && (
              <button
                type="submit"
                formAction={staffAction}
                className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-surface-900 dark:text-amber-400"
              >
                Kami Sale Staff ke khate mein bhejein
              </button>
            )}
          </div>
          {staffState?.error && <p className="text-xs text-red-600">{staffState.error}</p>}
          {staffState?.success && <p className="text-xs text-green-700 dark:text-green-400">{staffState.message}</p>}
        </>
      ) : (
        <p className="rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-600 dark:bg-surface-800 dark:text-surface-400">
          {status === "verified" ? t("sc_waiting_post", lang) : t("sc_waiting_verify", lang)}
        </p>
      )}
    </form>
  );
}
