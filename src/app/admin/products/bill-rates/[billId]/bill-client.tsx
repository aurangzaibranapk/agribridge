"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileText, Save, Search, ShoppingBag, Table2, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  applyBillRates,
  createPurchaseFromBill,
  deleteSupplierBill,
  saveBillLine,
  skipBillLine,
  type BillRateState,
} from "@/actions/supplier-bill-rates";
import { Card } from "@/components/ui/layout-primitives";
import { Badge, Button, Input, Label, Select } from "@/components/ui/form";
import { t, type Lang } from "@/lib/i18n/translations";
import { PaymentTermsFields } from "@/components/purchases/payment-terms-fields";

const initial: BillRateState = {};

interface BillFile {
  id: string;
  url: string;
  mime: string | null;
  pageNo: number;
  read: boolean;
  problem: string | null;
  linesFound: number | null;
}

interface Line {
  id: string;
  lineNo: number | null;
  pageNo: number | null;
  rawText: string | null;
  itemName: string | null;
  packSize: string | null;
  qty: number | null;
  rate: number | null;
  lineTotal: number | null;
  productId: string | null;
  matchSource: string | null;
  confidence: string | null;
  status: string;
  problem: string | null;
  appliedRate: number | null;
  /** Bill se wholesale rate bhi (319). Khali = ye rate mat chhuo. */
  wholesaleRate: number | null;
}

/**
 * Har khane ke saamne nishan (263): AI ne kya parha, us par kitna
 * bharosa. Ye hisaab safhe par hota hai, database mein nahi -- kyunke
 * banda khane badalta hai to nishan bhi usi waqt badalna chahiye.
 */
function fieldMarks(line: Line): { name: "ok" | "warn" | "none"; qty: "ok" | "warn" | "none"; rate: "ok" | "warn" | "none"; adds: boolean | null } {
  const src = line.matchSource ?? "";
  const name: "ok" | "warn" | "none" = !line.productId ? "none" : src.startsWith("fuzzy") ? "warn" : "ok";
  let adds: boolean | null = null;
  if (line.qty != null && line.rate != null && line.lineTotal != null) {
    const calc = line.qty * line.rate;
    adds = Math.abs(calc - line.lineTotal) <= Math.max(1, line.lineTotal * 0.01);
  }
  const low = line.confidence === "low";
  const qty: "ok" | "warn" | "none" = line.qty == null ? "none" : adds === false || low ? "warn" : "ok";
  const rate: "ok" | "warn" | "none" = line.rate == null ? "none" : adds === false || low ? "warn" : "ok";
  return { name, qty, rate, adds };
}

function Mark({ state, lang }: { state: "ok" | "warn" | "none"; lang: Lang }) {
  if (state === "ok") return <span className="ml-1 text-xs text-emerald-600" title={t("pf_bill_c_ok", lang)}>✓</span>;
  if (state === "warn") return <span className="ml-1 text-xs text-amber-600" title={t("pf_bill_c_warn", lang)}>⚠</span>;
  return <span className="ml-1 text-xs text-surface-400" title={t("pf_bill_c_none", lang)}>?</span>;
}

interface Product {
  id: string;
  name: string;
  packSize: string | null;
  purchasePrice: number;
  ratePending: boolean;
}

function Submit({ label, icon, variant }: { label: string; icon?: React.ReactNode; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={variant}>
      <span className="inline-flex items-center gap-1.5">
        {icon} {pending ? "…" : label}
      </span>
    </Button>
  );
}

function Msg({ state }: { state: BillRateState }) {
  if (state.error) return <p className="mt-2 text-sm text-red-700">{state.error}</p>;
  if (state.notice) return <p className="mt-2 text-sm text-emerald-700">{state.notice}</p>;
  return null;
}

/**
 * Product chunne ka khana.
 *
 * Poori fehrist ek select mein daalna aasan tha, magar hazaar products
 * mein se sahi wala dhoondna wahan haath se hota hai -- aur jaldi mein
 * upar neeche wala chun liya jata hai. Yahan likh kar dhoondte hain,
 * aur chuna hua naam saamne likha rehta hai.
 */
function ProductPicker({
  lang,
  name,
  products,
  defaultId,
  disabled,
}: {
  lang: Lang;
  name: string;
  products: Product[];
  defaultId: string | null;
  disabled?: boolean;
}) {
  const [chosen, setChosen] = useState<string | null>(defaultId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const chosenProduct = useMemo(() => products.find((p) => p.id === chosen) ?? null, [products, chosen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => `${p.name} ${p.packSize ?? ""}`.toLowerCase().includes(q))
      .slice(0, 25);
  }, [products, query]);

  return (
    <div>
      <input type="hidden" name={name} value={chosen ?? ""} />

      {chosenProduct ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-base font-medium text-emerald-900">
            {chosenProduct.name}
            {chosenProduct.packSize ? ` · ${chosenProduct.packSize}` : ""}
          </span>
          <span className="text-xs text-emerald-800">
            {chosenProduct.ratePending
              ? t("pf_bill_rate_was_none", lang)
              : t("pf_bill_rate_now", lang).replace("{rate}", chosenProduct.purchasePrice.toLocaleString())}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setOpen(true);
              }}
              className="ml-auto text-xs text-emerald-800 underline"
            >
              {t("pf_bill_change", lang)}
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-surface-400" />
            <input
              type="text"
              value={query}
              disabled={disabled}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              placeholder={t("pf_bill_search_product", lang)}
              className="w-full border-0 bg-transparent p-0 text-base outline-none placeholder:text-surface-400"
            />
          </div>

          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-surface-200 bg-white shadow-lg">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(p.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-surface-50"
                  >
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.packSize && <span className="text-xs text-surface-500">{p.packSize}</span>}
                    <span className="ml-auto text-xs text-surface-500">
                      {p.ratePending ? t("pf_bill_rate_pending_short", lang) : `Rs ${p.purchasePrice.toLocaleString()}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {open && query.trim().length > 1 && results.length === 0 && (
            <p className="mt-1 text-xs text-surface-500">
              {t("pf_bill_no_product", lang)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function LineRow({ lang, line, products, billDone }: { lang: Lang; line: Line; products: Product[]; billDone: boolean }) {
  const [saveState, saveAction] = useFormState(saveBillLine, initial);
  const [skipState, skipAction] = useFormState(skipBillLine, initial);

  const applied = line.status === "applied";
  const locked = applied || billDone;

  const marks = fieldMarks(line);
  return (
    <Card className={applied ? "border-emerald-200" : line.status === "ready" ? "border-amber-200" : undefined}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs text-surface-400">#{line.lineNo ?? "—"}</span>
        {line.pageNo != null && (
          <span className="text-xs text-surface-400">
            {t("pf_bill_page_label", lang).replace("{n}", String(line.pageNo))}
          </span>
        )}
        {/* Bill par jo likha tha, jyun ka tyun. Ye kabhi nahi badalta --
            baad mein "AI ne kya parha tha" ka jawab isi se milta hai. */}
        <span className="rounded bg-surface-100 px-2 py-0.5 font-mono text-xs text-surface-700">
          {line.rawText ?? "—"}
        </span>
        {line.confidence && !applied && (
          <Badge tone={line.confidence === "high" ? "green" : line.confidence === "medium" ? "gray" : "amber"}>
            {t(line.confidence === "high" ? "pf_bill_c_high" : line.confidence === "medium" ? "pf_bill_c_medium" : "pf_bill_c_low", lang)}
          </Badge>
        )}
        <span className="ml-auto">
          {applied ? (
            <Badge tone="green">{t("pf_bill_applied_badge", lang).replace("{rate}", line.appliedRate?.toLocaleString() ?? "—")}</Badge>
          ) : line.status === "ready" ? (
            <Badge tone="amber">{t("pf_ready", lang)}</Badge>
          ) : (
            <Badge tone="gray">{t("pf_bill_to_check", lang)}</Badge>
          )}
        </span>
      </div>

      {line.problem && (
        <p className="mb-2 flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {line.problem}
        </p>
      )}

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="line_id" value={line.id} />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Label htmlFor={`nm-${line.id}`}>{t("pf_bill_line_item", lang)}<Mark state={marks.name} lang={lang} /></Label>
            <Input
              id={`nm-${line.id}`}
              name="item_name"
              defaultValue={line.itemName ?? ""}
              disabled={locked}
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor={`qt-${line.id}`}>{t("pf_f_qty_in", lang)}<Mark state={marks.qty} lang={lang} /></Label>
            <Input
              id={`qt-${line.id}`}
              name="qty"
              type="number"
              step="0.001"
              min="0"
              defaultValue={line.qty ?? ""}
              disabled={locked}
              className="text-base"
            />
          </div>
          <div>
            <Label htmlFor={`rt-${line.id}`}>{t("pf_bill_line_rate", lang)}<Mark state={marks.rate} lang={lang} /></Label>
            <Input
              id={`rt-${line.id}`}
              name="rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={line.rate ?? ""}
              disabled={locked}
              placeholder={t("pf_bill_rate_ph", lang)}
              className="text-base"
            />
            {line.rate == null && !applied && (
              <p className="mt-1 text-xs text-amber-700">
                {t("pf_bill_rate_blank", lang)}
              </p>
            )}
            {marks.adds === false && !applied && (
              <p className="mt-1 text-xs text-amber-700">
                {t("pf_bill_c_not_adding", lang)
                  .replace("{calc}", ((line.qty ?? 0) * (line.rate ?? 0)).toLocaleString())
                  .replace("{total}", (line.lineTotal ?? 0).toLocaleString())}
              </p>
            )}
          </div>
          {/* Wholesale rate yahin -- bill charhte waqt sath hi lag jata
              hai (319). Pehle is ke liye har cheez alag se kholni parti
              thi; 14 qataron wale bill par 14 dafa. Wohi kaam jo koi
              nahi karta, aur phir wholesale rate purana hi chalta rehta
              hai (malik, 5 September). */}
          <div>
            <Label htmlFor={`ws-${line.id}`}>Wholesale rate</Label>
            <Input
              id={`ws-${line.id}`}
              name="wholesale_rate"
              type="number"
              step="0.01"
              min="0"
              defaultValue={line.wholesaleRate ?? ""}
              disabled={locked}
              placeholder="khali chhorein to na badle"
              className="text-base"
            />
            <p className="mt-1 text-xs text-surface-500">
              Khali chhor dein to is cheez ka purana wholesale rate waisa hi rahega.
            </p>
          </div>
        </div>

        <div>
          <Label>{t("pf_bill_which_product", lang)}</Label>
          <ProductPicker lang={lang} name="product_id" products={products} defaultId={line.productId} disabled={locked} />
          {line.matchSource === "auto_name" && !applied && (
            <p className="mt-1 text-xs text-amber-700">
              {t("pf_bill_auto_match", lang)}
            </p>
          )}
          {(line.matchSource ?? "").startsWith("fuzzy") && !applied && (
            <p className="mt-1 text-xs font-medium text-amber-800">
              {t("pf_bill_fuzzy_match", lang).replace("{score}", line.matchSource!.split(":")[1] ?? "?")}
            </p>
          )}
        </div>

        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            <Submit label={t("pf_save", lang)} icon={<Save className="h-4 w-4" />} variant="secondary" />
            <span className="text-xs text-surface-500">
              {line.lineTotal != null &&
                t("pf_bill_line_total", lang).replace("{amount}", line.lineTotal.toLocaleString())}
            </span>
          </div>
        )}
      </form>

      {!locked && (
        <form action={skipAction} className="mt-2">
          <input type="hidden" name="line_id" value={line.id} />
          <Submit label={t("pf_bill_drop_line", lang)} icon={<Trash2 className="h-4 w-4" />} variant="secondary" />
        </form>
      )}

      <Msg state={saveState} />
      <Msg state={skipState} />
    </Card>
  );
}

/**
 * Bill hatane ka button.
 *
 * Ye alag component is liye hai ke us ka apna form aur apni halat hai.
 * Poochhe baghair nahi mitta -- ek click se mit jane wali cheez wo hai
 * jise banda ghalti se daba deta hai.
 */
function DeleteBill({ lang, billId }: { lang: Lang; billId: string }) {
  const [state, action] = useFormState(deleteSupplierBill, initial);
  const { pending } = useFormStatus();

  if (state.success) {
    return (
      <Card className="border-emerald-200 bg-emerald-50">
        <p className="text-sm text-emerald-900">
          {state.notice}{" "}
          <Link href="/admin/products/bill-rates" className="underline">
            {t("pf_bill_all", lang)}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(t("pf_bill_del_confirm", lang))) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={billId} />
      {state.error && (
        <Card className="mb-2 border-red-200 bg-red-50">
          <p className="text-sm text-red-800">{state.error}</p>
        </Card>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        <Trash2 className="h-3.5 w-3.5" /> {t("pf_bill_del", lang)}
      </button>
    </form>
  );
}

export function BillClient({
  lang,
  billId,
  billStatus,
  source,
  files,
  billSupplierId,
  purchaseId,
  suppliers,
  branches,
  defaultBranchId,
  isAdminLevel,
  canDelete,
  billTotal,
  linesTotal,
  aiRead,
  lines,
  products,
}: {
  lang: Lang;
  billId: string;
  billStatus: string;
  source: string;
  files: BillFile[];
  billSupplierId: string | null;
  purchaseId: string | null;
  suppliers: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  defaultBranchId: string | null;
  isAdminLevel: boolean;
  canDelete: boolean;
  billTotal: number | null;
  linesTotal: number;
  aiRead: boolean;
  lines: Line[];
  products: Product[];
}) {
  const [applyState, applyAction] = useFormState(applyBillRates, initial);
  const [poState, poAction] = useFormState(createPurchaseFromBill, initial as BillRateState & { purchaseId?: string });
  const [showBill, setShowBill] = useState(true);

  const done = billStatus === "applied";
  const ready = lines.filter((l) => l.status === "ready").length;
  const draft = lines.filter((l) => l.status === "draft").length;
  const applied = lines.filter((l) => l.status === "applied").length;

  // Rs 1 tak ka farq gol karne ka hota hai; us se zyada ka matlab hai
  // koi qatar chhoot gayi.
  const mismatch =
    billTotal != null && linesTotal > 0 && Math.abs(billTotal - linesTotal) > 1
      ? Math.abs(billTotal - linesTotal)
      : null;

  return (
    <div className="space-y-4">
      {!aiRead && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">{t("pf_bill_ai_off", lang)}</p>
        </Card>
      )}

      {/* Jo bill kisi kaam ka na nikla, us ko qatar mein khara rehne dena
          sirf shor barhata hai. Magar jis se purchase ban chuki ho wo
          nahi mitta -- us ki rok action mein hai, yahan sirf button
          chhupa dena kaafi nahi hota. */}
      {canDelete && !purchaseId && !done && <DeleteBill lang={lang} billId={billId} />}

      {mismatch != null && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            {t("pf_bill_mismatch", lang)
              .replace("{lines}", linesTotal.toLocaleString())
              .replace("{total}", billTotal?.toLocaleString() ?? "—")
              .replace("{diff}", mismatch.toLocaleString())}
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-surface-600">
            {lines.length} {t("pf_rows", lang)} · <strong className="text-emerald-700">{ready} {t("pf_ready", lang)}</strong>
            {draft > 0 && ` · ${draft} ${t("pf_bill_to_check", lang)}`}
            {applied > 0 && ` · ${applied} ${t("pf_approved", lang)}`}
          </span>

          {source === "sheet" ? (
            <span className="inline-flex items-center gap-1 text-xs text-surface-500">
              <Table2 className="h-3.5 w-3.5" /> {t("pf_bill_from_sheet", lang)}
            </span>
          ) : (
            files.length > 0 && (
              <>
                <span className="text-xs text-surface-500">
                  {t("pf_bill_pages_n", lang).replace("{n}", String(files.length))}
                </span>
                <button
                  type="button"
                  onClick={() => setShowBill((v) => !v)}
                  className="text-xs text-surface-500 underline"
                >
                  {showBill ? t("pf_bill_hide_photo", lang) : t("pf_bill_show_photo", lang)}
                </button>
              </>
            )
          )}
        </div>

        {source === "sheet" && <p className="mt-2 text-xs text-surface-500">{t("pf_bill_no_photo", lang)}</p>}

        {/* Har file ka apna khana. Jo file parhi na ja saki us par
            wajah likhi jati hai -- khamoshi se chhoR dene par banda
            samajhta hai ke poora bill parh liya gaya. */}
        {showBill && source !== "sheet" && files.length > 0 && (
          <div className="mt-3 space-y-3">
            {files.map((f) => (
              <div key={f.id}>
                <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-surface-500">
                  <span>{t("pf_bill_page_label", lang).replace("{n}", String(f.pageNo))}</span>
                  {f.linesFound != null && <span>· {f.linesFound} {t("pf_rows", lang)}</span>}
                  <a href={f.url} target="_blank" rel="noreferrer" className="underline">
                    {t("pf_bill_open_file", lang)}
                  </a>
                </p>

                {f.problem && (
                  <p className="mb-1 flex items-start gap-1.5 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {f.problem}
                  </p>
                )}

                {f.mime === "application/pdf" ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-3 text-sm hover:bg-surface-50"
                  >
                    <FileText className="h-5 w-5 text-red-600" /> PDF
                  </a>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.url}
                    alt={t("pf_bill_page_label", lang).replace("{n}", String(f.pageNo))}
                    className="max-h-[28rem] w-full rounded-lg border border-surface-200 object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {lines.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-500">{t("pf_bill_no_lines", lang)}</p>
        </Card>
      ) : (
        lines.map((line) => <LineRow key={line.id} lang={lang} line={line} products={products} billDone={done} />)
      )}

      {!done && ready > 0 && (
        <>
          {/* ---- Pehla raasta: Purchase (malik ke naqshe ka qadam A) ----
              Wohi qatarein purchase (pending) ban jati hain aur rate bhi
              charh jate hain. Stock aur dena Receive par -- yahan nahi. */}
          <Card className="border-brand-200 bg-brand-50">
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-brand-900">
              <ShoppingBag className="h-4 w-4" /> {t("pf_po_title", lang)}
            </h3>
            <p className="mb-3 text-sm text-brand-900">{t("pf_po_note", lang).replace("{n}", String(ready))}</p>

            <form action={poAction} className="space-y-3">
              <input type="hidden" name="bill_id" value={billId} />

              <div className="grid gap-3 sm:grid-cols-2">
                {!billSupplierId && (
                  <div>
                    <Label htmlFor="po-sup">{t("pf_po_supplier", lang)}</Label>
                    <Select id="po-sup" name="supplier_id" defaultValue="" required className="w-full">
                      <option value="">{t("pf_src_pick_one", lang)}</option>
                      {suppliers.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-brand-800">{t("pf_po_supplier_req", lang)}</p>
                  </div>
                )}

                {isAdminLevel && (
                  <div>
                    <Label htmlFor="po-br">{t("pf_po_branch", lang)}</Label>
                    <Select id="po-br" name="branch_id" defaultValue={defaultBranchId ?? ""} required className="w-full">
                      <option value="">{t("pf_src_pick_one", lang)}</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              <PaymentTermsFields />

              <Submit label={t("pf_po_go", lang)} icon={<ShoppingBag className="h-4 w-4" />} />
            </form>

            {poState.error && <p className="mt-2 text-sm text-red-700">{poState.error}</p>}
            {poState.success && (
              <p className="mt-2 text-sm text-emerald-800">
                {poState.notice}{" "}
                {poState.purchaseId && (
                  <Link href="/admin/purchases" className="underline">
                    {t("pf_po_open", lang)}
                  </Link>
                )}
              </p>
            )}
          </Card>

          {/* ---- Doosra raasta: sirf rate. Jab bill sirf rate ki
              tasdeeq ke liye aaya ho, kharid ke liye nahi. ---- */}
          <Card>
            <p className="mb-2 text-sm text-surface-600">{t("pf_po_rates_only", lang)}</p>
            <form action={applyAction}>
              <input type="hidden" name="bill_id" value={billId} />
              <Submit
                label={t("pf_bill_apply_n", lang).replace("{n}", String(ready))}
                icon={<TrendingUp className="h-4 w-4" />}
                variant="secondary"
              />
            </form>
            <Msg state={applyState} />
          </Card>
        </>
      )}

      {done && (
        <Card className="border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900">
            {t("pf_bill_done", lang).replace("{n}", String(applied))}
            {purchaseId && (
              <>
                {" "}
                {t("pf_po_linked", lang)}{" "}
                <Link href="/admin/purchases" className="underline">
                  {t("pf_po_open", lang)}
                </Link>
              </>
            )}
          </p>
        </Card>
      )}
    </div>
  );
}
